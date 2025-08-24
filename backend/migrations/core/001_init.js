const bcrypt = require('bcrypt');
const { initializeDatabase } = require('../../src/database/db');
const { generateReadablePassword } = require('../../src/utils/passwordGenerator');
const fs = require('fs').promises;
const path = require('path');

exports.up = async function(knex) {
  console.log('Initializing database schema...');
  
  try {
    // Initialize tables
    await initializeDatabase();
    
    // Create default admin user if none exists
    const adminExists = await knex('admin_users').first();
    if (!adminExists) {
      // Generate a secure random password
      const generatedPassword = generateReadablePassword();
      const passwordHash = await bcrypt.hash(generatedPassword, 12); // Increased rounds for better security
      
      // Get admin credentials from environment or use defaults
      const adminUsername = process.env.ADMIN_USERNAME || 'admin';
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
      
      await knex('admin_users').insert({
        username: adminUsername,
        email: adminEmail,
        password_hash: passwordHash,
        must_change_password: true,
        created_at: new Date()
      });
      
      // Try to save credentials to file, but don't fail if we can't
      const dataDir = path.join(__dirname, '..', '..', 'data');
      const setupInfoPath = path.join(dataDir, 'ADMIN_CREDENTIALS.txt');
      
      const setupInfo = `
========================================
PicPeak Admin Credentials
========================================

Your admin account has been created with these credentials:

Email: ${adminEmail}
Password: ${generatedPassword}

IMPORTANT SECURITY NOTES:
1. Please change this password after first login
2. This file will be created only once
3. Store these credentials securely
4. Delete this file after noting the password

Login URL: ${process.env.ADMIN_URL || 'http://localhost:3001'}/admin

Login with the email address shown above

Generated on: ${new Date().toISOString()}
========================================
`;
      
      try {
        // Try to create directory and write file
        await fs.mkdir(dataDir, { recursive: true });
        await fs.writeFile(setupInfoPath, setupInfo, 'utf8');
        console.log(`📁 Credentials also saved to: data/ADMIN_CREDENTIALS.txt`);
      } catch (error) {
        // If we can't write the file, that's okay - credentials are shown in console
        console.log('⚠️  Could not save credentials to file (permission denied)');
        console.log('   Please copy the credentials shown above');
      }
      
      console.log('\n========================================');
      console.log('✅ Admin user created successfully!');
      console.log('========================================');
      console.log(`Email: ${adminEmail}`);
      console.log(`Password: ${generatedPassword}`);
      console.log('\n⚠️  IMPORTANT:');
      console.log('1. Save these credentials securely');
      console.log('2. Please change the password after first login');
      console.log('========================================\n');
    }
    
    // Create default email templates if none exist
    const templateExists = await knex('email_templates').first();
    if (!templateExists) {
      await knex('email_templates').insert([
        {
          template_key: 'gallery_created',
          subject: 'Your Photo Gallery is Ready!',
          body_html: `<h2>Gallery Created Successfully</h2>
<p>Dear {{host_name}},</p>
<p>Your photo gallery "{{event_name}}" has been created successfully!</p>
<p><strong>Gallery Details:</strong></p>
<ul>
  <li>Event Date: {{event_date}}</li>
  <li>Gallery Link: {{gallery_link}}</li>
  <li>Password: {{gallery_password}}</li>
  <li>Expires: {{expiry_date}}</li>
</ul>
<p>Share this link and password with your guests to allow them to view and download photos.</p>`,
          body_text: 'Gallery Created Successfully\n\nDear {{host_name}},\n\nYour photo gallery "{{event_name}}" has been created successfully!',
          variables: JSON.stringify(['host_name', 'event_name', 'event_date', 'gallery_link', 'gallery_password', 'expiry_date'])
        },
        {
          template_key: 'expiration_warning',
          subject: 'Your Photo Gallery Expires Soon',
          body_html: `<h2>Gallery Expiring Soon</h2>
<p>Dear {{host_name}},</p>
<p>Your photo gallery "{{event_name}}" will expire in {{days_remaining}} days.</p>
<p>After expiration, the gallery will be archived and no longer accessible to guests.</p>
<p><a href="{{gallery_link}}">Visit Gallery</a></p>`,
          body_text: 'Gallery Expiring Soon\n\nDear {{host_name}},\n\nYour photo gallery "{{event_name}}" will expire in {{days_remaining}} days.',
          variables: JSON.stringify(['host_name', 'event_name', 'days_remaining', 'gallery_link'])
        }
      ]);
      console.log('Default email templates created');
    }

    // Create default email config if none exists
    const emailConfig = await knex('email_configs').first();
    if (!emailConfig) {
      await knex('email_configs').insert({
        smtp_host: process.env.SMTP_HOST || 'mailhog',
        smtp_port: process.env.SMTP_PORT || 1025,
        smtp_secure: process.env.SMTP_SECURE === 'true',
        smtp_user: process.env.SMTP_USER || '',
        smtp_pass: process.env.SMTP_PASS || '',
        from_email: process.env.EMAIL_FROM || 'noreply@photo-sharing.local',
        from_name: 'Photo Sharing'
      });
      console.log('Default email configuration created');
    }

    console.log('Migrations completed successfully');
  } catch (error) {
    console.error('Initial setup failed:', error);
    throw error;
  }
};

exports.down = async function(knex) {
  // This migration cannot be rolled back as it creates the initial schema
  console.log('Initial setup cannot be rolled back');
};
