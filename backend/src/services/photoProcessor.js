const path = require('path');
const fs = require('fs').promises;
const { db } = require('../database/db');
const { generateThumbnail } = require('./imageProcessor');
const { generatePhotoFilename } = require('../utils/filenameSanitizer');

// Get storage path from environment or default
const getStoragePath = () => process.env.STORAGE_PATH || path.join(__dirname, '../../../storage');

async function processUploadedPhotos(files, eventId, uploadedBy = 'admin', categoryId = null) {
  const uploadedPhotos = [];
  
  // Get event details
  const event = await db('events').where({ id: eventId }).first();
  if (!event) {
    throw new Error('Event not found');
  }
  
  // Process each file
  for (const file of files) {
    const trx = await db.transaction();
    
    try {
      // Get category info if provided
      let category = null;
      let counter = 1;
      const parsedCategoryId = categoryId ? parseInt(categoryId) : null;
      
      if (parsedCategoryId) {
        // Get category and update counter
        category = await trx('photo_categories')
          .where({ id: parsedCategoryId })
          .first();
        
        if (category) {
          counter = (category.photo_counter || 0) + 1;
          await trx('photo_categories')
            .where({ id: parsedCategoryId })
            .update({ photo_counter: counter });
        }
      } else {
        // For uncategorized photos, count existing uncategorized photos
        const uncategorizedCount = await trx('photos')
          .where({ event_id: eventId })
          .whereNull('category_id')
          .count('id as count')
          .first();
        
        counter = (uncategorizedCount.count || 0) + 1;
      }
      
      // Generate new filename
      const extension = path.extname(file.originalname);
      const newFilename = generatePhotoFilename(
        event.event_name,
        category ? category.name : 'uncategorized',
        counter,
        extension
      );
      
      // Move file to event folder
      const destPath = path.join(getStoragePath(), 'events/active', event.slug);
      await fs.mkdir(destPath, { recursive: true });
      
      const newPath = path.join(destPath, newFilename);
      // Use copyFile and unlink instead of rename to avoid cross-device issues
      await fs.copyFile(file.path, newPath);
      await fs.unlink(file.path);
      
      // Generate thumbnail
      const thumbnailPath = await generateThumbnail(newPath);
      
      // Calculate relative paths
      const storagePath = getStoragePath();
      const relativePath = path.relative(path.join(storagePath, 'events/active'), newPath);
      const relativeThumbPath = thumbnailPath; // thumbnailPath is already relative to storage root
      
      // Add to database with uploaded_by field
      const [photoId] = await trx('photos').insert({
        event_id: eventId,
        filename: newFilename,
        path: relativePath,
        thumbnail_path: relativeThumbPath,
        category_id: parsedCategoryId || null,
        type: 'individual',
        size_bytes: file.size,
        uploaded_by: uploadedBy
      });
      
      // Commit transaction
      await trx.commit();
      
      uploadedPhotos.push({
        id: photoId,
        filename: newFilename,
        size: file.size,
        category_id: parsedCategoryId || null,
        uploaded_by: uploadedBy
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