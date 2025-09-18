const jwt = require('jsonwebtoken');
const { db } = require('../database/db');
const { formatBoolean } = require('../utils/dbCompat');
const logger = require('../utils/logger');
const { getAdminTokenFromRequest, getGalleryTokenFromRequest } = require('../utils/tokenUtils');

/**
 * Enhanced admin authentication middleware
 * Adds additional security checks beyond basic JWT validation
 */
async function adminAuth(req, res, next) {
  try {
    const token = getAdminTokenFromRequest(req);
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET, {
        issuer: 'picpeak-auth',
        complete: true
      });
      decoded = decoded.payload; // Extract payload when using complete: true
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
      }
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    // Verify token type
    if (decoded.type !== 'admin') {
      logger.warn('Non-admin token used for admin endpoint', { 
        userId: decoded.id,
        tokenType: decoded.type 
      });
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    // IP validation (optional - can be strict or just log)
    const currentIp = req.ip || req.connection.remoteAddress;
    if (decoded.ip && decoded.ip !== currentIp) {
      logger.warn('Token used from different IP', {
        userId: decoded.id,
        tokenIp: decoded.ip,
        currentIp: currentIp
      });
      // Optional: Reject if IP doesn't match
      // return res.status(401).json({ error: 'Invalid token' });
    }
    
    // Check if admin still exists and is active
    const admin = await db('admin_users')
      .where({ id: decoded.id, is_active: formatBoolean(true) })
      .first();
    
    if (!admin) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    // Check if password was changed after token was issued
    if (admin.password_changed_at) {
      const passwordChangedTime = new Date(admin.password_changed_at).getTime() / 1000;
      if (decoded.iat < passwordChangedTime) {
        logger.warn('Token used after password change', { userId: decoded.id });
        return res.status(401).json({ 
          error: 'Token invalid due to password change',
          code: 'PASSWORD_CHANGED'
        });
      }
    }
    
    // Add user info to request
    req.admin = {
      id: admin.id,
      username: admin.username,
      email: admin.email
    };
    
    next();
  } catch (error) {
    logger.error('Auth middleware error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
}

/**
 * Enhanced gallery authentication middleware
 */
async function galleryAuth(req, res, next) {
  try {
    const slug = req.params?.slug || req.requestedSlug;
    const token = getGalleryTokenFromRequest(req, slug);
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET, {
        issuer: 'picpeak-auth',
        complete: true
      });
      decoded = decoded.payload;
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Session expired', code: 'TOKEN_EXPIRED' });
      }
      return res.status(401).json({ error: 'Invalid session' });
    }
    
    // Verify token type
    if (decoded.type !== 'gallery') {
      return res.status(403).json({ error: 'Invalid access token' });
    }
    
    // Check if event still exists and is active
    const event = await db('events')
      .where({ 
        id: decoded.eventId, 
        is_active: true, 
        is_archived: false 
      })
      .first();
    
    if (!event) {
      return res.status(404).json({ error: 'Gallery not found or expired' });
    }
    
    // Check if gallery has expired
    if (new Date(event.expires_at) < new Date()) {
      return res.status(410).json({ 
        error: 'Gallery has expired',
        code: 'GALLERY_EXPIRED'
      });
    }
    
    // Add event info to request
    req.event = event;
    req.galleryToken = decoded;
    
    next();
  } catch (error) {
    logger.error('Gallery auth middleware error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
}

/**
 * Photo access authentication
 * Validates both admin and gallery tokens for photo access
 */
async function photoAuth(req, res, next) {
  try {
    const slug = req.params?.slug || req.requestedSlug;
    const token = getAdminTokenFromRequest(req) || getGalleryTokenFromRequest(req, slug);
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    // Allow both admin and gallery tokens
    if (decoded.type === 'admin') {
      const admin = await db('admin_users')
        .where({ id: decoded.id, is_active: formatBoolean(true) })
        .first();
      
      if (!admin) {
        return res.status(401).json({ error: 'Invalid token' });
      }
      
      req.auth = { type: 'admin', user: admin };
    } else if (decoded.type === 'gallery') {
      const event = await db('events')
        .where({ 
          id: decoded.eventId, 
          is_active: true, 
          is_archived: false 
        })
        .first();
      
      if (!event) {
        return res.status(404).json({ error: 'Gallery not found' });
      }
      
      // For gallery tokens, ensure they can only access their event's photos
      req.auth = { type: 'gallery', event: event };
    } else {
      return res.status(403).json({ error: 'Invalid token type' });
    }
    
    next();
  } catch (error) {
    logger.error('Photo auth middleware error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
}

/**
 * Verify gallery access for specific operations
 */
async function verifyGalleryAccess(req, res, next) {
  try {
    if (!req.auth) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const { eventId } = req.params;
    
    // Admins can access any gallery
    if (req.auth.type === 'admin') {
      return next();
    }
    
    // Gallery tokens can only access their own event
    if (req.auth.type === 'gallery') {
      if (req.auth.event.id !== parseInt(eventId)) {
        return res.status(403).json({ error: 'Access denied' });
      }
      return next();
    }
    
    res.status(403).json({ error: 'Access denied' });
  } catch (error) {
    res.status(500).json({ error: 'Access verification failed' });
  }
}

module.exports = { 
  adminAuth, 
  galleryAuth,
  photoAuth,
  verifyGalleryAccess
};
