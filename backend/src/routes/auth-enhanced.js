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
const {
  setAdminAuthCookie,
  clearAdminAuthCookie,
  setGalleryAuthCookies,
  clearGalleryAuthCookies,
  getAdminTokenFromRequest,
  getGalleryTokenFromRequest,
} = require('../utils/tokenUtils');
const { getEventShareToken, resolveShareIdentifier } = require('../services/shareLinkService');
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

    setAdminAuthCookie(res, token);
    
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
    const adminToken = getAdminTokenFromRequest(req);
    const galleryToken = getGalleryTokenFromRequest(req);
    const token = adminToken || galleryToken;

    if (token) {
      // End the session
      endSession(token);

      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        logger.info('User logged out', { 
          userId: decoded.id,
          username: decoded.username,
          type: decoded.type
        });

        if (decoded.type === 'admin') {
          clearAdminAuthCookie(res);
        } else if (decoded.type === 'gallery') {
          clearGalleryAuthCookies(res, decoded.eventSlug);
        }
      } catch (err) {
        // Token might be invalid, but still process logout and clear cookies
        clearAdminAuthCookie(res);
        clearGalleryAuthCookies(res);
      }
    } else {
      // No token found, but ensure cookies are cleared
      clearAdminAuthCookie(res);
      clearGalleryAuthCookies(res);
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
  body('password').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { slug, password, recaptchaToken } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'] || '';
    const event = await db('events')
      .where({ slug, is_active: formatBoolean(true), is_archived: formatBoolean(false) })
      .first();

    if (!event) {
      await trackFailedAttempt(`gallery:${slug}`, ipAddress, userAgent);
      return res.status(401).json({ error: 'Invalid gallery or password' });
    }

    const requiresPassword = !(event.require_password === false || event.require_password === 0 || event.require_password === '0');

    if (requiresPassword) {
      const lockoutStatus = await checkAccountLockout(`gallery:${slug}`);
      if (lockoutStatus.isLocked) {
        logger.warn('Gallery access attempt on locked gallery', { slug, ipAddress });
        return res.status(423).json({ 
          error: 'Too many failed attempts. Please try again later.',
          retryAfter: lockoutStatus.remainingTime
        });
      }

      const recaptchaValid = await verifyRecaptcha(recaptchaToken);
      if (!recaptchaValid) {
        await trackFailedAttempt(`gallery:${slug}`, ipAddress, userAgent);
        return res.status(400).json({ error: 'reCAPTCHA verification failed' });
      }

      if (!password) {
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

      await trackSuccessfulLogin(`gallery:${slug}`, ipAddress, userAgent);
      await db('access_logs').insert({
        event_id: event.id,
        ip_address: ipAddress,
        user_agent: userAgent,
        action: 'login_success'
      });
    } else {
      logger.info('Public gallery access granted without password', { slug, ipAddress });
      await trackSuccessfulLogin(`gallery:${slug}`, ipAddress, userAgent);
      await db('access_logs').insert({
        event_id: event.id,
        ip_address: ipAddress,
        user_agent: userAgent,
        action: 'login_success'
      });
    }

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

    setGalleryAuthCookies(res, token, event.slug);
    
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
        upload_category_id: event.upload_category_id,
        require_password: requiresPassword
      }
    });
  } catch (error) {
    logger.error('Gallery verification error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// Share link authentication (token-based)
router.post('/gallery/share-login', [
  body('slug').notEmpty().trim(),
  body('token').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { slug, token } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'] || '';

    let event = await db('events')
      .where({ slug, is_active: formatBoolean(true), is_archived: formatBoolean(false) })
      .first();

    if (!event) {
      const resolved = await resolveShareIdentifier(slug);
      if (resolved?.event) {
        event = resolved.event;
      }
    }

    if (!event) {
      return res.status(404).json({ error: 'Gallery not found' });
    }

    const expectedToken = getEventShareToken(event);

    if (!expectedToken || token !== expectedToken) {
      return res.status(401).json({ error: 'Invalid or expired share link' });
    }

    const jwtToken = jwt.sign({
      eventId: event.id,
      eventSlug: event.slug,
      type: 'gallery',
      ip: ipAddress,
      loginTime: Date.now()
    }, process.env.JWT_SECRET, {
      expiresIn: '24h',
      issuer: 'picpeak-auth'
    });

    await trackSuccessfulLogin(`gallery:${event.slug}:share`, ipAddress, userAgent);
    setGalleryAuthCookies(res, jwtToken, event.slug);

    const requiresPassword = !(event.require_password === false || event.require_password === 0 || event.require_password === '0');

    res.json({
      token: jwtToken,
      event: {
        id: event.id,
        event_name: event.event_name,
        event_type: event.event_type,
        event_date: event.event_date,
        welcome_message: event.welcome_message,
        color_theme: event.color_theme,
        expires_at: event.expires_at,
        allow_user_uploads: event.allow_user_uploads,
        upload_category_id: event.upload_category_id,
        require_password: requiresPassword
      }
    });
  } catch (error) {
    logger.error('Share link authentication error:', error);
    res.status(500).json({ error: 'Share link login failed' });
  }
});

// Gallery logout to clear cookies
router.post('/gallery/logout', async (req, res) => {
  try {
    const { slug } = req.body || {};
    clearGalleryAuthCookies(res, slug);
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    logger.error('Gallery logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Get current session info
router.get('/session', async (req, res) => {
  try {
    const { slug } = req.query;
    const token = getAdminTokenFromRequest(req) || getGalleryTokenFromRequest(req, slug);
    
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
        user: decoded.username || decoded.eventSlug,
        eventSlug: decoded.eventSlug,
        adminUsername: decoded.username
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
