const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { db, logActivity } = require('../database/db');
const { formatBoolean } = require('../utils/dbCompat');
const { adminAuth } = require('../middleware/auth-enhanced-v2');
const router = express.Router();
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const { archiveEvent } = require('../services/archiveService');
const { queueEmail } = require('../services/emailProcessor');
const { escapeLikePattern } = require('../utils/sqlSecurity');
// formatDate import removed - dates are formatted by email processor
const { validatePasswordInContext, getBcryptRounds } = require('../utils/passwordValidation');
const logger = require('../utils/logger');
const { buildShareLinkVariants } = require('../services/shareLinkService');

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

const getCustomerNameFromPayload = (payload = {}) => {
  if (typeof payload.customer_name === 'string') {
    const trimmed = payload.customer_name.trim();
    return trimmed || null;
  }
  return null;
};

const getCustomerEmailFromPayload = (payload = {}) => {
  if (typeof payload.customer_email === 'string') {
    const trimmed = payload.customer_email.trim();
    return trimmed || null;
  }
  return null;
};

const mapEventForApi = (event) => {
  if (!event || typeof event !== 'object') {
    return event;
  }

  const {
    host_name,
    host_email,
    customer_name,
    customer_email,
    ...rest
  } = event;

  return {
    ...rest,
    customer_name: customer_name ?? host_name ?? null,
    customer_email: customer_email ?? host_email ?? null
  };
};

let customerColumnCache = null;
const hasCustomerContactColumns = async () => {
  if (customerColumnCache === true) {
    return true;
  }

  try {
    const hasColumn = await db.schema.hasColumn('events', 'customer_email');
    if (hasColumn) {
      customerColumnCache = true;
    }
    return hasColumn;
  } catch (error) {
    logger.debug('Failed to detect customer_email column', { error: error.message });
    return false;
  }
};

