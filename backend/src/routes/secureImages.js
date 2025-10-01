const express = require('express');
const { db } = require('../database/db');
const { verifyGalleryAccess } = require('../middleware/gallery');
const secureImageService = require('../services/secureImageService');
const secureImageMiddleware = require('../middleware/secureImageMiddleware');
const logger = require('../utils/logger');
const { formatBoolean } = require('../utils/dbCompat');
const { resolvePhotoFilePath } = require('../services/photoResolver');

const router = express.Router();

/**
 * Generate secure token for image access
 */
router.post('/:slug/generate-token', async (req, res, next) => {
  // Add slug to request for verifyGalleryAccess
  req.requestedSlug = req.params.slug;
  next();
}, verifyGalleryAccess, async (req, res) => {
  try {
    const { photoId, accessType = 'view' } = req.body;
    
    if (!photoId) {
      return res.status(400).json({ error: 'Photo ID required' });
    }

    // Verify photo exists and belongs to event
    const photo = await db('photos')
      .where({ id: photoId, event_id: req.event.id })
      .first();

    if (!photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    // Create client fingerprint
    const clientFingerprint = secureImageService.createClientFingerprint(req);
    
    // Get protection level from event settings
    const protectionLevel = req.event.protection_level || 'standard';
    
    // Generate secure token with appropriate settings
    const tokenOptions = {
      expiresIn: protectionLevel === 'maximum' ? 180 : 300, // 3-5 minutes
      maxUses: accessType === 'download' ? 1 : 3,
      clientFingerprint,
      protectionLevel
    };

    const token = secureImageService.generateSecureToken(
      photoId,
      req.sessionID || 'anonymous',
      tokenOptions
    );

    // Log token generation
    await secureImageService.logImageAccess(
      photoId,
      req.event.id,
      { 
        ip: req.ip, 
        userAgent: req.get('User-Agent'), 
        fingerprint: clientFingerprint 
      },
      'token_generated'
    );

    res.json({
      token,
      expiresIn: tokenOptions.expiresIn,
      maxUses: tokenOptions.maxUses,
      protectionLevel
    });

  } catch (error) {
    logger.error('Error generating secure token', {
      error: error.message,
      photoId: req.body.photoId,
      eventId: req.event?.id
    });
    res.status(500).json({ error: 'Failed to generate secure token' });
  }
});

/**
 * Serve protected image with security measures
 */
router.get('/:slug/secure/:photoId/:token', 
  secureImageMiddleware.secureImageAccess,
  async (req, res) => {
    const { slug, photoId, token } = req.params; // Move outside try block for error handler access
    
    try {
      logger.debug('Secure image route hit', {
        slug,
        photoId,
        tokenLength: token?.length,
        hasAuthHeader: Boolean(req.headers.authorization),
      });
      const { fragment } = req.query;

      // Verify secure token
      const tokenValidation = secureImageService.verifySecureToken(
        token,
        req.clientInfo.fingerprint
      );

      if (!tokenValidation.valid) {
        // Get event for logging (best effort)
        const event = await db('events').where({ slug }).first();
        await secureImageService.logImageAccess(
          photoId,
          event?.id || 0,
          req.clientInfo,
          'token_invalid'
        );
        return res.status(403).json({ error: 'Invalid or expired token' });
      }

      // Get event from slug
      const event = await db('events')
        .where({ 
          slug,
          is_active: formatBoolean(true),
          is_archived: formatBoolean(false)
        })
        .first();

      if (!event) {
        return res.status(404).json({ error: 'Gallery not found' });
      }

      // Verify photo exists and belongs to event  
      const photo = await db('photos')
        .where({ id: photoId, event_id: event.id })
        .first();

      if (!photo) {
        return res.status(404).json({ error: 'Photo not found' });
      }

      let filePath;
      try {
        filePath = resolvePhotoFilePath(req.event, photo);
      } catch (resolveError) {
        logger.error('Failed to resolve photo path for secure token generation', {
          slug: req.params.slug,
          photoId,
          eventId: req.event.id,
          error: resolveError.message,
        });
        return res.status(404).json({ error: 'Photo file not found' });
      }

      // Get protection settings for this event
      const protectionSettings = {
        protectionLevel: event.protection_level || 'standard',
        quality: event.image_quality || 85,
        addFingerprint: event.add_fingerprint !== false,
        fragmentImage: event.use_canvas_rendering === true && fragment !== undefined
      };

      // Process image with protection measures
      const processedImage = await secureImageService.processProtectedImage(
        filePath,
        protectionSettings
      );

      // Handle fragmented images
      if (processedImage.type === 'fragmented') {
        return await handleFragmentedImage(req, res, processedImage, fragment);
      }

      // Log successful access
      await secureImageService.logImageAccess(
        photoId,
        event.id,
        req.clientInfo,
        'view'
      );

      // Set content type and security headers
      res.set({
        'Content-Type': photo.mime_type || 'image/jpeg',
        'Content-Length': processedImage.length,
        'X-Protection-Level': protectionSettings.protectionLevel,
        'X-Remaining-Uses': tokenValidation.remaining
      });

      res.send(processedImage);

    } catch (error) {
      logger.error('Error serving secure image', {
        error: error.message,
        photoId,
        slug,
        clientFingerprint: req.clientInfo?.fingerprint
      });
      res.status(500).json({ error: 'Failed to serve image' });
    }
  }
);

/**
 * Handle fragmented image delivery
 */
async function handleFragmentedImage(req, res, fragmentedImage, fragmentIndex) {
  const { photoId } = req.params;
  
  try {
    if (fragmentIndex === undefined) {
      // Return fragment metadata
      res.json({
        type: 'fragmented',
        fragments: fragmentedImage.fragments.length,
        dimensions: fragmentedImage.originalDimensions,
        fragmentDimensions: fragmentedImage.fragmentDimensions
      });
      return;
    }

    const index = parseInt(fragmentIndex);
    if (isNaN(index) || index < 0 || index >= fragmentedImage.fragments.length) {
      return res.status(400).json({ error: 'Invalid fragment index' });
    }

    const fragment = fragmentedImage.fragments[index];
    
    // Log fragment access
    await secureImageService.logImageAccess(
      photoId,
      req.event.id,
      req.clientInfo,
      `fragment_${index}`
    );

    res.set({
      'Content-Type': 'image/jpeg',
      'Content-Length': fragment.buffer.length,
      'X-Fragment-Index': index,
      'X-Fragment-Position': JSON.stringify(fragment.position)
    });

    res.send(fragment.buffer);

  } catch (error) {
    logger.error('Error serving image fragment', {
      error: error.message,
      fragmentIndex,
      photoId
    });
    res.status(500).json({ error: 'Failed to serve image fragment' });
  }
}

/**
 * Download protected image with watermark
 */
router.get('/:slug/secure-download/:photoId/:token',
  secureImageMiddleware.secureImageAccess,
  async (req, res, next) => {
    // Add slug to request for verifyGalleryAccess
    req.requestedSlug = req.params.slug;
    next();
  },
  verifyGalleryAccess,
  async (req, res) => {
    try {
      const { photoId, token } = req.params;

      // Check if downloads are allowed
      if (req.event.allow_downloads === false) {
        return res.status(403).json({ error: 'Downloads are disabled for this gallery' });
      }

      // Verify secure token
      const tokenValidation = secureImageService.verifySecureToken(
        token,
        req.clientInfo.fingerprint
      );

      if (!tokenValidation.valid) {
        return res.status(403).json({ error: 'Invalid or expired token' });
      }

      // Verify photo exists
      const photo = await db('photos')
        .where({ id: photoId, event_id: req.event.id })
        .first();

      if (!photo) {
        return res.status(404).json({ error: 'Photo not found' });
      }

      let filePath;
      try {
        filePath = resolvePhotoFilePath(req.event, photo);
      } catch (resolveError) {
        logger.error('Failed to resolve photo path for secure download', {
          slug: req.params.slug,
          photoId,
          eventId: req.event.id,
          error: resolveError.message,
        });
        return res.status(404).json({ error: 'Photo file not found' });
      }

      // Apply watermark if enabled
      const watermarkService = require('../services/watermarkService');
      const watermarkSettings = await watermarkService.getWatermarkSettings();
      
      let fileBuffer;
      if (watermarkSettings && watermarkSettings.enabled) {
        fileBuffer = await watermarkService.applyWatermark(filePath, watermarkSettings);
      } else {
        const fs = require('fs').promises;
        fileBuffer = await fs.readFile(filePath);
      }

      // Update download count
      await db('photos').where('id', photoId).increment('download_count', 1);

      // Log download
      await secureImageService.logImageAccess(
        photoId,
        req.event.id,
        req.clientInfo,
        'download'
      );

      res.set({
        'Content-Type': photo.mime_type || 'image/jpeg',
        'Content-Disposition': `attachment; filename="${photo.filename}"`,
        'Content-Length': fileBuffer.length,
        'X-Download-Protected': 'true'
      });

      res.send(fileBuffer);

    } catch (error) {
      logger.error('Error serving secure download', {
        error: error.message,
        photoId: req.params.photoId
      });
      res.status(500).json({ error: 'Failed to download image' });
    }
  }
);

/**
 * Get security statistics for monitoring
 */
router.get('/security/stats', async (req, res) => {
  try {
    // Only allow admin access
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const jwt = require('jsonwebtoken');
    // Try to verify with issuer first, fallback to no issuer for backward compatibility
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET, {
        issuer: 'picpeak-auth'
      });
    } catch (issuerError) {
      // If verification fails with issuer, try without issuer (backward compatibility)
      if (issuerError.name === 'JsonWebTokenError' && issuerError.message.includes('jwt issuer invalid')) {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } else {
        throw issuerError;
      }
    }
    const admin = await db('admin_users').where({ id: decoded.id }).first();
    
    if (!admin) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Get security statistics
    const stats = {
      middleware: secureImageMiddleware.getSecurityStatus(),
      recentAccess: await getRecentAccessStats(),
      suspiciousActivity: await getSuspiciousActivityStats()
    };

    res.json(stats);

  } catch (error) {
    logger.error('Error getting security stats', { error: error.message });
    res.status(500).json({ error: 'Failed to get security stats' });
  }
});

