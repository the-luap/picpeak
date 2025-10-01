const jwt = require('jsonwebtoken');
const { db, withRetry } = require('../database/db');
const { formatBoolean } = require('../utils/dbCompat');
const { getGalleryTokenFromRequest } = require('../utils/tokenUtils');
const logger = require('../utils/logger');

// Middleware to verify gallery access
async function verifyGalleryAccess(req, res, next) {
  try {
    const requestedSlug = req.params.slug || req.requestedSlug;
    const token = getGalleryTokenFromRequest(req, requestedSlug);
    let event;

    if (!token) {
      if (!requestedSlug) {
        return res.status(401).json({ error: 'No token provided' });
      }

      event = await withRetry(async () => {
        return await db('events')
          .where({ 
            slug: requestedSlug,
            is_active: formatBoolean(true),
            is_archived: formatBoolean(false)
          })
          .select('*')
          .first();
      });

      if (!event) {
        return res.status(404).json({ error: 'Gallery not found or expired' });
      }

      const requiresPassword = !(event.require_password === false || event.require_password === 0 || event.require_password === '0');
      if (!requiresPassword) {
        req.event = event;
        req.sessionID = `gallery_public_${event.id}_${Date.now()}`;
        req.clientInfo = {
          ip: req.ip || req.connection.remoteAddress || 'unknown',
          userAgent: req.get('User-Agent') || 'unknown',
          fingerprint: `${req.ip}-${req.get('User-Agent')}`.substring(0, 32),
          timestamp: Date.now()
        };
        return next();
      }

      return res.status(401).json({ error: 'No token provided' });
    }
    
    // Try to verify with issuer first, fallback to no issuer for backward compatibility
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET, {
        issuer: 'picpeak-auth'
      });
    } catch (error) {
      // If verification fails with issuer, try without issuer (backward compatibility)
      if (error.name === 'JsonWebTokenError' && error.message.includes('jwt issuer invalid')) {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } else {
        throw error;
      }
    }
    logger.debug('[verifyGalleryAccess] Token decoded successfully', { eventId: decoded.eventId, slug: requestedSlug });
    
    // If we have a slug in the URL params or from pre-middleware, verify it matches
    if (requestedSlug) {
      // Verify by slug and ensure it matches the token's event
      event = await withRetry(async () => {
        return await db('events')
          .where({ 
            slug: requestedSlug,
            is_active: formatBoolean(true),
            is_archived: formatBoolean(false)
          })
          .select('*')
          .first();
      });
      
      // Verify the token's eventId matches
      if (event && event.id !== decoded.eventId) {
        return res.status(403).json({ error: 'Token does not match requested gallery' });
      }
    } else {
      // Fallback to using eventId from token
      event = await withRetry(async () => {
        return await db('events')
          .where({ 
            id: decoded.eventId, 
            is_active: formatBoolean(true),
            is_archived: formatBoolean(false)
          })
          .select('*')
          .first();
      });
    }
    
    if (!event) {
      logger.warn('[verifyGalleryAccess] Event not found for slug', { slug: requestedSlug || 'no-slug', tokenEventId: decoded.eventId });
      return res.status(404).json({ error: 'Gallery not found or expired' });
    }
    
    logger.debug('[verifyGalleryAccess] Event located', { eventId: event.id, slug: event.slug });
    req.event = event;
    req.sessionID = decoded.sessionId || `gallery_${event.id}_${Date.now()}`;
    
    // Create client info for logging (similar to secureImageMiddleware but simpler)
    req.clientInfo = {
      ip: req.ip || req.connection.remoteAddress || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
      fingerprint: `${req.ip}-${req.get('User-Agent')}`.substring(0, 32), // Limit to 32 chars for DB column
      timestamp: Date.now()
    };
    
    logger.debug('[verifyGalleryAccess] Access granted', { eventId: event.id, slug: event.slug });
    next();
  } catch (error) {
    logger.error('Error verifying gallery access', { error: error.message, stack: error.stack });
    res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = {
  verifyGalleryAccess
};
