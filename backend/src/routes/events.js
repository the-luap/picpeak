const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { db } = require('../database/db');
const { formatBoolean } = require('../utils/dbCompat');
const { adminAuth } = require('../middleware/auth-enhanced-v2');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();

// Create new event
router.post('/', adminAuth, [
  body('event_type').isIn(['wedding', 'birthday', 'corporate', 'other']),
  body('event_name').notEmpty(),
  body('event_date').isDate(),
  body('host_email').isEmail(),
  body('admin_email').isEmail(),
  body('password').isLength({ min: 6 }),
  body('expiration_days').isInt({ min: 1, max: 365 }).optional()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const {
      event_type,
      event_name,
      event_date,
      host_email,
      admin_email,
      password,
      welcome_message,
      color_theme,
      expiration_days = 30
    } = req.body;
    
    // Generate unique slug
    const baseSlug = `${event_type}-${event_name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${event_date}`;
    let slug = baseSlug;
    let counter = 1;
    
    while (await db('events').where({ slug }).first()) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
    
    // Generate share link
    const shareToken = crypto.randomBytes(16).toString('hex');
    const shareLink = `${process.env.FRONTEND_URL}/gallery/${slug}/${shareToken}`;
    
    // Hash password
    const password_hash = await bcrypt.hash(password, 10);
    
    // Calculate expiration date (days after event date)
    const expires_at = new Date(event_date);
    expires_at.setDate(expires_at.getDate() + parseInt(expiration_days, 10));
    
    // Create folder structure
    const storagePath = process.env.STORAGE_PATH || path.join(__dirname, '../../../storage');
    const eventPath = path.join(storagePath, 'events/active', slug);
    await fs.mkdir(path.join(eventPath, 'collages'), { recursive: true });
    await fs.mkdir(path.join(eventPath, 'individual'), { recursive: true });
    
    // Insert into database
    const insertResult = await db('events').insert({
      slug,
      event_type,
      event_name,
      event_date,
      host_email,
      admin_email,
      password_hash,
      welcome_message,
      color_theme,
      share_link: shareLink,
      expires_at
    }).returning('id');
    
    // Handle both PostgreSQL (returns array of objects) and SQLite (returns array of IDs)
    const eventId = insertResult[0]?.id || insertResult[0];
    
    // Queue creation email
    const { queueEmail } = require('../services/emailProcessor');
    await queueEmail(eventId, host_email, 'gallery_created', {
      host_name: host_email.split('@')[0], // Extract name from email
      event_name,
      event_date: event_date,  // Pass raw date - will be formatted by email processor
      gallery_link: shareLink,
      gallery_password: password,
      expiry_date: expires_at.toISOString(),  // Pass ISO string - will be formatted by email processor
      welcome_message: welcome_message || ''
    });
    
    res.json({
      id: eventId,
      slug,
      share_link: shareLink,
      expires_at
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// Get all events (admin)
router.get('/', adminAuth, async (req, res) => {
  try {
    const { status = 'all' } = req.query;
    
    let query = db('events').select('*');
    
    if (status === 'active') {
      query = query.where('is_active', formatBoolean(true));
    } else if (status === 'archived') {
      query = query.where('is_archived', formatBoolean(true));
    }
    
    const events = await query.orderBy('created_at', 'desc');
    
    // Add photo counts
    for (const event of events) {
      const photoCount = await db('photos').where('event_id', event.id).count('id as count').first();
      event.photo_count = photoCount.count;
    }
    
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// Update event
router.put('/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Don't allow updating certain fields
    delete updates.id;
    delete updates.slug;
    delete updates.created_at;
    
    // If updating password, hash it
    if (updates.password) {
      updates.password_hash = await bcrypt.hash(updates.password, 10);
      delete updates.password;
    }
    
    await db('events').where('id', id).update(updates);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update event' });
  }
});

// Delete event (mark as inactive)
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    await db('events').where('id', id).update({ is_active: formatBoolean(false) });
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

// Extend expiration
router.post('/:id/extend', adminAuth, [
  body('days').isInt({ min: 1, max: 365 })
], async (req, res) => {
  try {
    const { id } = req.params;
    const { days } = req.body;
    
    const event = await db('events').where('id', id).first();
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    const newExpiration = new Date(event.expires_at);
    newExpiration.setDate(newExpiration.getDate() + days);
    
    await db('events').where('id', id).update({ 
      expires_at: newExpiration,
      is_active: formatBoolean(true) // Reactivate if expired
    });
    
    res.json({ expires_at: newExpiration });
  } catch (error) {
    res.status(500).json({ error: 'Failed to extend expiration' });
  }
});

module.exports = router;
