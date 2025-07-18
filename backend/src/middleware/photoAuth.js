const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { db } = require('../database/db');
const { formatBoolean } = require('../utils/dbCompat');

async function photoAuth(req, res, next) {
  try {
    // Extract event slug from the path
    let eventSlug;
    
    console.log('PhotoAuth middleware - path:', req.path);
    
    // For thumbnails, we need to parse the filename to get the event info
    if (req.path.startsWith('/thumb_')) {
      // For now, we'll rely on JWT token for thumbnail access
      eventSlug = null;
    } else {
      // For regular photos, the slug is the first part of the path
      eventSlug = req.path.split('/')[1];
    }
    
    // First check for JWT token (from gallery access)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Check if it's a gallery token
        if (decoded.type === 'gallery') {
          // For thumbnails, we need to verify the token is for a valid event
          if (!eventSlug) {
            // Extract event ID from the decoded token
            if (decoded.eventId) {
              const event = await db('events')
                .where({ id: decoded.eventId, is_active: formatBoolean(true) })
                .first();
              if (event) {
                req.event = event;
                return next();
              }
            }
            // Fallback to slug
            const event = await db('events')
              .where({ slug: decoded.eventSlug, is_active: formatBoolean(true) })
              .first();
            if (event) {
              req.event = event;
              return next();
            }
          }
          // For regular photos, check if token matches the event
          else if (decoded.eventSlug === eventSlug) {
            const event = await db('events')
              .where({ slug: eventSlug, is_active: formatBoolean(true) })
              .first();
            if (event) {
              req.event = event;
              return next();
            }
          }
        }
        
        // Check if it's an admin token (admins can view all photos)
        if (decoded.type === 'admin') {
          // For both thumbnails and photos with admin token, allow access
          return next();
        }
      } catch (err) {
        // Token invalid, fall through to password check
        console.error('JWT verification failed:', err.message);
      }
    }
    
    // Check for password header (legacy support)
    const password = req.headers['x-gallery-password'];
    
    if (!password && !authHeader) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // If no eventSlug (thumbnails), and we don't have valid auth yet, deny access
    if (!eventSlug && !password) {
      return res.status(401).json({ error: 'Authentication required for thumbnails' });
    }
    
    const event = await db('events').where({ slug: eventSlug, is_active: formatBoolean(true) }).first();
    if (!event) {
      return res.status(404).json({ error: 'Gallery not found' });
    }
    
    if (password) {
      const validPassword = await bcrypt.compare(password, event.password_hash);
      if (!validPassword) {
        await db('access_logs').insert({
          event_id: event.id,
          ip_address: req.ip,
          user_agent: req.headers['user-agent'],
          action: 'login_fail'
        });
        return res.status(401).json({ error: 'Invalid password' });
      }
    } else {
      // No valid authentication
      return res.status(401).json({ error: 'Invalid authentication' });
    }
    
    req.event = event;
    next();
  } catch (error) {
    console.error('Photo auth error:', error);
    res.status(500).json({ error: 'Authentication error' });
  }
}

module.exports = photoAuth;
