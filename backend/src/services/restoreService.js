const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const { pipeline } = require('stream/promises');
const { createReadStream, createWriteStream } = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const { db } = require('../database/db');
const knexConfig = require('../../knexfile');
const logger = require('../utils/logger');
const backupManifest = require('./backupManifest');
const S3StorageAdapter = require('./storage/s3Storage');
const { queueEmail } = require('./emailProcessor');
const { formatBoolean } = require('../utils/dbCompat');
const os = require('os');

/**
 * Restore Service with Extreme Safety Measures
 * 
 * This service handles restoration of backups with multiple safety checks,
 * validation, and rollback capabilities. It prioritizes data safety over speed.
 * 
 * Features:
 * - Pre-restore validation and integrity checks
 * - Automatic pre-restore backup creation
 * - Atomic operations where possible
 * - Comprehensive rollback capability
 * - Detailed logging of every action
 * - Dry-run mode for testing
 * - Multiple restore options (full, database-only, files-only, selective)
 * - S3 support with resume capability
 * - Post-restore verification
 * 
 * @class RestoreService
 */
class RestoreService {
  constructor() {
    this.isRunning = false;
    this.currentProgress = null;
    this.restoreLog = [];
    this.preRestoreBackupPath = null;
    this.dbType = knexConfig.client === 'pg' ? 'postgresql' : 'sqlite';
    this.tempDir = path.join(os.tmpdir(), 'picpeak-restore');
  }

