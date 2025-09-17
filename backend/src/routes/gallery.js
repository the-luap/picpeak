const express = require('express');
const jwt = require('jsonwebtoken');
const { db } = require('../database/db');
const { formatBoolean } = require('../utils/dbCompat');
const archiver = require('archiver');
const path = require('path');
const router = express.Router();
const watermarkService = require('../services/watermarkService');
const { verifyGalleryAccess } = require('../middleware/gallery');
const secureImageService = require('../services/secureImageService');
const secureImageMiddleware = require('../middleware/secureImageMiddleware');
const logger = require('../utils/logger');

// Get storage path from environment or default
const getStoragePath = () => process.env.STORAGE_PATH || path.join(__dirname, '../../storage');

// Verify share token
router.get('/:slug/verify-token/:token', async (req, res) => {
  try {
    const { slug, token } = req.params;
    
    const event = await db('events')
      .where({ share_link: slug, is_active: formatBoolean(true), is_archived: formatBoolean(false) })
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
      .where({ slug: slug })
      .select('event_name', 'event_type', 'event_date', 'expires_at', 'is_active', 'is_archived', 'share_link', 
              'allow_downloads', 'disable_right_click', 'watermark_downloads', 'watermark_text')
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
      color_theme: event.color_theme,
      allow_downloads: event.allow_downloads !== false,
      disable_right_click: event.disable_right_click === true,
      watermark_downloads: event.watermark_downloads === true,
      watermark_text: event.watermark_text
    });
  } catch (error) {
    console.error('Error fetching gallery info:', error);
    res.status(500).json({ error: 'Failed to fetch gallery info', details: error.message });
  }
});

