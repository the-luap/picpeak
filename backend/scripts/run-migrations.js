#!/usr/bin/env node

/**
 * Run database migrations using existing db connection
 */

const { db } = require('../src/database/db');

async function runMigrations() {
  console.log('Running database migrations...\n');
  
  try {
    // Run all pending migrations
    const result = await db.migrate.latest({
      directory: './migrations'
    });
    
    if (result[1].length === 0) {
      console.log('✓ Database is already up to date');
    } else {
      console.log(`✓ Ran ${result[1].length} migrations:`);
      result[1].forEach(migration => {
        console.log(`  - ${migration}`);
      });
    }
    
    // Show current migration status
    const list = await db.migrate.list();
    console.log(`\nCurrent status: ${list[0].length} completed migrations`);
    
    await db.destroy();
    process.exit(0);
  } catch (error) {
    console.error('Migration error:', error);
    await db.destroy();
    process.exit(1);
  }
}

runMigrations();