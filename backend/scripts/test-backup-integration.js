#!/usr/bin/env node

/**
 * Manual Integration Test Script for Enhanced Backup System
 * 
 * This script provides a comprehensive test of the backup system with real services.
 * It can be used to test against MinIO, AWS S3, or other S3-compatible services.
 * 
 * Usage:
 *   node scripts/test-backup-integration.js [options]
 * 
 * Options:
 *   --endpoint <url>     S3 endpoint URL (default: http://localhost:9000)
 *   --access-key <key>   S3 access key (default: minioadmin)
 *   --secret-key <key>   S3 secret key (default: minioadmin)
 *   --bucket <name>      S3 bucket name (default: test-backup-<timestamp>)
 *   --type <type>        Backup type: s3, local, rsync (default: s3)
 *   --cleanup            Clean up test data after completion
 *   --verbose            Enable verbose logging
 *   --help               Show this help message
 * 
 * Examples:
 *   # Test with local MinIO
 *   node scripts/test-backup-integration.js
 * 
 *   # Test with AWS S3
 *   node scripts/test-backup-integration.js \
 *     --endpoint https://s3.amazonaws.com \
 *     --access-key AKIAIOSFODNN7EXAMPLE \
 *     --secret-key wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY \
 *     --bucket my-test-bucket
 * 
 *   # Test local backup
 *   node scripts/test-backup-integration.js --type local
 */

const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const { S3Client, CreateBucketCommand, HeadBucketCommand, ListObjectsV2Command, GetObjectCommand, DeleteObjectsCommand, DeleteBucketCommand } = require('@aws-sdk/client-s3');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  endpoint: 'http://localhost:9000',
  accessKey: 'minioadmin',
  secretKey: 'minioadmin',
  bucket: `test-backup-${Date.now()}`,
  type: 's3',
  cleanup: false,
  verbose: false
};

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--endpoint':
      options.endpoint = args[++i];
      break;
    case '--access-key':
      options.accessKey = args[++i];
      break;
    case '--secret-key':
      options.secretKey = args[++i];
      break;
    case '--bucket':
      options.bucket = args[++i];
      break;
    case '--type':
      options.type = args[++i];
      break;
    case '--cleanup':
      options.cleanup = true;
      break;
    case '--verbose':
      options.verbose = true;
      break;
    case '--help':
      console.log(module.exports.description || 'Manual Integration Test Script');
      process.exit(0);
  }
}

// Load environment and services
require('dotenv').config();
const { db, initialize: initDb } = require('../src/database/db');
const backupService = require('../src/services/backupService');
const S3StorageAdapter = require('../src/services/storage/s3Storage');
const logger = require('../src/utils/logger');

// Configure logger based on verbose flag
if (!options.verbose) {
  logger.info = () => {};
  logger.debug = () => {};
}

// Test results
const results = {
  passed: 0,
  failed: 0,
  skipped: 0,
  tests: []
};

// Test utilities
async function runTest(name, testFn) {
  console.log(`\n📋 Running: ${name}`);
  try {
    const startTime = Date.now();
    await testFn();
    const duration = Date.now() - startTime;
    console.log(`✅ PASSED: ${name} (${duration}ms)`);
    results.passed++;
    results.tests.push({ name, status: 'passed', duration });
  } catch (error) {
    console.error(`❌ FAILED: ${name}`);
    console.error(`   Error: ${error.message}`);
    if (options.verbose) {
      console.error(error.stack);
    }
    results.failed++;
    results.tests.push({ name, status: 'failed', error: error.message });
  }
}

async function skipTest(name, reason) {
  console.log(`\n⏭️  Skipping: ${name}`);
  console.log(`   Reason: ${reason}`);
  results.skipped++;
  results.tests.push({ name, status: 'skipped', reason });
}

// Test functions
async function testS3Connection() {
  const s3Adapter = new S3StorageAdapter({
    bucket: options.bucket,
    endpoint: options.endpoint,
    accessKeyId: options.accessKey,
    secretAccessKey: options.secretKey,
    region: 'us-east-1',
    forcePathStyle: true,
    sslEnabled: options.endpoint.startsWith('https')
  });

  await s3Adapter.testConnection();
  console.log(`   ✓ Connected to S3 endpoint: ${options.endpoint}`);
  console.log(`   ✓ Bucket accessible: ${options.bucket}`);
}

