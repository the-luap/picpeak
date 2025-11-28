const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const logger = require('../utils/logger');
const { db } = require('../database/db');

// Configure sharp for better memory management with large batches
sharp.cache(false); // Disable cache to prevent memory buildup
sharp.concurrency(2); // Limit concurrent operations

// Default thumbnail settings
const DEFAULT_THUMBNAIL_WIDTH = 300;
const DEFAULT_THUMBNAIL_HEIGHT = 300;
const DEFAULT_THUMBNAIL_FIT = 'cover'; // 'cover' for square crops
const DEFAULT_THUMBNAIL_QUALITY = 85;
const DEFAULT_THUMBNAIL_FORMAT = 'jpeg';

const getStoragePath = () => process.env.STORAGE_PATH || path.join(__dirname, '../../../storage');
const getThumbnailPath = () => path.join(getStoragePath(), 'thumbnails');

// Helper to parse setting value (handles both JSON-encoded and plain values)
function parseSettingValue(value) {
  if (value === null || value === undefined) {
    return null;
  }
  // Try to parse as JSON first (in case it's a JSON-encoded string like '"cover"')
  try {
    return JSON.parse(value);
  } catch (e) {
    // If it's not valid JSON, return the raw value
    return value;
  }
}

// Validate that fit value is valid for Sharp
function validateFitValue(fit) {
  const validFitValues = ['cover', 'contain', 'fill', 'inside', 'outside'];
  if (fit && validFitValues.includes(fit)) {
    return fit;
  }
  return DEFAULT_THUMBNAIL_FIT;
}

// Get thumbnail settings from database
async function getThumbnailSettings() {
  try {
    const settings = await db('app_settings')
      .whereIn('setting_key', [
        'thumbnail_width',
        'thumbnail_height',
        'thumbnail_fit',
        'thumbnail_quality',
        'thumbnail_format'
      ])
      .select('setting_key', 'setting_value');

    const settingsMap = {};
    settings.forEach(s => {
      settingsMap[s.setting_key] = parseSettingValue(s.setting_value);
    });

    // Parse and validate fit value
    const fitValue = validateFitValue(settingsMap.thumbnail_fit);

    return {
      width: parseInt(settingsMap.thumbnail_width) || DEFAULT_THUMBNAIL_WIDTH,
      height: parseInt(settingsMap.thumbnail_height) || DEFAULT_THUMBNAIL_HEIGHT,
      fit: fitValue,
      quality: parseInt(settingsMap.thumbnail_quality) || DEFAULT_THUMBNAIL_QUALITY,
      format: settingsMap.thumbnail_format || DEFAULT_THUMBNAIL_FORMAT
    };
  } catch (error) {
    // If database is not ready or settings don't exist, use defaults
    logger.warn('Could not fetch thumbnail settings, using defaults:', error.message);
    return {
      width: DEFAULT_THUMBNAIL_WIDTH,
      height: DEFAULT_THUMBNAIL_HEIGHT,
      fit: DEFAULT_THUMBNAIL_FIT,
      quality: DEFAULT_THUMBNAIL_QUALITY,
      format: DEFAULT_THUMBNAIL_FORMAT
    };
  }
}

