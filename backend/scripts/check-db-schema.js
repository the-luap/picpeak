#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();

// Connect to the database
const dbPath = '/app/data/photo_sharing.db';
console.log(`Connecting to database at: ${dbPath}`);

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  }
  console.log('Connected to the SQLite database.\n');
});

// Get schema for events table
console.log('=== EVENTS TABLE SCHEMA ===');
db.all("PRAGMA table_info(events)", [], (err, rows) => {
  if (err) {
    console.error('Error getting events schema:', err.message);
  } else {
    rows.forEach(row => {
      console.log(`${row.name} (${row.type})`);
    });
  }
  
  console.log('\n=== PHOTOS TABLE SCHEMA ===');
  // Get schema for photos table
  db.all("PRAGMA table_info(photos)", [], (err, rows) => {
    if (err) {
      console.error('Error getting photos schema:', err.message);
    } else {
      rows.forEach(row => {
        console.log(`${row.name} (${row.type})`);
      });
    }
    
    // Close the database
    db.close();
  });
});