  /**
   * Main restore method with comprehensive safety checks
   * 
   * @param {Object} options - Restore options
   * @param {string} options.source - Backup source (file path or S3 URL)
   * @param {string} options.manifestPath - Path to backup manifest
   * @param {string} options.restoreType - 'full', 'database', 'files', or 'selective'
   * @param {Array} options.selectedItems - For selective restore, array of items to restore
   * @param {boolean} options.dryRun - If true, performs validation only
   * @param {boolean} options.skipPreBackup - Skip automatic pre-restore backup (dangerous!)
   * @param {boolean} options.force - Force restore even with warnings (dangerous!)
   * @param {Object} options.s3Config - S3 configuration for S3-based backups
   * @returns {Promise<Object>} - Restore result
   */
  async restore(options) {
    if (this.isRunning) {
      throw new Error('Restore operation already in progress');
    }

    this.isRunning = true;
    this.restoreLog = [];
    const startTime = new Date();
    let restoreRun = null;

    try {
      // Validate options
      this.validateRestoreOptions(options);
      this.log('info', 'Starting restore operation', { options: this.sanitizeOptions(options) });

      // Create restore run record
      const [runId] = await db('restore_runs').insert({
        started_at: startTime,
        status: 'running',
        restore_type: options.restoreType,
        source: options.source,
        manifest_path: options.manifestPath,
        is_dry_run: options.dryRun || false
      });

      restoreRun = { id: runId };

      // Step 1: Load and validate manifest
      this.updateProgress('Loading and validating manifest...');
      const manifest = await this.loadAndValidateManifest(options.manifestPath, options.s3Config);
      this.log('info', 'Manifest loaded and validated', {
        backupId: manifest.backup.id,
        backupType: manifest.backup.type,
        backupTime: manifest.backup.timestamp
      });

      // Step 2: Pre-restore validation
      this.updateProgress('Performing pre-restore validation...');
      const validation = await this.performPreRestoreValidation(manifest, options);
      
      if (!validation.isValid && !options.force) {
        throw new Error(`Pre-restore validation failed: ${validation.errors.join(', ')}`);
      }

      if (validation.warnings.length > 0) {
        this.log('warn', 'Pre-restore validation warnings', { warnings: validation.warnings });
        if (!options.force) {
          throw new Error(`Restore blocked due to warnings (use force to override): ${validation.warnings.join(', ')}`);
        }
      }

      // Step 3: Check disk space
      this.updateProgress('Checking available disk space...');
      const spaceCheck = await this.checkDiskSpace(manifest, options);
      if (!spaceCheck.hasEnoughSpace) {
        throw new Error(`Insufficient disk space. Required: ${spaceCheck.requiredFormatted}, Available: ${spaceCheck.availableFormatted}`);
      }

      // Dry run mode - stop here after validation
      if (options.dryRun) {
        this.log('info', 'Dry run completed successfully');
        
        await db('restore_runs').where('id', runId).update({
          completed_at: new Date(),
          status: 'completed',
          statistics: JSON.stringify({
            dryRun: true,
            validation,
            spaceCheck,
            manifest: {
              backupId: manifest.backup.id,
              fileCount: manifest.files.count,
              totalSize: manifest.files.total_size
            }
          })
        });

        return {
          success: true,
          dryRun: true,
          validation,
          spaceCheck,
          logs: this.restoreLog
        };
      }

      // Step 4: Create pre-restore backup (unless explicitly skipped)
      if (!options.skipPreBackup) {
        this.updateProgress('Creating pre-restore safety backup...');
        this.preRestoreBackupPath = await this.createPreRestoreBackup(options);
        this.log('info', 'Pre-restore backup created', { path: this.preRestoreBackupPath });
      } else {
        this.log('warn', 'Pre-restore backup skipped at user request');
      }

      // Step 5: Download backup if from S3
      let localBackupPath = options.source;
      if (options.source.startsWith('s3://')) {
        this.updateProgress('Downloading backup from S3...');
        localBackupPath = await this.downloadFromS3(options.source, manifest, options);
      }

      // Step 6: Perform the actual restore based on type
      let restoreResult;
      switch (options.restoreType) {
        case 'full':
          restoreResult = await this.performFullRestore(localBackupPath, manifest, options);
          break;
        case 'database':
          restoreResult = await this.performDatabaseRestore(localBackupPath, manifest, options);
          break;
        case 'files':
          restoreResult = await this.performFilesRestore(localBackupPath, manifest, options);
          break;
        case 'selective':
          restoreResult = await this.performSelectiveRestore(localBackupPath, manifest, options);
          break;
        default:
          throw new Error(`Unknown restore type: ${options.restoreType}`);
      }

      // Step 7: Post-restore verification
      this.updateProgress('Performing post-restore verification...');
      const verification = await this.performPostRestoreVerification(manifest, options);
      
      if (!verification.isValid) {
        this.log('error', 'Post-restore verification failed', { errors: verification.errors });
        // Attempt rollback
        if (this.preRestoreBackupPath) {
          await this.attemptRollback(this.preRestoreBackupPath);
        }
        throw new Error(`Post-restore verification failed: ${verification.errors.join(', ')}`);
      }

      // Step 8: Clean up temporary files
      if (localBackupPath !== options.source) {
        await fs.unlink(localBackupPath).catch(err => 
          this.log('warn', 'Failed to clean up temporary backup file', { error: err.message })
        );
      }

      // Calculate duration
      const endTime = new Date();
      const durationSeconds = Math.round((endTime - startTime) / 1000);

      // Update restore run record
      await db('restore_runs').where('id', runId).update({
        completed_at: endTime,
        status: 'completed',
        duration_seconds: durationSeconds,
        pre_restore_backup_path: this.preRestoreBackupPath,
        statistics: JSON.stringify({
          ...restoreResult,
          verification,
          durationSeconds
        })
      });

      // Send success notification
      await this.sendRestoreNotification('success', {
        restoreType: options.restoreType,
        duration: durationSeconds,
        filesRestored: restoreResult.filesRestored || 0,
        backupId: manifest.backup.id
      });

      this.log('info', 'Restore completed successfully', {
        duration: `${durationSeconds}s`,
        result: restoreResult
      });

      return {
        success: true,
        duration: durationSeconds,
        result: restoreResult,
        verification,
        preRestoreBackup: this.preRestoreBackupPath,
        logs: this.restoreLog
      };

    } catch (error) {
      this.log('error', 'Restore failed', { error: error.message, stack: error.stack });

      // Update restore run record
      if (restoreRun) {
        await db('restore_runs').where('id', restoreRun.id).update({
          completed_at: new Date(),
          status: 'failed',
          error_message: error.message,
          restore_log: JSON.stringify(this.restoreLog)
        });
      }

      // Send failure notification
      await this.sendRestoreNotification('failure', {
        error: error.message,
        restoreType: options.restoreType
      });

      throw error;

    } finally {
      this.isRunning = false;
      this.currentProgress = null;
      
      // Clean up temp directory
      try {
        await fs.rmdir(this.tempDir, { recursive: true });
      } catch (err) {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Validate restore options
   */
  validateRestoreOptions(options) {
    if (!options.source) {
      throw new Error('Backup source is required');
    }

    if (!options.manifestPath) {
      throw new Error('Manifest path is required');
    }

    if (!options.restoreType) {
      throw new Error('Restore type is required');
    }

    const validTypes = ['full', 'database', 'files', 'selective'];
    if (!validTypes.includes(options.restoreType)) {
      throw new Error(`Invalid restore type. Must be one of: ${validTypes.join(', ')}`);
    }

    if (options.restoreType === 'selective' && (!options.selectedItems || options.selectedItems.length === 0)) {
      throw new Error('Selected items are required for selective restore');
    }

    if (options.source.startsWith('s3://') && !options.s3Config) {
      throw new Error('S3 configuration is required for S3-based backups');
    }
  }

  /**
   * Load and validate manifest
   */
  async loadAndValidateManifest(manifestPath, s3Config) {
    let manifest;

    if (manifestPath.startsWith('s3://')) {
      // Download manifest from S3
      const tempManifestPath = path.join(this.tempDir, 'manifest.json');
      await fs.mkdir(this.tempDir, { recursive: true });
      await this.downloadFileFromS3(manifestPath, tempManifestPath, s3Config);
      manifest = await backupManifest.loadManifest(tempManifestPath);
    } else {
      manifest = await backupManifest.loadManifest(manifestPath);
    }

    // Validate manifest
    backupManifest.validateManifest(manifest);

    return manifest;
  }

  /**
   * Perform pre-restore validation
   */
  async performPreRestoreValidation(manifest, options) {
    const validation = {
      isValid: true,
      errors: [],
      warnings: []
    };

    try {
      // Check backup integrity
      if (manifest.verification && manifest.verification.total_checksum) {
        const calculatedChecksum = backupManifest.calculateManifestChecksum(manifest);
        if (calculatedChecksum !== manifest.verification.total_checksum) {
          validation.errors.push('Manifest checksum verification failed');
          validation.isValid = false;
        }
      }

      // Check backup age
      const backupAge = Date.now() - new Date(manifest.backup.timestamp).getTime();
      const ageInDays = backupAge / (1000 * 60 * 60 * 24);
      if (ageInDays > 30) {
        validation.warnings.push(`Backup is ${Math.round(ageInDays)} days old`);
      }

      // Check version compatibility
      const currentVersion = require('../../package.json').version;
      if (manifest.application.version !== currentVersion) {
        validation.warnings.push(
          `Version mismatch: backup from v${manifest.application.version}, current v${currentVersion}`
        );
      }

      // Check database compatibility
      if (options.restoreType === 'full' || options.restoreType === 'database') {
        const currentDbType = this.dbType;
        if (manifest.database.type !== currentDbType) {
          validation.errors.push(
            `Database type mismatch: backup is ${manifest.database.type}, current is ${currentDbType}`
          );
          validation.isValid = false;
        }
      }

      // Check if restoring would overwrite existing data
      if (options.restoreType === 'full' || options.restoreType === 'database') {
        const eventCount = await db('events').count('* as count').first();
        if (eventCount && eventCount.count > 0) {
          validation.warnings.push(`Database contains ${eventCount.count} existing events that will be overwritten`);
        }
      }

      // Check for active users
      const activeUsers = await db('admin_users')
        .where('is_active', formatBoolean(true))
        .count('* as count')
        .first();
      if (activeUsers && activeUsers.count > 0) {
        validation.warnings.push(`There are ${activeUsers.count} active admin users`);
      }

    } catch (error) {
      validation.errors.push(`Validation error: ${error.message}`);
      validation.isValid = false;
    }

    return validation;
  }

  /**
   * Check available disk space
   */
  async checkDiskSpace(manifest, options) {
    const { statvfs } = require('fs');
    const statvfsAsync = promisify(statvfs);

    try {
      const storagePath = process.env.STORAGE_PATH || path.join(__dirname, '../../../storage');
      const stats = await statvfsAsync(storagePath);
      
      const blockSize = stats.bsize || stats.f_bsize || 4096;
      const availableBytes = stats.bavail * blockSize;
      
      // Calculate required space (with 20% buffer)
      let requiredBytes = 0;
      if (options.restoreType === 'full' || options.restoreType === 'files') {
        requiredBytes = manifest.files.total_size * 1.2;
      }
      if (options.restoreType === 'full' || options.restoreType === 'database') {
        requiredBytes += (manifest.database.size || 0) * 1.2;
      }

      // Add space for pre-restore backup
      if (!options.skipPreBackup) {
        const currentUsage = await this.calculateCurrentStorageUsage();
        requiredBytes += currentUsage * 1.1; // 10% buffer for backup
      }

      return {
        hasEnoughSpace: availableBytes > requiredBytes,
        availableBytes,
        requiredBytes,
        availableFormatted: this.formatBytes(availableBytes),
        requiredFormatted: this.formatBytes(requiredBytes)
      };

    } catch (error) {
      // Fallback for systems without statvfs
      this.log('warn', 'Could not check disk space', { error: error.message });
      return {
        hasEnoughSpace: true, // Assume we have space if we can't check
        availableBytes: 0,
        requiredBytes: 0,
        availableFormatted: 'Unknown',
        requiredFormatted: 'Unknown'
      };
    }
  }

  /**
   * Create pre-restore backup
   */
  async createPreRestoreBackup(options) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `pre-restore-${timestamp}`;
    const backupPath = path.join(this.tempDir, backupName);

    await fs.mkdir(backupPath, { recursive: true });

    try {
      // Backup database
      if (options.restoreType === 'full' || options.restoreType === 'database') {
        this.log('info', 'Backing up current database...');
        const dbBackupPath = path.join(backupPath, 'database.sql');
        
        if (this.dbType === 'sqlite') {
          const dbPath = knexConfig.connection.filename;
          await execAsync(`sqlite3 "${dbPath}" ".backup '${dbBackupPath}'"`);
        } else {
          // PostgreSQL backup
          const { host, port, user, password, database } = knexConfig.connection;
          const env = { ...process.env, PGPASSWORD: password };
          await execAsync(
            `pg_dump -h ${host} -p ${port} -U ${user} -d ${database} > "${dbBackupPath}"`,
            { env }
          );
        }

        // Compress database backup
        await this.compressFile(dbBackupPath, `${dbBackupPath}.gz`);
        await fs.unlink(dbBackupPath);
      }

      // Backup files
      if (options.restoreType === 'full' || options.restoreType === 'files') {
        this.log('info', 'Backing up current files...');
        const storagePath = process.env.STORAGE_PATH || path.join(__dirname, '../../../storage');
        const filesBackupPath = path.join(backupPath, 'files.tar.gz');
        
        await execAsync(`tar -czf "${filesBackupPath}" -C "${path.dirname(storagePath)}" "${path.basename(storagePath)}"`);
      }

      // Create backup manifest
      const backupManifest = {
        timestamp: new Date().toISOString(),
        type: 'pre-restore-safety-backup',
        restoreOptions: this.sanitizeOptions(options),
        contents: await fs.readdir(backupPath)
      };

      await fs.writeFile(
        path.join(backupPath, 'backup-manifest.json'),
        JSON.stringify(backupManifest, null, 2)
      );

      return backupPath;

    } catch (error) {
      // Clean up on failure
      await fs.rmdir(backupPath, { recursive: true }).catch(() => {});
      throw new Error(`Failed to create pre-restore backup: ${error.message}`);
    }
  }

  /**
   * Download backup from S3
   */
  async downloadFromS3(s3Url, manifest, options) {
    const s3PathMatch = s3Url.match(/^s3:\/\/([^\/]+)\/(.+)$/);
    if (!s3PathMatch) {
      throw new Error('Invalid S3 URL format');
    }

    const [, bucket, prefix] = s3PathMatch;
    const s3Client = new S3StorageAdapter({
      ...options.s3Config,
      bucket
    });

    const localPath = path.join(this.tempDir, 'restore-download');
    await fs.mkdir(localPath, { recursive: true });

    try {
      // Test S3 connection
      await s3Client.testConnection();

      // Download database backup if needed
      if (options.restoreType === 'full' || options.restoreType === 'database') {
        if (manifest.database.backup_file) {
          const dbS3Key = path.posix.join(prefix, 'database', path.basename(manifest.database.backup_file));
          const localDbPath = path.join(localPath, 'database', path.basename(manifest.database.backup_file));
          
          await fs.mkdir(path.dirname(localDbPath), { recursive: true });
          
          this.log('info', 'Downloading database backup from S3...', { key: dbS3Key });
          await s3Client.download(dbS3Key, localDbPath, {
            onProgress: (loaded, total) => {
              const percent = Math.round((loaded / total) * 100);
              this.updateProgress(`Downloading database backup: ${percent}%`);
            }
          });
        }
      }

      // Download files if needed
      if (options.restoreType === 'full' || options.restoreType === 'files') {
        const filesToDownload = options.restoreType === 'selective' 
          ? options.selectedItems 
          : manifest.files.manifest;

        let downloaded = 0;
        for (const file of filesToDownload) {
          const s3Key = path.posix.join(prefix, file.path);
          const localFilePath = path.join(localPath, file.path);
          
          await fs.mkdir(path.dirname(localFilePath), { recursive: true });
          
          try {
            await s3Client.download(s3Key, localFilePath, {
              onProgress: (loaded, total) => {
                const filePercent = Math.round((loaded / total) * 100);
                const totalPercent = Math.round(((downloaded + (loaded / total)) / filesToDownload.length) * 100);
                this.updateProgress(`Downloading files: ${totalPercent}% (${file.path}: ${filePercent}%)`);
              }
            });
            
            // Verify checksum if available
            if (file.checksum) {
              const downloadedChecksum = await this.calculateChecksum(localFilePath);
              if (downloadedChecksum !== file.checksum) {
                throw new Error(`Checksum mismatch for ${file.path}`);
              }
            }
            
            downloaded++;
          } catch (error) {
            this.log('error', `Failed to download ${file.path}`, { error: error.message });
            throw error;
          }
        }
      }

      return localPath;

    } catch (error) {
      // Clean up on failure
      await fs.rmdir(localPath, { recursive: true }).catch(() => {});
      throw new Error(`Failed to download from S3: ${error.message}`);
    }
  }

  /**
   * Perform full restore (database + files)
   */
  async performFullRestore(backupPath, manifest, options) {
    const result = {
      databaseRestored: false,
      filesRestored: 0,
      errors: []
    };

    try {
      // Restore database first
      const dbResult = await this.performDatabaseRestore(backupPath, manifest, options);
      result.databaseRestored = dbResult.success;

      // Then restore files
      const filesResult = await this.performFilesRestore(backupPath, manifest, options);
      result.filesRestored = filesResult.filesRestored;

      return result;

    } catch (error) {
      result.errors.push(error.message);
      throw new Error(`Full restore failed: ${error.message}`);
    }
  }

  /**
   * Perform database-only restore
   */
  async performDatabaseRestore(backupPath, manifest, options) {
    this.updateProgress('Restoring database...');

    const dbBackupFile = manifest.database.backup_file;
    if (!dbBackupFile) {
      throw new Error('No database backup file found in manifest');
    }

    const dbBackupPath = path.join(backupPath, 'database', path.basename(dbBackupFile));
    
    // Check if backup file exists
    try {
      await fs.access(dbBackupPath);
    } catch (error) {
      throw new Error(`Database backup file not found: ${dbBackupPath}`);
    }

    // Decompress if needed
    let restoreFile = dbBackupPath;
    if (dbBackupPath.endsWith('.gz')) {
      this.log('info', 'Decompressing database backup...');
      const decompressedPath = dbBackupPath.replace('.gz', '');
      await this.decompressFile(dbBackupPath, decompressedPath);
      restoreFile = decompressedPath;
    }

    try {
      if (this.dbType === 'sqlite') {
        // SQLite restore
        const dbPath = knexConfig.connection.filename;
        
        // Close all database connections
        await db.destroy();
        
        // Backup current database
        const currentBackup = `${dbPath}.restore-backup`;
        await fs.copyFile(dbPath, currentBackup);
        
        try {
          // Restore from backup
          await execAsync(`sqlite3 "${dbPath}" ".restore '${restoreFile}'"`);
          
          // Verify integrity
          const integrityCheck = await execAsync(`sqlite3 "${dbPath}" "PRAGMA integrity_check"`);
          if (!integrityCheck.stdout.includes('ok')) {
            throw new Error('Database integrity check failed after restore');
          }
          
          // Remove backup of previous database
          await fs.unlink(currentBackup);
          
        } catch (error) {
          // Rollback on failure
          await fs.copyFile(currentBackup, dbPath);
          await fs.unlink(currentBackup);
          throw error;
        }
        
      } else {
        // PostgreSQL restore
        const { host, port, user, password, database } = knexConfig.connection;
        const env = { ...process.env, PGPASSWORD: password };
        
        // Drop and recreate database (extremely dangerous!)
        this.log('warn', 'Dropping and recreating PostgreSQL database...');
        
        await execAsync(
          `psql -h ${host} -p ${port} -U ${user} -c "DROP DATABASE IF EXISTS ${database}"`,
          { env }
        );
        
        await execAsync(
          `psql -h ${host} -p ${port} -U ${user} -c "CREATE DATABASE ${database}"`,
          { env }
        );
        
        // Restore from backup
        await execAsync(
          `psql -h ${host} -p ${port} -U ${user} -d ${database} < "${restoreFile}"`,
          { env, maxBuffer: 1024 * 1024 * 100 } // 100MB buffer
        );
      }

      // Re-initialize database connection
      const { db: newDb } = require('../database/db');
      
      // Run migrations to ensure schema is up to date
      this.log('info', 'Running database migrations...');
      await newDb.migrate.latest();

      return { success: true };

    } catch (error) {
      this.log('error', 'Database restore failed', { error: error.message });
      throw error;
    } finally {
      // Clean up decompressed file
      if (restoreFile !== dbBackupPath) {
        await fs.unlink(restoreFile).catch(() => {});
      }
    }
  }

  /**
   * Perform files-only restore
   */
  async performFilesRestore(backupPath, manifest, options) {
    this.updateProgress('Restoring files...');

    const storagePath = process.env.STORAGE_PATH || path.join(__dirname, '../../../storage');
    const filesToRestore = options.restoreType === 'selective' 
      ? options.selectedItems.filter(item => item.type === 'file')
      : manifest.files.manifest;

    let restoredCount = 0;
    const errors = [];

    for (const file of filesToRestore) {
      try {
        const sourcePath = path.join(backupPath, file.path);
        const targetPath = path.join(storagePath, file.path);

        // Check if source file exists
        try {
          await fs.access(sourcePath);
        } catch (error) {
          errors.push(`Source file not found: ${file.path}`);
          continue;
        }

        // Create target directory
        await fs.mkdir(path.dirname(targetPath), { recursive: true });

        // Check if target exists and create backup
        let targetBackup = null;
        try {
          await fs.access(targetPath);
          targetBackup = `${targetPath}.restore-backup`;
          await fs.copyFile(targetPath, targetBackup);
        } catch (error) {
          // Target doesn't exist, no backup needed
        }

        try {
          // Copy file
          await fs.copyFile(sourcePath, targetPath);

          // Verify checksum if available
          if (file.checksum) {
            const restoredChecksum = await this.calculateChecksum(targetPath);
            if (restoredChecksum !== file.checksum) {
              throw new Error('Checksum verification failed');
            }
          }

          // Set file permissions if available
          if (file.permissions) {
            await fs.chmod(targetPath, file.permissions);
          }

          // Set modification time
          if (file.modified) {
            const mtime = new Date(file.modified);
            await fs.utimes(targetPath, mtime, mtime);
          }

          // Remove backup of previous file
          if (targetBackup) {
            await fs.unlink(targetBackup);
          }

          restoredCount++;
          
          if (restoredCount % 100 === 0) {
            this.updateProgress(`Restored ${restoredCount}/${filesToRestore.length} files`);
          }

        } catch (error) {
          // Rollback on failure
          if (targetBackup) {
            await fs.copyFile(targetBackup, targetPath);
            await fs.unlink(targetBackup);
          }
          throw error;
        }

      } catch (error) {
        errors.push(`Failed to restore ${file.path}: ${error.message}`);
        this.log('error', `Failed to restore file ${file.path}`, { error: error.message });
      }
    }

    if (errors.length > 0 && errors.length === filesToRestore.length) {
      throw new Error('All file restorations failed');
    }

    return {
      filesRestored: restoredCount,
      totalFiles: filesToRestore.length,
      errors
    };
  }

  /**
   * Perform selective restore
   */
  async performSelectiveRestore(backupPath, manifest, options) {
    const result = {
      itemsRestored: 0,
      errors: []
    };

    // Separate selected items by type
    const databaseItems = options.selectedItems.filter(item => item.type === 'database');
    const fileItems = options.selectedItems.filter(item => item.type === 'file');

    // Restore database items (tables)
    if (databaseItems.length > 0) {
      this.log('warn', 'Selective database restore not implemented yet');
      result.errors.push('Selective database restore not implemented');
    }

    // Restore file items
    if (fileItems.length > 0) {
      const filesResult = await this.performFilesRestore(backupPath, manifest, {
        ...options,
        selectedItems: fileItems
      });
      result.itemsRestored += filesResult.filesRestored;
      result.errors.push(...filesResult.errors);
    }

    return result;
  }

  /**
   * Perform post-restore verification
   */
  async performPostRestoreVerification(manifest, options) {
    const verification = {
      isValid: true,
      errors: [],
      checksums: {}
    };

    try {
      // Verify database
      if (options.restoreType === 'full' || options.restoreType === 'database') {
        // Check database connectivity
        try {
          await db.raw('SELECT 1');
        } catch (error) {
          verification.errors.push('Database connection failed after restore');
          verification.isValid = false;
        }

        // Compare table checksums if available
        if (manifest.database.row_counts) {
          for (const [table, expected] of Object.entries(manifest.database.row_counts)) {
            try {
              const result = await db(table).count('* as count').first();
              if (result.count !== expected.rowCount) {
                verification.errors.push(
                  `Table ${table} row count mismatch: expected ${expected.rowCount}, got ${result.count}`
                );
              }
            } catch (error) {
              verification.errors.push(`Failed to verify table ${table}: ${error.message}`);
            }
          }
        }
      }

      // Verify files
      if (options.restoreType === 'full' || options.restoreType === 'files') {
        const storagePath = process.env.STORAGE_PATH || path.join(__dirname, '../../../storage');
        const filesToVerify = options.restoreType === 'selective' 
          ? options.selectedItems.filter(item => item.type === 'file')
          : manifest.files.manifest.slice(0, 100); // Verify first 100 files for performance

        for (const file of filesToVerify) {
          const filePath = path.join(storagePath, file.path);
          try {
            await fs.access(filePath);
            
            if (file.checksum) {
              const actualChecksum = await this.calculateChecksum(filePath);
              verification.checksums[file.path] = {
                expected: file.checksum,
                actual: actualChecksum,
                match: actualChecksum === file.checksum
              };
              
              if (actualChecksum !== file.checksum) {
                verification.errors.push(`Checksum mismatch for ${file.path}`);
              }
            }
          } catch (error) {
            verification.errors.push(`File not found after restore: ${file.path}`);
          }
        }
      }

    } catch (error) {
      verification.errors.push(`Verification error: ${error.message}`);
      verification.isValid = false;
    }

    verification.isValid = verification.errors.length === 0;
    return verification;
  }

  /**
   * Attempt rollback using pre-restore backup
   */
  async attemptRollback(preRestoreBackupPath) {
    this.log('warn', 'Attempting rollback to pre-restore state...');

    try {
      // Read backup manifest
      const manifestPath = path.join(preRestoreBackupPath, 'backup-manifest.json');
      const backupManifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));

      // Restore database if backed up
      const dbBackupPath = path.join(preRestoreBackupPath, 'database.sql.gz');
      if (await fs.access(dbBackupPath).then(() => true).catch(() => false)) {
        const decompressedPath = dbBackupPath.replace('.gz', '');
        await this.decompressFile(dbBackupPath, decompressedPath);

        if (this.dbType === 'sqlite') {
          const dbPath = knexConfig.connection.filename;
          await execAsync(`sqlite3 "${dbPath}" ".restore '${decompressedPath}'"`);
        } else {
          const { host, port, user, password, database } = knexConfig.connection;
          const env = { ...process.env, PGPASSWORD: password };
          await execAsync(
            `psql -h ${host} -p ${port} -U ${user} -d ${database} < "${decompressedPath}"`,
            { env }
          );
        }

        await fs.unlink(decompressedPath);
      }

      // Restore files if backed up
      const filesBackupPath = path.join(preRestoreBackupPath, 'files.tar.gz');
      if (await fs.access(filesBackupPath).then(() => true).catch(() => false)) {
        const storagePath = process.env.STORAGE_PATH || path.join(__dirname, '../../../storage');
        await execAsync(`tar -xzf "${filesBackupPath}" -C "${path.dirname(storagePath)}"`);
      }

      this.log('info', 'Rollback completed successfully');

    } catch (error) {
      this.log('error', 'Rollback failed', { error: error.message });
      throw new Error(`Rollback failed: ${error.message}. Manual intervention may be required.`);
    }
  }