async function generateThumbnail(imagePath, options = {}) {
  const filename = path.basename(imagePath);
  const thumbnailFilename = `thumb_${filename}`;
  const thumbnailDir = getThumbnailPath();
  const thumbnailPath = path.join(thumbnailDir, thumbnailFilename);
  
  // Get thumbnail settings
  const settings = await getThumbnailSettings();
  
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
    
    // Create sharp instance with memory-efficient settings
    let sharpInstance = sharp(imagePath, { 
      limitInputPixels: 268402689, // ~16k x 16k max
      sequentialRead: true, // More memory efficient for large images
      failOnError: false // Don't fail on minor issues
    });
    
    // Apply resize with configured settings
    // For square thumbnails with 'cover' fit, we crop to center
    sharpInstance = sharpInstance.resize(settings.width, settings.height, {
      withoutEnlargement: true,
      fit: settings.fit, // 'cover' will crop to fill the exact dimensions
      position: 'center' // Center the crop for better composition
    });
    
    // Apply format-specific options
    if (settings.format === 'jpeg') {
      sharpInstance = sharpInstance.jpeg({ 
        quality: settings.quality,
        progressive: true, // Progressive JPEG for better loading
        mozjpeg: true // Better compression
      });
    } else if (settings.format === 'png') {
      sharpInstance = sharpInstance.png({
        quality: settings.quality,
        compressionLevel: 9,
        progressive: true
      });
    } else if (settings.format === 'webp') {
      sharpInstance = sharpInstance.webp({
        quality: settings.quality,
        effort: 4 // Balance between speed and compression
      });
    }
    
    // Save the thumbnail
    await sharpInstance.toFile(thumbnailPath);
    
    // Verify the thumbnail was created successfully
    const stats = await fs.stat(thumbnailPath);
    if (stats.size === 0) {
      throw new Error('Generated thumbnail is empty');
    }
    
    return path.relative(getStoragePath(), thumbnailPath);
  } catch (error) {
    const msg = (error && error.message) ? error.message : String(error);
    logger.error(`Failed to generate thumbnail for ${filename}: ${msg}`);
    
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
  const { db } = require('../database/db');
  const { resolvePhotoFilePath } = require('./photoResolver');
  let originalPath;
  try {
    const event = await db('events').where('id', photo.event_id).first();
    originalPath = resolvePhotoFilePath(event, photo);
    logger.info(`Ensuring thumbnail for photo ${photo.id} from source: ${originalPath}`);
  } catch (e) {
    const msg = (e && e.message) ? e.message : String(e);
    logger.error(`Failed to resolve original path for thumbnail (photo ${photo.id}): ${msg}`);
    return null;
  }
  
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

async function generateVideoPlaceholder(originalFilename, options = {}) {
  const parsed = path.parse(originalFilename || '');
  const baseName = parsed.name || 'video';
  const thumbnailDir = getThumbnailPath();
  const thumbnailFilename = `thumb_${baseName}.jpg`;
  const thumbnailPath = path.join(thumbnailDir, thumbnailFilename);

  const settings = await getThumbnailSettings();
  const width = settings.width || DEFAULT_THUMBNAIL_WIDTH;
  const height = settings.height || DEFAULT_THUMBNAIL_HEIGHT;

  if (options.regenerate) {
    try {
      await fs.unlink(thumbnailPath);
    } catch (_) {
      // ignore if missing
    }
  }

  try {
    await fs.mkdir(thumbnailDir, { recursive: true });
    const svg = `
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#0f172a" stop-opacity="0.9"/>
            <stop offset="100%" stop-color="#1e293b" stop-opacity="0.9"/>
          </linearGradient>
        </defs>
        <rect width="${width}" height="${height}" rx="18" fill="url(#grad)"/>
        <circle cx="${width / 2}" cy="${height / 2}" r="${Math.min(width, height) / 6}" fill="rgba(255,255,255,0.85)"/>
        <polygon points="${width / 2 - 10},${height / 2 - 14} ${width / 2 - 10},${height / 2 + 14} ${width / 2 + 16},${height / 2}" fill="#0f172a"/>
        <text x="50%" y="${height - 18}" font-family="Arial, sans-serif" font-size="16" fill="rgba(255,255,255,0.9)" text-anchor="middle">
          VIDEO
        </text>
      </svg>
    `;

    await sharp(Buffer.from(svg))
      .resize(width, height, { fit: 'cover' })
      .jpeg({ quality: settings.quality || DEFAULT_THUMBNAIL_QUALITY })
      .toFile(thumbnailPath);

    return path.relative(getStoragePath(), thumbnailPath);
  } catch (error) {
    logger.error('Failed to generate video placeholder thumbnail:', error.message);
    return null;
  }
}

module.exports = { generateThumbnail, isThumbnailValid, ensureThumbnail, generateVideoPlaceholder };
