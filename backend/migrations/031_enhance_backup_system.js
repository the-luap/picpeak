exports.up = function(knex) {
  return knex.schema
    // Add new settings to app_settings table
    .table('app_settings', table => {
      // S3 configuration enhancements
      table.boolean('backup_s3_force_path_style').defaultTo(false).comment('Force path-style S3 URLs (for MinIO/self-hosted)');
      table.boolean('backup_s3_ssl_enabled').defaultTo(true).comment('Enable SSL/TLS for S3 connections');
      table.string('backup_s3_prefix', 255).comment('S3 key prefix for organizing backups');
      
      // Backup features
      table.boolean('backup_incremental').defaultTo(false).comment('Enable incremental backups');
      table.boolean('backup_include_database').defaultTo(true).comment('Include database dumps in backups');
      table.boolean('backup_manifest_enabled').defaultTo(true).comment('Generate backup manifests');
      table.enum('backup_manifest_format', ['json', 'yaml']).defaultTo('json').comment('Manifest file format');
      table.boolean('backup_encryption_enabled').defaultTo(false).comment('Enable backup encryption');
      table.string('backup_database_schedule', 100).comment('Separate cron schedule for database-only backups');
    })
    
    // Enhance backup_runs table
    .table('backup_runs', table => {
      // Manifest tracking
      table.string('manifest_path', 500).comment('Path to backup manifest file');
      table.uuid('manifest_id').comment('Unique identifier for the manifest');
      table.enum('manifest_format', ['json', 'yaml']).comment('Format of the manifest file');
      
      // Incremental backup support
      table.integer('parent_backup_id').unsigned().references('id').inTable('backup_runs').onDelete('SET NULL').comment('Parent backup for incremental backups');
      table.enum('backup_mode', ['full', 'incremental', 'database']).defaultTo('full').comment('Type of backup performed');
      
      // Add indexes for better query performance
      table.index(['backup_mode', 'status'], 'idx_backup_runs_mode_status');
      table.index(['parent_backup_id'], 'idx_backup_runs_parent');
      table.index(['created_at', 'backup_mode'], 'idx_backup_runs_created_mode');
    })
    
    // Create backup_manifest table for storing detailed manifest metadata
    .createTable('backup_manifest', table => {
      table.increments('id').primary();
      table.integer('backup_run_id').unsigned().notNullable().references('id').inTable('backup_runs').onDelete('CASCADE');
      table.uuid('manifest_id').notNullable().unique().comment('Unique identifier matching backup_runs.manifest_id');
      table.string('version', 20).notNullable().defaultTo('1.0.0').comment('Manifest schema version');
      table.enum('format', ['json', 'yaml']).notNullable().defaultTo('json');
      
      // Backup metadata
      table.timestamp('backup_start').notNullable();
      table.timestamp('backup_end').notNullable();
      table.bigInteger('total_size').unsigned().comment('Total size of backup in bytes');
      table.integer('file_count').unsigned().comment('Number of files in backup');
      table.integer('photo_count').unsigned().comment('Number of photos backed up');
      table.integer('event_count').unsigned().comment('Number of events backed up');
      
      // Incremental backup metadata
      table.boolean('is_incremental').defaultTo(false);
      table.uuid('parent_manifest_id').comment('Parent manifest ID for incremental backups');
      table.timestamp('incremental_since').comment('Timestamp for incremental backup baseline');
      
      // Content checksums
      table.string('checksum_algorithm', 50).defaultTo('sha256').comment('Algorithm used for checksums');
      table.text('manifest_checksum').comment('Checksum of the manifest file itself');
      
      // Storage information
      table.string('storage_location', 500).comment('Primary storage location (local path or S3 URI)');
      table.string('storage_provider', 50).comment('Storage provider (local, s3, etc.)');
      
      // Encryption metadata
      table.boolean('is_encrypted').defaultTo(false);
      table.string('encryption_algorithm', 100).comment('Encryption algorithm used');
      table.string('encryption_key_id', 255).comment('ID of encryption key used');
      
      // Additional metadata as JSON
      table.json('metadata').comment('Additional metadata as JSON');
      
      // Timestamps
      table.timestamps(true, true);
      
      // Indexes
      table.index(['backup_run_id'], 'idx_manifest_backup_run');
      table.index(['manifest_id'], 'idx_manifest_uuid');
      table.index(['parent_manifest_id'], 'idx_manifest_parent');
      table.index(['backup_start', 'backup_end'], 'idx_manifest_time_range');
      table.index(['is_incremental', 'created_at'], 'idx_manifest_incremental_created');
    })
    
    // Add composite indexes for common query patterns
    .raw(`
      CREATE INDEX IF NOT EXISTS idx_backup_runs_recent_successful 
      ON backup_runs(created_at DESC) 
      WHERE status = 'completed' AND backup_mode = 'full';
    `)
    .raw(`
      CREATE INDEX IF NOT EXISTS idx_backup_runs_incremental_chain 
      ON backup_runs(parent_backup_id, created_at) 
      WHERE backup_mode = 'incremental';
    `);
};

exports.down = function(knex) {
  return knex.schema
    // Drop indexes first
    .raw('DROP INDEX IF EXISTS idx_backup_runs_incremental_chain;')
    .raw('DROP INDEX IF EXISTS idx_backup_runs_recent_successful;')
    
    // Drop backup_manifest table
    .dropTableIfExists('backup_manifest')
    
    // Remove columns from backup_runs table
    .table('backup_runs', table => {
      table.dropIndex(['backup_mode', 'status'], 'idx_backup_runs_mode_status');
      table.dropIndex(['parent_backup_id'], 'idx_backup_runs_parent');
      table.dropIndex(['created_at', 'backup_mode'], 'idx_backup_runs_created_mode');
      
      table.dropColumn('manifest_path');
      table.dropColumn('manifest_id');
      table.dropColumn('manifest_format');
      table.dropColumn('parent_backup_id');
      table.dropColumn('backup_mode');
    })
    
    // Remove columns from app_settings table
    .table('app_settings', table => {
      table.dropColumn('backup_s3_force_path_style');
      table.dropColumn('backup_s3_ssl_enabled');
      table.dropColumn('backup_s3_prefix');
      table.dropColumn('backup_incremental');
      table.dropColumn('backup_include_database');
      table.dropColumn('backup_manifest_enabled');
      table.dropColumn('backup_manifest_format');
      table.dropColumn('backup_encryption_enabled');
      table.dropColumn('backup_database_schedule');
    });
};