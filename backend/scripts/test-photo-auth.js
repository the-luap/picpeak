#!/usr/bin/env node

/**
 * Script to test photo authentication
 * Usage: node scripts/test-photo-auth.js <jwt-token>
 */

const axios = require('axios');

async function testPhotoAuth(token) {
  if (!token) {
    console.error('Usage: node scripts/test-photo-auth.js <jwt-token>');
    console.error('\nTo get a token, login to a gallery and check localStorage for gallery_token_<slug>');
    process.exit(1);
  }

  const baseUrl = process.env.API_URL || 'http://localhost:3001';
  
  console.log(`Testing photo authentication with token: ${token.substring(0, 20)}...`);
  console.log(`Base URL: ${baseUrl}\n`);

  // Test URLs
  const tests = [
    {
      name: 'Thumbnail via static route',
      url: `${baseUrl}/thumbnails/thumb_Test_Gallery_uncategorized_5210.jpg`,
      headers: { 'Authorization': `Bearer ${token}` }
    },
    {
      name: 'Photo via static route',
      url: `${baseUrl}/photos/wedding-test-gallery-2025-07-14-1/Test_Gallery_uncategorized_5210.jpg`,
      headers: { 'Authorization': `Bearer ${token}` }
    },
    {
      name: 'Gallery photos API',
      url: `${baseUrl}/api/gallery/wedding-test-gallery-2025-07-14-1/photos`,
      headers: { 'Authorization': `Bearer ${token}` }
    }
  ];

  for (const test of tests) {
    console.log(`Testing: ${test.name}`);
    console.log(`URL: ${test.url}`);
    
    try {
      const response = await axios.get(test.url, {
        headers: test.headers,
        validateStatus: () => true // Don't throw on any status
      });
      
      console.log(`Status: ${response.status}`);
      console.log(`Headers:`, response.headers['content-type']);
      
      if (response.status === 200) {
        if (test.name.includes('API')) {
          console.log(`Photos count: ${response.data.photos?.length || 0}`);
        } else {
          console.log(`Content length: ${response.headers['content-length']} bytes`);
        }
      } else {
        console.log(`Error:`, response.data);
      }
    } catch (error) {
      console.log(`Network error:`, error.message);
    }
    
    console.log('---\n');
  }
  
  // Decode token to show info
  try {
    const parts = token.split('.');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    console.log('Token payload:', payload);
  } catch (error) {
    console.log('Failed to decode token');
  }
}

// Get token from command line
const token = process.argv[2];

testPhotoAuth(token).catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});