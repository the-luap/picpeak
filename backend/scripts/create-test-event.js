const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { db } = require('../src/database/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

async function createTestEvent() {
  try {
    console.log('Creating test event...');
    
    // Hash a simple password
    const passwordHash = await bcrypt.hash('test123', 10);
    
    // Generate share token
    const shareToken = uuidv4().replace(/-/g, '');
    const shareLink = `http://localhost:3005/gallery/wedding-test123-2025-07-07/${shareToken}`;
    
    // Create event
    const eventData = {
      slug: 'wedding-test123-2025-07-07',
      event_type: 'wedding',
      event_name: 'Test Wedding',
      event_date: '2025-07-07',
      host_email: 'host@example.com',
      admin_email: 'admin@example.com',
      password_hash: passwordHash,
      welcome_message: 'Welcome to our test wedding gallery!',
      color_theme: null, // Use global theme
      is_active: 1,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      share_link: shareLink
    };
    
    // Delete existing event if it exists
    await db('events').where('slug', eventData.slug).delete();
    
    // Insert new event
    const insertResult = await db('events').insert(eventData).returning('id');
    const eventId = insertResult[0]?.id || insertResult[0];
    console.log('Event created with ID:', eventId);
    
    console.log('\nTest event created successfully!');
    console.log('Event details:');
    console.log('- Name:', eventData.event_name);
    console.log('- Slug:', eventData.slug);
    console.log('- Password:', 'test123');
    console.log('- Share link:', shareLink);
    console.log('\nYou can now access the gallery at the share link above');
    
    process.exit(0);
  } catch (error) {
    console.error('Error creating test event:', error);
    process.exit(1);
  }
}

createTestEvent();