async function setupTestData() {
  const storagePath = path.join(__dirname, '../test-storage');
  process.env.STORAGE_PATH = storagePath;

  // Create directory structure
  const dirs = [
    'events/active/wedding-2024',
    'events/active/birthday-2024',
    'events/archived',
    'thumbnails',
    'uploads',
    'backups'
  ];

  for (const dir of dirs) {
    await fs.mkdir(path.join(storagePath, dir), { recursive: true });
  }

  // Create test files with various sizes
  const files = [
    { path: 'events/active/wedding-2024/photo1.jpg', size: 1024 * 1024 }, // 1MB
    { path: 'events/active/wedding-2024/photo2.jpg', size: 512 * 1024 },  // 512KB
    { path: 'events/active/birthday-2024/photo1.jpg', size: 2 * 1024 * 1024 }, // 2MB
    { path: 'events/archived/old-event.zip', size: 5 * 1024 * 1024 }, // 5MB
    { path: 'thumbnails/thumb1.jpg', size: 50 * 1024 }, // 50KB
    { path: 'uploads/logo.png', size: 100 * 1024 } // 100KB
  ];

  let totalSize = 0;
  for (const file of files) {
    const content = crypto.randomBytes(file.size);
    await fs.writeFile(path.join(storagePath, file.path), content);
    totalSize += file.size;
  }

  console.log(`   ✓ Created ${files.length} test files`);
  console.log(`   ✓ Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);

  return { storagePath, fileCount: files.length, totalSize };
}

async function configureBackup(type) {
  const baseSettings = [
    { setting_key: 'backup_enabled', setting_value: 'true' },
    { setting_key: 'backup_destination_type', setting_value: `"${type}"` },
    { setting_key: 'backup_include_archived', setting_value: 'true' },
    { setting_key: 'backup_include_database', setting_value: 'true' },
    { setting_key: 'backup_incremental', setting_value: 'true' },
    { setting_key: 'backup_manifest_format', setting_value: '"json"' },
    { setting_key: 'backup_max_file_size_mb', setting_value: '100' }
  ];

  const typeSpecificSettings = {
    s3: [
      { setting_key: 'backup_s3_bucket', setting_value: `"${options.bucket}"` },
      { setting_key: 'backup_s3_endpoint', setting_value: `"${options.endpoint}"` },
      { setting_key: 'backup_s3_access_key', setting_value: `"${options.accessKey}"` },
      { setting_key: 'backup_s3_secret_key', setting_value: `"${options.secretKey}"` },
      { setting_key: 'backup_s3_region', setting_value: '"us-east-1"' },
      { setting_key: 'backup_s3_force_path_style', setting_value: 'true' },
      { setting_key: 'backup_s3_ssl_enabled', setting_value: options.endpoint.startsWith('https') ? 'true' : 'false' }
    ],
    local: [
      { setting_key: 'backup_destination_path', setting_value: `"${path.join(__dirname, '../test-backup')}"` }
    ],
    rsync: [
      { setting_key: 'backup_rsync_host', setting_value: '"localhost"' },
      { setting_key: 'backup_rsync_path', setting_value: `"${path.join(__dirname, '../test-backup-rsync')}"` }
    ]
  };

  const settings = [...baseSettings, ...(typeSpecificSettings[type] || [])];

  // Clear existing settings
  await db('app_settings').where('setting_type', 'backup').del();

  // Insert new settings
  for (const setting of settings) {
    await db('app_settings').insert({
      setting_type: 'backup',
      ...setting,
      created_at: new Date(),
      updated_at: new Date()
    });
  }

  console.log(`   ✓ Configured ${type} backup with ${settings.length} settings`);
}

async function performBackup() {
  const startTime = Date.now();
  
  // Run the backup
  await backupService.runBackup();

  // Get backup results
  const backupRun = await db('backup_runs')
    .orderBy('started_at', 'desc')
    .first();

  if (!backupRun) {
    throw new Error('No backup run found');
  }

  if (backupRun.status !== 'completed') {
    throw new Error(`Backup failed with status: ${backupRun.status}, error: ${backupRun.error_message}`);
  }

  const duration = Date.now() - startTime;

  console.log(`   ✓ Backup completed in ${duration}ms`);
  console.log(`   ✓ Files backed up: ${backupRun.files_backed_up}`);
  console.log(`   ✓ Total size: ${(backupRun.total_size_bytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   ✓ Manifest: ${backupRun.manifest_path ? 'Generated' : 'Not generated'}`);

  return backupRun;
}

async function verifyS3Backup(backupRun) {
  const s3Client = new S3Client({
    endpoint: options.endpoint,
    region: 'us-east-1',
    credentials: {
      accessKeyId: options.accessKey,
      secretAccessKey: options.secretKey
    },
    forcePathStyle: true
  });

  // List objects in bucket
  const listResponse = await s3Client.send(new ListObjectsV2Command({
    Bucket: options.bucket
  }));

  const objects = listResponse.Contents || [];
  console.log(`   ✓ Objects in S3: ${objects.length}`);

  // Verify key components
  const hasBackupFolder = objects.some(obj => obj.Key.includes('backup-'));
  const hasManifest = objects.some(obj => obj.Key.includes('backup-manifest'));
  const hasSummary = objects.some(obj => obj.Key.includes('backup-summary.json'));
  const hasPhotos = objects.some(obj => obj.Key.includes('events/active'));

  if (!hasBackupFolder) throw new Error('No backup folder found in S3');
  if (!hasManifest) throw new Error('No manifest found in S3');
  if (!hasSummary) throw new Error('No summary found in S3');
  if (!hasPhotos) throw new Error('No photos found in S3');

  console.log(`   ✓ Backup structure verified`);

  // Download and verify a file
  const photoObject = objects.find(obj => obj.Key.includes('photo1.jpg'));
  if (photoObject) {
    const getResponse = await s3Client.send(new GetObjectCommand({
      Bucket: options.bucket,
      Key: photoObject.Key
    }));

    const chunks = [];
    for await (const chunk of getResponse.Body) {
      chunks.push(chunk);
    }
    const content = Buffer.concat(chunks);

    console.log(`   ✓ Downloaded test file: ${photoObject.Key} (${content.length} bytes)`);
  }
}

async function testIncrementalBackup(testData) {
  // Modify a file
  const modifiedFile = path.join(testData.storagePath, 'events/active/wedding-2024/photo1.jpg');
  const newContent = crypto.randomBytes(1024 * 1024 + 100); // Slightly larger
  await fs.writeFile(modifiedFile, newContent);

  console.log(`   ✓ Modified test file`);

  // Perform incremental backup
  const backupRun = await performBackup();

  if (backupRun.files_backed_up !== 1) {
    throw new Error(`Expected 1 file in incremental backup, got ${backupRun.files_backed_up}`);
  }

  console.log(`   ✓ Incremental backup correctly identified changed file`);

  // Verify manifest indicates incremental
  if (backupRun.manifest_path) {
    const { manifest } = await backupService.getBackupManifest(backupRun.id);
    if (!manifest.incremental) {
      throw new Error('Manifest does not indicate incremental backup');
    }
    console.log(`   ✓ Manifest correctly marked as incremental`);
  }

  return backupRun;
}

async function testManifestValidation(backupRun) {
  if (!backupRun.manifest_path) {
    throw new Error('No manifest path in backup run');
  }

  const result = await backupService.validateBackupManifest(backupRun.manifest_path);

  if (!result.valid) {
    throw new Error(`Manifest validation failed: ${result.error}`);
  }

  console.log(`   ✓ Manifest validation passed`);
  console.log(`   ✓ Manifest version: ${result.manifest.manifest.version}`);
  console.log(`   ✓ Files in manifest: ${result.manifest.files.count}`);
}

async function testBackupStatus() {
  const status = await backupService.getBackupStatus(5);

  console.log(`   ✓ Backup service running: ${status.isRunning}`);
  console.log(`   ✓ Backup service healthy: ${status.isHealthy}`);
  console.log(`   ✓ Recent runs: ${status.recentRuns.length}`);

  if (status.lastRun) {
    console.log(`   ✓ Last run status: ${status.lastRun.status}`);
    console.log(`   ✓ Manifest valid: ${status.lastRun.manifestValid}`);
  }
}

async function cleanupTestData() {
  if (!options.cleanup) {
    console.log('\n📌 Test data retained for inspection');
    console.log(`   Storage: ${process.env.STORAGE_PATH}`);
    if (options.type === 's3') {
      console.log(`   S3 Bucket: ${options.bucket}`);
    }
    return;
  }

  console.log('\n🧹 Cleaning up test data...');

  // Clean storage directory
  if (process.env.STORAGE_PATH) {
    await fs.rm(process.env.STORAGE_PATH, { recursive: true, force: true });
    console.log('   ✓ Removed test storage directory');
  }

  // Clean S3 bucket if used
  if (options.type === 's3') {
    const s3Client = new S3Client({
      endpoint: options.endpoint,
      region: 'us-east-1',
      credentials: {
        accessKeyId: options.accessKey,
        secretAccessKey: options.secretKey
      },
      forcePathStyle: true
    });

    try {
      // List and delete all objects
      const listResponse = await s3Client.send(new ListObjectsV2Command({
        Bucket: options.bucket
      }));

      if (listResponse.Contents && listResponse.Contents.length > 0) {
        await s3Client.send(new DeleteObjectsCommand({
          Bucket: options.bucket,
          Delete: {
            Objects: listResponse.Contents.map(obj => ({ Key: obj.Key }))
          }
        }));
        console.log(`   ✓ Deleted ${listResponse.Contents.length} objects from S3`);
      }

      // Delete bucket
      await s3Client.send(new DeleteBucketCommand({
        Bucket: options.bucket
      }));
      console.log(`   ✓ Deleted S3 bucket: ${options.bucket}`);
    } catch (error) {
      console.error(`   ⚠️  Failed to cleanup S3: ${error.message}`);
    }
  }

  // Clean backup directories
  const backupDirs = [
    path.join(__dirname, '../test-backup'),
    path.join(__dirname, '../test-backup-rsync')
  ];

  for (const dir of backupDirs) {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
  console.log('   ✓ Removed backup directories');
}

// Main test runner
async function main() {
  console.log('🚀 Enhanced Backup System Integration Test');
  console.log('==========================================');
  console.log(`Type: ${options.type}`);
  console.log(`Endpoint: ${options.endpoint}`);
  console.log(`Bucket: ${options.bucket}`);
  console.log('');

  let s3Client;
  let testData;

  try {
    // Initialize database
    console.log('📦 Initializing database...');
    await initDb();
    await db.migrate.latest();
    console.log('   ✓ Database initialized');

    // S3-specific setup
    if (options.type === 's3') {
      // Test S3 connection
      await runTest('S3 Connection Test', testS3Connection);

      // Create S3 bucket if needed
      s3Client = new S3Client({
        endpoint: options.endpoint,
        region: 'us-east-1',
        credentials: {
          accessKeyId: options.accessKey,
          secretAccessKey: options.secretKey
        },
        forcePathStyle: true
      });

      try {
        await s3Client.send(new HeadBucketCommand({ Bucket: options.bucket }));
        console.log(`\n📦 Using existing bucket: ${options.bucket}`);
      } catch (error) {
        if (error.name === 'NotFound') {
          await s3Client.send(new CreateBucketCommand({ Bucket: options.bucket }));
          console.log(`\n📦 Created new bucket: ${options.bucket}`);
        } else {
          throw error;
        }
      }
    }

    // Setup test data
    console.log('\n📁 Setting up test data...');
    testData = await setupTestData();

    // Configure backup
    console.log(`\n⚙️  Configuring ${options.type} backup...`);
    await configureBackup(options.type);

    // Run tests based on backup type
    await runTest('Initial Full Backup', performBackup);

    if (options.type === 's3') {
      await runTest('Verify S3 Backup Contents', async () => {
        const lastRun = await db('backup_runs').orderBy('started_at', 'desc').first();
        await verifyS3Backup(lastRun);
      });
    }

    await runTest('Incremental Backup', () => testIncrementalBackup(testData));

    await runTest('Manifest Validation', async () => {
      const lastRun = await db('backup_runs').orderBy('started_at', 'desc').first();
      await testManifestValidation(lastRun);
    });

    await runTest('Backup Status Check', testBackupStatus);

    // Performance test with larger files
    if (options.type === 's3') {
      await runTest('Large File Backup (10MB)', async () => {
        const largeFile = path.join(testData.storagePath, 'events/active/large.jpg');
        await fs.writeFile(largeFile, crypto.randomBytes(10 * 1024 * 1024));
        await performBackup();
      });
    }

    // Test backup service lifecycle
    await runTest('Backup Service Start/Stop', async () => {
      await backupService.startBackupService();
      console.log('   ✓ Service started');
      
      backupService.stopBackupService();
      console.log('   ✓ Service stopped');
    });

    // Print results summary
    console.log('\n📊 Test Results Summary');
    console.log('======================');
    console.log(`✅ Passed: ${results.passed}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`⏭️  Skipped: ${results.skipped}`);
    console.log(`📋 Total: ${results.tests.length}`);

    if (results.failed > 0) {
      console.log('\nFailed Tests:');
      results.tests
        .filter(t => t.status === 'failed')
        .forEach(t => console.log(`  - ${t.name}: ${t.error}`));
    }

  } catch (error) {
    console.error('\n💥 Fatal error:', error.message);
    if (options.verbose) {
      console.error(error.stack);
    }
    results.failed++;
  } finally {
    // Cleanup
    await cleanupTestData();

    // Close database
    await db.destroy();

    // Exit with appropriate code
    process.exit(results.failed > 0 ? 1 : 0);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = { runTest, skipTest };