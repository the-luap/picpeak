const path = require('path');
const fs = require('fs').promises;
const { db } = require('../database/db');
const { generateThumbnail } = require('./imageProcessor');
const { generatePhotoFilename } = require('../utils/filenameSanitizer');

// Get storage path from environment or default
const getStoragePath = () => process.env.STORAGE_PATH || path.join(__dirname, '../../../storage');

function normalizeFiles(files) {
  if (!files) return [];
  if (Array.isArray(files)) return files.filter(Boolean);

  // Multer may expose files as an iterable object
  if (typeof files[Symbol.iterator] === 'function') {
    return Array.from(files).filter(Boolean);
  }

  if (typeof files === 'object') {
    return Object.values(files)
      .flatMap((value) => (Array.isArray(value) ? value : [value]))
      .filter(Boolean);
  }

  return [];
}

async function processUploadedPhotos(files, eventId, uploadedBy = 'admin', categoryId = null) {
  const uploadedPhotos = [];
  const fileList = normalizeFiles(files);

  if (fileList.length === 0) {
    return uploadedPhotos;
  }

  // Get event details
  const event = await db('events').where({ id: eventId }).first();
  if (!event) {
    throw new Error('Event not found');
  }
  
  // Process each file
  for (const file of fileList) {
    const trx = await db.transaction();
    
    try {
      // Count existing photos to generate sequence number
      let counter = 1;
      let photoType = 'individual'; // default type
      
      // If categoryId is provided and matches photo types, use it as type
      if (categoryId === 'collage') {
        photoType = 'collage';
      }
      
      // Count existing photos of the same type for numbering
      const existingCount = await trx('photos')
        .where({ event_id: eventId, type: photoType })
        .count('id as count')
        .first();

      const existingCountValue = Number(existingCount?.count ?? 0);
      counter = existingCountValue + 1;
      
      // Generate new filename
      const extension = path.extname(file.originalname);
      const categoryName = photoType === 'collage' ? 'collages' : 'individual';
      const newFilename = generatePhotoFilename(
        event.event_name,
        categoryName,
        counter,
        extension
      );
      
      // Move file to event folder
      const destPath = path.join(getStoragePath(), 'events/active', event.slug);
      await fs.mkdir(destPath, { recursive: true });
      
      const newPath = path.join(destPath, newFilename);
      const tempPath = file?.path || file?.filepath || file?.tempFilePath;

      if (!tempPath) {
        throw new Error('Uploaded file is missing a temporary path');
      }

      // Use copyFile and unlink instead of rename to avoid cross-device issues
      try {
        await fs.copyFile(tempPath, newPath);
      } finally {
        try {
          await fs.unlink(tempPath);
        } catch (unlinkErr) {
          if (unlinkErr?.code !== 'ENOENT') {
            console.warn(`Failed to clean up temp upload ${tempPath}:`, unlinkErr);
          }
        }
      }
      
      // Generate thumbnail
      const thumbnailPath = await generateThumbnail(newPath);
      
      // Calculate relative paths
      const storagePath = getStoragePath();
      const relativePath = path.relative(path.join(storagePath, 'events/active'), newPath);
      const relativeThumbPath = thumbnailPath; // thumbnailPath is already relative to storage root
      
      // Add to database with uploaded_by field
      let insertResult;
      const clientName = trx?.client?.config?.client;
      const supportsReturning = ['pg', 'postgres', 'postgresql'].includes(clientName);

      if (supportsReturning) {
        insertResult = await trx('photos')
          .insert({
            event_id: eventId,
            filename: newFilename,
            path: relativePath,
            thumbnail_path: relativeThumbPath,
            type: photoType,
            size_bytes: file.size,
            uploaded_by: uploadedBy,
            source_origin: 'managed'
          })
          .returning('id');
      } else {
        insertResult = await trx('photos').insert({
          event_id: eventId,
          filename: newFilename,
          path: relativePath,
          thumbnail_path: relativeThumbPath,
          type: photoType,
          size_bytes: file.size,
          uploaded_by: uploadedBy,
          source_origin: 'managed'
        });
      }

      const insertedId = Array.isArray(insertResult)
        ? (insertResult[0]?.id ?? insertResult[0])
        : insertResult;

      const photoId = typeof insertedId === 'object' ? insertedId.id : insertedId;

      if (photoId === undefined || photoId === null) {
        throw new Error('Failed to determine inserted photo ID');
      }

      // Commit transaction
      await trx.commit();
      
      uploadedPhotos.push({
        id: photoId,
        filename: newFilename,
        size: file.size,
        type: photoType
      });
    } catch (error) {
      console.error(`Error processing file ${file.originalname}:`, error);
      if (trx) await trx.rollback();
      // Continue with other files
    }
  }
  
  return uploadedPhotos;
}

module.exports = {
  processUploadedPhotos
};
