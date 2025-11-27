const path = require('path');
const fs = require('fs').promises;
const { db } = require('../database/db');
const { generateThumbnail } = require('./imageProcessor');
const { generatePhotoFilename } = require('../utils/filenameSanitizer');
const { processUploadedVideo, isVideoMimeType } = require('./videoProcessor');

// Get storage path from environment or default
const getStoragePath = () => process.env.STORAGE_PATH || path.join(__dirname, '../../../storage');

function normalizeFiles(files) {
  // Handle null, undefined, or falsy values
  if (!files) {
    console.log('[normalizeFiles] No files provided');
    return [];
  }

  // Handle arrays
  if (Array.isArray(files)) {
    const validFiles = files.filter(Boolean);
    console.log(`[normalizeFiles] Normalized ${validFiles.length} files from array`);
    return validFiles;
  }

  // Handle iterable objects (some multer configurations)
  try {
    if (typeof files === 'object' && typeof files[Symbol.iterator] === 'function') {
      const validFiles = Array.from(files).filter(Boolean);
      console.log(`[normalizeFiles] Normalized ${validFiles.length} files from iterable`);
      return validFiles;
    }
  } catch (err) {
    console.warn('[normalizeFiles] Failed to iterate files object:', err.message);
  }

  // Handle plain objects (multer fieldname mapping)
  if (typeof files === 'object') {
    try {
      const validFiles = Object.values(files)
        .flatMap((value) => (Array.isArray(value) ? value : [value]))
        .filter(Boolean);
      console.log(`[normalizeFiles] Normalized ${validFiles.length} files from object`);
      return validFiles;
    } catch (err) {
      console.warn('[normalizeFiles] Failed to process files object:', err.message);
      return [];
    }
  }

  // Unexpected type
  console.warn('[normalizeFiles] Unexpected files type:', typeof files);
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
        const fileInfo = JSON.stringify({
          originalname: file?.originalname,
          mimetype: file?.mimetype,
          size: file?.size,
          availableKeys: Object.keys(file || {})
        });
        throw new Error(`Uploaded file is missing a temporary path. File info: ${fileInfo}`);
      }

      // Verify temp file exists before copying
      try {
        await fs.access(tempPath);
      } catch (accessErr) {
        console.error(`Temp file not accessible: ${tempPath}`, {
          originalname: file?.originalname,
          error: accessErr.message
        });
        throw new Error(`Uploaded file not found at temporary location: ${tempPath}`);
      }

      // Use copyFile and unlink instead of rename to avoid cross-device issues
      try {
        await fs.copyFile(tempPath, newPath);
        console.log(`Successfully copied ${file.originalname} to ${newPath}`);
      } catch (copyErr) {
        console.error(`Failed to copy file from ${tempPath} to ${newPath}:`, copyErr);
        throw new Error(`Failed to copy uploaded file: ${copyErr.message}`);
      } finally {
        // Clean up temp file with better error handling
        try {
          await fs.unlink(tempPath);
          console.log(`Cleaned up temp file: ${tempPath}`);
        } catch (unlinkErr) {
          // Only warn if file exists but couldn't be deleted
          // ENOENT means file was already deleted, which is fine
          if (unlinkErr?.code !== 'ENOENT') {
            console.warn(`Failed to clean up temp upload ${tempPath}:`, {
              error: unlinkErr.message,
              code: unlinkErr.code
            });
          }
        }
      }
      
      // Determine if this is a video or image
      const isVideo = isVideoMimeType(file.mimetype);
      const mediaType = isVideo ? 'video' : 'image';

      // Generate thumbnail and extract metadata
      let thumbnailPath;
      let videoMetadata = null;

      if (isVideo) {
        // Process video: extract metadata and generate thumbnail
        const thumbnailDir = path.join(getStoragePath(), 'thumbnails');
        await fs.mkdir(thumbnailDir, { recursive: true });
        const videoThumbnailPath = path.join(thumbnailDir, `thumb_${newFilename.replace(/\.[^.]+$/, '.jpg')}`);

        const result = await processUploadedVideo(newPath, videoThumbnailPath);
        videoMetadata = result.metadata;
        thumbnailPath = path.relative(getStoragePath(), videoThumbnailPath);
      } else {
        // Process image: generate thumbnail
        thumbnailPath = await generateThumbnail(newPath);
      }

      // Calculate relative paths
      const storagePath = getStoragePath();
      const relativePath = path.relative(path.join(storagePath, 'events/active'), newPath);
      const relativeThumbPath = thumbnailPath; // thumbnailPath is already relative to storage root

      // Add to database with uploaded_by field and media metadata
      let insertResult;
      const clientName = trx?.client?.config?.client;
      const supportsReturning = ['pg', 'postgres', 'postgresql'].includes(clientName);

      const photoData = {
        event_id: eventId,
        filename: newFilename,
        path: relativePath,
        thumbnail_path: relativeThumbPath,
        type: photoType,
        size_bytes: file.size,
        uploaded_by: uploadedBy,
        source_origin: 'managed',
        media_type: mediaType,
        mime_type: file.mimetype
      };

      // Add video-specific metadata if applicable
      if (isVideo && videoMetadata) {
        photoData.duration = videoMetadata.duration;
        photoData.video_codec = videoMetadata.videoCodec;
        photoData.audio_codec = videoMetadata.audioCodec;
        photoData.width = videoMetadata.width;
        photoData.height = videoMetadata.height;
      }

      if (supportsReturning) {
        insertResult = await trx('photos')
          .insert(photoData)
          .returning('id');
      } else {
        insertResult = await trx('photos').insert(photoData);
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

      console.log(`Successfully processed file ${file.originalname} (ID: ${photoId})`);
    } catch (error) {
      console.error(`Error processing file ${file.originalname}:`, {
        error: error.message,
        stack: error.stack,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        tempPath: file?.path || file?.filepath || file?.tempFilePath
      });

      if (trx) {
        try {
          await trx.rollback();
        } catch (rollbackErr) {
          console.error('Failed to rollback transaction:', rollbackErr);
        }
      }

      // Continue with other files
      // Note: Individual file failures don't stop the entire upload batch
    }
  }
  
  return uploadedPhotos;
}

module.exports = {
  processUploadedPhotos
};
