const jwt = require('jsonwebtoken');
const { db } = require('../database/db');

// In-memory session tracking (in production, use Redis)
const sessions = new Map();

// Default session timeout (60 minutes)
const DEFAULT_SESSION_TIMEOUT = 60 * 60 * 1000;

// Cache for session timeout setting
let cachedTimeout = null;
let cacheExpiry = 0;
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes - reduced DB queries

// Clean up expired sessions every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [token, lastActivity] of sessions.entries()) {
    if (now - lastActivity > DEFAULT_SESSION_TIMEOUT) {
      sessions.delete(token);
    }
  }
}, 5 * 60 * 1000);

async function getSessionTimeout() {
  const now = Date.now();
  
  // Return cached value if still valid
  if (cachedTimeout && now < cacheExpiry) {
    return cachedTimeout;
  }
  
  try {
    const setting = await db('app_settings')
      .where('setting_key', 'security_session_timeout_minutes')
      .first()
      .timeout(5000); // 5 second timeout
    
    if (setting && setting.setting_value) {
      let value = setting.setting_value;
      // Handle both string and object values
      if (typeof value === 'string') {
        try {
          value = JSON.parse(value);
        } catch (e) {
          // If it's not JSON, try to parse as number directly
          value = parseInt(value);
        }
      }
      const minutes = parseInt(value);
      if (!isNaN(minutes) && minutes > 0) {
        cachedTimeout = minutes * 60 * 1000; // Convert to milliseconds
        cacheExpiry = now + CACHE_DURATION;
        return cachedTimeout;
      }
    }
  } catch (error) {
    // Only log if it's not a connection error (to avoid spam)
    if (error.code !== 'ECONNRESET' && !error.message?.includes('Connection terminated')) {
      console.error('Error getting session timeout:', error.message);
    }
  }
  
  // Use cached value if available, otherwise default
  return cachedTimeout || DEFAULT_SESSION_TIMEOUT;
}

async function sessionTimeoutMiddleware(req, res, next) {
  // Skip for non-authenticated routes
  if (!req.headers.authorization) {
    return next();
  }
  
  const token = req.headers.authorization.split(' ')[1];
  if (!token) {
    return next();
  }
  
  try {
    // Verify token is valid
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if this is an admin token
    if (!decoded.id) {
      return next();
    }
    
    const now = Date.now();
    const lastActivity = sessions.get(token);
    const timeout = await getSessionTimeout();
    
    // If session exists, check if it's expired
    if (lastActivity) {
      if (now - lastActivity > timeout) {
        sessions.delete(token);
        return res.status(401).json({ 
          error: 'Session expired', 
          code: 'SESSION_TIMEOUT' 
        });
      }
    }
    
    // Update last activity
    sessions.set(token, now);
    
    // Clean up old token if user has a new one
    // This prevents memory leaks from token renewals
    const userId = decoded.id;
    for (const [oldToken, _] of sessions.entries()) {
      if (oldToken !== token) {
        try {
          const oldDecoded = jwt.verify(oldToken, process.env.JWT_SECRET);
          if (oldDecoded.id === userId) {
            sessions.delete(oldToken);
          }
        } catch (e) {
          // Token is invalid, remove it
          sessions.delete(oldToken);
        }
      }
    }
    
    next();
  } catch (error) {
    // Token is invalid
    next();
  }
}

// Function to end a session
function endSession(token) {
  sessions.delete(token);
}

// Function to get active sessions count
function getActiveSessions() {
  const now = Date.now();
  let active = 0;
  
  for (const [_, lastActivity] of sessions.entries()) {
    if (now - lastActivity <= DEFAULT_SESSION_TIMEOUT) {
      active++;
    }
  }
  
  return active;
}

module.exports = { 
  sessionTimeoutMiddleware, 
  endSession,
  getActiveSessions 
};