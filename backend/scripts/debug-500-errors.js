require('dotenv').config();
const { db } = require('../src/database/db');

async function debugEndpoints() {
  console.log('Debugging 500 errors...\n');
  
  try {
    // Test email templates query
    console.log('1. Testing email templates query:');
    try {
      const templates = await db('email_templates')
        .select('*')
        .orderBy('template_key');
      
      console.log(`Found ${templates.length} templates`);
      if (templates.length > 0) {
        console.log('First template columns:', Object.keys(templates[0]));
        console.log('Template keys:', templates.map(t => t.template_key));
      }
    } catch (error) {
      console.error('Email templates query failed:', error.message);
      console.error('Error code:', error.code);
    }
    
    // Test notifications query
    console.log('\n2. Testing notifications query:');
    try {
      const notifications = await db('activity_logs')
        .select(
          'activity_logs.*',
          'events.event_name'
        )
        .leftJoin('events', 'activity_logs.event_id', 'events.id')
        .whereNull('activity_logs.read_at')
        .orderBy('activity_logs.created_at', 'desc')
        .limit(5);
      
      console.log(`Found ${notifications.length} unread notifications`);
    } catch (error) {
      console.error('Notifications query failed:', error.message);
      console.error('Error code:', error.code);
      
      // Check if it's a column issue
      if (error.message.includes('column')) {
        console.log('\nChecking activity_logs columns:');
        const columns = await db('activity_logs').columnInfo();
        console.log('Columns:', Object.keys(columns));
      }
    }
    
    // Test specific template query
    console.log('\n3. Testing specific template query (gallery_created):');
    try {
      const template = await db('email_templates')
        .where('template_key', 'gallery_created')
        .first();
      
      if (template) {
        console.log('Template found:', template.template_key);
        console.log('Has subject_en?', template.subject_en !== undefined);
        console.log('Has subject?', template.subject !== undefined);
      } else {
        console.log('Template not found');
      }
    } catch (error) {
      console.error('Template query failed:', error.message);
    }
    
    // Check CMS pages
    console.log('\n4. Checking CMS pages:');
    try {
      const pages = await db('cms_pages')
        .select('slug', 'title', 'is_published')
        .orderBy('slug');
      
      console.log(`Found ${pages.length} CMS pages:`);
      pages.forEach(page => {
        console.log(`  - ${page.slug}: ${page.title} (published: ${page.is_published})`);
      });
    } catch (error) {
      console.error('CMS pages query failed:', error.message);
    }
    
  } catch (error) {
    console.error('General error:', error);
  } finally {
    await db.destroy();
    process.exit(0);
  }
}

debugEndpoints();