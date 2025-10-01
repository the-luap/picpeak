const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { db } = require('../database/db');
const { formatBoolean } = require('../utils/dbCompat');
const { validatePasswordInContext, getBcryptRounds } = require('../utils/passwordValidation');
const { adminAuth } = require('../middleware/auth-enhanced-v2');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();

const parseBooleanInput = (value, defaultValue = true) => {
  if (value === undefined || value === null) {
    return defaultValue;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['false', '0', 'no', 'off'].includes(normalized)) {
      return false;
    }
    if (['true', '1', 'yes', 'on'].includes(normalized)) {
      return true;
    }
  }
  return defaultValue;
};

// Create new event
router.post('/', adminAuth, [
  body('event_type').isIn(['wedding', 'birthday', 'corporate', 'other']),
  body('event_name').notEmpty(),
  body('event_date').isDate(),
  body('host_email').isEmail(),
  body('admin_email').isEmail(),
  body('require_password').optional().isBoolean(),
  body('password').optional().isString().custom((value, { req }) => {
    const requirePassword = parseBooleanInput(req.body.require_password, true);
    if (!requirePassword) {
      return true;
    }
    if (typeof value !== 'string' || value.trim().length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }
    return true;
  }),
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
      require_password: requirePasswordInput = true,
      welcome_message,
      color_theme,
      expiration_days = 30
    } = req.body;

    const requirePassword = parseBooleanInput(requirePasswordInput, true);

    if (requirePassword) {
      const passwordValidation = await validatePasswordInContext(password, 'gallery', {
        eventName: event_name
      });

      if (!passwordValidation.valid) {
        return res.status(400).json({ 
          error: 'Password does not meet security requirements',
          details: passwordValidation.errors,
          score: passwordValidation.score,
          feedback: passwordValidation.feedback
        });
      }
    }
    
    // Generate unique slug
    const baseSlug = `${event_type}-${event_name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${event_date}`;
    let slug = baseSlug;
    let counter = 1;
    
    while (await db('events').where({ slug }).first()) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
    
    // Generate share link (just slug/token, not full URL)
    const shareToken = crypto.randomBytes(16).toString('hex');
    const sharePath = `/gallery/${slug}/${shareToken}`;
    const frontendBase = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
    const fullShareLink = frontendBase ? `${frontendBase}${sharePath}` : sharePath;
    const shareLinkSlug = `${slug}/${shareToken}`;
    
    // Hash password (or placeholder when not required)
    const password_hash = requirePassword
      ? await bcrypt.hash(password, getBcryptRounds())
      : await bcrypt.hash(crypto.randomBytes(32).toString('hex'), getBcryptRounds());
    
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
      share_link: shareLinkSlug,
      expires_at,
      require_password: formatBoolean(requirePassword)
    }).returning('id');
    
    // Handle both PostgreSQL (returns array of objects) and SQLite (returns array of IDs)
    const eventId = insertResult[0]?.id || insertResult[0];
    
    // Queue creation email
    const { queueEmail } = require('../services/emailProcessor');
    await queueEmail(eventId, host_email, 'gallery_created', {
      host_name: host_email.split('@')[0], // Extract name from email
      event_name,
      event_date: event_date,  // Pass raw date - will be formatted by email processor
      gallery_link: fullShareLink,
      gallery_password: requirePassword ? password : 'No password required',
      expiry_date: expires_at.toISOString(),  // Pass ISO string - will be formatted by email processor
      welcome_message: welcome_message || ''
    });

    res.json({
      id: eventId,
      slug,
      share_link: fullShareLink,
      expires_at,
      require_password: requirePassword
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
    const updates = { ...req.body };
    
    // Don't allow updating certain fields
    delete updates.id;
    delete updates.slug;
    delete updates.created_at;
    delete updates.password_confirmation;

    const hasRequirePasswordUpdate = Object.prototype.hasOwnProperty.call(updates, 'require_password');
    let requirePasswordUpdate;
    if (hasRequirePasswordUpdate) {
      requirePasswordUpdate = parseBooleanInput(updates.require_password, true);
      updates.require_password = formatBoolean(requirePasswordUpdate);
    }

    let newPasswordPlain;
    if (Object.prototype.hasOwnProperty.call(updates, 'password')) {
      if (updates.password === undefined || updates.password === null || updates.password === '') {
        delete updates.password;
      } else {
        newPasswordPlain = updates.password;
        delete updates.password;
      }
    }

    const event = await db('events').where('id', id).first();
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const currentRequirePassword = parseBooleanInput(event.require_password, true);

    if (hasRequirePasswordUpdate && requirePasswordUpdate === true && !currentRequirePassword && !newPasswordPlain) {
      return res.status(400).json({ error: 'Password must be provided when enabling password requirement.' });
    }

    if (newPasswordPlain) {
      updates.password_hash = await bcrypt.hash(newPasswordPlain, getBcryptRounds());
    } else if (hasRequirePasswordUpdate && requirePasswordUpdate === false && currentRequirePassword) {
      updates.password_hash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), getBcryptRounds());
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
