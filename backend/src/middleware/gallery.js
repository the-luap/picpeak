const jwt = require('jsonwebtoken');
const { db, withRetry } = require('../database/db');
const { formatBoolean } = require('../utils/dbCompat');

// Middleware to verify gallery access
async function verifyGalleryAccess(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];
    if (!token) {
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
    console.log('[verifyGalleryAccess] Token decoded successfully, eventId:', decoded.eventId);
    
    // If we have a slug in the URL params or from pre-middleware, verify it matches
    const requestedSlug = req.params.slug || req.requestedSlug;
    
    let event;
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
      console.log('[verifyGalleryAccess] Event not found for slug:', requestedSlug || 'no-slug', 'eventId:', decoded.eventId);
      return res.status(404).json({ error: 'Gallery not found or expired' });
    }
    
    console.log('[verifyGalleryAccess] Event found:', event.id, event.slug);
    req.event = event;
    req.sessionID = decoded.sessionId || `gallery_${event.id}_${Date.now()}`;
    
    // Create client info for logging (similar to secureImageMiddleware but simpler)
    req.clientInfo = {
      ip: req.ip || req.connection.remoteAddress || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
      fingerprint: `${req.ip}-${req.get('User-Agent')}`.substring(0, 32), // Limit to 32 chars for DB column
      timestamp: Date.now()
    };
    
    console.log('[verifyGalleryAccess] Access granted for event:', event.id);
    next();
  } catch (error) {
    console.error('Error verifying gallery access:', error);
    res.status(401).json({ error: 'Invalid token', details: error.message });
  }
}

module.exports = {
  verifyGalleryAccess
};