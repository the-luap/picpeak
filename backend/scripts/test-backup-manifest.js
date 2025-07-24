#!/usr/bin/env node

/**
 * Test script for backup manifest generator
 * Demonstrates all features of the manifest generator
 */

const path = require('path');
const fs = require('fs').promises;
const backupManifest = require('../src/services/backupManifest');
const logger = require('../src/utils/logger');

async function testManifestGeneration() {
  console.log('=== Testing Backup Manifest Generator ===\n');

  try {
    // 1. Generate a full backup manifest
    console.log('1. Generating full backup manifest...');
    
    const fullManifestOptions = {
      backupType: 'full',
      backupPath: '/backup/full/2025-01-21',
      files: [
        {
          path: '/storage/events/active/wedding-smith-2025/DSC_001.jpg',
          relativePath: 'events/active/wedding-smith-2025/DSC_001.jpg',
          size: 2456789,
          modified: new Date('2025-01-20T10:30:00Z'),
          checksum: 'a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890',
          permissions: '644'
        },
        {
          path: '/storage/events/active/wedding-smith-2025/DSC_002.jpg',
          relativePath: 'events/active/wedding-smith-2025/DSC_002.jpg',
          size: 2156789,
          modified: new Date('2025-01-20T10:31:00Z'),
          checksum: 'b2c3d4e5f67890123456789012345678901234567890123456789012345678901',
          permissions: '644'
        },
        {
          path: '/storage/thumbnails/wedding-smith-2025/thumb_DSC_001.jpg',
          relativePath: 'thumbnails/wedding-smith-2025/thumb_DSC_001.jpg',
          size: 45678,
          modified: new Date('2025-01-20T10:35:00Z'),
          checksum: 'c3d4e5f678901234567890123456789012345678901234567890123456789012',
          permissions: '644'
        }
      ],
      databaseInfo: {
        type: 'sqlite',
        backupFile: 'database-backup-20250121-103000.sql.gz',
        size: 1048576,
        checksum: 'd4e5f6789012345678901234567890123456789012345678901234567890123',
        tables: {
          events: 156,
          photos: 4523,
          access_logs: 12456,
          admin_users: 3
        },
        rowCounts: {
          events: 156,
          photos: 4523,
          access_logs: 12456,
          admin_users: 3
        }
      },
      format: 'json',
      customMetadata: {
        operator: 'admin@example.com',
        reason: 'Scheduled daily backup',
        retentionDays: 30,
        compressionType: 'gzip'
      }
    };

    const fullManifest = await backupManifest.generateManifest(fullManifestOptions);
    
    // Save in both formats
    const jsonPath = path.join(__dirname, 'test-manifest-full.json');
    const yamlPath = path.join(__dirname, 'test-manifest-full.yaml');
    
    await backupManifest.saveManifest(fullManifest, jsonPath, 'json');
    await backupManifest.saveManifest(fullManifest, yamlPath, 'yaml');
    
    console.log('✓ Full backup manifest generated and saved\n');

    // 2. Generate summary report
    console.log('2. Generating summary report...');
    const summaryReport = backupManifest.generateSummaryReport(fullManifest);
    console.log(summaryReport);
    console.log('\n');

    // 3. Load and validate manifest
    console.log('3. Loading and validating manifest...');
    const loadedManifest = await backupManifest.loadManifest(jsonPath);
    console.log('✓ Manifest loaded and validated successfully\n');

    // 4. Generate incremental backup manifest
    console.log('4. Generating incremental backup manifest...');
    
    const incrementalOptions = {
      backupType: 'incremental',
      backupPath: '/backup/incremental/2025-01-22',
      parentBackupId: fullManifest.backup.id,
      files: [
        // Original files with same checksums (unchanged)
        fullManifestOptions.files[0],
        fullManifestOptions.files[2],
        // Modified file
        {
          ...fullManifestOptions.files[1],
          size: 2256789,
          modified: new Date('2025-01-21T14:00:00Z'),
          checksum: 'e5f678901234567890123456789012345678901234567890123456789012345'
        },
        // New file
        {
          path: '/storage/events/active/wedding-smith-2025/DSC_003.jpg',
          relativePath: 'events/active/wedding-smith-2025/DSC_003.jpg',
          size: 2356789,
          modified: new Date('2025-01-21T14:30:00Z'),
          checksum: 'f6789012345678901234567890123456789012345678901234567890123456',
          permissions: '644'
        }
      ],
      databaseInfo: {
        ...fullManifestOptions.databaseInfo,
        size: 1148576,
        checksum: 'g7890123456789012345678901234567890123456789012345678901234567',
        rowCounts: {
          events: 158,
          photos: 4567,
          access_logs: 12789,
          admin_users: 3
        }
      }
    };

    const incrementalManifest = await backupManifest.generateIncrementalManifest(
      incrementalOptions, 
      fullManifest
    );
    
    const incrementalJsonPath = path.join(__dirname, 'test-manifest-incremental.json');
    await backupManifest.saveManifest(incrementalManifest, incrementalJsonPath, 'json');
    
    console.log('✓ Incremental backup manifest generated');
    console.log(`  - Added files: ${incrementalManifest.incremental.changes.added_files_count}`);
    console.log(`  - Modified files: ${incrementalManifest.incremental.changes.modified_files_count}`);
    console.log(`  - Deleted files: ${incrementalManifest.incremental.changes.deleted_files_count}`);
    console.log(`  - Size difference: ${(incrementalManifest.incremental.changes.size_difference / 1024).toFixed(2)} KB\n`);

    // 5. Compare manifests
    console.log('5. Comparing manifests...');
    const comparison = backupManifest.compareManifests(incrementalManifest, fullManifest);
    console.log('Comparison results:');
    console.log(`  - Added: ${comparison.added_files.length} files`);
    console.log(`  - Modified: ${comparison.modified_files.length} files`);
    console.log(`  - Deleted: ${comparison.deleted_files.length} files`);
    console.log(`  - Unchanged: ${comparison.unchanged_files.length} files`);
    console.log(`  - Database changed: ${comparison.database_changes.checksum_changed ? 'Yes' : 'No'}\n`);

    // 6. Test manifest integrity
    console.log('6. Testing manifest integrity...');
    
    // Corrupt the manifest
    const corruptedManifest = JSON.parse(JSON.stringify(incrementalManifest));
    corruptedManifest.files.manifest[0].size = 9999999; // Change a file size
    
    try {
      backupManifest.validateManifest(corruptedManifest);
      console.log('✗ Validation should have failed for corrupted manifest');
    } catch (error) {
      console.log('✓ Correctly detected corrupted manifest:', error.message);
    }

    console.log('\n=== All tests completed successfully! ===');
    
    // Clean up test files
    await fs.unlink(jsonPath).catch(() => {});
    await fs.unlink(yamlPath).catch(() => {});
    await fs.unlink(incrementalJsonPath).catch(() => {});

  } catch (error) {
    console.error('Test failed:', error);
    logger.error('Manifest test failed:', error);
    process.exit(1);
  }
}

// Run tests
testManifestGeneration().catch(console.error);