// Get all photos
router.get('/:slug/photos', verifyGalleryAccess, async (req, res) => {
  try {
    // Get filter parameters from query
    const { filter, guest_id } = req.query;
    const feedbackService = require('../services/feedbackService');
    
    // First get all photos
    let photos = await db('photos')
      .where('photos.event_id', req.event.id)
      .select('photos.*')
      .orderBy('photos.uploaded_at', 'desc');
    
    // Apply filtering if requested (global, based on aggregate counts)
    if (filter) {
      const f = String(filter).toLowerCase();
      const parts = f.split(',').map(s => s.trim());
      const include = new Set();

      // Helper to include IDs for a predicate
      const includeBy = (predicate) => {
        photos.forEach(p => { if (predicate(p)) include.add(p.id); });
      };

      if (parts.includes('liked')) {
        includeBy(p => (p.like_count || 0) > 0);
      }
      if (parts.includes('favorited')) {
        includeBy(p => (p.favorite_count || 0) > 0);
      }
      if (parts.includes('rated')) {
        includeBy(p => (p.average_rating || 0) > 0);
      }
      if (parts.includes('commented')) {
        // Query commented photo IDs
        const commented = await db('photo_feedback')
          .where({ event_id: req.event.id, feedback_type: 'comment', is_approved: true, is_hidden: false })
          .groupBy('photo_id')
          .select('photo_id');
        const commentedIds = new Set(commented.map(c => c.photo_id));
        includeBy(p => commentedIds.has(p.id));
      }

      if (include.size > 0) {
        photos = photos.filter(p => include.has(p.id));
      }
    }
    
    // Then get comment counts separately
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
    
    // Get distinct photo types for this event
    const categoryResults = await db('photos')
      .where('event_id', req.event.id)
      .select('type')
      .distinct('type')
      .orderBy('type', 'asc');
    
    // Convert types to category-like objects
    const categories = categoryResults.map(result => ({
      id: result.type,
      name: result.type === 'individual' ? 'Individual Photos' : 'Collages',
      slug: result.type,
      is_global: false
    }));
    
    // Log view
    await db('access_logs').insert({
      event_id: req.event.id,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      action: 'view'
    });
    
    // Include protection settings in response
    const protectionSettings = {
      protection_level: req.event.protection_level || 'standard',
      image_quality: req.event.image_quality || 85,
      use_canvas_rendering: req.event.use_canvas_rendering === true,
      fragmentation_level: req.event.fragmentation_level || 3,
      overlay_protection: req.event.overlay_protection !== false
    };
    

    res.json({
      event: {
        id: req.event.id,
        event_name: req.event.event_name,
        event_type: req.event.event_type,
        event_date: req.event.event_date,
        welcome_message: req.event.welcome_message,
        color_theme: req.event.color_theme,
        expires_at: req.event.expires_at,
        hero_photo_id: req.event.hero_photo_id,
        allow_downloads: req.event.allow_downloads !== false,
        disable_right_click: req.event.disable_right_click === true,
        watermark_downloads: req.event.watermark_downloads === true,
        watermark_text: req.event.watermark_text,
        ...protectionSettings
      },
      categories: categories,
      photos: photos.map(photo => {
        const useJwtUrl = (protectionSettings.protection_level === 'basic' || protectionSettings.protection_level === 'standard');
        const photoUrl = useJwtUrl ? 
          `/api/gallery/${req.params.slug}/photo/${photo.id}` : 
          `/api/secure-images/${req.params.slug}/secure/${photo.id}/{{token}}`;
        
        return {
          id: photo.id,
          filename: photo.filename,
          url: photoUrl,
          thumbnail_url: photo.thumbnail_path ? `/api/gallery/${req.params.slug}/thumbnail/${photo.id}` : null,
          secure_url_template: `/api/secure-images/${req.params.slug}/secure/${photo.id}/{{token}}`,
          download_url_template: `/api/secure-images/${req.params.slug}/secure-download/${photo.id}/{{token}}`,
          type: photo.type,
          category_id: photo.type,
          category_name: photo.type === 'individual' ? 'Individual Photos' : 'Collages',
          category_slug: photo.type,
          size: photo.size_bytes,
          uploaded_at: photo.uploaded_at,
          // Fixed: Use the calculated useJwtUrl variable instead of recalculating
          requires_token: !useJwtUrl,
          // Feedback data
          has_feedback: (commentMap[photo.id] > 0 || photo.average_rating > 0 || photo.like_count > 0),
          average_rating: photo.average_rating || 0,
          comment_count: commentMap[photo.id] || 0,
          like_count: photo.like_count || 0,
          favorite_count: photo.favorite_count || 0
        };
      })
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
    
    // Check if downloads are allowed for this event
    if (req.event.allow_downloads === false) {
      return res.status(403).json({ error: 'Downloads are disabled for this gallery' });
    }
    
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
    
    // Photo path should be in storage/events/active directory
    // Handle both legacy paths (just slug/filename) and new paths (events/active/slug/filename)
    const storagePath = getStoragePath();
    let filePath;
    if (photo.path.startsWith('events/active/')) {
      // New format: path already includes events/active/ prefix
      filePath = path.join(storagePath, photo.path);
    } else {
      // Legacy format: path is just slug/filename
      filePath = path.join(storagePath, 'events/active', photo.path);
    }
    
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
    // Check if downloads are allowed for this event
    if (req.event.allow_downloads === false) {
      return res.status(403).json({ error: 'Downloads are disabled for this gallery' });
    }
    
    // Fetch photos
    const photos = await db('photos')
      .where('photos.event_id', req.event.id)
      .select('photos.*')
      .orderBy('photos.type', 'asc')
      .orderBy('photos.uploaded_at', 'desc');
    
    if (photos.length === 0) {
      return res.status(404).json({ error: 'No photos found' });
    }
    
    // Count unique types
    const uniqueTypes = new Set(photos.map(p => p.type)).size;
    const hasMultipleTypes = uniqueTypes > 1;
    
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
      // Photo path should be in storage/events/active directory
      // Handle both legacy paths (just slug/filename) and new paths (events/active/slug/filename)
      const storagePath = getStoragePath();
      let filePath;
      if (photo.path.startsWith('events/active/')) {
        // New format: path already includes events/active/ prefix
        filePath = path.join(storagePath, photo.path);
      } else {
        // Legacy format: path is just slug/filename
        filePath = path.join(storagePath, 'events/active', photo.path);
      }
      
      // Determine the file name in the archive
      let archiveName;
      if (hasMultipleTypes) {
        // Use photo type as folder
        const folderName = photo.type === 'individual' ? 'Individual Photos' : 'Collages';
        archiveName = path.join(folderName, photo.filename);
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

// Download selected photos as ZIP
router.post('/:slug/download-selected', verifyGalleryAccess, async (req, res) => {
  try {
    // Check if downloads are allowed for this event
    if (req.event.allow_downloads === false) {
      return res.status(403).json({ error: 'Downloads are disabled for this gallery' });
    }

    const ids = Array.isArray(req.body?.photo_ids) ? req.body.photo_ids : [];
    if (!ids.length) {
      return res.status(400).json({ error: 'photo_ids is required (non-empty array)' });
    }

    // Clean IDs
    const photoIds = ids
      .map((v) => parseInt(v, 10))
      .filter((v) => Number.isInteger(v))
      .slice(0, 500);

    if (photoIds.length === 0) {
      return res.status(400).json({ error: 'No valid photo IDs provided' });
    }

    // Fetch photos
    const photos = await db('photos')
      .where('photos.event_id', req.event.id)
      .whereIn('photos.id', photoIds)
      .select('photos.*')
      .orderBy('photos.uploaded_at', 'desc');

    if (photos.length === 0) {
      return res.status(404).json({ error: 'No photos found for selected IDs' });
    }

    const archiveName = `${req.event.slug}-selected.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${archiveName}"`);

    const archive = archiver('zip', { zlib: { level: 5 } });
    archive.on('error', (err) => {
      console.error('Zip error:', err);
      try { res.status(500).end(); } catch (e) {}
    });
    archive.pipe(res);

    const { resolvePhotoFilePath } = require('../services/photoResolver');
    const fs = require('fs');
    // Check watermark settings similar to download-all
    const watermarkSettings = await watermarkService.getWatermarkSettings();
    for (const photo of photos) {
      try {
        const filePath = resolvePhotoFilePath(req.event, photo);
        if (filePath && fs.existsSync(filePath)) {
          const name = photo.filename || `photo-${photo.id}.jpg`;
          if (watermarkSettings && watermarkSettings.enabled) {
            // Apply watermark like download-all
            const watermarkedBuffer = await watermarkService.applyWatermark(filePath, watermarkSettings);
            archive.append(watermarkedBuffer, { name });
          } else {
            archive.file(filePath, { name });
          }
        }
      } catch (e) {
        // skip missing/inaccessible files
      }
    }

    await archive.finalize();

    await db('access_logs').insert({
      event_id: req.event.id,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      action: 'download_selected'
    });
  } catch (error) {
    console.error('Error in download-selected:', error);
    res.status(500).json({ error: 'Failed to download selected photos' });
  }
});


// View single photo (with watermark if enabled)
router.get('/:slug/photo/:photoId', 
  verifyGalleryAccess, 
  async (req, res) => {
    try {
      const { photoId } = req.params;
      
      const photo = await db('photos')
        .where({ id: photoId, event_id: req.event.id })
        .first();
      
      
      if (!photo) {
        return res.status(404).json({ error: 'Photo not found' });
      }

      // Check protection level - basic and standard protection allow direct JWT access
      const protectionLevel = req.event.protection_level || 'standard';
      
      if (protectionLevel === 'enhanced' || protectionLevel === 'maximum') {
        // For enhanced/maximum protection, redirect to secure endpoint
        return res.status(302).json({ 
          error: 'Secure access required',
          secureEndpoint: `/api/secure-images/${req.params.slug}/generate-token`,
          photoId: photoId
        });
      }
      
      // Resolve the absolute file path for this photo, supporting both managed and external reference modes
      const { resolvePhotoFilePath } = require('../services/photoResolver');
      const filePath = resolvePhotoFilePath(req.event, photo);
      
      
      // Log access - temporarily disabled for debugging
      // await secureImageService.logImageAccess(
      //   photoId,
      //   req.event.id,
      //   req.clientInfo,
      //   'view_basic'
      // );
      
      // Get watermark settings
      const watermarkSettings = await watermarkService.getWatermarkSettings();
      
      if (watermarkSettings && watermarkSettings.enabled) {
        // Apply watermark and send
        const watermarkedBuffer = await watermarkService.applyWatermark(filePath, watermarkSettings);
        
        res.set({
          'Content-Type': photo.mime_type || 'image/jpeg',
          'Cache-Control': 'private, max-age=1800', // Cache for 30 minutes
          'X-Protection-Level': 'basic'
        });
        
        res.send(watermarkedBuffer);
      } else {
        // Send original file with basic protection headers
        res.set({
          'Cache-Control': 'private, max-age=1800',
          'X-Protection-Level': 'basic'
        });
        // Ensure absolute path for res.sendFile
        const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(filePath);
        res.sendFile(absolutePath);
      }
    } catch (error) {
      logger.error('Error serving photo:', {
        error: error.message,
        stack: error.stack,
        photoId: req.params.photoId,
        eventId: req.event?.id
      });
      res.status(500).json({ error: 'Failed to serve photo', details: error.message });
    }
  }
);

// Serve thumbnail
router.get('/:slug/thumbnail/:photoId', 
  verifyGalleryAccess, 
  async (req, res) => {
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

      // Log thumbnail access
      await secureImageService.logImageAccess(
        photoId,
        req.event.id,
        req.clientInfo,
        'thumbnail'
      );
      
      // Set appropriate headers with enhanced security
      res.set({
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'private, max-age=1800', // Reduced cache time
        'Cross-Origin-Resource-Policy': 'cross-origin',
        'X-Content-Type-Options': 'nosniff',
        'X-Protected-Thumbnail': 'true'
      });
      
      // Send file
      res.sendFile(path.resolve(thumbPath));
    } catch (error) {
      logger.error('Error serving thumbnail:', {
        error: error.message,
        photoId: req.params.photoId,
        eventId: req.event?.id
      });
      res.status(500).json({ error: 'Failed to serve thumbnail' });
    }
  }
);

// Get feedback settings for gallery
router.get('/:slug/feedback-settings', verifyGalleryAccess, async (req, res) => {
  try {
    const feedbackService = require('../services/feedbackService');
    const settings = await feedbackService.getEventFeedbackSettings(req.event.id);
    
    res.json({
      feedback_enabled: settings.feedback_enabled || false,
      allow_ratings: settings.allow_ratings,
      allow_likes: settings.allow_likes, 
      allow_comments: settings.allow_comments,
      allow_favorites: settings.allow_favorites,
      show_feedback_to_guests: settings.show_feedback_to_guests
    });
  } catch (error) {
    console.error('Error fetching feedback settings:', error);
    res.status(500).json({ error: 'Failed to fetch feedback settings' });
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
