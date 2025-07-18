const express = require('express');
const jwt = require('jsonwebtoken');
const { db } = require('../database/db');
const { formatBoolean } = require('../utils/dbCompat');
const archiver = require('archiver');
const path = require('path');
const router = express.Router();
const watermarkService = require('../services/watermarkService');
const { verifyGalleryAccess } = require('../middleware/gallery');

// Get storage path from environment or default
const getStoragePath = () => process.env.STORAGE_PATH || path.join(__dirname, '../../../storage');

// Verify share token
router.get('/:slug/verify-token/:token', async (req, res) => {
  try {
    const { slug, token } = req.params;
    
    const event = await db('events')
      .where({ slug, is_active: formatBoolean(true), is_archived: formatBoolean(false) })
      .select('id', 'share_link')
      .first();
    
    if (!event) {
      return res.status(404).json({ error: 'Gallery not found' });
    }
    
    // Extract token from share link and verify
    const expectedToken = event.share_link.split('/').pop();
    if (token !== expectedToken) {
      return res.status(404).json({ error: 'Invalid gallery link' });
    }
    
    res.json({ valid: true });
  } catch (error) {
    console.error('Error verifying token:', error);
    res.status(500).json({ error: 'Failed to verify token', details: error.message });
  }
});

// Get gallery info (with optional token verification)
router.get('/:slug/info', async (req, res) => {
  try {
    const { slug } = req.params;
    const { token } = req.query;
    
    const event = await db('events')
      .where({ slug })
      .select('event_name', 'event_type', 'event_date', 'expires_at', 'is_active', 'is_archived', 'share_link')
      .first();
    
    if (!event) {
      return res.status(404).json({ error: 'Gallery not found' });
    }
    
    // Check if event is archived
    if (event.is_archived) {
      return res.status(404).json({ error: 'Gallery has been archived and is no longer available' });
    }
    
    // If token provided, verify it matches the share link
    if (token) {
      let expectedToken = event.share_link;
      // Handle both formats: full URL or just token
      if (event.share_link && event.share_link.includes('/')) {
        expectedToken = event.share_link.split('/').pop();
      }
      if (token !== expectedToken) {
        return res.status(404).json({ error: 'Invalid gallery link' });
      }
    }
    
    res.json({
      event_name: event.event_name,
      event_type: event.event_type,
      event_date: event.event_date,
      expires_at: event.expires_at,
      is_active: event.is_active,
      is_expired: !event.is_active || new Date(event.expires_at) < new Date(),
      requires_password: true,
      color_theme: event.color_theme
    });
  } catch (error) {
    console.error('Error fetching gallery info:', error);
    res.status(500).json({ error: 'Failed to fetch gallery info', details: error.message });
  }
});

// Get all photos
router.get('/:slug/photos', verifyGalleryAccess, async (req, res) => {
  try {
    const photos = await db('photos')
      .leftJoin('photo_categories', 'photos.category_id', 'photo_categories.id')
      .where('photos.event_id', req.event.id)
      .select(
        'photos.*',
        'photo_categories.name as category_name',
        'photo_categories.slug as category_slug'
      )
      .orderBy('photos.uploaded_at', 'desc');
    
    // Get all categories for this event
    const categories = await db('photo_categories')
      .where(function() {
        this.where('is_global', formatBoolean(true))
          .orWhere('event_id', req.event.id);
      })
      .orderBy('is_global', 'desc')
      .orderBy('name', 'asc');
    
    // Log view
    await db('access_logs').insert({
      event_id: req.event.id,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      action: 'view'
    });
    
    res.json({
      event: {
        id: req.event.id,
        event_name: req.event.event_name,
        event_type: req.event.event_type,
        event_date: req.event.event_date,
        welcome_message: req.event.welcome_message,
        color_theme: req.event.color_theme,
        expires_at: req.event.expires_at,
        hero_photo_id: req.event.hero_photo_id
      },
      categories: categories.map(cat => ({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        is_global: cat.is_global
      })),
      photos: photos.map(photo => ({
        id: photo.id,
        filename: photo.filename,
        url: `/api/gallery/${req.params.slug}/photo/${photo.id}`,
        thumbnail_url: photo.thumbnail_path ? `/api/gallery/${req.params.slug}/thumbnail/${photo.id}` : null,
        type: photo.type,
        category_id: photo.category_id,
        category_name: photo.category_name,
        category_slug: photo.category_slug,
        size: photo.size_bytes,
        uploaded_at: photo.uploaded_at
      }))
    });
  } catch (error) {
    console.error('Error fetching photos:', error);
    res.status(500).json({ error: 'Failed to fetch photos', details: error.message });
  }
});

