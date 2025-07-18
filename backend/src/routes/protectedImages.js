const express = require('express');
const path = require('path');
const { db } = require('../database/db');
const { formatBoolean } = require('../utils/dbCompat');
const { verifyGalleryAccess } = require('../middleware/gallery');
const watermarkService = require('../services/watermarkService');
const { getStoragePath } = require('../config/storage');
const crypto = require('crypto');

const router = express.Router();

/**
 * Generate a signed URL token for image access
 */
function generateImageToken(photoId, expiresIn = 3600) {
  const secret = process.env.JWT_SECRET;
  const expires = Date.now() + (expiresIn * 1000);
  const data = `${photoId}:${expires}`;
  const signature = crypto.createHmac('sha256', secret).update(data).digest('hex');
  return `${Buffer.from(data).toString('base64')}.${signature}`;
}

/**
 * Verify image token
 */
function verifyImageToken(token) {
  try {
    const secret = process.env.JWT_SECRET;
    const [data, signature] = token.split('.');
    const decoded = Buffer.from(data, 'base64').toString();
    const [photoId, expires] = decoded.split(':');
    
    // Verify signature
    const expectedSignature = crypto.createHmac('sha256', secret).update(decoded).digest('hex');
    if (signature !== expectedSignature) {
      return null;
    }
    
    // Check expiration
    if (Date.now() > parseInt(expires)) {
      return null;
    }
    
    return { photoId: parseInt(photoId), expires: parseInt(expires) };
  } catch (error) {
    return null;
  }
}

/**
 * Serve watermarked image
 */
router.get('/:slug/photo/:photoId/view', verifyGalleryAccess, async (req, res) => {
  try {
    const { photoId } = req.params;
    
    // Get photo details
    const photo = await db('photos')
      .where({
        id: photoId,
        event_id: req.event.id
      })
      .first();
    
    if (!photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }
    
    // Get watermark settings
    const watermarkSettings = await watermarkService.getWatermarkSettings();
    
    // Build full path to photo
    const photoPath = path.join(getStoragePath(), 'events/active', req.event.slug, photo.path);
    
    // Apply watermark if enabled
    const imageBuffer = await watermarkService.applyWatermark(photoPath, watermarkSettings);
    
    // Set appropriate headers
    res.set({
      'Content-Type': photo.mime_type || 'image/jpeg',
      'Content-Length': imageBuffer.length,
      'Cache-Control': 'private, max-age=3600',
      'X-Content-Type-Options': 'nosniff'
    });
    
    // Send the watermarked image
    res.send(imageBuffer);
    
  } catch (error) {
    console.error('Error serving watermarked image:', error);
    res.status(500).json({ error: 'Failed to serve image' });
  }
});

/**
 * Generate signed URL for image access
 */
router.post('/:slug/photo/:photoId/generate-url', verifyGalleryAccess, async (req, res) => {
  try {
    const { photoId } = req.params;
    
    // Verify photo belongs to this event
    const photo = await db('photos')
      .where({
        id: photoId,
        event_id: req.event.id
      })
      .first();
    
    if (!photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }
    
    // Generate signed token
    const token = generateImageToken(photoId);
    const signedUrl = `/api/images/${req.params.slug}/photo/${photoId}/signed/${token}`;
    
    res.json({ 
      url: signedUrl,
      expiresIn: 3600 // 1 hour
    });
    
  } catch (error) {
    console.error('Error generating signed URL:', error);
    res.status(500).json({ error: 'Failed to generate URL' });
  }
});

/**
 * Serve image with signed URL (no gallery auth required, token is the auth)
 */
router.get('/:slug/photo/:photoId/signed/:token', async (req, res) => {
  try {
    const { slug, photoId, token } = req.params;
    
    // Verify token
    const tokenData = verifyImageToken(token);
    if (!tokenData || tokenData.photoId !== parseInt(photoId)) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    
    // Get event
    const event = await db('events')
      .where({ slug })
      .where('is_active', formatBoolean(true))
      .first();
    
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    // Get photo
    const photo = await db('photos')
      .where({
        id: photoId,
        event_id: event.id
      })
      .first();
    
    if (!photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }
    
    // Get watermark settings
    const watermarkSettings = await watermarkService.getWatermarkSettings();
    
    // Build full path to photo
    const photoPath = path.join(getStoragePath(), 'events/active', event.slug, photo.path);
    
    // Apply watermark if enabled
    const imageBuffer = await watermarkService.applyWatermark(photoPath, watermarkSettings);
    
    // Set appropriate headers
    res.set({
      'Content-Type': photo.mime_type || 'image/jpeg',
      'Content-Length': imageBuffer.length,
      'Cache-Control': 'private, max-age=3600',
      'X-Content-Type-Options': 'nosniff'
    });
    
    // Send the watermarked image
    res.send(imageBuffer);
    
  } catch (error) {
    console.error('Error serving signed image:', error);
    res.status(500).json({ error: 'Failed to serve image' });
  }
});

module.exports = router;