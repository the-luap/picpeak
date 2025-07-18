const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { db } = require('../database/db');
const { formatBoolean } = require('../utils/dbCompat');
const { verifyRecaptcha } = require('../services/recaptcha');
const { 
  trackFailedAttempt,
  trackSuccessfulLogin,
  checkAccountLockout,
  checkSuspiciousActivity,
  getGenericAuthError
} = require('../utils/authSecurity');
const { endSession } = require('../middleware/sessionTimeout');
const logger = require('../utils/logger');
const router = express.Router();

// Admin login with enhanced security
router.post('/admin/login', [
  body('username').notEmpty().trim(),
  body('password').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { username, password, recaptchaToken } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'] || '';
    
    // Check account lockout first
    const lockoutStatus = await checkAccountLockout(username);
    if (lockoutStatus.isLocked) {
      logger.warn('Login attempt on locked account', { username, ipAddress });
      return res.status(423).json({ 
        error: 'Account temporarily locked due to too many failed attempts',
        retryAfter: lockoutStatus.remainingTime
      });
    }
    
    // Verify reCAPTCHA
    const recaptchaValid = await verifyRecaptcha(recaptchaToken);
    if (!recaptchaValid) {
      await trackFailedAttempt(username, ipAddress, userAgent);
      return res.status(400).json({ error: 'reCAPTCHA verification failed' });
    }
    
    // Check for suspicious activity
    const isSuspicious = await checkSuspiciousActivity(username, ipAddress);
    if (isSuspicious) {
      // Still allow login but log it
      logger.warn('Suspicious login pattern detected', { username, ipAddress });
    }
    
    const admin = await db('admin_users')
      .where({ username })
      .orWhere({ email: username })
      .first();
    
    // Use generic error to prevent user enumeration
    if (!admin || !await bcrypt.compare(password, admin.password_hash)) {
      await trackFailedAttempt(username, ipAddress, userAgent);
      return res.status(401).json({ error: getGenericAuthError() });
    }
    
    if (!admin.is_active) {
      await trackFailedAttempt(username, ipAddress, userAgent);
      return res.status(401).json({ error: getGenericAuthError() });
    }
    
    // Successful login
    await trackSuccessfulLogin(username, ipAddress, userAgent);
    
    // Update last login and login metadata
    await db('admin_users').where('id', admin.id).update({ 
      last_login: new Date(),
      last_login_ip: ipAddress
    });
    
    // Generate token with additional claims
    const token = jwt.sign({ 
      id: admin.id,
      username: admin.username,
      type: 'admin',
      ip: ipAddress,
      loginTime: Date.now()
    }, process.env.JWT_SECRET, { 
      expiresIn: '24h',
      issuer: 'picpeak-auth'
    });
    
    res.json({
      token,
      user: {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        mustChangePassword: admin.must_change_password || false
      }
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Logout endpoint
router.post('/logout', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (token) {
      // End the session
      endSession(token);
      
      // Log the logout
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        logger.info('User logged out', { 
          userId: decoded.id,
          username: decoded.username,
          type: decoded.type
        });
      } catch (err) {
        // Token might be invalid, but still process logout
      }
    }
    
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Gallery password verification with enhanced security
router.post('/gallery/verify', [
  body('slug').notEmpty().trim(),
  body('password').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { slug, password, recaptchaToken } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'] || '';
    
    // Check gallery-specific lockout
    const lockoutStatus = await checkAccountLockout(`gallery:${slug}`);
    if (lockoutStatus.isLocked) {
      logger.warn('Gallery access attempt on locked gallery', { slug, ipAddress });
      return res.status(423).json({ 
        error: 'Too many failed attempts. Please try again later.',
        retryAfter: lockoutStatus.remainingTime
      });
    }
    
    // Verify reCAPTCHA
    const recaptchaValid = await verifyRecaptcha(recaptchaToken);
    if (!recaptchaValid) {
      await trackFailedAttempt(`gallery:${slug}`, ipAddress, userAgent);
      return res.status(400).json({ error: 'reCAPTCHA verification failed' });
    }
    
    const event = await db('events').where({ slug, is_active: formatBoolean(true), is_archived: formatBoolean(false) }).first();
    if (!event) {
      // Don't reveal if gallery exists
      await trackFailedAttempt(`gallery:${slug}`, ipAddress, userAgent);
      return res.status(401).json({ error: 'Invalid gallery or password' });
    }
    
    const validPassword = await bcrypt.compare(password, event.password_hash);
    if (!validPassword) {
      await trackFailedAttempt(`gallery:${slug}`, ipAddress, userAgent);
      await db('access_logs').insert({
        event_id: event.id,
        ip_address: ipAddress,
        user_agent: userAgent,
        action: 'login_fail'
      });
      return res.status(401).json({ error: 'Invalid gallery or password' });
    }
    
    // Successful access
    await trackSuccessfulLogin(`gallery:${slug}`, ipAddress, userAgent);
    
    // Log successful access
    await db('access_logs').insert({
      event_id: event.id,
      ip_address: ipAddress,
      user_agent: userAgent,
      action: 'login_success'
    });
    
    // Generate session token with additional security info
    const token = jwt.sign({ 
      eventId: event.id, 
      eventSlug: event.slug,
      type: 'gallery',
      ip: ipAddress,
      loginTime: Date.now()
    }, process.env.JWT_SECRET, { 
      expiresIn: '24h',
      issuer: 'picpeak-auth'
    });
    
    res.json({
      token,
      event: {
        id: event.id,
        event_name: event.event_name,
        event_type: event.event_type,
        event_date: event.event_date,
        welcome_message: event.welcome_message,
        color_theme: event.color_theme,
        expires_at: event.expires_at,
        allow_user_uploads: event.allow_user_uploads,
        upload_category_id: event.upload_category_id
      }
    });
  } catch (error) {
    logger.error('Gallery verification error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// Get current session info
router.get('/session', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Calculate remaining time
      const now = Date.now() / 1000;
      const remainingTime = Math.max(0, decoded.exp - now);
      
      res.json({
        valid: true,
        type: decoded.type,
        expiresIn: Math.floor(remainingTime),
        user: decoded.username || decoded.eventSlug
      });
    } catch (err) {
      res.json({
        valid: false,
        error: 'Invalid or expired token'
      });
    }
  } catch (error) {
    res.status(500).json({ error: 'Session check failed' });
  }
});

module.exports = router;