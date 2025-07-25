#!/usr/bin/env node

/**
 * Mark a specific migration as applied without running it
 * Usage: node scripts/mark-migration-applied.js <migration-filename>
 */

const { db } = require('../src/database/db');

async function markMigrationAsApplied(filename) {
  try {
    // Check if migration is already marked
    const existing = await db('migrations')
      .where('filename', filename)
      .first();
    
    if (existing) {
      console.log(`Migration ${filename} is already marked as applied`);
      return;
    }
    
    // Mark as applied
    await db('migrations').insert({ 
      filename,
      applied_at: new Date()
    });
    
    console.log(`✅ Migration ${filename} marked as applied`);
  } catch (error) {
    console.error('Error marking migration:', error.message);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

// Get migration filename from command line
const migrationFile = process.argv[2];

if (!migrationFile) {
  console.error('Usage: node scripts/mark-migration-applied.js <migration-filename>');
  console.error('Example: node scripts/mark-migration-applied.js 032_add_restore_runs_table.js');
  process.exit(1);
}

markMigrationAsApplied(migrationFile);