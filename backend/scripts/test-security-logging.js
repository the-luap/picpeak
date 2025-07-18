#!/usr/bin/env node

/**
 * Test script to verify security logging is working correctly
 * Run with: node scripts/test-security-logging.js
 */

require('dotenv').config({ path: '../.env' });
const logger = require('../src/utils/logger');

console.log('Testing Security Logging...\n');

// Test 1: Basic logging
console.log('1. Testing basic logging levels:');
logger.info('Test info message', { test: true });
logger.warn('Test warning message', { test: true });
logger.error('Test error message', { test: true });

// Test 2: Security event logging
console.log('\n2. Testing security event logging:');

// Rate limit exceeded
logger.warn('Rate limit exceeded', {
  ip: '192.168.1.100',
  path: '/api/admin/login',
  method: 'POST',
  authenticated: false,
  userAgent: 'Mozilla/5.0 Test',
  timestamp: new Date().toISOString(),
  rateLimitInfo: {
    limit: 5,
    current: 6,
    remaining: 0,
    resetTime: new Date(Date.now() + 900000).toISOString()
  }
});

// Auth rate limit
logger.warn('Auth rate limit exceeded', {
  ip: '192.168.1.101',
  path: '/api/auth/admin/login',
  method: 'POST',
  userAgent: 'Mozilla/5.0 Test',
  authType: 'admin',
  timestamp: new Date().toISOString()
});

// Failed login
logger.warn('Failed login attempt', {
  username: 'testuser',
  ip: '192.168.1.102',
  userAgent: 'Mozilla/5.0 Test',
  reason: 'invalid_credentials',
  timestamp: new Date().toISOString()
});

// JWT validation failure
logger.warn('JWT validation failed', {
  ip: '192.168.1.103',
  path: '/api/admin/events',
  method: 'GET',
  userAgent: 'Mozilla/5.0 Test',
  error: 'TokenExpiredError',
  message: 'jwt expired',
  timestamp: new Date().toISOString()
});

// Account lockout
logger.warn('Login attempt on locked account', {
  username: 'lockeduser',
  ip: '192.168.1.104',
  remainingLockTime: 1200,
  timestamp: new Date().toISOString()
});

// Suspicious activity
logger.warn('Suspicious login activity detected', {
  username: 'suspicioususer',
  ips: ['192.168.1.105', '192.168.1.106', '192.168.1.107'],
  timeWindow: '15 minutes',
  timestamp: new Date().toISOString()
});

console.log('\n3. Check log files:');
console.log('- logs/security.log - Should contain all security warnings');
console.log('- logs/error.log - Should contain error messages');
console.log('- logs/combined.log - Should contain all messages');

console.log('\n✅ Security logging test complete!');
console.log('Review the log files to ensure all events are properly captured.');

// Give logger time to flush
setTimeout(() => {
  process.exit(0);
}, 1000);