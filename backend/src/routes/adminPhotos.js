const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { db, logActivity } = require('../database/db');
const { adminAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { generateThumbnail, ensureThumbnail, extractCaptureDate } = require('../services/imageProcessor');
const { processUploadedVideo, isVideoMimeType } = require('../services/videoProcessor');
const { generatePhotoFilename } = require('../utils/filenameSanitizer');
const { escapeLikePattern } = require('../utils/sqlSecurity');
const { validateUploadedFiles } = require('../middleware/uploadValidation');
const { getMaxFilesPerUpload, getAllowedMimeTypes } = require('../services/uploadSettings');
const { processUploadedPhotos } = require('../services/photoProcessor');
const chunkedUpload = require('../services/chunkedUploadService');
const watermarkGeneratorService = require('../services/watermarkGeneratorService');
const { requireEventOwnership } = require('../middleware/ownership');
const router = express.Router();

// Get storage path from environment or default
const getStoragePath = () => process.env.STORAGE_PATH || path.join(__dirname, '../../../storage');

// Configure multer for file uploads
// IMPORTANT: Using synchronous functions to prevent file corruption
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    console.log('Multer destination called for file:', file.originalname);
    const { eventId } = req.params;
    
    // We'll validate the event exists in the route handler
    // For now, just create a temp destination
    const tempPath = path.join(getStoragePath(), 'temp', `upload_${Date.now()}_${Math.random().toString(36).substring(7)}`);
    
    // Create directory synchronously
    require('fs').mkdirSync(tempPath, { recursive: true });
    console.log('Temp destination path:', tempPath);
    
    // Store temp path for cleanup
    req.tempUploadPath = tempPath;
    
    cb(null, tempPath);
  },
  filename: (req, file, cb) => {
    console.log('Multer filename called for file:', file.originalname);
    // Use a simple temporary filename
    const tempName = `temp_${Date.now()}_${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    console.log('Temp filename:', tempName);
    cb(null, tempName);
  }
});

const { validateFileType, createFileUploadValidator } = require('../utils/fileSecurityUtils');

// Create a multer instance that uses dynamically resolved allowed MIME types.
// The allowed types are fetched from the database once per request (before multer
// processes files) and attached to req.allowedMimeTypes so that the fileFilter
// callback can read them synchronously.
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 * 1024, // 10GB limit per file to support large videos
    files: 2000, // Hard safety ceiling; actual limit enforced dynamically
    fieldSize: 10 * 1024 * 1024, // 10MB for non-file fields
    parts: 10000,
    headerPairs: 2000
  },
  fileFilter: (req, file, cb) => {
    // req.allowedMimeTypes is populated by the middleware that runs before multer
    const allowedMimeTypes = req.allowedMimeTypes || ['image/jpeg', 'image/png', 'image/webp'];

    if (validateFileType(file.originalname, file.mimetype, allowedMimeTypes)) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type. Check allowed file types in system settings.'));
    }
  },
  abortOnLimit: true
});

// Middleware to resolve allowed MIME types from settings before multer runs
const resolveAllowedTypes = async (req, res, next) => {
  try {
    req.allowedMimeTypes = await getAllowedMimeTypes();
  } catch (error) {
    console.error('Failed to resolve allowed MIME types:', error);
    req.allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
  }
  next();
};

// Dynamic content validator middleware that reads allowed types from req
const validateUploadContent = async (req, res, next) => {
  const allowedTypes = req.allowedMimeTypes || ['image/jpeg', 'image/png', 'image/webp'];
  const validator = createFileUploadValidator({
    allowedTypes,
    maxFileSize: 10 * 1024 * 1024 * 1024, // 10GB to support large videos
    validateContent: true
  });
  return validator(req, res, next);
};

// Request timeout middleware for uploads
const uploadTimeout = (timeout = 300000) => { // 5 minutes default
  return (req, res, next) => {
    // Set timeout for the request
    req.setTimeout(timeout, () => {
      console.error('Upload request timed out');
      if (!res.headersSent) {
        res.status(408).json({ error: 'Upload request timed out' });
      }
    });
    
    // Set response timeout as well
    res.setTimeout(timeout, () => {
      console.error('Upload response timed out');
    });
    
    next();
  };
};

// Upload photos for an event
// Max file count is configurable via general settings
router.post('/:eventId/upload', adminAuth, requirePermission('photos.upload'), requireEventOwnership, uploadTimeout(600000), resolveAllowedTypes, async (req, res, next) => { // 10 minute timeout
  let maxFilesPerUpload;
  try {
    maxFilesPerUpload = await getMaxFilesPerUpload();
  } catch (error) {
    console.error('Failed to resolve max files per upload:', error);
    return res.status(500).json({ error: 'Unable to determine upload limits' });
  }

  upload.array('photos', maxFilesPerUpload)(req, res, (err) => {
    if (err) {
      console.error('Multer error:', err);
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File too large. Maximum size is 10GB per file.' });
        }
        if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
          return res.status(400).json({ error: `Too many files. Maximum ${maxFilesPerUpload} files per upload.` });
        }
        return res.status(400).json({ error: `Upload error: ${err.message}` });
      }
      return res.status(400).json({ error: err.message || 'Upload failed' });
    }
    next();
  });
}, validateUploadContent, validateUploadedFiles, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { category_id } = req.body;
    
    console.log('Upload request received for event:', eventId);
    console.log('Body:', req.body);
    console.log('Files:', req.files ? req.files.length : 'none');
    console.log('File details:', req.files?.map(f => ({ name: f.originalname, size: f.size, mimetype: f.mimetype })));
    console.log('Category ID received:', category_id);
    
    // Verify event exists and admin has access
    const event = await db('events').where({ id: eventId }).first();
    if (!event) {
      console.error('Event not found:', eventId);
      // Clean up temp files
      if (req.tempUploadPath) {
        try {
          await fs.rm(req.tempUploadPath, { recursive: true, force: true });
        } catch (e) {
          console.error('Failed to clean up temp path:', e);
        }
      }
      return res.status(404).json({ error: 'Event not found' });
    }

    // Enforce photo cap if set
    if (event.photo_cap && event.photo_cap > 0) {
      const existingPhotoCount = await db('photos')
        .where({ event_id: eventId })
        .count('id as count')
        .first();
      const currentCount = parseInt(existingPhotoCount.count) || 0;
      const newFilesCount = (req.files && req.files.length) || 0;
      if (currentCount + newFilesCount > event.photo_cap) {
        // Clean up temp files
        if (req.tempUploadPath) {
          try {
            await fs.rm(req.tempUploadPath, { recursive: true, force: true });
          } catch (e) {
            console.error('Failed to clean up temp path:', e);
          }
        }
        return res.status(400).json({
          error: `Photo cap exceeded. This event allows a maximum of ${event.photo_cap} photos. Currently ${currentCount} photos exist, and you are trying to upload ${newFilesCount} more.`
        });
      }
    }

    if (!req.files || req.files.length === 0) {
      console.error('No files in request. req.files:', req.files);
      console.error('Request body keys:', Object.keys(req.body));
      // Clean up temp files
      if (req.tempUploadPath) {
        try {
          await fs.rm(req.tempUploadPath, { recursive: true, force: true });
        } catch (e) {
          console.error('Failed to clean up temp path:', e);
        }
      }
      return res.status(400).json({ error: 'No files uploaded' });
    }
    
    // Parse category_id to number if provided (handle string values like 'individual', 'collage')
    const rawParsed = category_id ? parseInt(category_id, 10) : NaN;
    const parsedCategoryId = !isNaN(rawParsed) ? rawParsed : null;

    // Determine photo type and category name
    let photoType = 'individual'; // default
    let categoryName = 'individual';

    // Look up the actual category from database if provided
    if (parsedCategoryId && !isNaN(parsedCategoryId)) {
      const category = await db('photo_categories').where({ id: parsedCategoryId }).first();
      if (category) {
        categoryName = category.slug || category.name.toLowerCase().replace(/\s+/g, '_');
        // Use category slug for type determination
        if (category.slug === 'collage' || category.slug === 'collages') {
          photoType = 'collage';
        }
      }
    } else if (category_id === 'collage') {
      // For backwards compatibility, accept string values
      photoType = 'collage';
      categoryName = 'collages';
    }
    
    // Create final destination directory
    const finalDestPath = path.join(getStoragePath(), 'events/active', event.slug);
    await fs.mkdir(finalDestPath, { recursive: true });
    
    const uploadedPhotos = [];
    const errors = [];
    
    // Process files in batches to optimize database operations
    const BATCH_SIZE = 25; // Increased batch size for better performance with large uploads
    
    for (let i = 0; i < req.files.length; i += BATCH_SIZE) {
      const batch = req.files.slice(i, i + BATCH_SIZE);
      
      // Start a single transaction for the batch
      const trx = await db.transaction();
      
      try {
        // Get initial counter for this batch based on photo type
        const existingCount = await trx('photos')
          .where({ event_id: eventId, type: photoType })
          .count('id as count')
          .first();
        let batchCounter = (parseInt(existingCount.count) || 0) + 1;
        
        const batchPhotos = [];
        const fileRenameOperations = []; // Store rename operations to do after commit
        
        // First pass: prepare data and move files from temp to final location
        for (let fileIndex = 0; fileIndex < batch.length; fileIndex++) {
          const file = batch[fileIndex];
          const counter = batchCounter + fileIndex;
          const tempPath = file.path; // Original temp path
          
          try {
            // Verify file is complete before processing
            const tempStats = await fs.stat(tempPath);
            if (tempStats.size === 0) {
              throw new Error('File is empty - upload may have been interrupted');
            }
            
            // Generate new filename
            const extension = path.extname(file.originalname);
            const newFilename = generatePhotoFilename(
              event.event_name,
              categoryName,
              counter,
              extension
            );
            
            // Calculate final path
            const finalPath = path.join(finalDestPath, newFilename);
            const storagePath = getStoragePath();
            const relativePath = path.relative(path.join(storagePath, 'events/active'), finalPath);

            // Extract capture date from EXIF metadata
            let capturedAt = null;
            try {
              capturedAt = await extractCaptureDate(tempPath);
            } catch (exifError) {
              // Non-fatal - just log and continue without capture date
              console.log(`Could not extract EXIF date for ${file.originalname}`);
            }

            // Determine media type
            const isVideo = isVideoMimeType(file.mimetype);
            const mediaType = isVideo ? 'video' : 'image';

            // Prepare photo data for batch insert
            const photoData = {
              event_id: parseInt(eventId),
              filename: newFilename,
              original_filename: file.originalname, // Preserve original filename for Lightroom export
              path: relativePath,
              thumbnail_path: null, // Will generate after successful commit
              type: photoType,
              category_id: parsedCategoryId, // Save the selected category
              size_bytes: tempStats.size, // Use actual file size from stat
              captured_at: capturedAt, // EXIF capture date (if available)
              media_type: mediaType,
              mime_type: file.mimetype
            };
            
            batchPhotos.push(photoData);
            
            // Store move operation for later
            fileRenameOperations.push({
              tempPath: tempPath,
              finalPath: finalPath,
              filename: newFilename,
              photoData: photoData
            });
          } catch (error) {
            console.error(`Error preparing file ${file.originalname}:`, error);
            errors.push({ filename: file.originalname, error: error.message });
          }
        }
        
        // Insert all photos in this batch
        if (batchPhotos.length > 0) {
          console.log(`Inserting batch of ${batchPhotos.length} photos with type: ${photoType}`);
          
          const insertedIds = await trx('photos').insert(batchPhotos).returning('id');
          
          // No need to update counter as we calculate it dynamically
          
          // Commit the transaction first
          await trx.commit();
          console.log(`Successfully committed batch of ${batchPhotos.length} photos`);
          
          // Now move files from temp to final location after successful commit
          for (let idx = 0; idx < fileRenameOperations.length; idx++) {
            const operation = fileRenameOperations[idx];
            try {
              // Move the file from temp to final location
              await fs.rename(operation.tempPath, operation.finalPath);
              console.log(`Moved file from ${operation.tempPath} to ${operation.finalPath}`);
              
              // Verify the file was moved successfully
              const finalStats = await fs.stat(operation.finalPath);
              if (finalStats.size !== operation.photoData.size_bytes) {
                throw new Error(`File size mismatch after move: expected ${operation.photoData.size_bytes}, got ${finalStats.size}`);
              }
              
              // Generate thumbnail and extract metadata
              const photoId = insertedIds[idx]?.id || insertedIds[idx];
              const isVideoFile = isVideoMimeType(operation.photoData.mime_type);
              let thumbnailPath = null;

              try {
                if (isVideoFile) {
                  // Process video: extract metadata and generate thumbnail
                  const thumbnailDir = path.join(getStoragePath(), 'thumbnails');
                  await fs.mkdir(thumbnailDir, { recursive: true });
                  const videoThumbnailPath = path.join(thumbnailDir, `thumb_${operation.filename.replace(/\.[^.]+$/, '.jpg')}`);

                  const result = await processUploadedVideo(operation.finalPath, videoThumbnailPath);
                  thumbnailPath = path.relative(getStoragePath(), videoThumbnailPath);

                  if (photoId && result.metadata) {
                    await db('photos')
                      .where({ id: photoId })
                      .update({
                        thumbnail_path: thumbnailPath,
                        duration: result.metadata.duration,
                        video_codec: result.metadata.videoCodec,
                        audio_codec: result.metadata.audioCodec,
                        width: result.metadata.width,
                        height: result.metadata.height
                      });
                  }
                } else {
                  thumbnailPath = await generateThumbnail(operation.finalPath);

                  // Update the database with thumbnail path and image dimensions
                  if (photoId) {
                    const updateData = {};
                    if (thumbnailPath) updateData.thumbnail_path = thumbnailPath;

                    try {
                      const sharp = require('sharp');
                      const metadata = await sharp(operation.finalPath).metadata();
                      if (metadata.width && metadata.height) {
                        updateData.width = metadata.width;
                        updateData.height = metadata.height;
                      }
                    } catch (metadataError) {
                      console.warn(`Could not extract image dimensions for ${operation.filename}:`, metadataError.message);
                    }

                    if (Object.keys(updateData).length > 0) {
                      await db('photos')
                        .where({ id: photoId })
                        .update(updateData);
                    }
                  }
                }
              } catch (thumbError) {
                console.error(`Thumbnail/metadata processing failed for ${operation.filename}:`, thumbError.message);
              }

              // Queue watermark generation in background (non-blocking, images only)
              if (photoId && !isVideoFile) {
                watermarkGeneratorService.generateForPhoto(photoId)
                  .catch(err => console.warn(`Watermark generation queued failed for photo ${photoId}:`, err.message));
              }
              
              // Add to successful uploads
              uploadedPhotos.push({
                id: insertedIds[idx]?.id || insertedIds[idx],
                filename: operation.filename,
                size: operation.photoData.size_bytes,
                category_id: operation.photoData.category_id
              });
            } catch (moveError) {
              console.error(`Failed to move file ${operation.tempPath} to ${operation.finalPath}:`, moveError);
              errors.push({ 
                filename: operation.filename, 
                error: `File move failed: ${moveError.message}` 
              });
              
              // Try to clean up the database entry if file move failed
              if (insertedIds[idx]) {
                const photoId = insertedIds[idx]?.id || insertedIds[idx];
                try {
                  await db('photos').where({ id: photoId }).delete();
                  console.log(`Cleaned up database entry for failed photo ${photoId}`);
                } catch (cleanupError) {
                  console.error(`Failed to clean up database entry:`, cleanupError);
                }
              }
            }
          }
        } else {
          // No photos to insert, just rollback
          await trx.rollback();
        }
      } catch (error) {
        console.error(`Error processing batch starting at index ${i}:`, error);
        console.error('Stack trace:', error.stack);
        
        // Rollback if not already committed
        if (!trx.isCompleted()) {
          await trx.rollback();
        }
        
        // Add all files in this batch to errors
        for (const file of batch) {
          errors.push({ 
            filename: file.originalname, 
            error: `Batch processing failed: ${error.message}` 
          });
        }
      }
    }
    
    // Clean up temp upload directory
    if (req.tempUploadPath) {
      try {
        await fs.rm(req.tempUploadPath, { recursive: true, force: true });
        console.log(`Cleaned up temp upload directory: ${req.tempUploadPath}`);
      } catch (e) {
        console.error('Failed to clean up temp upload directory:', e);
      }
    }
    
    // Log activity
    await logActivity('photos_uploaded',
      { count: uploadedPhotos.length, eventName: event.event_name },
      eventId,
      { type: 'admin', id: req.admin.id, name: req.admin.username }
    );
    
    // Include any files that were invalid from the validation middleware
    const totalInvalidFiles = (req.invalidFiles || []).concat(errors);
    
    // Prepare response
    const totalAttempted = req.files.length + (req.invalidFiles ? req.invalidFiles.length : 0);
    const response = {
      message: `Successfully uploaded ${uploadedPhotos.length} photos`,
      photos: uploadedPhotos,
      totalFiles: totalAttempted,
      successCount: uploadedPhotos.length,
      failureCount: totalInvalidFiles.length
    };
    
    // Include error details if any files failed
    if (totalInvalidFiles.length > 0) {
      response.errors = totalInvalidFiles;
      response.message = `Uploaded ${uploadedPhotos.length} of ${totalAttempted} photos. ${totalInvalidFiles.length} failed.`;
    }
    
    res.json(response);
  } catch (error) {
    console.error('Error uploading photos:', error);
    
    // Clean up temp upload directory on error
    if (req.tempUploadPath) {
      try {
        await fs.rm(req.tempUploadPath, { recursive: true, force: true });
        console.log(`Cleaned up temp upload directory after error: ${req.tempUploadPath}`);
      } catch (e) {
        console.error('Failed to clean up temp upload directory:', e);
      }
    }
    
    res.status(500).json({ error: 'Failed to upload photos' });
  }
});

// Delete a photo
router.delete('/:eventId/photos/:photoId', adminAuth, requirePermission('photos.delete'), requireEventOwnership, async (req, res) => {
  try {
    const { eventId, photoId } = req.params;
    
    // Get photo details
    const photo = await db('photos')
      .where({ id: photoId, event_id: eventId })
      .first();
    
    if (!photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }
    
    // Delete physical files
    const storagePath = getStoragePath();
    const photoPath = path.join(storagePath, 'events/active', photo.path);
    
    try {
      await fs.unlink(photoPath);
    } catch (error) {
      console.error('Error deleting photo file:', error);
    }
    
    // Delete thumbnail if exists
    if (photo.thumbnail_path) {
      const thumbPath = path.join(storagePath, 'events/active', photo.thumbnail_path);
      try {
        // Check if file exists before attempting to delete
        await fs.access(thumbPath);
        await fs.unlink(thumbPath);
      } catch (error) {
        // Only log if it's not a "file not found" error
        if (error.code !== 'ENOENT') {
          console.error('Error deleting thumbnail:', error);
        }
      }
    }

    // Delete pre-generated watermark if exists
    if (photo.watermark_path) {
      await watermarkGeneratorService.deleteForPhoto(photo.id);
    }

    // Remove from database
    await db('photos').where({ id: photoId }).delete();
    
    // Log activity
    const event = await db('events').where({ id: eventId }).first();
    await logActivity('photo_deleted',
      { filename: photo.filename, eventName: event.event_name },
      eventId,
      { type: 'admin', id: req.admin.id, name: req.admin.username }
    );
    
    res.json({ message: 'Photo deleted successfully' });
  } catch (error) {
    console.error('Error deleting photo:', error);
    res.status(500).json({ error: 'Failed to delete photo' });
  }
});

// Update a photo (e.g., change category)
router.patch('/:eventId/photos/:photoId', adminAuth, requirePermission('photos.edit'), requireEventOwnership, async (req, res) => {
  try {
    const { eventId, photoId } = req.params;
    const { category_id, visibility } = req.body;

    // Verify photo belongs to event
    const photo = await db('photos')
      .where({ id: photoId, event_id: eventId })
      .first();

    if (!photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    // Prepare update data
    const updateData = {};

    // Handle visibility update (#172)
    if (visibility !== undefined) {
      if (['visible', 'hidden'].includes(visibility)) {
        updateData.visibility = visibility;
      }
    }

    // Handle type-based categories ('individual' or 'collage')
    // These are string values that map to the photo.type field
    if (category_id === 'individual' || category_id === 'collage') {
      updateData.type = category_id;
      updateData.category_id = null; // Clear legacy category_id
    } else if (category_id === null || category_id === undefined) {
      // Explicitly clear category
      updateData.category_id = null;
    } else {
      // Handle numeric category IDs from photo_categories table
      const numericCategoryId = parseInt(category_id, 10);
      if (!isNaN(numericCategoryId)) {
        updateData.category_id = numericCategoryId;
      } else {
        updateData.category_id = null;
      }
    }

    // Update photo
    await db('photos')
      .where({ id: photoId, event_id: eventId })
      .update(updateData);

    // Fetch and return the updated photo
    const updatedPhoto = await db('photos')
      .where({ id: photoId, event_id: eventId })
      .first();

    res.json({
      message: 'Photo updated successfully',
      photo: updatedPhoto
    });
  } catch (error) {
    console.error('Error updating photo:', error);
    res.status(500).json({ error: 'Failed to update photo' });
  }
});

// Bulk delete photos
router.post('/:eventId/photos/bulk-delete', adminAuth, requirePermission('photos.delete'), requireEventOwnership, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { photoIds } = req.body;
    
    if (!Array.isArray(photoIds) || photoIds.length === 0) {
      return res.status(400).json({ error: 'Invalid photo IDs' });
    }
    
    // Get all photos to delete
    const photos = await db('photos')
      .whereIn('id', photoIds)
      .where('event_id', eventId);
    
    if (photos.length === 0) {
      return res.status(404).json({ error: 'No photos found' });
    }
    
    // Delete physical files
    const storagePath = getStoragePath();
    const event = await db('events').where({ id: eventId }).first();
    
    for (const photo of photos) {
      // Delete photo file
      const photoPath = path.join(storagePath, 'events/active', photo.path);
      try {
        await fs.unlink(photoPath);
      } catch (error) {
        console.error('Error deleting photo file:', error);
      }
      
      // Delete thumbnail
      if (photo.thumbnail_path) {
        const thumbPath = path.join(storagePath, photo.thumbnail_path);
        try {
          // Check if file exists before attempting to delete
          await fs.access(thumbPath);
          await fs.unlink(thumbPath);
        } catch (error) {
          // Only log if it's not a "file not found" error
          if (error.code !== 'ENOENT') {
            console.error('Error deleting thumbnail:', error);
          }
        }
      }

      // Delete pre-generated watermark
      if (photo.watermark_path) {
        await watermarkGeneratorService.deleteForPhoto(photo.id);
      }
    }

    // Delete from database
    await db('photos')
      .whereIn('id', photoIds)
      .where('event_id', eventId)
      .delete();
    
    // Log activity
    await logActivity('photos_bulk_deleted',
      { count: photos.length, eventName: event.event_name },
      eventId,
      { type: 'admin', id: req.admin.id, name: req.admin.username }
    );
    
    res.json({ message: `${photos.length} photos deleted successfully` });
  } catch (error) {
    console.error('Error bulk deleting photos:', error);
    res.status(500).json({ error: 'Failed to delete photos' });
  }
});

// Bulk update photos
router.post('/:eventId/photos/bulk-update', adminAuth, requirePermission('photos.edit'), requireEventOwnership, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { photoIds, updates } = req.body;
    
    if (!Array.isArray(photoIds) || photoIds.length === 0) {
      return res.status(400).json({ error: 'Invalid photo IDs' });
    }
    
    // Verify all photos belong to the event
    const photoCount = await db('photos')
      .whereIn('id', photoIds)
      .where('event_id', eventId)
      .count('id as count')
      .first();
    
    if (parseInt(photoCount.count) !== photoIds.length) {
      return res.status(400).json({ error: 'Some photos do not belong to this event' });
    }
    
    // Prepare update data
    const updateData = {};

    // Handle visibility update (#172)
    if (updates.visibility !== undefined) {
      if (['visible', 'hidden'].includes(updates.visibility)) {
        updateData.visibility = updates.visibility;
      }
    }

    if (updates.category_id !== undefined) {
      // Handle type-based categories ('individual' or 'collage')
      // These are string values that map to the photo.type field
      if (updates.category_id === 'individual' || updates.category_id === 'collage') {
        updateData.type = updates.category_id;
        updateData.category_id = null; // Clear legacy category_id
      } else if (updates.category_id === null) {
        // Explicitly clear category
        updateData.category_id = null;
      } else {
        // Handle numeric category IDs from photo_categories table
        const numericCategoryId = parseInt(updates.category_id, 10);
        if (!isNaN(numericCategoryId)) {
          updateData.category_id = numericCategoryId;
        } else {
          updateData.category_id = null;
        }
      }
    }

    await db('photos')
      .whereIn('id', photoIds)
      .where('event_id', eventId)
      .update(updateData);

    res.json({ message: `${photoIds.length} photos updated successfully` });
  } catch (error) {
    console.error('Error bulk updating photos:', error);
    res.status(500).json({ error: 'Failed to update photos' });
  }
});

// Download a photo
router.get('/:eventId/photos/:photoId/download', adminAuth, requirePermission('photos.download'), requireEventOwnership, async (req, res) => {
  try {
    const { eventId, photoId } = req.params;
    
    const photo = await db('photos')
      .where({ id: photoId, event_id: eventId })
      .first();
    
    if (!photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }
    
    const { resolvePhotoFilePath } = require('../services/photoResolver');
    const event = await db('events').where('id', eventId).first();
    const filePath = resolvePhotoFilePath(event, photo);
    
    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (error) {
      return res.status(404).json({ error: 'Photo file not found' });
    }
    
    // Send file
    res.download(filePath, photo.filename);
  } catch (error) {
    console.error('Error downloading photo:', error);
    res.status(500).json({ error: 'Failed to download photo' });
  }
});

// Get all photos for an event
router.get('/:eventId/photos', adminAuth, requirePermission('photos.view'), requireEventOwnership, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { category_id, type, search, sort = 'date', has_likes, has_favorites, has_comments, min_rating } = req.query;
    const order = ['asc', 'desc'].includes(req.query.order) ? req.query.order : 'desc';
    const logic = req.query.logic === 'OR' ? 'OR' : 'AND';

    let query = db('photos')
      .where({ 'photos.event_id': eventId })
      .leftJoin('photo_categories', 'photos.category_id', 'photo_categories.id')
      .select('photos.*', 'photo_categories.name as pc_name', 'photo_categories.slug as pc_slug');

    // Filter by category_id
    if (category_id !== undefined && category_id !== '' && category_id !== '0') {
      if (category_id === 'individual' || category_id === 'collage') {
        // Legacy type-based filtering
        query = query.where({ 'photos.type': category_id });
      } else if (category_id === 'uncategorized') {
        // Filter for photos with no category assigned
        query = query.whereNull('photos.category_id');
      } else {
        // Numeric category ID from photo_categories table
        const numericCategoryId = parseInt(category_id, 10);
        if (!isNaN(numericCategoryId)) {
          query = query.where({ 'photos.category_id': numericCategoryId });
        }
      }
    }

    // Keep type filter for backwards compatibility
    if (type) {
      query = query.where({ 'photos.type': type });
    }

    // Search by filename
    if (search) {
      const escapedSearch = escapeLikePattern(search);
      query = query.where('photos.filename', 'like', `%${escapedSearch}%`);
    }

    // Feedback filters (has likes / favorites / comments / min rating) with AND/OR logic
    const feedbackConditions = [];
    if (has_likes === 'true' || has_likes === true) {
      feedbackConditions.push(qb => qb.where('photos.like_count', '>', 0));
    }
    if (has_favorites === 'true' || has_favorites === true) {
      feedbackConditions.push(qb => qb.where('photos.favorite_count', '>', 0));
    }
    if (has_comments === 'true' || has_comments === true) {
      feedbackConditions.push(qb => qb.where('photos.comment_count', '>', 0));
    }
    if (min_rating !== undefined && min_rating !== null && min_rating !== '') {
      const minRatingNum = parseFloat(min_rating);
      if (!isNaN(minRatingNum)) {
        feedbackConditions.push(qb => qb.where('photos.average_rating', '>=', minRatingNum));
      }
    }
    if (feedbackConditions.length > 0) {
      if (logic === 'OR') {
        query = query.where(builder => {
          feedbackConditions.forEach((cond, idx) => {
            if (idx === 0) {
              cond(builder);
            } else {
              builder.orWhere(sub => cond(sub));
            }
          });
        });
      } else {
        feedbackConditions.forEach(cond => {
          query = query.where(builder => cond(builder));
        });
      }
    }

    // Sorting
    let orderByColumn = 'photos.uploaded_at';
    if (sort === 'name') {
      orderByColumn = 'photos.filename';
    } else if (sort === 'size') {
      orderByColumn = 'photos.size_bytes';
    }
    
    const photos = await query.orderBy(orderByColumn, order);
    
    // Get comment counts separately
    const commentCounts = await db('photo_feedback')
      .whereIn('photo_id', photos.map(p => p.id))
      .where('feedback_type', 'comment')
      .where('is_approved', true)
      .where('is_hidden', false)
      .groupBy('photo_id')
      .select('photo_id', db.raw('COUNT(*) as comment_count'));
    
    // Create a map for quick lookup
    const commentMap = {};
    commentCounts.forEach(c => {
      commentMap[c.photo_id] = parseInt(c.comment_count);
    });
    
    res.json({
      photos: photos.map(photo => ({
        id: photo.id,
        filename: photo.filename,
        original_filename: photo.original_filename || null,
        // Use the correct admin photos router base for serving images
        url: `/api/admin/photos/${eventId}/photo/${photo.id}`,
        // Always expose a thumbnail URL; backend will generate on demand if missing
        thumbnail_url: `/api/admin/photos/${eventId}/thumbnail/${photo.id}`,
        type: photo.type,
        category_id: photo.category_id || photo.type,
        category_name: photo.pc_name || (photo.type === 'individual' ? 'Individual Photos' : 'Collages'),
        category_slug: photo.pc_slug || photo.type,
        media_type: photo.media_type || 'image',
        mime_type: photo.mime_type || null,
        width: photo.width || null,
        height: photo.height || null,
        duration: photo.duration || null,
        size: photo.size_bytes,
        uploaded_at: photo.uploaded_at,
        // Feedback data
        has_feedback: (commentMap[photo.id] > 0 || photo.average_rating > 0 || photo.like_count > 0),
        average_rating: photo.average_rating || 0,
        comment_count: commentMap[photo.id] || 0,
        like_count: photo.like_count || 0,
        favorite_count: photo.favorite_count || 0
      }))
    });
  } catch (error) {
    console.error('Error fetching photos:', error);
    res.status(500).json({ error: 'Failed to fetch photos' });
  }
});

// Serve photo with admin authentication
router.get('/:eventId/photo/:photoId', adminAuth, requirePermission('photos.view'), requireEventOwnership, async (req, res) => {
  try {
    const { eventId, photoId } = req.params;
    
    const photo = await db('photos')
      .where({ id: photoId, event_id: eventId })
      .first();
    
    if (!photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }
    
    const { resolvePhotoFilePath } = require('../services/photoResolver');
    const event = await db('events').where('id', eventId).first();
    const filePath = resolvePhotoFilePath(event, photo);
    
    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (error) {
      return res.status(404).json({ error: 'Photo file not found' });
    }
    
    // Set appropriate headers
    res.setHeader('Content-Type', `image/${path.extname(photo.filename).slice(1)}`);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    
    // Send file (sendFile requires absolute path)
    res.sendFile(path.resolve(filePath));
  } catch (error) {
    console.error('Error serving photo:', error);
    res.status(500).json({ error: 'Failed to serve photo' });
  }
});

// Serve thumbnail with admin authentication
router.get('/:eventId/thumbnail/:photoId', adminAuth, requirePermission('photos.view'), requireEventOwnership, async (req, res) => {
  try {
    const { eventId, photoId } = req.params;
    
    const photo = await db('photos')
      .where({ id: photoId, event_id: eventId })
      .first();
    
    if (!photo) {
      console.error(`Photo not found: ${photoId}, event ${eventId}`);
      return res.status(404).json({ error: 'Photo not found' });
    }
    
    // Ensure thumbnail exists and is valid, regenerate if needed
    const thumbnailPath = await ensureThumbnail(photo);
    
    if (!thumbnailPath) {
      console.error(`Failed to generate thumbnail for photo ${photoId}`);
      return res.status(404).json({ error: 'Thumbnail generation failed' });
    }
    
    const storagePath = getStoragePath();
    const filePath = path.join(storagePath, thumbnailPath);
    
    // Set appropriate headers
    res.setHeader('Content-Type', 'image/jpeg'); // Thumbnails are always JPEG
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    
    // Send file (sendFile requires absolute path)
    res.sendFile(path.resolve(filePath));
  } catch (error) {
    console.error('Error serving thumbnail:', error);
    console.error('Photo ID:', req.params.photoId);
    console.error('Event ID:', req.params.eventId);
    res.status(500).json({ error: 'Failed to serve thumbnail' });
  }
});

// Debug endpoint to check photo existence
router.get('/:eventId/debug', adminAuth, requirePermission('photos.view'), requireEventOwnership, async (req, res) => {
  try {
    const { eventId } = req.params;
    
    const event = await db('events').where({ id: eventId }).first();
    const photoCount = await db('photos').where({ event_id: eventId }).count('id as count').first();
    const photos = await db('photos').where({ event_id: eventId }).limit(5);
    
    res.json({
      event: event || 'Not found',
      photoCount: photoCount.count,
      samplePhotos: photos,
      storagePath: getStoragePath()
    });
  } catch (error) {
    console.error('Error fetching admin photo debug data:', error);
    res.status(500).json({ error: 'Failed to fetch photo debug data' });
  }
});

// ============================================
// CHUNKED UPLOAD ENDPOINTS
// For large file uploads (videos up to 10GB)
// ============================================

// Initialize a chunked upload
router.post('/:eventId/chunked-upload/init', adminAuth, requirePermission('photos.upload'), requireEventOwnership, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { filename, fileSize, mimeType, totalChunks } = req.body;

    // Validate event exists
    const event = await db('events').where({ id: eventId }).first();
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Validate required fields
    if (!filename || !fileSize || !mimeType) {
      return res.status(400).json({ error: 'Missing required fields: filename, fileSize, mimeType' });
    }

    // Validate file size (max 10GB)
    const maxSize = 10 * 1024 * 1024 * 1024;
    if (fileSize > maxSize) {
      return res.status(400).json({ error: `File too large. Maximum size is 10GB.` });
    }

    const result = await chunkedUpload.initializeUpload({
      filename,
      fileSize,
      mimeType,
      eventId: parseInt(eventId),
      totalChunks
    });

    res.json(result);
  } catch (error) {
    console.error('Error initializing chunked upload:', error);
    res.status(500).json({ error: 'Failed to initialize upload' });
  }
});

// Upload a chunk
router.post('/:eventId/chunked-upload/:uploadId/chunk/:chunkIndex', adminAuth, requirePermission('photos.upload'), requireEventOwnership, async (req, res) => {
  try {
    const { uploadId, chunkIndex } = req.params;

    // Get chunk data from request body
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const chunkData = Buffer.concat(chunks);

    const result = await chunkedUpload.uploadChunk(uploadId, parseInt(chunkIndex), chunkData);

    res.json(result);
  } catch (error) {
    console.error('Error uploading chunk:', error);
    res.status(500).json({ error: error.message || 'Failed to upload chunk' });
  }
});

// Complete chunked upload and process the file
router.post('/:eventId/chunked-upload/:uploadId/complete', adminAuth, requirePermission('photos.upload'), requireEventOwnership, async (req, res) => {
  try {
    const { eventId, uploadId } = req.params;
    const { category_id } = req.body;

    // Complete the chunked upload (merge chunks)
    const mergedFile = await chunkedUpload.completeUpload(uploadId);

    // Process the merged file as a regular upload
    const fileObj = {
      originalname: mergedFile.filename,
      mimetype: mergedFile.mimeType,
      size: mergedFile.size,
      path: mergedFile.path
    };

    const uploadedPhotos = await processUploadedPhotos(
      [fileObj],
      parseInt(eventId),
      'admin',
      category_id || null
    );

    // Clean up temp directory
    try {
      await fs.rm(mergedFile.tempDir, { recursive: true, force: true });
    } catch (cleanupErr) {
      console.warn('Failed to clean up temp directory:', cleanupErr.message);
    }

    res.json({
      success: true,
      uploaded: uploadedPhotos.length,
      photos: uploadedPhotos
    });
  } catch (error) {
    console.error('Error completing chunked upload:', error);
    res.status(500).json({ error: error.message || 'Failed to complete upload' });
  }
});

// Get upload status
router.get('/:eventId/chunked-upload/:uploadId/status', adminAuth, requirePermission('photos.view'), requireEventOwnership, async (req, res) => {
  try {
    const { uploadId } = req.params;

    const status = chunkedUpload.getUploadStatus(uploadId);

    if (!status) {
      return res.status(404).json({ error: 'Upload not found or expired' });
    }

    res.json(status);
  } catch (error) {
    console.error('Error getting upload status:', error);
    res.status(500).json({ error: 'Failed to get upload status' });
  }
});

// Abort chunked upload
router.delete('/:eventId/chunked-upload/:uploadId', adminAuth, requirePermission('photos.delete'), requireEventOwnership, async (req, res) => {
  try {
    const { uploadId } = req.params;

    await chunkedUpload.abortUpload(uploadId);

    res.json({ success: true, message: 'Upload aborted' });
  } catch (error) {
    console.error('Error aborting upload:', error);
    res.status(500).json({ error: 'Failed to abort upload' });
  }
});

module.exports = router;
