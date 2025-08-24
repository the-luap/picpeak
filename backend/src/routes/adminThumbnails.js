const express = require('express');
const router = express.Router();
const { db } = require('../database/db');
const { adminAuth } = require('../middleware/auth');
const { generateThumbnail } = require('../services/imageProcessor');
const path = require('path');
const fs = require('fs').promises;
const logger = require('../utils/logger');

const getStoragePath = () => process.env.STORAGE_PATH || path.join(__dirname, '../../../storage');

// Get thumbnail settings
router.get('/settings', adminAuth, async (req, res) => {
  try {
    const settings = await db('app_settings')
      .whereIn('key', [
        'thumbnail_width',
        'thumbnail_height',
        'thumbnail_fit',
        'thumbnail_quality',
        'thumbnail_format'
      ])
      .select('key', 'value', 'description');
    
    const settingsMap = {};
    settings.forEach(s => {
      settingsMap[s.key] = {
        value: s.value,
        description: s.description
      };
    });
    
    res.json({
      settings: settingsMap,
      fitOptions: ['cover', 'contain', 'fill', 'inside', 'outside'],
      formatOptions: ['jpeg', 'png', 'webp']
    });
  } catch (error) {
    logger.error('Error fetching thumbnail settings:', error);
    res.status(500).json({ error: 'Failed to fetch thumbnail settings' });
  }
});

// Update thumbnail settings
router.put('/settings', adminAuth, async (req, res) => {
  try {
    const { width, height, fit, quality, format } = req.body;
    
    // Validate inputs
    if (width && (width < 50 || width > 1000)) {
      return res.status(400).json({ error: 'Width must be between 50 and 1000 pixels' });
    }
    if (height && (height < 50 || height > 1000)) {
      return res.status(400).json({ error: 'Height must be between 50 and 1000 pixels' });
    }
    if (quality && (quality < 1 || quality > 100)) {
      return res.status(400).json({ error: 'Quality must be between 1 and 100' });
    }
    if (fit && !['cover', 'contain', 'fill', 'inside', 'outside'].includes(fit)) {
      return res.status(400).json({ error: 'Invalid fit option' });
    }
    if (format && !['jpeg', 'png', 'webp'].includes(format)) {
      return res.status(400).json({ error: 'Invalid format option' });
    }
    
    // Update settings
    const updates = [];
    if (width) updates.push({ key: 'thumbnail_width', value: width.toString() });
    if (height) updates.push({ key: 'thumbnail_height', value: height.toString() });
    if (fit) updates.push({ key: 'thumbnail_fit', value: fit });
    if (quality) updates.push({ key: 'thumbnail_quality', value: quality.toString() });
    if (format) updates.push({ key: 'thumbnail_format', value: format });
    
    for (const update of updates) {
      await db('app_settings')
        .where('key', update.key)
        .update({
          value: update.value,
          updated_at: db.fn.now()
        });
    }
    
    res.json({ 
      message: 'Thumbnail settings updated successfully',
      regenerateRequired: true 
    });
  } catch (error) {
    logger.error('Error updating thumbnail settings:', error);
    res.status(500).json({ error: 'Failed to update thumbnail settings' });
  }
});

// Regenerate all thumbnails with new settings
router.post('/regenerate', adminAuth, async (req, res) => {
  try {
    const { eventId } = req.body; // Optional: regenerate for specific event only
    
    let query = db('photos').select('id', 'event_id', 'path');
    if (eventId) {
      query = query.where('event_id', eventId);
    }
    
    const photos = await query;
    
    if (photos.length === 0) {
      return res.json({ message: 'No photos to regenerate' });
    }
    
    // Start regeneration in background
    res.json({ 
      message: `Started regenerating ${photos.length} thumbnails`,
      count: photos.length 
    });
    
    // Process thumbnails in background
    setImmediate(async () => {
      let successCount = 0;
      let errorCount = 0;
      
      for (const photo of photos) {
        try {
          const storagePath = getStoragePath();
          const originalPath = path.join(storagePath, 'events/active', photo.path);
          
          // Check if original file exists
          try {
            await fs.access(originalPath);
          } catch (err) {
            logger.warn(`Original file not found for photo ${photo.id}: ${originalPath}`);
            errorCount++;
            continue;
          }
          
          // Regenerate thumbnail
          const thumbnailPath = await generateThumbnail(originalPath, { regenerate: true });
          
          if (thumbnailPath) {
            // Update database with new thumbnail path
            await db('photos')
              .where({ id: photo.id })
              .update({ 
                thumbnail_path: thumbnailPath,
                updated_at: db.fn.now()
              });
            
            successCount++;
            logger.info(`Regenerated thumbnail for photo ${photo.id}`);
          } else {
            errorCount++;
          }
        } catch (error) {
          logger.error(`Error regenerating thumbnail for photo ${photo.id}:`, error);
          errorCount++;
        }
      }
      
      logger.info(`Thumbnail regeneration complete: ${successCount} success, ${errorCount} errors`);
    });
    
  } catch (error) {
    logger.error('Error starting thumbnail regeneration:', error);
    res.status(500).json({ error: 'Failed to start thumbnail regeneration' });
  }
});

// Get regeneration status
router.get('/regenerate/status', adminAuth, async (req, res) => {
  try {
    // Count photos with and without thumbnails
    const totalPhotos = await db('photos').count('id as count').first();
    const photosWithThumbnails = await db('photos')
      .whereNotNull('thumbnail_path')
      .count('id as count')
      .first();
    
    res.json({
      total: totalPhotos.count,
      withThumbnails: photosWithThumbnails.count,
      withoutThumbnails: totalPhotos.count - photosWithThumbnails.count,
      percentage: Math.round((photosWithThumbnails.count / totalPhotos.count) * 100)
    });
  } catch (error) {
    logger.error('Error fetching regeneration status:', error);
    res.status(500).json({ error: 'Failed to fetch regeneration status' });
  }
});

module.exports = router;