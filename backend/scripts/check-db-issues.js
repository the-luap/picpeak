require('dotenv').config();
const { db } = require('../src/database/db');

async function checkDatabaseIssues() {
  console.log('Checking database issues...\n');
  
  try {
    // Check email_templates table structure
    console.log('1. Checking email_templates table structure:');
    const emailTemplateColumns = await db('email_templates').columnInfo();
    console.log('Columns:', Object.keys(emailTemplateColumns));
    
    // Check if any templates exist
    const templateCount = await db('email_templates').count('* as count');
    console.log('Template count:', templateCount[0].count);
    
    // Check for specific template
    const galleryCreatedTemplate = await db('email_templates')
      .where('template_key', 'gallery_created')
      .first();
    console.log('gallery_created template exists:', !!galleryCreatedTemplate);
    
    // Check activity_logs table
    console.log('\n2. Checking activity_logs table:');
    const activityLogColumns = await db('activity_logs').columnInfo();
    console.log('Columns:', Object.keys(activityLogColumns));
    
    // Check migrations table
    console.log('\n3. Checking migrations status:');
    const migrations = await db('migrations')
      .orderBy('id', 'desc')
      .limit(10);
    console.log('Latest migrations:');
    migrations.forEach(m => console.log(`  - ${m.filename}`));
    
    // Test a simple query from notifications route
    console.log('\n4. Testing notifications query:');
    try {
      const notifications = await db('activity_logs')
        .select(
          'activity_logs.*',
          'events.event_name'
        )
        .leftJoin('events', 'activity_logs.event_id', 'events.id')
        .orderBy('activity_logs.created_at', 'desc')
        .limit(5);
      console.log(`Found ${notifications.length} notifications`);
    } catch (error) {
      console.error('Notifications query failed:', error.message);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.destroy();
    process.exit(0);
  }
}

checkDatabaseIssues();