const fs = require('fs');
const path = require('path');
const knex = require('knex');
const knexConfig = require('../../knexfile');
const logger = require('../utils/logger');

// Ensure SQLite directory exists when using file-based DB (native installs)
try {
  const isPostgres = knexConfig && knexConfig.client === 'pg';
  if (!isPostgres && knexConfig && knexConfig.connection) {
    const filename = typeof knexConfig.connection === 'object'
      ? knexConfig.connection.filename
      : (typeof knexConfig.connection === 'string' ? knexConfig.connection : null);
    if (filename && typeof filename === 'string') {
      const dir = path.dirname(filename);
      if (dir && dir !== '.') {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }
} catch (e) {
  // Non-fatal: log and continue; SQLite will fail later if still missing
  try { logger.warn('SQLite directory ensure failed', { error: e.message }); } catch (_) {}
}

// Create database connection with built-in retry logic
const db = knex(knexConfig);

// Connection retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

// Wrapper function to handle connection retries
async function withRetry(queryFn, retries = MAX_RETRIES) {
  for (let i = 0; i < retries; i++) {
    try {
      return await queryFn();
    } catch (error) {
      const isConnectionError = error.message && (
        error.message.includes('Connection terminated unexpectedly') ||
        error.message.includes('Connection ended unexpectedly') ||
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('ETIMEDOUT')
      );
      
      if (isConnectionError && i < retries - 1) {
        logger.info(`Database connection error, retrying in ${RETRY_DELAY}ms... (attempt ${i + 1}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (i + 1)));
        continue;
      }
      throw error;
    }
  }
}

async function initializeDatabase() {
  // Events table
  const hasEventsTable = await db.schema.hasTable('events');
  if (!hasEventsTable) {
    await db.schema.createTable('events', (table) => {
      table.increments('id').primary();
      table.string('slug').unique().notNullable();
      table.string('event_type').notNullable();
      table.string('event_name').notNullable();
      table.date('event_date').notNullable();
      table.string('host_email').notNullable();
      table.string('admin_email').notNullable();
      table.string('password_hash').notNullable();
      table.text('welcome_message');
      table.text('color_theme');
      table.string('share_link').unique().notNullable();
      table.datetime('created_at').defaultTo(db.fn.now());
      table.datetime('expires_at').notNullable();
      table.boolean('is_active').defaultTo(true);
      table.boolean('is_archived').defaultTo(false);
      table.string('archive_path');
      table.datetime('archived_at');
      table.boolean('allow_user_uploads').defaultTo(false);
      table.integer('upload_category_id');
      table.boolean('allow_downloads').defaultTo(true);
      table.boolean('disable_right_click').defaultTo(false);
      table.boolean('watermark_downloads').defaultTo(false);
      table.text('watermark_text');
      table.integer('hero_photo_id').references('id').inTable('photos').onDelete('SET NULL');
    });
  } else {
    // Check if color_theme needs to be updated to TEXT type
    // This is needed for larger theme configurations
    const isPostgres = knexConfig.client === 'pg';
    
    if (!isPostgres) {
      // SQLite-specific migration
      try {
        await db.raw(`
          CREATE TABLE IF NOT EXISTS events_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            slug TEXT UNIQUE NOT NULL,
            event_type TEXT NOT NULL,
            event_name TEXT NOT NULL,
            event_date DATE NOT NULL,
            host_email TEXT NOT NULL,
            admin_email TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            welcome_message TEXT,
            color_theme TEXT,
            share_link TEXT UNIQUE NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME NOT NULL,
            is_active BOOLEAN DEFAULT 1,
            is_archived BOOLEAN DEFAULT 0,
            archive_path TEXT,
            archived_at DATETIME,
            allow_user_uploads BOOLEAN DEFAULT 0,
            upload_category_id INTEGER,
            allow_downloads BOOLEAN DEFAULT 1,
            disable_right_click BOOLEAN DEFAULT 0,
            watermark_downloads BOOLEAN DEFAULT 0,
            watermark_text TEXT,
            hero_photo_id INTEGER
          )
        `);
        
        const pragmaRows = await db.raw("PRAGMA table_info('events')");
        const existingColumns = pragmaRows.map(row => row.name);
        const selectColumns = existingColumns.map((col) => {
          switch (col) {
            case 'allow_user_uploads':
              return "COALESCE(allow_user_uploads, 0) as allow_user_uploads";
            case 'upload_category_id':
              return "upload_category_id";
            case 'allow_downloads':
              return "COALESCE(allow_downloads, 1) as allow_downloads";
            case 'disable_right_click':
              return "COALESCE(disable_right_click, 0) as disable_right_click";
            case 'watermark_downloads':
              return "COALESCE(watermark_downloads, 0) as watermark_downloads";
            case 'watermark_text':
              return 'watermark_text';
            case 'hero_photo_id':
              return 'hero_photo_id';
            default:
              return col;
          }
        });

        await db.raw(`INSERT INTO events_new (${existingColumns.join(', ')}) SELECT ${selectColumns.join(', ')} FROM events`);
        await db.raw('DROP TABLE events');
        await db.raw('ALTER TABLE events_new RENAME TO events');
      } catch (error) {
        // If the migration fails, it might already have been applied
        logger.debug('Color theme migration may have already been applied');
      }
    }
  }

  // Photo metadata table
  const hasPhotosTable = await db.schema.hasTable('photos');
  if (!hasPhotosTable) {
    await db.schema.createTable('photos', (table) => {
      table.increments('id').primary();
      table.integer('event_id').references('id').inTable('events').onDelete('CASCADE');
      table.string('filename').notNullable();
      table.string('path').notNullable();
      table.string('thumbnail_path');
      table.string('type').notNullable(); // 'collage' or 'individual'
      table.integer('size_bytes');
      table.string('uploaded_by').defaultTo('admin');
      table.datetime('uploaded_at').defaultTo(db.fn.now());
      table.integer('view_count').defaultTo(0);
      table.integer('download_count').defaultTo(0);
    });
  }

  // Access logs table
  const hasAccessLogsTable = await db.schema.hasTable('access_logs');
  if (!hasAccessLogsTable) {
    await db.schema.createTable('access_logs', (table) => {
      table.increments('id').primary();
      table.integer('event_id').references('id').inTable('events');
      table.string('ip_address');
      table.string('user_agent');
      table.string('action'); // 'view', 'download', 'login_success', 'login_fail'
      table.string('photo_id');
      table.datetime('timestamp').defaultTo(db.fn.now());
    });
  }

  // Email queue table
  const hasEmailQueueTable = await db.schema.hasTable('email_queue');
  if (!hasEmailQueueTable) {
    await db.schema.createTable('email_queue', (table) => {
      table.increments('id').primary();
      table.integer('event_id').references('id').inTable('events');
      table.string('recipient_email').notNullable();
      table.string('email_type').notNullable(); // 'creation', 'warning', 'expiration', 'archive_complete'
      table.json('email_data');
      table.string('status').defaultTo('pending'); // 'pending', 'sent', 'failed'
      table.datetime('scheduled_at').defaultTo(db.fn.now());
      table.datetime('sent_at');
      table.text('error_message');
      table.integer('retry_count').defaultTo(0);
    });
  }

  // Admin users table
  const hasAdminUsersTable = await db.schema.hasTable('admin_users');
  if (!hasAdminUsersTable) {
    await db.schema.createTable('admin_users', (table) => {
      table.increments('id').primary();
      table.string('username').unique().notNullable();
      table.string('email').unique().notNullable();
      table.string('password_hash').notNullable();
      table.boolean('is_active').defaultTo(true);
      table.boolean('must_change_password').defaultTo(false);
      table.datetime('password_changed_at');
      table.datetime('created_at').defaultTo(db.fn.now());
      table.datetime('updated_at').defaultTo(db.fn.now());
      table.datetime('last_login');
      table.string('last_login_ip');
    });
  } else {
    // Check if updated_at column exists
    const hasUpdatedAt = await db.schema.hasColumn('admin_users', 'updated_at');
    if (!hasUpdatedAt) {
      await db.schema.table('admin_users', (table) => {
        table.datetime('updated_at');
      });
      // Set default value for existing rows
      await db('admin_users').update({ updated_at: new Date() });
    }
    
    // Check if must_change_password column exists
    const hasMustChangePassword = await db.schema.hasColumn('admin_users', 'must_change_password');
    if (!hasMustChangePassword) {
      await db.schema.table('admin_users', (table) => {
        table.boolean('must_change_password').defaultTo(false);
      });
    }
    
    // Check if password_changed_at column exists
    const hasPasswordChangedAt = await db.schema.hasColumn('admin_users', 'password_changed_at');
    if (!hasPasswordChangedAt) {
      await db.schema.table('admin_users', (table) => {
        table.datetime('password_changed_at');
      });
    }
    
    // Check if last_login_ip column exists
    const hasLastLoginIp = await db.schema.hasColumn('admin_users', 'last_login_ip');
    if (!hasLastLoginIp) {
      await db.schema.table('admin_users', (table) => {
        table.string('last_login_ip');
      });
    }
  }

  // Token revocation tables
  const hasRevokedTokensTable = await db.schema.hasTable('revoked_tokens');
  if (!hasRevokedTokensTable) {
    await db.schema.createTable('revoked_tokens', (table) => {
      table.increments('id').primary();
      table.string('token_id').notNullable().unique(); // JWT ID or generated ID
      table.integer('user_id').nullable(); // User who owned the token
      table.string('token_type', 20); // admin, gallery, etc.
      table.timestamp('revoked_at').defaultTo(db.fn.now());
      table.timestamp('expires_at').notNullable(); // When token would have expired
      table.string('reason', 100); // password_change, logout, compromised, etc.
      table.text('metadata'); // Additional JSON data
      
      // Indexes for performance
      table.index('token_id');
      table.index('user_id');
      table.index('expires_at'); // For cleanup
    });
  }

  const hasUserTokenRevocationsTable = await db.schema.hasTable('user_token_revocations');
  if (!hasUserTokenRevocationsTable) {
    await db.schema.createTable('user_token_revocations', (table) => {
      table.integer('user_id').primary();
      table.timestamp('revoked_at').notNullable();
      table.string('reason', 100);
      
      // Index for quick lookups
      table.index('revoked_at');
    });
  }

  // Email configuration table
  const hasEmailConfigTable = await db.schema.hasTable('email_configs');
  if (!hasEmailConfigTable) {
    await db.schema.createTable('email_configs', (table) => {
      table.increments('id').primary();
      table.string('smtp_host').notNullable();
      table.integer('smtp_port').notNullable();
      table.boolean('smtp_secure').defaultTo(false);
      table.string('smtp_user');
      table.string('smtp_pass');
      table.string('from_email').notNullable();
      table.string('from_name');
      table.datetime('updated_at').defaultTo(db.fn.now());
    });
  }

  // Email templates table
  const hasEmailTemplatesTable = await db.schema.hasTable('email_templates');
  if (!hasEmailTemplatesTable) {
    await db.schema.createTable('email_templates', (table) => {
      table.increments('id').primary();
      table.string('template_key').unique().notNullable(); // 'gallery_created', 'expiration_warning', etc.
      table.string('subject').notNullable();
      table.text('body_html').notNullable();
      table.text('body_text');
      table.json('variables'); // Available template variables
      table.datetime('updated_at').defaultTo(db.fn.now());
    });
  }

  // App settings table
  const hasAppSettingsTable = await db.schema.hasTable('app_settings');
  if (!hasAppSettingsTable) {
    await db.schema.createTable('app_settings', (table) => {
      table.increments('id').primary();
      table.string('setting_key').unique().notNullable();
      table.json('setting_value');
      table.string('setting_type'); // 'branding', 'theme', 'general'
      table.datetime('updated_at').defaultTo(db.fn.now());
    });
  }

  // Activity logs table
  const hasActivityLogsTable = await db.schema.hasTable('activity_logs');
  if (!hasActivityLogsTable) {
    await db.schema.createTable('activity_logs', (table) => {
      table.increments('id').primary();
      table.string('activity_type').notNullable(); // 'event_created', 'photos_uploaded', etc.
      table.string('actor_type'); // 'admin', 'system', 'guest'
      table.integer('actor_id');
      table.string('actor_name');
      table.json('metadata'); // Additional data about the activity
      table.integer('event_id').references('id').inTable('events');
      table.datetime('created_at').defaultTo(db.fn.now());
      table.datetime('read_at').nullable();
    });
  } else {
    // Check if read_at column exists
    const hasReadAt = await db.schema.hasColumn('activity_logs', 'read_at');
    if (!hasReadAt) {
      await db.schema.table('activity_logs', (table) => {
        table.datetime('read_at').nullable();
      });
    }
  }
}

// Helper function to log activities
async function logActivity(activityType, metadata = {}, eventId = null, actor = null) {
  try {
    await db('activity_logs').insert({
      activity_type: activityType,
      actor_type: actor?.type || 'system',
      actor_id: actor?.id || null,
      actor_name: actor?.name || null,
      metadata: JSON.stringify(metadata),
      event_id: eventId
    });
  } catch (error) {
    logger.error('Failed to log activity:', { error: error.message });
  }
}

module.exports = { db, initializeDatabase, logActivity, withRetry };