// Download single photo
router.get('/:slug/download/:photoId', verifyGalleryAccess, async (req, res) => {
  try {
    const { photoId } = req.params;
    
    const photo = await db('photos')
      .where({ id: photoId, event_id: req.event.id })
      .first();
    
    if (!photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }
    
    // Update download count
    await db('photos').where('id', photoId).increment('download_count', 1);
    
    // Log download
    await db('access_logs').insert({
      event_id: req.event.id,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      action: 'download',
      photo_id: photoId
    });
    
    const filePath = path.join(getStoragePath(), 'events/active', photo.path);
    
    // Get watermark settings
    const watermarkSettings = await watermarkService.getWatermarkSettings();
    
    if (watermarkSettings && watermarkSettings.enabled) {
      // Apply watermark and send
      const watermarkedBuffer = await watermarkService.applyWatermark(filePath, watermarkSettings);
      
      res.set({
        'Content-Type': photo.mime_type || 'image/jpeg',
        'Content-Disposition': `attachment; filename="${photo.filename}"`,
        'Content-Length': watermarkedBuffer.length
      });
      
      res.send(watermarkedBuffer);
    } else {
      // Send original file
      res.download(filePath, photo.filename);
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to download photo' });
  }
});

// Download all photos as ZIP
router.get('/:slug/download-all', verifyGalleryAccess, async (req, res) => {
  try {
    // Fetch photos with category information
    const photos = await db('photos')
      .leftJoin('photo_categories', 'photos.category_id', 'photo_categories.id')
      .where('photos.event_id', req.event.id)
      .select(
        'photos.*',
        'photo_categories.name as category_name',
        'photo_categories.slug as category_slug'
      )
      .orderBy('photo_categories.name', 'asc')
      .orderBy('photos.uploaded_at', 'desc');
    
    if (photos.length === 0) {
      return res.status(404).json({ error: 'No photos found' });
    }
    
    // Count unique categories (excluding null)
    const uniqueCategories = new Set(photos.filter(p => p.category_id).map(p => p.category_id)).size;
    const hasMultipleCategories = uniqueCategories > 1;
    
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${req.event.slug}.zip"`);
    
    const archive = archiver('zip', { zlib: { level: 5 } });
    archive.on('error', (err) => {
      throw err;
    });
    
    archive.pipe(res);
    
    // Get watermark settings
    const watermarkSettings = await watermarkService.getWatermarkSettings();
    
    // Add photos to archive
    for (const photo of photos) {
      const filePath = path.join(getStoragePath(), 'events/active', photo.path);
      
      // Determine the file name in the archive
      let archiveName;
      if (hasMultipleCategories) {
        if (photo.category_name) {
          // Use category name as folder (sanitize for filesystem)
          const folderName = photo.category_name.replace(/[^a-zA-Z0-9-_ ]/g, '').trim();
          archiveName = path.join(folderName, photo.filename);
        } else {
          // Put uncategorized photos in 'Uncategorized' folder
          archiveName = path.join('Uncategorized', photo.filename);
        }
      } else {
        // No folders, just the filename
        archiveName = photo.filename;
      }
      
      if (watermarkSettings && watermarkSettings.enabled) {
        // Apply watermark
        const watermarkedBuffer = await watermarkService.applyWatermark(filePath, watermarkSettings);
        archive.append(watermarkedBuffer, { name: archiveName });
      } else {
        // Add original file
        archive.file(filePath, { name: archiveName });
      }
    }
    
    await archive.finalize();
    
    // Log bulk download
    await db('access_logs').insert({
      event_id: req.event.id,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      action: 'download_all'
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create download archive' });
  }
});

// View single photo (with watermark if enabled)
router.get('/:slug/photo/:photoId', verifyGalleryAccess, async (req, res) => {
  try {
    const { photoId } = req.params;
    
    const photo = await db('photos')
      .where({ id: photoId, event_id: req.event.id })
      .first();
    
    if (!photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }
    
    const filePath = path.join(getStoragePath(), 'events/active', photo.path);
    
    // Get watermark settings
    const watermarkSettings = await watermarkService.getWatermarkSettings();
    
    if (watermarkSettings && watermarkSettings.enabled) {
      // Apply watermark and send
      const watermarkedBuffer = await watermarkService.applyWatermark(filePath, watermarkSettings);
      
      res.set({
        'Content-Type': photo.mime_type || 'image/jpeg',
        'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
      });
      
      res.send(watermarkedBuffer);
    } else {
      // Send original file
      res.sendFile(filePath);
    }
  } catch (error) {
    console.error('Error serving photo:', error);
    res.status(500).json({ error: 'Failed to serve photo' });
  }
});

// Serve thumbnail
router.get('/:slug/thumbnail/:photoId', verifyGalleryAccess, async (req, res) => {
  try {
    const { photoId } = req.params;
    
    const photo = await db('photos')
      .where({ id: photoId, event_id: req.event.id })
      .first();
    
    if (!photo || !photo.thumbnail_path) {
      return res.status(404).json({ error: 'Thumbnail not found' });
    }
    
    const thumbPath = path.join(getStoragePath(), photo.thumbnail_path);
    
    // Check if file exists
    const fs = require('fs').promises;
    try {
      await fs.access(thumbPath);
    } catch (error) {
      return res.status(404).json({ error: 'Thumbnail file not found' });
    }
    
    // Set appropriate headers
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    
    // Send file
    res.sendFile(path.resolve(thumbPath));
  } catch (error) {
    console.error('Error serving thumbnail:', error);
    res.status(500).json({ error: 'Failed to serve thumbnail' });
  }
});

// Get photo stats
router.get('/:slug/stats', verifyGalleryAccess, async (req, res) => {
  try {
    const totalPhotos = await db('photos')
      .where('event_id', req.event.id)
      .count('id as count')
      .first();
    
    const totalViews = await db('access_logs')
      .where('event_id', req.event.id)
      .where('action', 'view')
      .count('id as count')
      .first();
    
    const totalDownloads = await db('photos')
      .where('event_id', req.event.id)
      .sum('download_count as total')
      .first();
    
    const uniqueVisitors = await db('access_logs')
      .where('event_id', req.event.id)
      .countDistinct('ip_address as count')
      .first();
    
    res.json({
      total_photos: totalPhotos.count,
      total_views: totalViews.count,
      total_downloads: totalDownloads.total || 0,
      unique_visitors: uniqueVisitors.count
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// User photo upload endpoint
router.post('/:eventId/upload', verifyGalleryAccess, async (req, res) => {
  try {
    const eventId = parseInt(req.params.eventId);
    
    // Verify the event matches the token
    if (req.event.id !== eventId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Check if user uploads are allowed
    if (!req.event.allow_user_uploads) {
      return res.status(403).json({ error: 'User uploads are not allowed for this event' });
    }
    
    // Import multer and photo processing
    const multer = require('multer');
    const upload = multer({ 
      dest: '/tmp/uploads/',
      limits: { 
        fileSize: 50 * 1024 * 1024, // 50MB
        files: 10 // Max 10 files at once
      },
      fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Invalid file type'));
        }
      }
    }).array('photos', 10);
    
    // Handle upload
    upload(req, res, async (err) => {
      if (err) {
        console.error('Upload error:', err);
        return res.status(400).json({ error: err.message });
      }
      
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
      }
      
      const { processUploadedPhotos } = require('../services/photoProcessor');
      const categoryId = req.body.category_id || req.event.upload_category_id || null;
      
      try {
        // Process uploaded photos
        const results = await processUploadedPhotos(req.files, eventId, 'user', categoryId);
        
        // Clean up temp files
        const fs = require('fs').promises;
        for (const file of req.files) {
          await fs.unlink(file.path).catch(console.error);
        }
        
        res.json({ 
          message: 'Photos uploaded successfully',
          count: results.length,
          photos: results
        });
      } catch (processError) {
        console.error('Photo processing error:', processError);
        res.status(500).json({ error: 'Failed to process photos' });
      }
    });
  } catch (error) {
    console.error('Upload route error:', error);
    res.status(500).json({ error: 'Failed to upload photos' });
  }
});

module.exports = router;
