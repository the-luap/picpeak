require('dotenv').config({ path: '../.env' });
const path = require('path');
const fs = require('fs').promises;
const { db } = require('../src/database/db');
const { generatePhotoFilename } = require('../src/utils/filenameSanitizer');

async function fixTempPhotos() {
  console.log('Starting to fix temporary photo files...\n');
  
  try {
    // Find all photos with temp_ filenames
    const tempPhotos = await db('photos')
      .where('filename', 'like', 'temp_%')
      .orderBy('event_id', 'asc')
      .orderBy('category_id', 'asc')
      .orderBy('id', 'asc');
    
    console.log(`Found ${tempPhotos.length} photos with temporary filenames\n`);
    
    if (tempPhotos.length === 0) {
      console.log('No temporary photos found. Exiting.');
      return;
    }
    
    // Group photos by event and category
    const grouped = {};
    for (const photo of tempPhotos) {
      const key = `${photo.event_id}_${photo.category_id || 'null'}`;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(photo);
    }
    
    console.log(`Processing ${Object.keys(grouped).length} event/category groups...\n`);
    
    // Process each group
    for (const [key, photos] of Object.entries(grouped)) {
      const [eventId, categoryIdStr] = key.split('_');
      const categoryId = categoryIdStr === 'null' ? null : parseInt(categoryIdStr);
      
      console.log(`\nProcessing Event ID: ${eventId}, Category ID: ${categoryId || 'uncategorized'}`);
      console.log(`Photos in group: ${photos.length}`);
      
      // Get event details
      const event = await db('events').where({ id: eventId }).first();
      if (!event) {
        console.error(`Event ${eventId} not found! Skipping...`);
        continue;
      }
      
      // Get category details if applicable
      let category = null;
      let startCounter = 1;
      
      if (categoryId) {
        category = await db('photo_categories').where({ id: categoryId }).first();
        if (!category) {
          console.error(`Category ${categoryId} not found! Treating as uncategorized...`);
        } else {
          // Get the highest counter for this category
          const maxPhoto = await db('photos')
            .where({ event_id: eventId, category_id: categoryId })
            .whereNot('filename', 'like', 'temp_%')
            .orderBy('id', 'desc')
            .first();
          
          if (maxPhoto && maxPhoto.filename) {
            // Extract counter from filename
            const match = maxPhoto.filename.match(/_(\d+)\.[^.]+$/);
            if (match) {
              startCounter = parseInt(match[1]) + 1;
            }
          }
        }
      } else {
        // For uncategorized, get the highest counter
        const maxPhoto = await db('photos')
          .where({ event_id: eventId })
          .whereNull('category_id')
          .whereNot('filename', 'like', 'temp_%')
          .orderBy('id', 'desc')
          .first();
        
        if (maxPhoto && maxPhoto.filename) {
          const match = maxPhoto.filename.match(/_(\d+)\.[^.]+$/);
          if (match) {
            startCounter = parseInt(match[1]) + 1;
          }
        }
      }
      
      console.log(`Starting counter: ${startCounter}`);
      
      // Process each photo in the group
      let successCount = 0;
      let errorCount = 0;
      
      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];
        const counter = startCounter + i;
        
        try {
          // Generate new filename
          const extension = path.extname(photo.filename);
          const newFilename = generatePhotoFilename(
            event.event_name,
            category ? category.name : 'uncategorized',
            counter,
            extension
          );
          
          // Build full paths
          const storagePath = process.env.STORAGE_PATH || path.join(__dirname, '../../storage');
          const oldPath = path.join(storagePath, 'events/active', photo.path);
          const newPath = path.join(path.dirname(oldPath), newFilename);
          
          // Check if old file exists
          try {
            await fs.access(oldPath);
          } catch (e) {
            console.error(`File not found: ${oldPath}`);
            errorCount++;
            continue;
          }
          
          // Rename the file
          await fs.rename(oldPath, newPath);
          
          // Update database
          const newRelativePath = path.relative(path.join(storagePath, 'events/active'), newPath);
          await db('photos')
            .where({ id: photo.id })
            .update({
              filename: newFilename,
              path: newRelativePath
            });
          
          console.log(`✓ Renamed: ${photo.filename} → ${newFilename}`);
          successCount++;
          
        } catch (error) {
          console.error(`✗ Failed to process photo ${photo.id}: ${error.message}`);
          errorCount++;
        }
      }
      
      // Update category counter if needed
      if (category && successCount > 0) {
        const newCounter = startCounter + photos.length - 1;
        await db('photo_categories')
          .where({ id: categoryId })
          .update({ photo_counter: newCounter });
        console.log(`Updated category counter to ${newCounter}`);
      }
      
      console.log(`\nGroup summary: ${successCount} successful, ${errorCount} errors`);
    }
    
    console.log('\n=== COMPLETE ===');
    console.log('All temporary photos have been processed.');
    
  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await db.destroy();
  }
}

// Run the script
fixTempPhotos().catch(console.error);