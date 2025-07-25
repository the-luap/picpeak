/**
 * Authentication Security Utilities
 * Provides enhanced security features for authentication
 */

const { db } = require('../database/db');
const { formatBoolean } = require('./dbCompat');
const logger = require('./logger');

// Configuration constants
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds
const ATTEMPT_WINDOW = 15 * 60 * 1000; // 15 minutes window for counting attempts

/**
 * Track failed login attempt
 * @param {string} identifier - Username or email
 * @param {string} ipAddress - IP address of the attempt
 * @param {string} userAgent - User agent string
 */
async function trackFailedAttempt(identifier, ipAddress, userAgent) {
  try {
    // Check if table exists first
    const tableExists = await db.schema.hasTable('login_attempts');
    if (!tableExists) {
      return;
    }
    
    await db('login_attempts').insert({
      identifier,
      ip_address: ipAddress,
      user_agent: userAgent,
      attempt_time: new Date().toISOString(),
      success: false
    });

    // Log security event
    logger.warn('Failed login attempt', {
      identifier,
      ipAddress,
      userAgent,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error tracking failed login attempt:', error);
  }
}

/**
 * Track successful login
 * @param {string} identifier - Username or email
 * @param {string} ipAddress - IP address
 * @param {string} userAgent - User agent string
 */
async function trackSuccessfulLogin(identifier, ipAddress, userAgent) {
  try {
    // Check if table exists first
    const tableExists = await db.schema.hasTable('login_attempts');
    if (!tableExists) {
      return;
    }
    
    await db('login_attempts').insert({
      identifier,
      ip_address: ipAddress,
      user_agent: userAgent,
      attempt_time: new Date().toISOString(),
      success: true
    });

    // Clear old failed attempts for this user
    const cutoffTime = new Date(Date.now() - ATTEMPT_WINDOW);
    await db('login_attempts')
      .where('identifier', identifier)
      .where('success', formatBoolean(false))
      .where('attempt_time', '<', cutoffTime.toISOString())
      .delete();
  } catch (error) {
    logger.error('Error tracking successful login:', error);
  }
}

/**
 * Check if account is locked due to too many failed attempts
 * @param {string} identifier - Username or email
 * @returns {Promise<{isLocked: boolean, remainingTime?: number}>}
 */
async function checkAccountLockout(identifier) {
  try {
    // Check if table exists first
    const tableExists = await db.schema.hasTable('login_attempts');
    if (!tableExists) {
      return { isLocked: false };
    }
    
    const recentWindow = new Date(Date.now() - ATTEMPT_WINDOW);
    
    // Get recent failed attempts
    const failedAttempts = await db('login_attempts')
      .where('identifier', identifier)
      .where('success', formatBoolean(false))
      .where('attempt_time', '>=', recentWindow.toISOString())
      .orderBy('attempt_time', 'desc')
      .limit(MAX_LOGIN_ATTEMPTS);

    if (failedAttempts.length >= MAX_LOGIN_ATTEMPTS) {
      // Check if still within lockout period
      const oldestAttempt = failedAttempts[failedAttempts.length - 1];
      const lockoutEnd = new Date(oldestAttempt.attempt_time).getTime() + LOCKOUT_DURATION;
      const now = Date.now();

      if (now < lockoutEnd) {
        return {
          isLocked: true,
          remainingTime: Math.ceil((lockoutEnd - now) / 1000) // seconds
        };
      }
    }

    return { isLocked: false };
  } catch (error) {
    logger.error('Error checking account lockout:', error);
    return { isLocked: false }; // Fail open to avoid locking users out due to errors
  }
}

/**
 * Check for suspicious login patterns
 * @param {string} identifier - Username or email
 * @param {string} ipAddress - Current IP address
 * @returns {Promise<boolean>} - True if suspicious
 */
async function checkSuspiciousActivity(identifier, ipAddress) {
  try {
    // Check if table exists first
    const tableExists = await db.schema.hasTable('login_attempts');
    if (!tableExists) {
      return false;
    }
    
    // Check for rapid attempts from different IPs
    const recentWindow = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes
    
    const recentAttempts = await db('login_attempts')
      .where('identifier', identifier)
      .where('attempt_time', '>=', recentWindow.toISOString())
      .select('ip_address')
      .distinct('ip_address');

    // If more than 3 different IPs in 5 minutes, it's suspicious
    if (recentAttempts.length > 3) {
      logger.warn('Suspicious login activity detected', {
        identifier,
        uniqueIPs: recentAttempts.length,
        currentIP: ipAddress
      });
      return true;
    }

    return false;
  } catch (error) {
    logger.error('Error checking suspicious activity:', error);
    return false;
  }
}

/**
 * Get generic error message to prevent user enumeration
 * @returns {string}
 */
function getGenericAuthError() {
  return 'Invalid credentials';
}

/**
 * Clean up old login attempts (should be run periodically)
 */
async function cleanupOldAttempts() {
  try {
    // Check if table exists first
    const tableExists = await db.schema.hasTable('login_attempts');
    if (!tableExists) {
      // Table doesn't exist, skip cleanup
      return;
    }
    
    const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days
    
    const deleted = await db('login_attempts')
      .where('attempt_time', '<', cutoffDate.toISOString())
      .delete();

    if (deleted > 0) {
      logger.info(`Cleaned up ${deleted} old login attempts`);
    }
  } catch (error) {
    logger.error('Error cleaning up login attempts:', error);
  }
}

/**
 * Initialize cleanup job
 */
function initializeCleanupJob() {
  // Run cleanup every 24 hours
  setInterval(cleanupOldAttempts, 24 * 60 * 60 * 1000);
  
  // Run initial cleanup
  cleanupOldAttempts();
}

module.exports = {
  trackFailedAttempt,
  trackSuccessfulLogin,
  checkAccountLockout,
  checkSuspiciousActivity,
  getGenericAuthError,
  initializeCleanupJob,
  MAX_LOGIN_ATTEMPTS,
  LOCKOUT_DURATION
};