/**
 * Get recent access statistics
 */
async function getRecentAccessStats() {
  try {
    const hourAgo = new Date(Date.now() - 3600000).toISOString();
    
    const stats = await db('image_access_logs')
      .where('accessed_at', '>', hourAgo)
      .select('access_type')
      .count('* as count')
      .groupBy('access_type');

    return stats.reduce((acc, stat) => {
      acc[stat.access_type] = parseInt(stat.count);
      return acc;
    }, {});
  } catch (error) {
    console.error('Error getting recent access stats:', error);
    return {};
  }
}

/**
 * Get suspicious activity statistics
 */
async function getSuspiciousActivityStats() {
  try {
    const hourAgo = new Date(Date.now() - 3600000).toISOString();
    
    const suspiciousCount = await db('image_access_logs')
      .where('accessed_at', '>', hourAgo)
      .where('access_type', 'like', '%suspicious%')
      .count('* as count')
      .first();

    const uniqueIPs = await db('image_access_logs')
      .where('accessed_at', '>', hourAgo)
      .countDistinct('client_ip as count')
      .first();

    return {
      suspiciousEvents: parseInt(suspiciousCount.count),
      uniqueIPs: parseInt(uniqueIPs.count)
    };
  } catch (error) {
    console.error('Error getting suspicious activity stats:', error);
    return { suspiciousEvents: 0, uniqueIPs: 0 };
  }
}

module.exports = router;
