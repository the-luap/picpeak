require('dotenv').config();
const { db } = require('../src/database/db');

async function fixProductionIssues() {
  console.log('Fixing production database issues...\n');
  
  try {
    // 1. Check and fix email_templates structure
    console.log('1. Checking email_templates structure:');
    const emailColumns = await db('email_templates').columnInfo();
    console.log('Current columns:', Object.keys(emailColumns));
    
    // Check if we need to add basic columns back
    const hasSubject = 'subject' in emailColumns;
    const hasSubjectEn = 'subject_en' in emailColumns;
    
    if (hasSubjectEn && !hasSubject) {
      console.log('Adding basic columns back to email_templates...');
      await db.schema.alterTable('email_templates', (table) => {
        table.string('subject');
        table.text('body_html');
        table.text('body_text');
      });
      
      // Copy values from _en columns
      await db('email_templates').update({
        subject: db.raw('subject_en'),
        body_html: db.raw('body_html_en'),
        body_text: db.raw('body_text_en')
      });
      console.log('Basic columns added successfully');
    }
    
    // 2. Ensure default templates exist
    console.log('\n2. Checking email templates:');
    const templateCount = await db('email_templates').count('* as count');
    console.log('Template count:', templateCount[0].count);
    
    if (templateCount[0].count === 0) {
      console.log('No templates found, inserting defaults...');
      const defaultTemplates = [
        {
          template_key: 'gallery_created',
          subject: 'Your Photo Gallery is Ready!',
          body_html: '<h2>Gallery Created Successfully</h2>...',
          body_text: 'Gallery Created Successfully...',
          variables: JSON.stringify(['host_name', 'event_name', 'event_date', 'gallery_link', 'gallery_password', 'expiry_date'])
        },
        {
          template_key: 'expiration_warning',
          subject: 'Your Photo Gallery Expires Soon',
          body_html: '<h2>Gallery Expiring Soon</h2>...',
          body_text: 'Gallery Expiring Soon...',
          variables: JSON.stringify(['host_name', 'event_name', 'days_remaining', 'gallery_link'])
        },
        {
          template_key: 'gallery_expired',
          subject: 'Your Photo Gallery Has Expired',
          body_html: '<h2>Gallery Expired</h2>...',
          body_text: 'Gallery Expired...',
          variables: JSON.stringify(['host_name', 'event_name'])
        },
        {
          template_key: 'archive_complete',
          subject: 'Gallery Archive Complete',
          body_html: '<h2>Archive Complete</h2>...',
          body_text: 'Archive Complete...',
          variables: JSON.stringify(['host_name', 'event_name', 'archive_size'])
        }
      ];
      
      for (const template of defaultTemplates) {
        // Add language columns if they exist
        if (hasSubjectEn) {
          template.subject_en = template.subject;
          template.body_html_en = template.body_html;
          template.body_text_en = template.body_text;
          template.subject_de = template.subject;
          template.body_html_de = template.body_html;
          template.body_text_de = template.body_text;
        }
        
        await db('email_templates').insert(template);
      }
      console.log('Default templates inserted');
    }
    
    // 3. Check activity_logs structure
    console.log('\n3. Checking activity_logs structure:');
    const activityColumns = await db('activity_logs').columnInfo();
    console.log('Columns:', Object.keys(activityColumns));
    
    // Check if read_at exists
    if (!('read_at' in activityColumns)) {
      console.log('Adding read_at column to activity_logs...');
      await db.schema.alterTable('activity_logs', (table) => {
        table.datetime('read_at').nullable();
      });
      console.log('read_at column added');
    }
    
    // 4. Check and add CMS pages
    console.log('\n4. Checking CMS pages:');
    const cmsColumns = await db('cms_pages').columnInfo();
    console.log('CMS columns:', Object.keys(cmsColumns));
    
    const impressum = await db('cms_pages').where('slug', 'impressum').first();
    const datenschutz = await db('cms_pages').where('slug', 'datenschutz').first();
    
    if (!impressum) {
      console.log('Adding Impressum page...');
      await db('cms_pages').insert({
        slug: 'impressum',
        title_en: 'Legal Notice',
        title_de: 'Impressum',
        content_en: '<h1>Legal Notice</h1><p>Your legal information here...</p>',
        content_de: '<h1>Impressum</h1><p>Ihre rechtlichen Informationen hier...</p>',
        updated_at: new Date()
      });
    }
    
    if (!datenschutz) {
      console.log('Adding Datenschutz page...');
      await db('cms_pages').insert({
        slug: 'datenschutz',
        title_en: 'Privacy Policy',
        title_de: 'Datenschutzerklärung',
        content_en: '<h1>Privacy Policy</h1><p>Your privacy policy here...</p>',
        content_de: '<h1>Datenschutzerklärung</h1><p>Ihre Datenschutzerklärung hier...</p>',
        updated_at: new Date()
      });
    }
    
    console.log('\n✅ All fixes applied successfully!');
    
  } catch (error) {
    console.error('Error fixing issues:', error);
    console.error('Stack:', error.stack);
  } finally {
    await db.destroy();
    process.exit(0);
  }
}

fixProductionIssues();