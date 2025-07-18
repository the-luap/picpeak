const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const logger = require('../utils/logger');

// Configure sharp for better memory management with large batches
sharp.cache(false); // Disable cache to prevent memory buildup
sharp.concurrency(2); // Limit concurrent operations

const THUMBNAIL_WIDTH = 300;
const getStoragePath = () => process.env.STORAGE_PATH || path.join(__dirname, '../../../storage');
const getThumbnailPath = () => path.join(getStoragePath(), 'thumbnails');

async function generateThumbnail(imagePath, options = {}) {
  const filename = path.basename(imagePath);
  const thumbnailFilename = `thumb_${filename}`;
  const thumbnailDir = getThumbnailPath();
  const thumbnailPath = path.join(thumbnailDir, thumbnailFilename);
  
  // Ensure thumbnail directory exists
  await fs.mkdir(thumbnailDir, { recursive: true });
  
  // Check if we need to regenerate (for broken thumbnails)
  if (options.regenerate) {
    try {
      await fs.unlink(thumbnailPath);
      logger.info(`Deleted broken thumbnail: ${thumbnailPath}`);
    } catch (err) {
      // File might not exist, that's okay
    }
  }
  
  try {
    // First, verify the source image is complete and valid
    const metadata = await sharp(imagePath).metadata();
    
    if (!metadata.width || !metadata.height) {
      throw new Error('Invalid image metadata - file may be incomplete');
    }
    
    // Generate thumbnail with memory-efficient settings and error handling
    await sharp(imagePath, { 
      limitInputPixels: 268402689, // ~16k x 16k max
      sequentialRead: true, // More memory efficient for large images
      failOnError: false // Don't fail on minor issues
    })
      .resize(THUMBNAIL_WIDTH, null, {
        withoutEnlargement: true,
        fit: 'inside'
      })
      .jpeg({ 
        quality: 80,
        progressive: true, // Progressive JPEG for better loading
        mozjpeg: true // Better compression
      })
      .toFile(thumbnailPath);
    
    // Verify the thumbnail was created successfully
    const stats = await fs.stat(thumbnailPath);
    if (stats.size === 0) {
      throw new Error('Generated thumbnail is empty');
    }
    
    return path.relative(getStoragePath(), thumbnailPath);
  } catch (error) {
    logger.error(`Failed to generate thumbnail for ${filename}:`, error.message);
    
    // Clean up any partially created file
    try {
      await fs.unlink(thumbnailPath);
    } catch (unlinkErr) {
      // Ignore unlink errors
    }
    
    // Return null if thumbnail generation fails, don't fail the whole upload
    return null;
  }
}

/**
 * Check if a thumbnail exists and is valid
 */
async function isThumbnailValid(thumbnailPath) {
  try {
    const fullPath = path.join(getStoragePath(), thumbnailPath);
    const stats = await fs.stat(fullPath);
    
    // Check if file exists and has content
    if (stats.size === 0) {
      return false;
    }
    
    // Try to read metadata to ensure it's a valid image
    await sharp(fullPath).metadata();
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Regenerate thumbnail if it's broken or missing
 */
async function ensureThumbnail(photo) {
  const storagePath = getStoragePath();
  const originalPath = path.join(storagePath, 'events/active', photo.path);
  
  // Check if thumbnail exists and is valid
  if (photo.thumbnail_path) {
    const isValid = await isThumbnailValid(photo.thumbnail_path);
    if (isValid) {
      return photo.thumbnail_path;
    }
    logger.warn(`Invalid thumbnail detected for photo ${photo.id}, regenerating...`);
  }
  
  // Generate new thumbnail
  const newThumbnailPath = await generateThumbnail(originalPath, { regenerate: true });
  
  if (newThumbnailPath) {
    // Update database with new thumbnail path
    const { db } = require('../database/db');
    await db('photos')
      .where({ id: photo.id })
      .update({ thumbnail_path: newThumbnailPath });
    
    logger.info(`Regenerated thumbnail for photo ${photo.id}`);
    return newThumbnailPath;
  }
  
  return null;
}

module.exports = { generateThumbnail, isThumbnailValid, ensureThumbnail };
