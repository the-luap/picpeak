#!/usr/bin/env node

/**
 * Fix migration state by marking migrations as applied if their tables already exist
 */

const { db } = require('../src/database/db');

async function fixMigrationState() {
  try {
    console.log('Checking migration state...');
    
    // Ensure migrations table exists
    const hasMigrationsTable = await db.schema.hasTable('migrations');
    if (!hasMigrationsTable) {
      await db.schema.createTable('migrations', (table) => {
        table.increments('id').primary();
        table.string('filename').unique().notNullable();
        table.timestamp('applied_at').defaultTo(db.fn.now());
      });
      console.log('Created migrations tracking table');
    }
    
    // Check for specific tables and mark their migrations as applied
    const tableChecks = [
      { table: 'restore_runs', migration: '032_add_restore_runs_table.js' },
      { table: 'restore_file_operations', migration: '032_add_restore_runs_table.js' },
      { table: 'restore_validation_results', migration: '032_add_restore_runs_table.js' },
      { table: 'gallery_feedback', migration: '033_add_gallery_feedback.js' },
      { table: 'feedback_photos', migration: '033_add_gallery_feedback.js' },
    ];
    
    for (const check of tableChecks) {
      const tableExists = await db.schema.hasTable(check.table);
      if (tableExists) {
        const migrationApplied = await db('migrations')
          .where('filename', check.migration)
          .first();
        
        if (!migrationApplied) {
          await db('migrations').insert({ 
            filename: check.migration,
            applied_at: new Date()
          });
          console.log(`✅ Marked ${check.migration} as applied (table ${check.table} exists)`);
        } else {
          console.log(`ℹ️  ${check.migration} already marked as applied`);
        }
      }
    }
    
    console.log('\nMigration state fixed successfully!');
  } catch (error) {
    console.error('Error fixing migration state:', error.message);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

fixMigrationState();