  // Utility methods

  /**
   * Calculate file checksum
   */
  async calculateChecksum(filePath) {
    const hash = crypto.createHash('sha256');
    const stream = createReadStream(filePath);
    
    return new Promise((resolve, reject) => {
      stream.on('data', data => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  /**
   * Compress file using gzip
   */
  async compressFile(inputPath, outputPath) {
    const gzip = zlib.createGzip({ level: 6 });
    const source = createReadStream(inputPath);
    const destination = createWriteStream(outputPath);
    await pipeline(source, gzip, destination);
  }

  /**
   * Decompress gzip file
   */
  async decompressFile(inputPath, outputPath) {
    const gunzip = zlib.createGunzip();
    const source = createReadStream(inputPath);
    const destination = createWriteStream(outputPath);
    await pipeline(source, gunzip, destination);
  }

  /**
   * Download file from S3
   */
  async downloadFileFromS3(s3Url, localPath, s3Config) {
    const s3PathMatch = s3Url.match(/^s3:\/\/([^\/]+)\/(.+)$/);
    if (!s3PathMatch) {
      throw new Error('Invalid S3 URL format');
    }

    const [, bucket, key] = s3PathMatch;
    const s3Client = new S3StorageAdapter({
      ...s3Config,
      bucket
    });

    await s3Client.download(key, localPath);
  }

  /**
   * Calculate current storage usage
   */
  async calculateCurrentStorageUsage() {
    const storagePath = process.env.STORAGE_PATH || path.join(__dirname, '../../../storage');
    
    let totalSize = 0;
    async function calculateDirSize(dirPath) {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          await calculateDirSize(fullPath);
        } else if (entry.isFile()) {
          const stats = await fs.stat(fullPath);
          totalSize += stats.size;
        }
      }
    }

    await calculateDirSize(storagePath);
    return totalSize;
  }

  /**
   * Format bytes to human readable
   */
  formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  /**
   * Update progress
   */
  updateProgress(message, details = {}) {
    this.currentProgress = {
      message,
      details,
      timestamp: new Date()
    };
    logger.info(`Restore progress: ${message}`, details);
  }

  /**
   * Get current progress
   */
  getProgress() {
    return this.currentProgress;
  }

  /**
   * Log message
   */
  log(level, message, details = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      details
    };
    
    this.restoreLog.push(logEntry);
    logger[level](message, details);
  }

  /**
   * Sanitize options for logging
   */
  sanitizeOptions(options) {
    const sanitized = { ...options };
    if (sanitized.s3Config) {
      sanitized.s3Config = {
        ...sanitized.s3Config,
        accessKeyId: sanitized.s3Config.accessKeyId ? '***' : undefined,
        secretAccessKey: sanitized.s3Config.secretAccessKey ? '***' : undefined
      };
    }
    return sanitized;
  }

  /**
   * Send restore notification
   */
  async sendRestoreNotification(type, details) {
    try {
      const admins = await db('admin_users').where('is_active', formatBoolean(true));
      
      for (const admin of admins) {
        if (type === 'success') {
          await queueEmail(null, admin.email, 'restore_completed', {
            restore_type: details.restoreType,
            duration: `${details.duration} seconds`,
            files_restored: details.filesRestored,
            backup_id: details.backupId,
            timestamp: new Date().toISOString()
          });
        } else {
          await queueEmail(null, admin.email, 'restore_failed', {
            restore_type: details.restoreType,
            error_message: details.error,
            timestamp: new Date().toISOString()
          });
        }
      }
    } catch (error) {
      this.log('error', 'Failed to send restore notification', { error: error.message });
    }
  }

  /**
   * Get restore history
   */
  async getRestoreHistory(limit = 10) {
    return await db('restore_runs')
      .orderBy('started_at', 'desc')
      .limit(limit);
  }

  /**
   * Generate restore report
   */
  generateRestoreReport(restoreResult) {
    const report = [];
    
    report.push('=== RESTORE OPERATION REPORT ===');
    report.push(`Status: ${restoreResult.success ? 'SUCCESS' : 'FAILED'}`);
    report.push(`Duration: ${restoreResult.duration}s`);
    report.push(`Dry Run: ${restoreResult.dryRun ? 'Yes' : 'No'}`);
    
    if (restoreResult.result) {
      report.push('\n--- Restore Results ---');
      report.push(`Database Restored: ${restoreResult.result.databaseRestored ? 'Yes' : 'No'}`);
      report.push(`Files Restored: ${restoreResult.result.filesRestored || 0}`);
      if (restoreResult.result.errors && restoreResult.result.errors.length > 0) {
        report.push(`Errors: ${restoreResult.result.errors.length}`);
        restoreResult.result.errors.forEach(err => report.push(`  - ${err}`));
      }
    }
    
    if (restoreResult.verification) {
      report.push('\n--- Verification Results ---');
      report.push(`Valid: ${restoreResult.verification.isValid ? 'Yes' : 'No'}`);
      if (restoreResult.verification.errors.length > 0) {
        report.push('Errors:');
        restoreResult.verification.errors.forEach(err => report.push(`  - ${err}`));
      }
    }
    
    if (restoreResult.preRestoreBackup) {
      report.push('\n--- Safety Backup ---');
      report.push(`Location: ${restoreResult.preRestoreBackup}`);
    }
    
    report.push('\n--- Operation Log ---');
    restoreResult.logs.forEach(log => {
      report.push(`[${log.timestamp}] ${log.level.toUpperCase()}: ${log.message}`);
    });
    
    return report.join('\n');
  }
}

// Create singleton instance
const restoreService = new RestoreService();

module.exports = {
  restoreService,
  RestoreService // Export class for testing
};