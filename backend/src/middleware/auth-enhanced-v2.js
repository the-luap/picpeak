const jwt = require('jsonwebtoken');
const { db } = require('../database/db');
const { formatBoolean } = require('../utils/dbCompat');
const { isTokenRevoked } = require('../utils/tokenRevocation');
const logger = require('../utils/logger');
const { getAdminTokenFromRequest, getGalleryTokenFromRequest } = require('../utils/tokenUtils');

/**
 * Enhanced admin authentication middleware with revocation checking
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
      decoded = decoded.payload;
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
      }
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    // Check if token is revoked
    if (await isTokenRevoked(decoded)) {
      logger.warn('Revoked token used', {
        userId: decoded.id,
        tokenType: decoded.type
      });
      return res.status(401).json({ error: 'Token has been revoked', code: 'TOKEN_REVOKED' });
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
    req.token = token; // Store token for potential revocation
    
    next();
  } catch (error) {
    logger.error('Auth middleware error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
}

/**
 * Enhanced gallery authentication middleware with revocation checking
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
    
    // Check if token is revoked
    if (await isTokenRevoked(decoded)) {
      return res.status(401).json({ error: 'Session has been invalidated', code: 'TOKEN_REVOKED' });
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
    req.token = token;
    
    next();
  } catch (error) {
    logger.error('Gallery auth middleware error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
}

// Export other middleware functions from original file...
module.exports = { 
  adminAuth, 
  galleryAuth,
  // ... other exports
};
