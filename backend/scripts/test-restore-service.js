/**
 * Test script for the restore service
 * 
 * This script demonstrates the restore service functionality with safety checks
 * 
 * Usage:
 *   node scripts/test-restore-service.js [options]
 * 
 * Options:
 *   --dry-run    Perform validation only without actual restore
 *   --force      Force restore even with warnings
 *   --type       Restore type: full, database, files, selective (default: full)
 *   --source     Backup source path or S3 URL
 *   --manifest   Path to backup manifest
 */

require('dotenv').config();
const { restoreService } = require('../src/services/restoreService');
const { db } = require('../src/database/db');
const logger = require('../src/utils/logger');
const path = require('path');
const fs = require('fs').promises;

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  dryRun: args.includes('--dry-run'),
  force: args.includes('--force'),
  restoreType: 'full',
  source: null,
  manifestPath: null
};

// Parse restore type
const typeIndex = args.indexOf('--type');
if (typeIndex !== -1 && args[typeIndex + 1]) {
  options.restoreType = args[typeIndex + 1];
}

// Parse source
const sourceIndex = args.indexOf('--source');
if (sourceIndex !== -1 && args[sourceIndex + 1]) {
  options.source = args[sourceIndex + 1];
}

// Parse manifest
const manifestIndex = args.indexOf('--manifest');
if (manifestIndex !== -1 && args[manifestIndex + 1]) {
  options.manifestPath = args[manifestIndex + 1];
}

