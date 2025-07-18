#!/usr/bin/env node

/**
 * Script to diagnose thumbnail serving issues
 * Usage: node scripts/diagnose-thumbnails.js <eventId>
 */

const path = require('path');
const fs = require('fs').promises;
const { db } = require('../src/database/db');

const STORAGE_PATH = process.env.STORAGE_PATH || path.join(__dirname, '../../storage');
const THUMBNAILS_DIR = path.join(STORAGE_PATH, 'thumbnails');

async function diagnoseThumbnails(eventId) {
  if (!eventId) {
    console.error('Usage: node scripts/diagnose-thumbnails.js <eventId>');
    process.exit(1);
  }
  
  console.log(`Diagnosing thumbnails for event ID: ${eventId}`);
  console.log(`Storage path: ${STORAGE_PATH}`);
  console.log(`Thumbnails directory: ${THUMBNAILS_DIR}\n`);
  
  try {
    // Get event info
    const event = await db('events').where('id', eventId).first();
    if (!event) {
      console.error(`Event not found with ID: ${eventId}`);
      return;
    }
    
    console.log(`Event: ${event.event_name} (${event.slug})`);
    console.log(`Active: ${event.is_active}, Archived: ${event.is_archived}\n`);
    
    // Get photos for this event
    const photos = await db('photos')
      .where('event_id', eventId)
      .select('id', 'filename', 'path', 'thumbnail_path');
    
    console.log(`Found ${photos.length} photos in database\n`);
    
    let missingThumbnails = 0;
    let existingThumbnails = 0;
    let pathIssues = [];
    
    for (const photo of photos.slice(0, 10)) { // Check first 10 photos
      console.log(`Photo ID ${photo.id}: ${photo.filename}`);
      console.log(`  Photo path: ${photo.path}`);
      console.log(`  Thumbnail path in DB: ${photo.thumbnail_path}`);
      
      if (photo.thumbnail_path) {
        // Expected thumbnail filename
        const expectedThumbName = `thumb_${photo.filename}`;
        const expectedThumbPath = path.join(THUMBNAILS_DIR, expectedThumbName);
        
        // Check if thumbnail exists
        try {
          await fs.access(expectedThumbPath);
          console.log(`  ✓ Thumbnail exists at: ${expectedThumbName}`);
          existingThumbnails++;
          
          // Check if DB path matches expected path
          const dbThumbName = path.basename(photo.thumbnail_path);
          if (dbThumbName !== expectedThumbName) {
            console.log(`  ⚠ Path mismatch! DB has: ${dbThumbName}, Expected: ${expectedThumbName}`);
            pathIssues.push({
              photoId: photo.id,
              dbPath: photo.thumbnail_path,
              expectedPath: `thumbnails/${expectedThumbName}`
            });
          }
        } catch {
          console.log(`  ✗ Thumbnail missing: ${expectedThumbName}`);
          missingThumbnails++;
        }
      } else {
        console.log(`  ✗ No thumbnail path in database`);
        missingThumbnails++;
      }
      console.log('');
    }
    
    console.log('--- Summary ---');
    console.log(`Existing thumbnails: ${existingThumbnails}`);
    console.log(`Missing thumbnails: ${missingThumbnails}`);
    console.log(`Path issues: ${pathIssues.length}`);
    
    if (pathIssues.length > 0) {
      console.log('\n--- Path Issues ---');
      console.log('The following photos have incorrect thumbnail paths in the database:');
      for (const issue of pathIssues) {
        console.log(`Photo ID ${issue.photoId}:`);
        console.log(`  Current: ${issue.dbPath}`);
        console.log(`  Should be: ${issue.expectedPath}`);
      }
      
      console.log('\nTo fix path issues, run:');
      console.log(`UPDATE photos SET thumbnail_path = 'thumbnails/thumb_' || filename WHERE event_id = ${eventId};`);
    }
    
    // Check for any thumbnails in the directory that match this event
    const files = await fs.readdir(THUMBNAILS_DIR);
    const eventThumbnails = files.filter(f => {
      // Try to match thumbnails for this event
      for (const photo of photos) {
        if (f === `thumb_${photo.filename}`) return true;
      }
      return false;
    });
    
    console.log(`\n--- Filesystem Check ---`);
    console.log(`Found ${eventThumbnails.length} thumbnails in directory for this event`);
    
  } catch (error) {
    console.error('Error during diagnosis:', error);
    process.exit(1);
  }
}

// Parse command line arguments
const eventId = process.argv[2] ? parseInt(process.argv[2]) : null;

// Run the diagnosis
diagnoseThumbnails(eventId).then(async () => {
  await db.destroy();
  console.log('\nDiagnosis complete');
}).catch(async error => {
  console.error('Diagnosis failed:', error);
  await db.destroy();
  process.exit(1);
});