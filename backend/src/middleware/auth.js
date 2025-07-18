const jwt = require('jsonwebtoken');
const { db } = require('../database/db');
const { formatBoolean } = require('../utils/dbCompat');
const logger = require('../utils/logger');

async function adminAuth(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                     req.headers['x-real-ip'] || 
                     req.connection.remoteAddress || 
                     req.ip;
      logger.warn('Admin auth attempt without token', {
        ip: clientIp,
        path: req.path,
        method: req.method,
        userAgent: req.headers['user-agent']
      });
      return res.status(401).json({ error: 'No token provided' });
    }
    
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                     req.headers['x-real-ip'] || 
                     req.connection.remoteAddress || 
                     req.ip;
      
      logger.warn('JWT validation failed', {
        ip: clientIp,
        path: req.path,
        method: req.method,
        userAgent: req.headers['user-agent'],
        error: jwtError.name,
        message: jwtError.message,
        timestamp: new Date().toISOString()
      });
      
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired' });
      }
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    const admin = await db('admin_users').where({ id: decoded.id, is_active: formatBoolean(true) }).first();
    
    if (!admin) {
      const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                     req.headers['x-real-ip'] || 
                     req.connection.remoteAddress || 
                     req.ip;
      
      logger.warn('Admin auth failed - user not found or inactive', {
        ip: clientIp,
        userId: decoded.id,
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString()
      });
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    req.admin = admin;
    next();
  } catch (error) {
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                   req.headers['x-real-ip'] || 
                   req.connection.remoteAddress || 
                   req.ip;
    
    logger.error('Admin auth middleware error', {
      ip: clientIp,
      path: req.path,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = { adminAuth };