async function testRestore() {
  console.log('=== PicPeak Restore Service Test ===\n');
  
  try {
    // If no source/manifest provided, try to find a recent backup
    if (!options.source || !options.manifestPath) {
      console.log('No backup source specified. Looking for recent backups...\n');
      
      const recentBackup = await db('backup_runs')
        .where('status', 'completed')
        .whereNotNull('manifest_path')
        .orderBy('completed_at', 'desc')
        .first();
      
      if (!recentBackup) {
        console.error('❌ No completed backups found in the database');
        console.log('\nPlease run a backup first or specify --source and --manifest');
        process.exit(1);
      }
      
      console.log(`Found recent backup from ${recentBackup.completed_at}`);
      console.log(`Backup ID: ${recentBackup.manifest_id}`);
      console.log(`Files backed up: ${recentBackup.files_backed_up}`);
      console.log(`Total size: ${(recentBackup.total_size_bytes / 1024 / 1024).toFixed(2)} MB`);
      console.log(`Manifest: ${recentBackup.manifest_path}\n`);
      
      // For this test, we'll create a mock scenario
      console.log('⚠️  This is a TEST MODE - using mock data for safety\n');
      
      // Create test backup directory
      const testBackupDir = path.join(__dirname, '../temp/test-backup');
      await fs.mkdir(testBackupDir, { recursive: true });
      
      // Create test manifest
      const testManifest = {
        manifest: {
          version: '2.0',
          created: new Date().toISOString(),
          generator: 'Test Script',
          format: 'json'
        },
        backup: {
          id: 'test-backup-' + Date.now(),
          type: 'full',
          timestamp: new Date().toISOString(),
          path: testBackupDir,
          parent_backup_id: null,
          retention_days: 30
        },
        system: {
          hostname: require('os').hostname(),
          platform: process.platform,
          os_release: require('os').release(),
          architecture: require('os').arch()
        },
        application: {
          name: 'PicPeak',
          version: require('../package.json').version,
          node_version: process.version,
          environment: 'test'
        },
        files: {
          count: 0,
          total_size: 0,
          checksums: {},
          manifest: []
        },
        database: {
          type: process.env.DB_TYPE === 'postgresql' ? 'postgresql' : 'sqlite',
          backup_file: null,
          size: 0,
          checksum: null,
          tables: {},
          row_counts: {}
        },
        verification: {
          total_checksum: null,
          file_count_check: 0,
          size_check: 0,
          integrity_timestamp: new Date().toISOString()
        },
        metadata: {
          test_mode: true
        }
      };
      
      // Calculate checksum
      const crypto = require('crypto');
      const manifestCopy = JSON.parse(JSON.stringify(testManifest));
      delete manifestCopy.verification.total_checksum;
      testManifest.verification.total_checksum = crypto
        .createHash('sha256')
        .update(JSON.stringify(manifestCopy, Object.keys(manifestCopy).sort()))
        .digest('hex');
      
      // Save test manifest
      const testManifestPath = path.join(testBackupDir, 'test-manifest.json');
      await fs.writeFile(testManifestPath, JSON.stringify(testManifest, null, 2));
      
      options.source = testBackupDir;
      options.manifestPath = testManifestPath;
    }
    
    // Display restore options
    console.log('Restore Options:');
    console.log(`- Type: ${options.restoreType}`);
    console.log(`- Source: ${options.source}`);
    console.log(`- Manifest: ${options.manifestPath}`);
    console.log(`- Dry Run: ${options.dryRun ? 'Yes' : 'No'}`);
    console.log(`- Force: ${options.force ? 'Yes' : 'No'}`);
    console.log('');
    
    // Add S3 config if source is S3
    if (options.source.startsWith('s3://')) {
      options.s3Config = {
        accessKeyId: process.env.BACKUP_S3_ACCESS_KEY,
        secretAccessKey: process.env.BACKUP_S3_SECRET_KEY,
        region: process.env.BACKUP_S3_REGION || 'us-east-1',
        endpoint: process.env.BACKUP_S3_ENDPOINT
      };
      
      if (!options.s3Config.accessKeyId || !options.s3Config.secretAccessKey) {
        console.error('❌ S3 credentials not configured in environment');
        process.exit(1);
      }
    }
    
    // Confirm before proceeding (unless dry run)
    if (!options.dryRun) {
      console.log('⚠️  WARNING: This will restore data from the backup!');
      console.log('⚠️  Current data may be overwritten!');
      console.log('');
      console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    console.log('\nStarting restore operation...\n');
    
    // Perform restore
    const result = await restoreService.restore(options);
    
    if (options.dryRun) {
      console.log('\n=== DRY RUN RESULTS ===\n');
      
      console.log('Validation:');
      console.log(`- Valid: ${result.validation.isValid ? '✅ Yes' : '❌ No'}`);
      
      if (result.validation.errors.length > 0) {
        console.log('- Errors:');
        result.validation.errors.forEach(err => console.log(`  ❌ ${err}`));
      }
      
      if (result.validation.warnings.length > 0) {
        console.log('- Warnings:');
        result.validation.warnings.forEach(warn => console.log(`  ⚠️  ${warn}`));
      }
      
      console.log('\nDisk Space:');
      console.log(`- Required: ${result.spaceCheck.requiredFormatted}`);
      console.log(`- Available: ${result.spaceCheck.availableFormatted}`);
      console.log(`- Sufficient: ${result.spaceCheck.hasEnoughSpace ? '✅ Yes' : '❌ No'}`);
      
    } else {
      console.log('\n=== RESTORE RESULTS ===\n');
      
      console.log(`Status: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}`);
      console.log(`Duration: ${result.duration}s`);
      
      if (result.result) {
        console.log('\nItems Restored:');
        if (result.result.databaseRestored !== undefined) {
          console.log(`- Database: ${result.result.databaseRestored ? '✅' : '❌'}`);
        }
        if (result.result.filesRestored !== undefined) {
          console.log(`- Files: ${result.result.filesRestored}`);
        }
        if (result.result.errors && result.result.errors.length > 0) {
          console.log('- Errors:');
          result.result.errors.forEach(err => console.log(`  ❌ ${err}`));
        }
      }
      
      if (result.verification) {
        console.log('\nVerification:');
        console.log(`- Valid: ${result.verification.isValid ? '✅ Yes' : '❌ No'}`);
        if (result.verification.errors.length > 0) {
          console.log('- Errors:');
          result.verification.errors.forEach(err => console.log(`  ❌ ${err}`));
        }
      }
      
      if (result.preRestoreBackup) {
        console.log('\nSafety Backup:');
        console.log(`- Location: ${result.preRestoreBackup}`);
        console.log('- This backup can be used to rollback if needed');
      }
    }
    
    // Show recent log entries
    console.log('\nRecent Log Entries:');
    result.logs.slice(-10).forEach(log => {
      const icon = log.level === 'error' ? '❌' : log.level === 'warn' ? '⚠️ ' : 'ℹ️ ';
      console.log(`${icon} [${log.timestamp}] ${log.message}`);
    });
    
    // Clean up test files
    if (options.source && options.source.includes('test-backup')) {
      await fs.rmdir(path.dirname(options.source), { recursive: true }).catch(() => {});
    }
    
  } catch (error) {
    console.error('\n❌ Restore operation failed:', error.message);
    
    // Show logs if available
    if (restoreService.restoreLog && restoreService.restoreLog.length > 0) {
      console.log('\nError Log:');
      restoreService.restoreLog.slice(-10).forEach(log => {
        if (log.level === 'error' || log.level === 'warn') {
          console.log(`[${log.timestamp}] ${log.level.toUpperCase()}: ${log.message}`);
        }
      });
    }
    
    process.exit(1);
  }
  
  // Cleanup
  await db.destroy();
  process.exit(0);
}

// Show help if requested
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
PicPeak Restore Service Test

This script tests the restore service functionality with safety checks.

Usage:
  node scripts/test-restore-service.js [options]

Options:
  --dry-run    Perform validation only without actual restore
  --force      Force restore even with warnings
  --type       Restore type: full, database, files, selective (default: full)
  --source     Backup source path or S3 URL
  --manifest   Path to backup manifest
  --help       Show this help message

Examples:
  # Dry run with automatic backup selection
  node scripts/test-restore-service.js --dry-run

  # Full restore from specific backup
  node scripts/test-restore-service.js --source /backup/2024-01-20 --manifest /backup/2024-01-20/manifest.json

  # Database-only restore with force
  node scripts/test-restore-service.js --type database --force --source /backup/2024-01-20 --manifest /backup/2024-01-20/manifest.json

  # Restore from S3
  node scripts/test-restore-service.js --source s3://my-bucket/backups/2024-01-20 --manifest s3://my-bucket/backups/2024-01-20/manifest.json

Safety Features:
- Pre-restore validation checks compatibility and warns about potential issues
- Automatic pre-restore backup is created (unless skipped)
- Post-restore verification ensures data integrity
- Rollback capability if restore fails
- Detailed logging of all operations
`);
  process.exit(0);
}

// Run the test
testRestore();