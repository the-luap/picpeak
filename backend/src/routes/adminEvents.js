const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { db, logActivity } = require('../database/db');
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
const { formatBoolean } = require('../utils/dbCompat');

// Create new event
router.post('/', adminAuth, [
  body('event_type').isIn(['wedding', 'birthday', 'corporate', 'other']),
  body('event_name').notEmpty().trim(),
  body('event_date').isDate(),
  body('host_email').isEmail().normalizeEmail(),
  body('admin_email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('expiration_days').isInt({ min: 1, max: 365 }).optional(),
  body('welcome_message').optional().trim(),
  body('color_theme').optional().trim(),
  body('allow_user_uploads').optional().isBoolean().toBoolean(),
  body('upload_category_id').optional({ nullable: true, checkFalsy: true }).isInt(),
  body('host_name').notEmpty().trim()
], async (req, res) => {
  try {
    console.log('Create event request body:', req.body);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error('Validation errors:', errors.array());
      return res.status(400).json({ errors: errors.array() });
    }
    
    const {
      event_type,
      event_name,
      event_date,
      host_name,
      host_email,
      admin_email,
      password,
      welcome_message = '',
      color_theme = null,
      expiration_days = 30,
      allow_user_uploads = false,
      upload_category_id = null
    } = req.body;
    
    // Validate password strength
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
    
    // Generate share link
    const shareToken = crypto.randomBytes(16).toString('hex');
    const shareLink = `${process.env.FRONTEND_URL}/gallery/${slug}/${shareToken}`;
    
    // Hash password with configurable rounds
    const password_hash = await bcrypt.hash(password, getBcryptRounds());
    
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
      host_name,
      host_email,
      admin_email,
      password_hash,
      welcome_message,
      color_theme,
      share_link: shareLink,
      expires_at: expires_at.toISOString(),
      created_at: new Date().toISOString(),
      allow_user_uploads,
      upload_category_id
    }).returning('id');
    
    // Handle both PostgreSQL (returns array of objects) and SQLite (returns array of IDs)
    const eventId = insertResult[0]?.id || insertResult[0];
    
    // Log activity
    await logActivity('event_created', 
      { event_type, expires_at }, 
      eventId, 
      { type: 'admin', id: req.admin.id, name: req.admin.username }
    );
    
    // Queue creation email
    // Language detection is handled by email processor
    
    await db('email_queue').insert({
      event_id: eventId,
      recipient_email: host_email,
      email_type: 'gallery_created',
      email_data: JSON.stringify({
        host_name: host_name,
        event_name,
        event_date: event_date,  // Pass raw date - will be formatted by email processor
        gallery_link: shareLink,
        gallery_password: password,
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
      share_link: shareLink,
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
    }));

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

    res.json({
      ...event,
      photo_count: parseInt(photoCount) || 0,
      total_size: parseInt(totalSize) || 0,
      total_views: parseInt(totalViews) || 0,
      total_downloads: parseInt(totalDownloads) || 0,
      unique_visitors: parseInt(uniqueVisitors) || 0,
      recent_photos: recentPhotos
    });
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
  body('host_name').optional().trim().notEmpty(),
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
  }).withMessage('hero_photo_id must be an integer or null')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Update event validation errors:', JSON.stringify(errors.array(), null, 2));
      console.log('Request body:', req.body);
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const updates = req.body;

    // Log the update request for debugging
    console.log('Update event request:', {
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

      // 5. Delete categories (photo_categories has CASCADE delete for event_id)
      await trx('photo_categories').where('event_id', id).del();

      // 6. Finally delete the event
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
        error: 'Cannot delete event due to existing references. Please contact support.',
        details: error.message 
      });
    } else {
      res.status(500).json({ 
        error: 'Failed to delete event',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
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
      // For password reset, we'll need to create a template or use a different approach
      // For now, let's use the gallery_created template with updated password
      await queueEmail(id, event.host_email, 'gallery_created', {
        host_name: event.host_email.split('@')[0],
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
    await queueEmail(id, event.host_email, 'gallery_created', {
      host_name: event.host_name || event.host_email.split('@')[0],
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
        recipient: event.host_email,
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
          error: error.message
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