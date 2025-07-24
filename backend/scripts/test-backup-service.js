#!/usr/bin/env node

require('dotenv').config();
const { initializeDatabase } = require('../src/database/db');
const { runBackup, getBackupStatus } = require('../src/services/backupService');
const logger = require('../src/utils/logger');

async function testBackupService() {
  try {
    console.log('Testing backup service...\n');
    
    // Initialize database
    await initializeDatabase();
    
    // Get current backup status
    console.log('Getting backup status...');
    const statusBefore = await getBackupStatus();
    console.log('Last run:', statusBefore.lastRun ? statusBefore.lastRun.started_at : 'Never');
    console.log('Is healthy:', statusBefore.isHealthy);
    console.log('');
    
    // Run backup
    console.log('Running backup...');
    await runBackup();
    
    // Get status after backup
    console.log('\nGetting status after backup...');
    const statusAfter = await getBackupStatus();
    console.log('Last run:', statusAfter.lastRun ? statusAfter.lastRun.started_at : 'Never');
    console.log('Status:', statusAfter.lastRun ? statusAfter.lastRun.status : 'Unknown');
    console.log('Files backed up:', statusAfter.lastRun ? statusAfter.lastRun.files_backed_up : 0);
    console.log('Total size:', statusAfter.lastRun ? `${(statusAfter.lastRun.total_size_bytes / 1024 / 1024).toFixed(2)} MB` : '0 MB');
    
    if (statusAfter.lastRun && statusAfter.lastRun.error_message) {
      console.log('Error:', statusAfter.lastRun.error_message);
    }
    
    console.log('\nBackup test completed!');
    process.exit(0);
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

testBackupService();