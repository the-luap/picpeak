const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { db } = require('../database/db');
const { formatBoolean } = require('../utils/dbCompat');
const { verifyRecaptcha } = require('../services/recaptcha');
const router = express.Router();

// Admin login
router.post('/admin/login', [
  body('username').notEmpty(),
  body('password').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { username, password, recaptchaToken } = req.body;
    
    // Verify reCAPTCHA
    const recaptchaValid = await verifyRecaptcha(recaptchaToken);
    if (!recaptchaValid) {
      return res.status(400).json({ error: 'reCAPTCHA verification failed' });
    }
    
    const admin = await db('admin_users')
      .where({ username })
      .orWhere({ email: username })
      .first();
    
    if (!admin || !await bcrypt.compare(password, admin.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    if (!admin.is_active) {
      return res.status(401).json({ error: 'Account disabled' });
    }
    
    // Update last login
    await db('admin_users').where('id', admin.id).update({ last_login: new Date() });
    
    const token = jwt.sign({ id: admin.id, type: 'admin' }, process.env.JWT_SECRET, { expiresIn: '24h' });
    
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
    res.status(500).json({ error: 'Login failed' });
  }
});

// Gallery password verification
router.post('/gallery/verify', [
  body('slug').notEmpty(),
  body('password').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { slug, password, recaptchaToken } = req.body;
    
    // Verify reCAPTCHA
    const recaptchaValid = await verifyRecaptcha(recaptchaToken);
    if (!recaptchaValid) {
      return res.status(400).json({ error: 'reCAPTCHA verification failed' });
    }
    
    const event = await db('events').where({ slug, is_active: formatBoolean(true), is_archived: formatBoolean(false) }).first();
    if (!event) {
      return res.status(404).json({ error: 'Gallery not found or expired' });
    }
    
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
    
    // Log successful access
    await db('access_logs').insert({
      event_id: event.id,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      action: 'login_success'
    });
    
    // Generate session token
    const token = jwt.sign({ 
      eventId: event.id, 
      eventSlug: event.slug,
      type: 'gallery' 
    }, process.env.JWT_SECRET, { expiresIn: '24h' });
    
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
        hero_photo_id: event.hero_photo_id
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Verification failed' });
  }
});

module.exports = router;
