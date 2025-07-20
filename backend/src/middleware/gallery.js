const jwt = require('jsonwebtoken');
const { db, withRetry } = require('../database/db');
const { formatBoolean } = require('../utils/dbCompat');

// Middleware to verify gallery access
async function verifyGalleryAccess(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const event = await withRetry(async () => {
      return await db('events')
        .where({ 
          id: decoded.eventId, 
          is_active: formatBoolean(true),
          is_archived: formatBoolean(false)
        })
        .first();
    });
    
    if (!event) {
      return res.status(404).json({ error: 'Gallery not found or expired' });
    }
    
    req.event = event;
    next();
  } catch (error) {
    console.error('Error verifying gallery access:', error);
    res.status(401).json({ error: 'Invalid token', details: error.message });
  }
}

module.exports = {
  verifyGalleryAccess
};