// Create new event
router.post('/', adminAuth, [
  body('event_type').isIn(['wedding', 'birthday', 'corporate', 'other']),
  body('event_name').notEmpty().trim(),
  body('event_date').isDate(),
  body('customer_name').notEmpty().trim(),
  body('customer_email').isEmail().normalizeEmail(),
  body('admin_email').isEmail().normalizeEmail(),
  body('require_password').optional().isBoolean(),
  body('password').optional().isString().custom((value, { req }) => {
    const input = req.body.require_password;
    const normalizeBoolean = (val, defaultValue = true) => {
      if (val === undefined || val === null) return defaultValue;
      if (typeof val === 'boolean') return val;
      if (typeof val === 'number') return val !== 0;
      if (typeof val === 'string') {
        const normalized = val.trim().toLowerCase();
        if (['false', '0', 'no', 'off'].includes(normalized)) return false;
        if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
      }
      return defaultValue;
    };

    const requirePassword = normalizeBoolean(input, true);
    if (!requirePassword) {
      return true;
    }
    if (typeof value !== 'string' || value.trim().length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }
    return true;
  }),
  body('expiration_days').isInt({ min: 1, max: 365 }).optional(),
  body('welcome_message').optional().trim(),
  body('color_theme').optional().trim(),
  body('allow_user_uploads').optional().isBoolean().toBoolean(),
  body('upload_category_id').optional({ nullable: true, checkFalsy: true }).isInt(),
  body('allow_downloads').optional().isBoolean(),
  body('disable_right_click').optional().isBoolean(),
  body('watermark_downloads').optional().isBoolean(),
  body('watermark_text').optional().trim()
], async (req, res) => {
  try {
    logger.debug('Create event request body', { body: req.body });
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error('Validation errors:', errors.array());
      return res.status(400).json({ errors: errors.array() });
    }
    
    const {
      event_type,
      event_name,
      event_date,
      admin_email,
      password,
      welcome_message = '',
      color_theme = null,
      expiration_days = 30,
      allow_user_uploads = false,
      upload_category_id = null,
      allow_downloads = true,
      disable_right_click = false,
      watermark_downloads = false,
      watermark_text = null,
      require_password: requirePasswordInput = true,
      // Feedback settings
      feedback_enabled = false,
      allow_ratings = true,
      allow_likes = true,
      allow_comments = true,
      allow_favorites = true,
      require_name_email = false,
      moderate_comments = true,
      show_feedback_to_guests = true
    } = req.body;

    const customerName = getCustomerNameFromPayload(req.body);
    const customerEmail = getCustomerEmailFromPayload(req.body);

    const customerColumnsAvailable = await hasCustomerContactColumns();

    if (!customerName || !customerEmail) {
      return res.status(400).json({ error: 'customer_name and customer_email are required' });
    }

    const requirePassword = parseBooleanInput(requirePasswordInput, true);

    // Debug logging
    logger.debug('Download control values', {
      allow_downloads,
      disable_right_click,
      watermark_downloads,
      watermark_text,
      require_password: requirePassword,
      types: {
        allow_downloads: typeof allow_downloads,
        disable_right_click: typeof disable_right_click,
        watermark_downloads: typeof watermark_downloads
      }
    });
    
    let passwordValidation = null;

    if (requirePassword) {
      passwordValidation = await validatePasswordInContext(password, 'gallery', {
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
    const processedEventName = event_name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-') // Replace non-alphanumeric with dash
      .replace(/-+/g, '-')         // Replace multiple dashes with single dash
      .replace(/^-|-$/g, '');      // Remove leading/trailing dashes
    const baseSlug = `${event_type}-${processedEventName}-${event_date}`;
    let slug = baseSlug;
    let counter = 1;
    
    while (await db('events').where({ slug }).first()) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
    
    // Generate share link respecting configured format
    const shareToken = crypto.randomBytes(16).toString('hex');
    const { sharePath, shareUrl, shareLinkToStore } = await buildShareLinkVariants({ slug, shareToken });
    
    // Hash password with configurable rounds (random placeholder when not required)
    const password_hash = requirePassword
      ? await bcrypt.hash(password, getBcryptRounds())
      : await bcrypt.hash(crypto.randomBytes(32).toString('hex'), getBcryptRounds());
    
    // Calculate expiration date (days after event date)
    // Parse YYYY-MM-DD format as local date to avoid timezone issues
    let expires_at;
    if (event_date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [year, month, day] = event_date.split('-').map(num => parseInt(num, 10));
      expires_at = new Date(year, month - 1, day);
    } else {
      expires_at = new Date(event_date);
    }
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
      ...(customerColumnsAvailable ? { customer_name: customerName, customer_email: customerEmail } : {}),
      host_name: customerName,
      host_email: customerEmail,
      admin_email,
      password_hash,
      welcome_message,
      color_theme,
      share_link: shareLinkToStore,
      share_token: shareToken,
      expires_at: expires_at.toISOString(),
      created_at: new Date().toISOString(),
      allow_user_uploads,
      upload_category_id,
      allow_downloads: formatBoolean(allow_downloads !== undefined ? allow_downloads : true),
      disable_right_click: formatBoolean(disable_right_click !== undefined ? disable_right_click : false),
      watermark_downloads: formatBoolean(watermark_downloads !== undefined ? watermark_downloads : false),
      watermark_text,
      require_password: formatBoolean(requirePassword)
    }).returning('id');
    
    // Handle both PostgreSQL (returns array of objects) and SQLite (returns array of IDs)
    const eventId = insertResult[0]?.id || insertResult[0];
    
    // Insert feedback settings if feedback is enabled
    if (feedback_enabled) {
      await db('event_feedback_settings').insert({
        event_id: eventId,
        feedback_enabled: formatBoolean(feedback_enabled),
        allow_ratings: formatBoolean(allow_ratings),
        allow_likes: formatBoolean(allow_likes),
        allow_comments: formatBoolean(allow_comments),
        allow_favorites: formatBoolean(allow_favorites),
        require_name_email: formatBoolean(require_name_email),
        moderate_comments: formatBoolean(moderate_comments),
        show_feedback_to_guests: formatBoolean(show_feedback_to_guests),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }
    
    // Log activity
    await logActivity('event_created', 
      { event_type, expires_at, require_password: requirePassword, password_strength: passwordValidation?.score }, 
      eventId, 
      { type: 'admin', id: req.admin.id, name: req.admin.username }
    );
    
    // Queue creation email
    // Language detection is handled by email processor
    
    await db('email_queue').insert({
      event_id: eventId,
      recipient_email: customerEmail,
      email_type: 'gallery_created',
      email_data: JSON.stringify({
        customer_name: customerName,
        customer_email: customerEmail,
        host_name: customerName || (customerEmail ? customerEmail.split('@')[0] : null),
        event_name,
        event_date: event_date,  // Pass raw date - will be formatted by email processor
        gallery_link: shareUrl,
        gallery_password: requirePassword ? password : 'No password required',
        expiry_date: expires_at.toISOString(),  // Pass ISO string - will be formatted by email processor
        welcome_message: welcome_message || ''
      }),
      status: 'pending',
      created_at: new Date()
      // scheduled_at will use default value
    });
    
    res.json({
      id: eventId,
      slug,
      event_name,
      event_type,
      customer_name: customerName,
      customer_email: customerEmail,
      require_password: requirePassword,
      share_link: shareUrl,
      expires_at: expires_at.toISOString(),
      created_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// Get all events with pagination and filters
router.get('/', adminAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const status = req.query.status || 'all';
    const sortBy = req.query.sortBy || 'created_at';
    const sortOrder = req.query.sortOrder || 'desc';

    // Build query
    let query = db('events');
    
    // Apply search filter
    if (search) {
      const escapedSearch = escapeLikePattern(search);
      query = query.where((builder) => {
        builder.where('event_name', 'like', `%${escapedSearch}%`)
          .orWhere('admin_email', 'like', `%${escapedSearch}%`)
          .orWhere('slug', 'like', `%${escapedSearch}%`);
      });
    }

    // Apply status filter
    if (status === 'active') {
      query = query.where('is_active', formatBoolean(true)).where('is_archived', formatBoolean(false));
    } else if (status === 'archived') {
      query = query.where('is_archived', formatBoolean(true));
    } else if (status === 'inactive') {
      query = query.where('is_active', formatBoolean(false)).where('is_archived', formatBoolean(false));
    } else if (status === 'expiring') {
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
      query = query
        .where('is_active', formatBoolean(true))
        .where('is_archived', formatBoolean(false))
        .where('expires_at', '<=', sevenDaysFromNow.toISOString())
        .where('expires_at', '>', new Date().toISOString());
    }

    // Get total count for pagination
    const countQuery = query.clone();
    const [{ count }] = await countQuery.count('* as count');

    // Apply sorting and pagination
    const events = await query
      .orderBy(sortBy, sortOrder)
      .limit(limit)
      .offset(offset);

    // Get photo counts for each event
    const eventIds = events.map(e => e.id);
    const photoCounts = await db('photos')
      .whereIn('event_id', eventIds)
      .groupBy('event_id')
      .select('event_id')
      .count('* as count');

    // Map photo counts to events
    const photoCountMap = photoCounts.reduce((acc, { event_id, count }) => {
      acc[event_id] = parseInt(count);
      return acc;
    }, {});

    // Add photo counts to events and convert dates
    const eventsWithCounts = events.map(event => ({
      ...event,
      photo_count: photoCountMap[event.id] || 0,
      // Convert Unix timestamps to ISO strings
      created_at: event.created_at ? new Date(event.created_at).toISOString() : null,
      expires_at: event.expires_at ? new Date(event.expires_at).toISOString() : null,
      archived_at: event.archived_at ? new Date(event.archived_at).toISOString() : null
    })).map(mapEventForApi);

    res.json({
      events: eventsWithCounts,
      pagination: {
        page,
        limit,
        total: parseInt(count),
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// Get single event details
router.get('/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const event = await db('events')
      .where('id', id)
      .first();

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Get photo count
    const [{ count: photoCount }] = await db('photos')
      .where('event_id', id)
      .count('* as count');

    // Get total size
    const [{ totalSize }] = await db('photos')
      .where('event_id', id)
      .sum('size_bytes as totalSize');

    // Get recent photos
    const recentPhotos = await db('photos')
      .where('event_id', id)
      .orderBy('uploaded_at', 'desc')
      .limit(10)
      .select('filename', 'type', 'size_bytes', 'uploaded_at');

    // Get view and download statistics
    const [{ totalViews }] = await db('access_logs')
      .where('event_id', id)
      .where('action', 'view')
      .count('* as totalViews');

    const [{ totalDownloads }] = await db('access_logs')
      .where('event_id', id)
      .where('action', 'download')
      .count('* as totalDownloads');

    const [{ uniqueVisitors }] = await db('access_logs')
      .where('event_id', id)
      .countDistinct('ip_address as uniqueVisitors');

    res.json(mapEventForApi({
      ...event,
      photo_count: parseInt(photoCount) || 0,
      total_size: parseInt(totalSize) || 0,
      total_views: parseInt(totalViews) || 0,
      total_downloads: parseInt(totalDownloads) || 0,
      unique_visitors: parseInt(uniqueVisitors) || 0,
      recent_photos: recentPhotos
    }));
  } catch (error) {
    console.error('Error fetching event:', error);
    res.status(500).json({ error: 'Failed to fetch event details' });
  }
});

// Update event
router.put('/:id', adminAuth, [
  body('event_name').optional().trim().notEmpty(),
  body('admin_email').optional().isEmail(),
  body('is_active').optional().isBoolean(),
  body('expires_at').optional().isISO8601(),
  body('welcome_message').optional({ nullable: true, checkFalsy: true }).trim(),
  body('color_theme').optional({ nullable: true }),
  body('allow_user_uploads').optional().isBoolean(),
  body('customer_name').optional().trim().notEmpty(),
  body('customer_email').optional().isEmail().normalizeEmail(),
  body('upload_category_id').optional().custom((value) => {
    // Accept null, undefined, or integer values
    if (value === null || value === undefined) return true;
    return Number.isInteger(Number(value));
  }).withMessage('upload_category_id must be an integer or null'),
  body('hero_photo_id').optional().custom((value) => {
    // Accept null, undefined, or numeric values
    if (value === null || value === undefined) return true;
    // Check if it's a number or can be converted to a valid integer
    const num = Number(value);
    return !isNaN(num) && Number.isInteger(num);
  }).withMessage('hero_photo_id must be an integer or null'),
  body('allow_downloads').optional().isBoolean(),
  body('disable_right_click').optional().isBoolean(),
  body('watermark_downloads').optional().isBoolean(),
  body('watermark_text').optional().trim(),
  body('source_mode').optional().isIn(['managed', 'reference']),
  body('external_path').optional({ nullable: true }).isString().trim(),
  body('require_password').optional().isBoolean(),
  body('password').optional().isString().custom((value, { req }) => {
    if (value === undefined || value === null || value === '') {
      return true;
    }
    if (typeof value !== 'string' || value.trim().length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }
    return true;
  })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.debug('Update event validation errors', { errors: errors.array(), body: req.body });
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const updates = { ...req.body };
    const customerColumnsAvailable = await hasCustomerContactColumns();

    if (Object.prototype.hasOwnProperty.call(updates, 'host_name') || Object.prototype.hasOwnProperty.call(updates, 'host_email')) {
      return res.status(400).json({ error: 'host_name and host_email are no longer supported. Use customer_name and customer_email instead.' });
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'customer_name')) {
      const nextName = getCustomerNameFromPayload(updates);
      if (nextName) {
        if (customerColumnsAvailable) {
          updates.customer_name = nextName;
        } else {
          delete updates.customer_name;
        }
        updates.host_name = nextName;
      } else {
        delete updates.customer_name;
      }
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'customer_email')) {
      const nextEmail = getCustomerEmailFromPayload(updates);
      if (nextEmail) {
        if (customerColumnsAvailable) {
          updates.customer_email = nextEmail;
        } else {
          delete updates.customer_email;
        }
        updates.host_email = nextEmail;
      } else {
        delete updates.customer_email;
      }
    }

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

    if (Object.prototype.hasOwnProperty.call(updates, 'source_mode')) {
      updates.source_mode = updates.source_mode === 'reference' ? 'reference' : 'managed';
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'external_path')) {
      const trimmedPath = updates.external_path ? String(updates.external_path).trim() : '';
      updates.external_path = trimmedPath || null;
    }

    if (updates.source_mode === 'managed') {
      updates.external_path = null;
    }

    if (updates.source_mode === 'reference' && (updates.external_path === null || updates.external_path === undefined)) {
      return res.status(400).json({ error: 'external_path is required when source_mode is reference' });
    }

    // Log the update request for debugging
    logger.debug('Update event request', {
      id,
      updates,
      color_theme_length: updates.color_theme ? updates.color_theme.length : 0,
      color_theme_type: typeof updates.color_theme,
      hero_photo_id: updates.hero_photo_id,
      hero_photo_id_type: typeof updates.hero_photo_id
    });

    // Check if event exists
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

    // Update event
    await db('events')
      .where('id', id)
      .update(updates);

    // Log activity
    await logActivity('event_updated',
      { changes: Object.keys(updates), eventName: event.event_name },
      id,
      { type: 'admin', id: req.admin.id, name: req.admin.username }
    );

    res.json({ message: 'Event updated successfully' });
  } catch (error) {
    console.error('Error updating event:', error);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

// Delete event
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if event exists
    const event = await db('events').where('id', id).first();
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Start a transaction to ensure all deletions succeed or fail together
    await db.transaction(async (trx) => {
      // 1. Delete activity logs (audit trail)
      await trx('activity_logs').where('event_id', id).del();

      // 2. Delete access logs
      await trx('access_logs').where('event_id', id).del();

      // 3. Delete email queue entries
      await trx('email_queue').where('event_id', id).del();

      // 4. Delete photos (this will also handle hero_photo_id foreign key)
      await trx('photos').where('event_id', id).del();

      // 5. Finally delete the event
      await trx('events').where('id', id).del();

      // Delete event folder from storage if it exists
      if (event.folder_path) {
        const storagePath = process.env.STORAGE_PATH || path.join(__dirname, '../../../storage');
        const eventFolderPath = path.join(storagePath, 'events', 'active', event.folder_path);
        
        try {
          const fsPromises = require('fs').promises;
          await fsPromises.rm(eventFolderPath, { recursive: true, force: true });
        } catch (err) {
          console.error('Failed to delete event folder:', err);
          // Don't fail the transaction if folder deletion fails
        }
      }

      // Delete archive if exists
      if (event.archive_path) {
        const storagePath = process.env.STORAGE_PATH || path.join(__dirname, '../../../storage');
        const archivePath = path.join(storagePath, event.archive_path);
        
        try {
          const fsPromises = require('fs').promises;
          await fsPromises.unlink(archivePath);
        } catch (err) {
          console.error('Failed to delete archive file:', err);
          // Don't fail the transaction if file deletion fails
        }
      }
    });

    // Log activity (outside transaction)
    await logActivity('event_deleted',
      { event_name: event.event_name },
      null,
      { type: 'admin', id: req.admin.id, name: req.admin.username }
    );

    res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    console.error('Error deleting event:', error);
    
    // Provide more specific error messages
    if (error.message && error.message.includes('foreign key constraint')) {
      res.status(500).json({ 
        error: 'Cannot delete event due to existing references. Please contact support.'
      });
    } else {
      res.status(500).json({ 
        error: 'Failed to delete event'
      });
    }
  }
});

// Toggle event status
router.post('/:id/toggle-status', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const event = await db('events').where('id', id).first();
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const newStatus = !event.is_active;
    await db('events')
      .where('id', id)
      .update({
        is_active: newStatus,
        updated_at: new Date()
      });

    // Log activity
    await logActivity(newStatus ? 'event_activated' : 'event_deactivated',
      { eventName: event.event_name },
      id,
      { type: 'admin', id: req.admin.id, name: req.admin.username }
    );

    res.json({ 
      message: `Event ${newStatus ? 'activated' : 'deactivated'} successfully`,
      is_active: newStatus
    });
  } catch (error) {
    console.error('Error toggling event status:', error);
    res.status(500).json({ error: 'Failed to toggle event status' });
  }
});

// Reset event password
router.post('/:id/reset-password', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { sendEmail = true } = req.body;

    const event = await db('events').where('id', id).first();
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (event.is_archived) {
      return res.status(400).json({ error: 'Cannot reset password for archived event' });
    }

    // Generate new password
    const { generateReadablePassword } = require('../utils/passwordGenerator');
    const newPassword = generateReadablePassword();
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update event with new password
    await db('events')
      .where('id', id)
      .update({
        password_hash: passwordHash
      });

    // Log activity
    await logActivity('password_reset',
      { eventName: event.event_name, emailSent: sendEmail },
      id,
      { type: 'admin', id: req.admin.id, name: req.admin.username }
    );

    // Queue email notification if requested
    if (sendEmail) {
      const recipientEmail = event.customer_email || event.host_email;
      const recipientName = event.customer_name || event.host_name || (recipientEmail ? recipientEmail.split('@')[0] : null);

      await queueEmail(id, recipientEmail, 'gallery_created', {
        customer_name: recipientName,
        customer_email: recipientEmail,
        host_name: recipientName,
        event_name: event.event_name,
        event_date: event.event_date,  // Pass raw date - will be formatted by email processor
        gallery_link: event.share_link,
        gallery_password: newPassword,
        expiry_date: event.expires_at  // Pass raw date - will be formatted by email processor
      });
    }

    res.json({ 
      message: 'Password reset successfully',
      newPassword: newPassword,
      emailSent: sendEmail
    });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Resend creation email
router.post('/:id/resend-email', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get event details
    const event = await db('events')
      .where('id', id)
      .first();
    
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    // The email processor will determine the language based on:
    // 1. Event language setting
    // 2. App settings general_default_language  
    // 3. Email config default language
    // 4. Domain-based detection
    // So we don't need to determine it here
    
    // For resending creation email, we need the actual password
    // First, try to get it from the request body if provided
    let galleryPassword = req.body.password;
    
    // If no password provided, we can't decrypt the existing one
    // So we'll show a security message
    if (!galleryPassword) {
      // We'll let the email processor determine the language for the security message
      galleryPassword = '{{password_security_message}}';
    }
    
    // Dates will be formatted by the email processor based on recipient language
    
    // Queue the email
    const recipientEmail = event.customer_email || event.host_email;
    const recipientName = event.customer_name || event.host_name || (recipientEmail ? recipientEmail.split('@')[0] : null);

    await queueEmail(id, recipientEmail, 'gallery_created', {
      customer_name: recipientName,
      customer_email: recipientEmail,
      host_name: recipientName,
      event_name: event.event_name,
      event_date: event.event_date,  // Pass raw date - will be formatted by email processor
      gallery_link: event.share_link,
      gallery_password: galleryPassword,
      expiry_date: event.expires_at,  // Pass raw date - will be formatted by email processor
      welcome_message: event.welcome_message || '',
      eventId: id,
      isResend: true // Flag to indicate this is a resend
    });
    
    // Log the activity using the proper schema
    try {
      await logActivity('email_resent', {
        email_type: 'gallery_created',
        recipient: recipientEmail,
        ip_address: req.ip || '0.0.0.0',
        user_agent: req.get('user-agent') || 'Unknown'
      }, id, {
        type: 'admin',
        id: req.admin.id,
        name: req.admin.username
      });
    } catch (logError) {
      console.error('Warning: Failed to log activity:', logError);
      // Don't fail the request if activity logging fails
    }
    
    res.json({ 
      success: true,
      message: 'Creation email has been queued for sending'
    });
  } catch (error) {
    console.error('Error resending creation email:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ error: 'Failed to resend creation email' });
  }
});

// Archive event
router.post('/:id/archive', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const event = await db('events').where('id', id).first();
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (event.is_archived) {
      return res.status(400).json({ error: 'Event is already archived' });
    }

    // Use the archive service to create ZIP archive
    await archiveEvent(event);

    // Log activity
    await logActivity('event_archived',
      { eventName: event.event_name },
      id,
      { type: 'admin', id: req.admin.id, name: req.admin.username }
    );

    res.json({ message: 'Event archived successfully' });
  } catch (error) {
    console.error('Error archiving event:', error);
    res.status(500).json({ error: 'Failed to archive event' });
  }
});

// Bulk archive events
router.post('/bulk-archive', adminAuth, [
  body('eventIds').isArray().withMessage('eventIds must be an array'),
  body('eventIds.*').isInt().withMessage('Each eventId must be an integer')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { eventIds } = req.body;
    
    if (eventIds.length === 0) {
      return res.status(400).json({ error: 'No events selected for archiving' });
    }

    // Get all events to archive
    const events = await db('events')
      .whereIn('id', eventIds)
      .where('is_archived', formatBoolean(false));

    if (events.length === 0) {
      return res.status(400).json({ error: 'No valid events found to archive' });
    }

    const results = {
      successful: [],
      failed: []
    };

    // Process each event
    for (const event of events) {
      try {
        // Use the archive service to create ZIP archive
        await archiveEvent(event);
        
        // Log activity
        await logActivity('event_archived',
          { eventName: event.event_name, bulkOperation: true },
          event.id,
          { type: 'admin', id: req.admin.id, name: req.admin.username }
        );
        
        results.successful.push({
          id: event.id,
          name: event.event_name
        });
      } catch (error) {
        console.error(`Failed to archive event ${event.id}:`, error);
        results.failed.push({
          id: event.id,
          name: event.event_name,
          error: 'Failed to archive event. Check server logs for details.'
        });
      }
    }

    // Log bulk archive activity
    await logActivity('bulk_archive_completed',
      { 
        totalEvents: eventIds.length,
        successfulCount: results.successful.length,
        failedCount: results.failed.length
      },
      null,
      { type: 'admin', id: req.admin.id, name: req.admin.username }
    );

    res.json({
      message: `Bulk archive completed: ${results.successful.length} succeeded, ${results.failed.length} failed`,
      results
    });
  } catch (error) {
    console.error('Error in bulk archive:', error);
    res.status(500).json({ error: 'Failed to perform bulk archive' });
  }
});

module.exports = router;
