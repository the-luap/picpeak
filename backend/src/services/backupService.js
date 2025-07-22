const cron = require('node-cron');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const { db } = require('../database/db');
const { queueEmail } = require('./emailProcessor');
const logger = require('../utils/logger');
const { formatBoolean } = require('../utils/dbCompat');
const backupManifest = require('./backupManifest');
const S3StorageAdapter = require('./storage/s3Storage');
const packageJson = require('../../package.json');

// Backup job reference
let backupJob = null;
let backupConfig = null;
let isRunning = false;

// Storage paths
const getStoragePath = () => process.env.STORAGE_PATH || path.join(__dirname, '../../../storage');

/**
 * Get current database schema version
 */
async function getCurrentSchemaVersion() {
  try {
    const result = await db('knex_migrations')
      .orderBy('id', 'desc')
      .first();
    return result ? result.name : 'unknown';
  } catch (error) {
    logger.error('Failed to get schema version:', error);
    return 'unknown';
  }
}

/**
 * Calculate file checksum using SHA256
 */
async function calculateChecksum(filePath) {
  const hash = crypto.createHash('sha256');
  const stream = require('fs').createReadStream(filePath);
  
  return new Promise((resolve, reject) => {
    stream.on('data', data => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

/**
 * Get database backup information
 */
async function getDatabaseBackupInfo() {
  try {
    // Check for recent database backup
    const recentDbBackup = await db('database_backup_runs')
      .where('status', 'completed')
      .orderBy('completed_at', 'desc')
      .first();
    
    if (recentDbBackup && recentDbBackup.file_path) {
      // Check if database has changed since backup
      const hasChanged = await hasDatabaseChanged(recentDbBackup.completed_at);
      
      return {
        type: recentDbBackup.backup_type,
        backupFile: recentDbBackup.file_path,
        size: recentDbBackup.file_size_bytes,
        checksum: recentDbBackup.checksum,
        tables: recentDbBackup.statistics ? JSON.parse(recentDbBackup.statistics).tables : {},
        rowCounts: recentDbBackup.table_checksums ? JSON.parse(recentDbBackup.table_checksums) : {},
        hasChanged: hasChanged,
        backupTime: recentDbBackup.completed_at
      };
    }
    
    return {
      type: process.env.DB_TYPE === 'postgresql' ? 'postgresql' : 'sqlite',
      backupFile: null,
      size: 0,
      checksum: null,
      tables: {},
      rowCounts: {},
      hasChanged: true,
      backupTime: null
    };
  } catch (error) {
    logger.error('Failed to get database backup info:', error);
    return {
      type: 'unknown',
      backupFile: null,
      size: 0,
      checksum: null,
      tables: {},
      rowCounts: {},
      hasChanged: true,
      backupTime: null
    };
  }
}

/**
 * Check if database has changed since a given time
 */
async function hasDatabaseChanged(sinceTime) {
  try {
    // List of tables that track modifications
    const tablesToCheck = [
      'events',
      'photos',
      'admin_users',
      'app_settings',
      'email_queue',
      'access_logs'
    ];
    
    for (const table of tablesToCheck) {
      try {
        // Check for updated_at timestamps
        const hasUpdates = await db(table)
          .where('updated_at', '>', sinceTime)
          .limit(1)
          .first();
        
        if (hasUpdates) {
          logger.debug(`Database table ${table} has changes since ${sinceTime}`);
          return true;
        }
        
        // Also check created_at for new records
        const hasNewRecords = await db(table)
          .where('created_at', '>', sinceTime)
          .limit(1)
          .first();
        
        if (hasNewRecords) {
          logger.debug(`Database table ${table} has new records since ${sinceTime}`);
          return true;
        }
      } catch (error) {
        // Table might not exist or not have timestamp columns
        logger.debug(`Could not check table ${table} for changes:`, error.message);
      }
    }
    
    return false;
  } catch (error) {
    logger.error('Failed to check database changes:', error);
    // Assume changed if we can't check
    return true;
  }
}

/**
 * Get backup configuration from database
 */
async function getBackupConfig() {
  try {
    const settings = await db('app_settings')
      .where('setting_type', 'backup')
      .select('setting_key', 'setting_value');
    
    const config = {};
    settings.forEach(setting => {
      try {
        config[setting.setting_key] = JSON.parse(setting.setting_value);
      } catch (e) {
        config[setting.setting_key] = setting.setting_value;
      }
    });
    
    return config;
  } catch (error) {
    logger.error('Failed to get backup configuration:', error);
    return null;
  }
}

/**
 * Get list of files to backup
 */
async function getFilesToBackup(includeArchived = true) {
  const files = [];
  const storagePath = getStoragePath();
  
  try {
    // Active events
    const activePath = path.join(storagePath, 'events/active');
    await scanDirectory(activePath, files, storagePath);
    
    // Archived events (if enabled)
    if (includeArchived) {
      const archivePath = path.join(storagePath, 'events/archived');
      await scanDirectory(archivePath, files, storagePath);
    }
    
    // Thumbnails
    const thumbsPath = path.join(storagePath, 'thumbnails');
    await scanDirectory(thumbsPath, files, storagePath);
    
    // Uploads (logos, favicons, etc.)
    const uploadsPath = path.join(storagePath, 'uploads');
    await scanDirectory(uploadsPath, files, storagePath);
    
    return files;
  } catch (error) {
    logger.error('Failed to get files to backup:', error);
    throw error;
  }
}

/**
 * Recursively scan directory for files
 */
async function scanDirectory(dirPath, fileList, basePath, excludePatterns = []) {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(basePath, fullPath);
      
      // Check exclude patterns
      if (excludePatterns.some(pattern => {
        if (pattern.includes('*')) {
          return new RegExp(pattern.replace(/\*/g, '.*')).test(entry.name);
        }
        return entry.name === pattern;
      })) {
        continue;
      }
      
      if (entry.isDirectory()) {
        await scanDirectory(fullPath, fileList, basePath, excludePatterns);
      } else if (entry.isFile()) {
        const stats = await fs.stat(fullPath);
        fileList.push({
          path: fullPath,
          relativePath: relativePath,
          size: stats.size,
          modified: stats.mtime
        });
      }
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      logger.error(`Failed to scan directory ${dirPath}:`, error);
    }
  }
}

/**
 * Check if file has changed since last backup
 */
async function hasFileChanged(filePath, checksum) {
  try {
    const fileState = await db('backup_file_states')
      .where('file_path', filePath)
      .first();
    
    return !fileState || fileState.checksum !== checksum;
  } catch (error) {
    logger.error('Failed to check file state:', error);
    return true; // Assume changed if we can't check
  }
}

/**
 * Update file state in database
 */
async function updateFileState(filePath, checksum, size, modified) {
  try {
    const existing = await db('backup_file_states')
      .where('file_path', filePath)
      .first();
    
    const data = {
      file_path: filePath,
      checksum: checksum,
      size_bytes: size,
      last_modified: modified,
      last_backed_up: new Date()
    };
    
    if (existing) {
      await db('backup_file_states')
        .where('id', existing.id)
        .update(data);
    } else {
      await db('backup_file_states').insert(data);
    }
  } catch (error) {
    logger.error('Failed to update file state:', error);
  }
}

/**
 * Perform local directory backup
 */
async function performLocalBackup(config, files) {
  const destPath = config.backup_destination_path;
  const storagePath = getStoragePath();
  let backedUpCount = 0;
  let backedUpSize = 0;
  const backedUpFiles = [];
  
  // Ensure destination exists
  await fs.mkdir(destPath, { recursive: true });
  
  for (const file of files) {
    try {
      // Skip large files if configured
      const maxSizeMB = config.backup_max_file_size_mb || 5000;
      if (file.size > maxSizeMB * 1024 * 1024) {
        logger.warn(`Skipping large file: ${file.relativePath} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
        continue;
      }
      
      // Calculate checksum
      const checksum = await calculateChecksum(file.path);
      file.checksum = checksum; // Add checksum to file object
      
      // Check if file has changed
      const changed = await hasFileChanged(file.relativePath, checksum);
      if (!changed) {
        continue;
      }
      
      // Copy file
      const destFilePath = path.join(destPath, file.relativePath);
      const destDir = path.dirname(destFilePath);
      await fs.mkdir(destDir, { recursive: true });
      await fs.copyFile(file.path, destFilePath);
      
      // Update state
      await updateFileState(file.relativePath, checksum, file.size, file.modified);
      
      backedUpCount++;
      backedUpSize += file.size;
      backedUpFiles.push(file.relativePath);
    } catch (error) {
      logger.error(`Failed to backup file ${file.relativePath}:`, error);
    }
  }
  
  return { backedUpCount, backedUpSize, backedUpFiles };
}

/**
 * Perform rsync backup
 */
async function performRsyncBackup(config, files) {
  const storagePath = getStoragePath();
  const host = config.backup_rsync_host;
  const user = config.backup_rsync_user;
  const remotePath = config.backup_rsync_path;
  const sshKey = config.backup_rsync_ssh_key;
  
  if (!host || !remotePath) {
    throw new Error('Rsync configuration incomplete');
  }
  
  // Build rsync command
  const rsyncOptions = [
    '-avz', // archive, verbose, compress
    '--delete', // remove deleted files
    '--stats' // show statistics
  ];
  
  if (sshKey) {
    rsyncOptions.push(`-e "ssh -i ${sshKey} -o StrictHostKeyChecking=no"`);
  }
  
  // Add exclude patterns
  const excludePatterns = config.backup_exclude_patterns || [];
  excludePatterns.forEach(pattern => {
    rsyncOptions.push(`--exclude="${pattern}"`);
  });
  
  const source = `${storagePath}/`;
  const destination = user ? `${user}@${host}:${remotePath}` : `${host}:${remotePath}`;
  
  const rsyncCommand = `rsync ${rsyncOptions.join(' ')} "${source}" "${destination}"`;
  
  try {
    const { stdout, stderr } = await execAsync(rsyncCommand);
    
    // Parse rsync stats
    const stats = parseRsyncStats(stdout);
    
    // Update file states for successfully synced files
    for (const file of files) {
      try {
        const checksum = await calculateChecksum(file.path);
        await updateFileState(file.relativePath, checksum, file.size, file.modified);
      } catch (error) {
        logger.error(`Failed to update state for ${file.relativePath}:`, error);
      }
    }
    
    return {
      backedUpCount: stats.filesTransferred || files.length,
      backedUpSize: stats.totalSize || files.reduce((sum, f) => sum + f.size, 0),
      backedUpFiles: files.map(f => f.relativePath)
    };
  } catch (error) {
    logger.error('Rsync backup failed:', error);
    throw new Error(`Rsync backup failed: ${error.message}`);
  }
}

/**
 * Parse rsync statistics from output
 */
function parseRsyncStats(output) {
  const stats = {};
  
  // Extract files transferred
  const filesMatch = output.match(/Number of files transferred: (\d+)/);
  if (filesMatch) {
    stats.filesTransferred = parseInt(filesMatch[1]);
  }
  
  // Extract total size
  const sizeMatch = output.match(/Total file size: ([\d,]+) bytes/);
  if (sizeMatch) {
    stats.totalSize = parseInt(sizeMatch[1].replace(/,/g, ''));
  }
  
  return stats;
}

/**
 * Perform S3-compatible backup
 */
async function performS3Backup(config, files) {
  let s3Client = null;
  let backedUpCount = 0;
  let backedUpSize = 0;
  const backedUpFiles = [];
  const storagePath = getStoragePath();
  
  try {
    // Initialize S3 client with configuration
    const s3Config = {
      bucket: config.backup_s3_bucket,
      region: config.backup_s3_region || 'us-east-1',
      endpoint: config.backup_s3_endpoint,
      accessKeyId: config.backup_s3_access_key,
      secretAccessKey: config.backup_s3_secret_key,
      forcePathStyle: config.backup_s3_force_path_style || false,
      sslEnabled: config.backup_s3_ssl_enabled !== false, // Default true
      maxRetries: 3,
      retryDelay: 1000
    };
    
    // Validate required S3 configuration
    if (!s3Config.bucket || !s3Config.accessKeyId || !s3Config.secretAccessKey) {
      throw new Error('S3 backup configuration incomplete: bucket, access key, and secret key are required');
    }
    
    // Create S3 client
    s3Client = new S3StorageAdapter(s3Config);
    
    // Test connection
    logger.info('Testing S3 connection...');
    await s3Client.testConnection();
    
    // Determine backup prefix based on date and configuration
    const now = new Date();
    const datePrefix = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
    const backupId = `backup-${now.getTime()}`;
    const s3Prefix = config.backup_s3_prefix ? 
      path.posix.join(config.backup_s3_prefix, datePrefix, backupId) : 
      path.posix.join('backups', datePrefix, backupId);
    
    logger.info(`Starting S3 backup to prefix: ${s3Prefix}`);
    
    // Process each file
    for (const file of files) {
      try {
        // Skip large files if configured
        const maxSizeMB = config.backup_max_file_size_mb || 5000;
        if (file.size > maxSizeMB * 1024 * 1024) {
          logger.warn(`Skipping large file: ${file.relativePath} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
          continue;
        }
        
        // Calculate checksum
        const checksum = await calculateChecksum(file.path);
        file.checksum = checksum; // Add checksum to file object
        
        // Check if file has changed
        const changed = await hasFileChanged(file.relativePath, checksum);
        if (!changed && config.backup_incremental !== false) {
          continue;
        }
        
        // Determine S3 key for the file
        const s3Key = path.posix.join(s3Prefix, file.relativePath);
        
        // Upload file to S3
        logger.debug(`Uploading ${file.relativePath} to S3 key: ${s3Key}`);
        
        let uploadStartTime = Date.now();
        await s3Client.upload(file.path, s3Key, {
          metadata: {
            'original-path': file.relativePath,
            'checksum': checksum,
            'backup-id': backupId,
            'backup-time': now.toISOString()
          },
          onProgress: (loaded, total) => {
            const percentComplete = Math.round((loaded / total) * 100);
            if (percentComplete % 25 === 0) { // Log at 25%, 50%, 75%, 100%
              logger.debug(`Upload progress for ${file.relativePath}: ${percentComplete}%`);
            }
          }
        });
        
        const uploadDuration = Date.now() - uploadStartTime;
        logger.debug(`Uploaded ${file.relativePath} in ${uploadDuration}ms`);
        
        // Update state
        await updateFileState(file.relativePath, checksum, file.size, file.modified);
        
        backedUpCount++;
        backedUpSize += file.size;
        backedUpFiles.push(file.relativePath);
        
      } catch (error) {
        logger.error(`Failed to backup file ${file.relativePath} to S3:`, error);
        // Continue with other files even if one fails
      }
    }
    
    // Check if database backup should be included
    if (config.backup_include_database !== false) {
      try {
        logger.info('Including database backup in S3 backup...');
        const dbInfo = await getDatabaseBackupInfo();
        
        if (dbInfo.backupFile && await fs.stat(dbInfo.backupFile).catch(() => null)) {
          // Upload database backup file
          const dbFileName = path.basename(dbInfo.backupFile);
          const dbS3Key = path.posix.join(s3Prefix, 'database', dbFileName);
          
          await s3Client.upload(dbInfo.backupFile, dbS3Key, {
            metadata: {
              'backup-type': 'database',
              'database-type': dbInfo.type,
              'checksum': dbInfo.checksum,
              'backup-id': backupId,
              'backup-time': now.toISOString()
            }
          });
          
          backedUpCount++;
          backedUpSize += dbInfo.size;
          logger.info(`Database backup uploaded to S3: ${dbS3Key}`);
        } else {
          logger.warn('No recent database backup found to include in S3 backup');
        }
      } catch (error) {
        logger.error('Failed to include database backup in S3:', error);
      }
    }
    
    // Create and upload a backup summary file
    try {
      const summary = {
        backupId: backupId,
        timestamp: now.toISOString(),
        s3Bucket: config.backup_s3_bucket,
        s3Prefix: s3Prefix,
        filesBackedUp: backedUpCount,
        totalSize: backedUpSize,
        totalSizeFormatted: formatBytes(backedUpSize),
        configuration: {
          incremental: config.backup_incremental !== false,
          includeArchived: config.backup_include_archived,
          includeDatabase: config.backup_include_database !== false,
          maxFileSizeMB: config.backup_max_file_size_mb || 5000
        }
      };
      
      const summaryJson = JSON.stringify(summary, null, 2);
      const summaryS3Key = path.posix.join(s3Prefix, 'backup-summary.json');
      
      // Create a temporary file for the summary
      const tempSummaryPath = path.join(storagePath, `temp-summary-${backupId}.json`);
      await fs.writeFile(tempSummaryPath, summaryJson);
      
      await s3Client.upload(tempSummaryPath, summaryS3Key, {
        contentType: 'application/json',
        metadata: {
          'backup-id': backupId,
          'backup-type': 'summary'
        }
      });
      
      // Clean up temp file
      await fs.unlink(tempSummaryPath).catch(() => {});
      
      logger.info(`Backup summary uploaded to S3: ${summaryS3Key}`);
    } catch (error) {
      logger.error('Failed to upload backup summary:', error);
    }
    
    logger.info(`S3 backup completed: ${backedUpCount} files, ${formatBytes(backedUpSize)} uploaded to ${s3Prefix}`);
    
    return { 
      backedUpCount, 
      backedUpSize, 
      backedUpFiles,
      s3Prefix,
      s3Bucket: config.backup_s3_bucket
    };
    
  } catch (error) {
    logger.error('S3 backup failed:', error);
    throw new Error(`S3 backup failed: ${error.message}`);
  }
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Run backup process
 */
async function runBackup() {
  if (isRunning) {
    logger.warn('Backup already running, skipping');
    return;
  }
  
  isRunning = true;
  const startTime = new Date();
  let backupRun = null;
  
  try {
    // Get current configuration
    const config = await getBackupConfig();
    if (!config.backup_enabled) {
      logger.info('Backup is disabled, skipping');
      return;
    }
    
    // Get current schema version
    const schemaVersion = await getCurrentSchemaVersion();
    
    // Create backup run record with version info
    const [runId] = await db('backup_runs').insert({
      started_at: startTime,
      status: 'running',
      backup_type: 'scheduled',
      app_version: packageJson.version,
      node_version: process.version,
      db_schema_version: schemaVersion
    });
    
    backupRun = { id: runId };
    
    // Get files to backup
    const files = await getFilesToBackup(config.backup_include_archived);
    logger.info(`Found ${files.length} files to check for backup`);
    
    // Perform backup based on destination type
    let result;
    switch (config.backup_destination_type) {
      case 'local':
        result = await performLocalBackup(config, files);
        break;
      case 'rsync':
        result = await performRsyncBackup(config, files);
        break;
      case 's3':
        result = await performS3Backup(config, files);
        break;
      default:
        throw new Error(`Unknown backup destination type: ${config.backup_destination_type}`);
    }
    
    // Calculate duration
    const endTime = new Date();
    const durationSeconds = Math.round((endTime - startTime) / 1000);
    
    // Generate backup manifest
    let manifestPath = null;
    try {
      logger.info('Generating backup manifest...');
      
      // Get database backup info if available
      const databaseInfo = await getDatabaseBackupInfo();
      
      // Determine if this is an incremental backup
      const lastSuccessfulBackup = await db('backup_runs')
        .where('status', 'completed')
        .whereNot('id', runId)
        .orderBy('completed_at', 'desc')
        .first();
      
      // Prepare backup path based on destination type
      let backupPath;
      if (config.backup_destination_type === 's3') {
        backupPath = `s3://${result.s3Bucket}/${result.s3Prefix}`;
      } else {
        backupPath = config.backup_destination_path || config.backup_destination_type;
      }
      
      let manifest;
      const manifestOptions = {
        backupType: lastSuccessfulBackup ? 'incremental' : 'full',
        backupPath: backupPath,
        files: files.filter(f => result.backedUpFiles && result.backedUpFiles.includes(f.relativePath)),
        databaseInfo: databaseInfo,
        parentBackupId: lastSuccessfulBackup ? lastSuccessfulBackup.manifest_id : null,
        format: config.backup_manifest_format || 'json',
        customMetadata: {
          backup_run_id: runId,
          destination_type: config.backup_destination_type,
          operator: 'system',
          reason: 'scheduled',
          retentionDays: config.backup_retention_days || 30,
          // Add S3-specific metadata if applicable
          ...(config.backup_destination_type === 's3' ? {
            s3_bucket: result.s3Bucket,
            s3_prefix: result.s3Prefix,
            s3_region: config.backup_s3_region || 'us-east-1',
            s3_endpoint: config.backup_s3_endpoint
          } : {})
        }
      };
      
      if (lastSuccessfulBackup && lastSuccessfulBackup.manifest_path) {
        try {
          const parentManifest = await backupManifest.loadManifest(lastSuccessfulBackup.manifest_path);
          manifest = await backupManifest.generateIncrementalManifest(manifestOptions, parentManifest);
        } catch (error) {
          logger.warn('Failed to load parent manifest, generating full manifest:', error);
          manifest = await backupManifest.generateManifest(manifestOptions);
        }
      } else {
        manifest = await backupManifest.generateManifest(manifestOptions);
      }
      
      // Save manifest
      const manifestFileName = `backup-manifest-${manifest.backup.id}.${config.backup_manifest_format || 'json'}`;
      
      if (config.backup_destination_type === 's3') {
        // For S3 backups, save manifest locally first then upload to S3
        const tempManifestDir = path.join(getStoragePath(), 'temp');
        await fs.mkdir(tempManifestDir, { recursive: true });
        
        const tempManifestPath = path.join(tempManifestDir, manifestFileName);
        await backupManifest.saveManifest(manifest, tempManifestPath, config.backup_manifest_format || 'json');
        
        // Upload manifest to S3
        try {
          const s3Config = {
            bucket: config.backup_s3_bucket,
            region: config.backup_s3_region || 'us-east-1',
            endpoint: config.backup_s3_endpoint,
            accessKeyId: config.backup_s3_access_key,
            secretAccessKey: config.backup_s3_secret_key,
            forcePathStyle: config.backup_s3_force_path_style || false,
            sslEnabled: config.backup_s3_ssl_enabled !== false
          };
          
          const s3Client = new S3StorageAdapter(s3Config);
          const manifestS3Key = path.posix.join(result.s3Prefix, 'manifests', manifestFileName);
          
          await s3Client.upload(tempManifestPath, manifestS3Key, {
            contentType: config.backup_manifest_format === 'xml' ? 'application/xml' : 'application/json',
            metadata: {
              'backup-id': manifest.backup.id,
              'backup-type': 'manifest',
              'manifest-version': manifest.version
            }
          });
          
          // Clean up temp file
          await fs.unlink(tempManifestPath).catch(() => {});
          
          // Store S3 path as manifest path
          manifestPath = `s3://${config.backup_s3_bucket}/${manifestS3Key}`;
          logger.info(`Backup manifest uploaded to S3: ${manifestPath}`);
          
        } catch (error) {
          logger.error('Failed to upload manifest to S3:', error);
          // Keep local path as fallback
          manifestPath = tempManifestPath;
        }
      } else {
        // For local/rsync backups, save to configured directory
        const manifestDir = config.backup_manifest_path || path.join(config.backup_destination_path || '/backup', 'manifests');
        await fs.mkdir(manifestDir, { recursive: true });
        
        manifestPath = path.join(manifestDir, manifestFileName);
        await backupManifest.saveManifest(manifest, manifestPath, config.backup_manifest_format || 'json');
        
        logger.info(`Backup manifest saved to ${manifestPath}`);
      }
      
    } catch (error) {
      logger.error('Failed to generate backup manifest:', error);
      // Don't fail the entire backup for manifest generation failure
    }
    
    // Update backup run record with manifest info
    await db('backup_runs')
      .where('id', runId)
      .update({
        completed_at: endTime,
        status: 'completed',
        files_backed_up: result.backedUpCount,
        total_size_bytes: result.backedUpSize,
        duration_seconds: durationSeconds,
        manifest_path: manifestPath,
        manifest_id: manifestPath ? path.basename(manifestPath, path.extname(manifestPath)) : null,
        manifest_info: manifestSummary ? JSON.stringify({
          manifest_version: manifestSummary.manifest?.version,
          backup_id: manifestSummary.backup?.id,
          system_info: manifestSummary.system,
          file_count: manifestSummary.files?.count,
          database_info: {
            type: manifestSummary.database?.type,
            schema_version: manifestSummary.database?.schema_version
          }
        }) : null,
        statistics: JSON.stringify({
          totalFilesChecked: files.length,
          filesBackedUp: result.backedUpCount,
          totalSize: result.backedUpSize,
          averageFileSize: result.backedUpCount > 0 ? Math.round(result.backedUpSize / result.backedUpCount) : 0,
          manifestGenerated: !!manifestPath
        })
      });
    
    logger.info(`Backup completed: ${result.backedUpCount} files, ${(result.backedUpSize / 1024 / 1024).toFixed(2)} MB in ${durationSeconds}s`);
    
    // Send success email if configured
    if (config.backup_email_on_success) {
      // Get admin emails
      const admins = await db('admin_users').where('is_active', formatBoolean(true));
      for (const admin of admins) {
        await queueEmail(null, admin.email, 'backup_completed', {
          start_time: startTime.toISOString(),
          duration: `${durationSeconds} seconds`,
          files_count: result.backedUpCount.toString(),
          total_size: `${(result.backedUpSize / 1024 / 1024).toFixed(2)} MB`,
          backup_type: config.backup_destination_type
        });
      }
    }
    
  } catch (error) {
    logger.error('Backup failed:', error);
    
    // Update backup run record
    if (backupRun) {
      await db('backup_runs')
        .where('id', backupRun.id)
        .update({
          completed_at: new Date(),
          status: 'failed',
          error_message: error.message
        });
    }
    
    // Send failure email
    const config = await getBackupConfig();
    if (config && config.backup_email_on_failure) {
      const admins = await db('admin_users').where('is_active', formatBoolean(true));
      for (const admin of admins) {
        await queueEmail(null, admin.email, 'backup_failed', {
          start_time: startTime.toISOString(),
          backup_type: config.backup_destination_type || 'unknown',
          error_message: error.message
        });
      }
    }
  } finally {
    isRunning = false;
  }
}

/**
 * Start backup service
 */
async function startBackupService() {
  try {
    // Get configuration
    backupConfig = await getBackupConfig();
    
    if (!backupConfig || !backupConfig.backup_enabled) {
      logger.info('Backup service is disabled');
      return;
    }
    
    // Cancel existing job if any
    if (backupJob) {
      backupJob.stop();
    }
    
    // Schedule backup job
    const schedule = backupConfig.backup_schedule || '0 2 * * *'; // Default: 2 AM daily
    backupJob = cron.schedule(schedule, async () => {
      logger.info('Starting scheduled backup');
      await runBackup();
    });
    
    logger.info(`Backup service started with schedule: ${schedule}`);
  } catch (error) {
    logger.error('Failed to start backup service:', error);
  }
}

/**
 * Stop backup service
 */
function stopBackupService() {
  if (backupJob) {
    backupJob.stop();
    backupJob = null;
    logger.info('Backup service stopped');
  }
}

/**
 * Trigger manual backup
 */
async function triggerManualBackup() {
  logger.info('Starting manual backup');
  await runBackup();
}

/**
 * Get backup status and history
 */
async function getBackupStatus(limit = 10) {
  try {
    const runs = await db('backup_runs')
      .orderBy('started_at', 'desc')
      .limit(limit);
    
    const lastRun = runs[0];
    const isHealthy = lastRun && lastRun.status === 'completed';
    
    // Validate manifest if exists
    let manifestValid = false;
    if (lastRun && lastRun.manifest_path) {
      try {
        const manifest = await backupManifest.loadManifest(lastRun.manifest_path);
        backupManifest.validateManifest(manifest);
        manifestValid = true;
      } catch (error) {
        logger.warn('Manifest validation failed:', error);
      }
    }
    
    return {
      isRunning,
      isHealthy,
      lastRun: lastRun ? {
        ...lastRun,
        manifestValid
      } : null,
      recentRuns: runs,
      nextScheduledRun: backupJob ? getNextScheduledRun() : null
    };
  } catch (error) {
    logger.error('Failed to get backup status:', error);
    return {
      isRunning,
      isHealthy: false,
      error: error.message
    };
  }
}

/**
 * Get next scheduled run time
 */
function getNextScheduledRun() {
  // This is a simplified version - would need proper cron parsing
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(2, 0, 0, 0); // Assuming default 2 AM schedule
  return tomorrow.toISOString();
}

/**
 * Clean up old backup runs
 */
async function cleanupOldBackupRuns(retentionDays = 30) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    
    const deleted = await db('backup_runs')
      .where('started_at', '<', cutoffDate)
      .delete();
    
    if (deleted > 0) {
      logger.info(`Cleaned up ${deleted} old backup runs`);
    }
  } catch (error) {
    logger.error('Failed to cleanup old backup runs:', error);
  }
}

/**
 * Get backup manifest for a specific backup run
 */
async function getBackupManifest(backupRunId) {
  try {
    const run = await db('backup_runs')
      .where('id', backupRunId)
      .first();
    
    if (!run || !run.manifest_path) {
      throw new Error('Backup manifest not found');
    }
    
    let manifest;
    
    // Check if manifest is stored in S3
    if (run.manifest_path.startsWith('s3://')) {
      // Parse S3 path
      const s3PathMatch = run.manifest_path.match(/^s3:\/\/([^\/]+)\/(.+)$/);
      if (!s3PathMatch) {
        throw new Error('Invalid S3 manifest path');
      }
      
      const [, bucket, key] = s3PathMatch;
      
      // Get S3 configuration from backup settings
      const config = await getBackupConfig();
      if (!config.backup_s3_access_key || !config.backup_s3_secret_key) {
        throw new Error('S3 credentials not configured for manifest retrieval');
      }
      
      // Initialize S3 client
      const s3Config = {
        bucket: bucket,
        region: config.backup_s3_region || 'us-east-1',
        endpoint: config.backup_s3_endpoint,
        accessKeyId: config.backup_s3_access_key,
        secretAccessKey: config.backup_s3_secret_key,
        forcePathStyle: config.backup_s3_force_path_style || false,
        sslEnabled: config.backup_s3_ssl_enabled !== false
      };
      
      const s3Client = new S3StorageAdapter(s3Config);
      
      // Download manifest to temporary location
      const tempDir = path.join(getStoragePath(), 'temp');
      await fs.mkdir(tempDir, { recursive: true });
      
      const tempManifestPath = path.join(tempDir, `manifest-${backupRunId}.json`);
      await s3Client.download(key, tempManifestPath);
      
      // Load manifest
      manifest = await backupManifest.loadManifest(tempManifestPath);
      
      // Clean up temp file
      await fs.unlink(tempManifestPath).catch(() => {});
      
    } else {
      // Load manifest from local filesystem
      manifest = await backupManifest.loadManifest(run.manifest_path);
    }
    
    return {
      manifest,
      summary: backupManifest.generateSummaryReport(manifest)
    };
  } catch (error) {
    logger.error('Failed to get backup manifest:', error);
    throw error;
  }
}

/**
 * Validate a backup manifest file
 */
async function validateBackupManifest(manifestPath) {
  try {
    let manifest;
    
    // Check if manifest is stored in S3
    if (manifestPath.startsWith('s3://')) {
      // Parse S3 path
      const s3PathMatch = manifestPath.match(/^s3:\/\/([^\/]+)\/(.+)$/);
      if (!s3PathMatch) {
        throw new Error('Invalid S3 manifest path');
      }
      
      const [, bucket, key] = s3PathMatch;
      
      // Get S3 configuration from backup settings
      const config = await getBackupConfig();
      if (!config.backup_s3_access_key || !config.backup_s3_secret_key) {
        throw new Error('S3 credentials not configured for manifest validation');
      }
      
      // Initialize S3 client
      const s3Config = {
        bucket: bucket,
        region: config.backup_s3_region || 'us-east-1',
        endpoint: config.backup_s3_endpoint,
        accessKeyId: config.backup_s3_access_key,
        secretAccessKey: config.backup_s3_secret_key,
        forcePathStyle: config.backup_s3_force_path_style || false,
        sslEnabled: config.backup_s3_ssl_enabled !== false
      };
      
      const s3Client = new S3StorageAdapter(s3Config);
      
      // Download manifest to temporary location
      const tempDir = path.join(getStoragePath(), 'temp');
      await fs.mkdir(tempDir, { recursive: true });
      
      const tempManifestPath = path.join(tempDir, `validate-manifest-${Date.now()}.json`);
      await s3Client.download(key, tempManifestPath);
      
      // Load manifest
      manifest = await backupManifest.loadManifest(tempManifestPath);
      
      // Clean up temp file
      await fs.unlink(tempManifestPath).catch(() => {});
      
    } else {
      // Load manifest from local filesystem
      manifest = await backupManifest.loadManifest(manifestPath);
    }
    
    // Validate the manifest
    backupManifest.validateManifest(manifest);
    return { valid: true, manifest };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

module.exports = {
  startBackupService,
  stopBackupService,
  triggerManualBackup,
  getBackupStatus,
  runBackup,
  cleanupOldBackupRuns,
  getBackupManifest,
  validateBackupManifest
};