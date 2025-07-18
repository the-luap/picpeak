const fs = require('fs').promises;
const path = require('path');
const { db } = require('../src/database/db');

/**
 * Production-safe migration runner that handles existing schema
 */

// Create or verify migrations tracking table
async function ensureMigrationsTable() {
  const tableExists = await db.schema.hasTable('migrations');
  if (!tableExists) {
    await db.schema.createTable('migrations', (table) => {
      table.increments('id').primary();
      table.string('filename').unique().notNullable();
      table.timestamp('applied_at').defaultTo(db.fn.now());
    });
    console.log('Created migrations tracking table');
  }
}

// Check if a migration has been applied
async function isMigrationApplied(filename) {
  const result = await db('migrations').where('filename', filename).first();
  return !!result;
}

// Mark migration as applied without running it (for existing schema)
async function markMigrationAsApplied(filename) {
  await db('migrations').insert({ filename });
  console.log(`Marked migration ${filename} as applied`);
}

// Detect existing schema and mark migrations as applied
async function detectExistingSchema() {
  console.log('Detecting existing schema...');
  
  const tableChecks = [
    { table: 'events', migration: 'init.js' },
    { table: 'photos', migration: 'init.js' },
    { table: 'photo_categories', migration: '004_add_categories_and_cms.js' },
    { table: 'cms_pages', migration: '004_add_categories_and_cms.js' },
    { table: 'login_attempts', migration: '015_add_login_attempts_table.js' },
    { table: 'token_blacklist', migration: '017_add_token_revocation_tables.js' },
  ];
  
  for (const check of tableChecks) {
    const exists = await db.schema.hasTable(check.table);
    if (exists) {
      const isApplied = await isMigrationApplied(check.migration);
      if (!isApplied) {
        await markMigrationAsApplied(check.migration);
      }
    }
  }
}

// Run a single migration safely
async function runMigrationSafely(filename) {
  try {
    const migrationPath = path.join(__dirname, filename);
    const migration = require(migrationPath);
    
    if (migration.up) {
      console.log(`Running migration: ${filename}`);
      
      // Run migration in a transaction if possible
      if (db.client.config.client === 'pg') {
        await db.transaction(async (trx) => {
          await migration.up(trx);
        });
      } else {
        await migration.up(db);
      }
      
      await db('migrations').insert({ filename });
      console.log(`Migration ${filename} completed successfully`);
    }
  } catch (error) {
    // Check if error is because schema already exists
    if (error.code === '42P07' || // PostgreSQL: relation already exists
        error.code === 'SQLITE_ERROR' && error.message.includes('already exists')) {
      console.log(`Migration ${filename} - schema already exists, marking as applied`);
      await markMigrationAsApplied(filename);
    } else {
      throw error;
    }
  }
}

// Main migration runner
async function runMigrations() {
  let connection;
  try {
    console.log('Starting production-safe database migrations...');
    
    // Ensure database connection is ready
    await db.raw('SELECT 1');
    console.log('Database connection verified');
    
    // Create migrations tracking table
    await ensureMigrationsTable();
    
    // Detect and mark existing schema
    await detectExistingSchema();
    
    // Get all migration files
    const files = await fs.readdir(__dirname);
    const migrationFiles = files
      .filter(f => f.match(/^\d{3}_.*\.js$/) || f === 'init.js')
      .sort((a, b) => {
        // Ensure init.js runs first
        if (a === 'init.js') return -1;
        if (b === 'init.js') return 1;
        return a.localeCompare(b);
      });
    
    // Run pending migrations
    let pendingCount = 0;
    let skippedCount = 0;
    
    for (const file of migrationFiles) {
      const isApplied = await isMigrationApplied(file);
      if (!isApplied) {
        await runMigrationSafely(file);
        pendingCount++;
      } else {
        skippedCount++;
      }
    }
    
    console.log(`\nMigration Summary:`);
    console.log(`- Applied: ${pendingCount} migration(s)`);
    console.log(`- Skipped: ${skippedCount} migration(s) (already applied)`);
    console.log(`- Total: ${migrationFiles.length} migration(s)`);
    console.log('\nAll migrations completed successfully');
    
    // Close database connection
    await db.destroy();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('Error details:', error);
    
    // Close database connection on error
    try {
      await db.destroy();
    } catch (e) {
      // Ignore
    }
    
    process.exit(1);
  }
}

// Add delay for database readiness in production
async function waitAndRun() {
  if (process.env.NODE_ENV === 'production') {
    console.log('Waiting 2 seconds for database readiness...');
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  await runMigrations();
}

// Only run if called directly
if (require.main === module) {
  waitAndRun();
}

module.exports = { runMigrations };