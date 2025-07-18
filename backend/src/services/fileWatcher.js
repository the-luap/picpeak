const chokidar = require('chokidar');
const path = require('path');
const fs = require('fs').promises;
const { db } = require('../database/db');
const { formatBoolean } = require('../utils/dbCompat');
const { generateThumbnail } = require('./imageProcessor');
const logger = require('../utils/logger');

const getStoragePath = () => process.env.STORAGE_PATH || path.join(__dirname, '../../../storage');
const WATCH_PATH = () => path.join(getStoragePath(), 'events/active');

function startFileWatcher() {
  const watcher = chokidar.watch(WATCH_PATH(), {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: true,
    awaitWriteFinish: {
      stabilityThreshold: 2000,
      pollInterval: 100
    }
  });

  watcher
    .on('add', async (filePath) => {
      try {
        await processNewPhoto(filePath);
      } catch (error) {
        logger.error('Error processing new photo:', error);
      }
    })
    .on('unlink', async (filePath) => {
      try {
        await removePhoto(filePath);
      } catch (error) {
        logger.error('Error removing photo:', error);
      }
    });

  logger.info('File watcher started');
}

async function processNewPhoto(filePath) {
  const relativePath = path.relative(WATCH_PATH(), filePath);
  const pathParts = relativePath.split(path.sep);
  
  if (pathParts.length < 2) return; // Not in correct folder structure
  
  const eventSlug = pathParts[0];
  const photoType = pathParts[1] === 'collages' ? 'collage' : 'individual';
  
  // Check if this is an image file
  const ext = path.extname(filePath).toLowerCase();
  if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) return;
  
  // Skip temporary upload files
  const filename = path.basename(filePath);
  if (filename.startsWith('temp_')) {
    logger.debug(`Skipping temporary upload file: ${filename}`);
    return;
  }
  
  // Find the event
  const event = await db('events').where({ slug: eventSlug, is_active: formatBoolean(true) }).first();
  if (!event) return;
  
  // Get file stats
  const stats = await fs.stat(filePath);
  
  // Generate thumbnail
  const thumbnailPath = await generateThumbnail(filePath);
  
  // Calculate relative thumbnail path
  const relativeThumbPath = thumbnailPath; // thumbnailPath is already relative to storage root
  
  // Check if photo already exists
  const existingPhoto = await db('photos')
    .where({ event_id: event.id, filename: path.basename(filePath) })
    .first();
  
  if (!existingPhoto) {
    // Add to database
    await db('photos').insert({
      event_id: event.id,
      filename: path.basename(filePath),
      path: relativePath,
      thumbnail_path: relativeThumbPath,
      type: photoType,
      size_bytes: stats.size
    });
    
    logger.info(`Added new photo: ${relativePath}`);
  } else {
    logger.debug(`Photo already exists: ${relativePath}`);
  }
}

async function removePhoto(filePath) {
  const relativePath = path.relative(WATCH_PATH(), filePath);
  
  // Remove from database
  await db('photos').where({ path: relativePath }).delete();
  
  logger.info(`Removed photo: ${relativePath}`);
}

module.exports = { startFileWatcher };
