const fs = require('fs').promises;
const path = require('path');
const { db } = require('../src/database/db');

// Create migrations table if it doesn't exist
async function createMigrationsTable() {
  const tableExists = await db.schema.hasTable('migrations');
  if (!tableExists) {
    await db.schema.createTable('migrations', (table) => {
      table.increments('id').primary();
      table.string('filename').unique().notNullable();
      table.timestamp('applied_at').defaultTo(db.fn.now());
    });
    console.log('Created migrations table');
  }
}

// Get list of applied migrations
async function getAppliedMigrations() {
  const migrations = await db('migrations').select('filename');
  return migrations.map(m => m.filename);
}

// Run a single migration
async function runMigration(filename) {
  const migrationPath = path.join(__dirname, filename);
  const migration = require(migrationPath);
  
  if (migration.up) {
    console.log(`Running migration: ${filename}`);
    await migration.up(db);
    await db('migrations').insert({ filename });
    console.log(`Migration ${filename} completed`);
  }
}

// Main migration runner
async function runMigrations() {
  try {
    console.log('Starting database migrations...');
    
    // First run the init.js if it exists but only if migrations table doesn't exist
    const tableExists = await db.schema.hasTable('migrations');
    if (!tableExists) {
      const { initializeDatabase } = require('../src/database/db');
      console.log('Running initial database setup...');
      await initializeDatabase();
    }
    
    // Create migrations table
    await createMigrationsTable();
    
    // Get all migration files
    const files = await fs.readdir(__dirname);
    const migrationFiles = files
      .filter(f => f.match(/^\d{3}_.*\.js$/))
      .sort();
    
    // Get applied migrations
    const appliedMigrations = await getAppliedMigrations();
    
    // Run pending migrations
    let pendingCount = 0;
    for (const file of migrationFiles) {
      if (!appliedMigrations.includes(file)) {
        await runMigration(file);
        pendingCount++;
      }
    }
    
    if (pendingCount === 0) {
      console.log('No pending migrations');
    } else {
      console.log(`Applied ${pendingCount} migration(s)`);
    }
    
    console.log('All migrations completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Only run if called directly
if (require.main === module) {
  runMigrations();
}

module.exports = { runMigrations };