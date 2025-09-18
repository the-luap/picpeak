const express = require('express');
const router = express.Router();
const { restoreService } = require('../services/restoreService');
const { adminAuth } = require('../middleware/auth');
const { body, query, validationResult } = require('express-validator');
const logger = require('../utils/logger');
const { db } = require('../database/db');
const path = require('path');
const fs = require('fs').promises;

/**
 * Admin routes for restore operations
 * All routes require admin authentication
 */

// Apply admin authentication to all routes
router.use(adminAuth);

/**
 * Get restore service status and history
 */
router.get('/status', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const history = await restoreService.getRestoreHistory(limit);
    
    const status = {
      isRunning: restoreService.isRunning,
      currentProgress: restoreService.getProgress(),
      history: history,
      settings: await getRestoreSettings()
    };
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.error('Failed to get restore status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get restore status'
    });
  }
});

/**
 * Validate restore request
 */
router.post('/validate', [
  body('source').notEmpty().withMessage('Backup source is required'),
  body('manifestPath').notEmpty().withMessage('Manifest path is required'),
  body('restoreType').isIn(['full', 'database', 'files', 'selective']).withMessage('Invalid restore type'),
  body('selectedItems').optional().isArray(),
  body('s3Config').optional().isObject()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  try {
    // Perform dry run validation
    const result = await restoreService.restore({
      ...req.body,
      dryRun: true,
      force: false
    });
    
    res.json({
      success: true,
      data: {
        validation: result.validation,
        spaceCheck: result.spaceCheck,
        logs: result.logs
      }
    });
  } catch (error) {
    logger.error('Restore validation failed:', error);
    res.status(400).json({
      success: false,
      error: 'Restore validation failed',
      logs: restoreService.restoreLog
    });
  }
});

/**
 * Start restore operation
 */
router.post('/start', [
  body('source').notEmpty().withMessage('Backup source is required'),
  body('manifestPath').notEmpty().withMessage('Manifest path is required'),
  body('restoreType').isIn(['full', 'database', 'files', 'selective']).withMessage('Invalid restore type'),
  body('selectedItems').optional().isArray(),
  body('skipPreBackup').optional().isBoolean(),
  body('force').optional().isBoolean(),
  body('s3Config').optional().isObject()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  try {
    // Check if restore is already running
    if (restoreService.isRunning) {
      return res.status(409).json({
        success: false,
        error: 'Restore operation already in progress'
      });
    }

    // Check permissions for dangerous options
    const settings = await getRestoreSettings();
    if (req.body.force && !settings.restore_allow_force) {
      return res.status(403).json({
        success: false,
        error: 'Force restore is not allowed by system settings'
      });
    }

    if (req.body.skipPreBackup && settings.restore_require_pre_backup) {
      return res.status(403).json({
        success: false,
        error: 'Skipping pre-restore backup is not allowed by system settings'
      });
    }

    // Log restore attempt
    logger.warn('Restore operation started', {
      user: req.user.email,
      ip: req.ip,
      restoreType: req.body.restoreType,
      source: req.body.source
    });

    // Start restore in background
    restoreService.restore({
      ...req.body,
      dryRun: false,
      operator: {
        type: 'manual',
        userId: req.user.id,
        ip: req.ip
      }
    }).catch(error => {
      logger.error('Background restore failed:', error);
    });

    res.json({
      success: true,
      message: 'Restore operation started'
    });
  } catch (error) {
    logger.error('Failed to start restore:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start restore operation'
    });
  }
});

/**
 * Get current restore progress
 */
router.get('/progress', async (req, res) => {
  try {
    const progress = restoreService.getProgress();
    const logs = restoreService.restoreLog.slice(-50); // Last 50 log entries
    
    res.json({
      success: true,
      data: {
        isRunning: restoreService.isRunning,
        progress: progress,
        logs: logs
      }
    });
  } catch (error) {
    logger.error('Failed to get restore progress:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get restore progress'
    });
  }
});

/**
 * Get restore run details
 */
router.get('/run/:id', async (req, res) => {
  try {
    const run = await db('restore_runs')
      .where('id', req.params.id)
      .first();
    
    if (!run) {
      return res.status(404).json({
        success: false,
        error: 'Restore run not found'
      });
    }
    
    // Parse JSON fields
    if (run.statistics) run.statistics = JSON.parse(run.statistics);
    if (run.restore_log) run.restore_log = JSON.parse(run.restore_log);
    if (run.metadata) run.metadata = JSON.parse(run.metadata);
    
    // Get validation results
    const validations = await db('restore_validation_results')
      .where('restore_run_id', run.id)
      .select('*');
    
    validations.forEach(v => {
      if (v.errors) v.errors = JSON.parse(v.errors);
      if (v.warnings) v.warnings = JSON.parse(v.warnings);
      if (v.checksums) v.checksums = JSON.parse(v.checksums);
    });
    
    // Get file operations summary
    const fileOps = await db('restore_file_operations')
      .where('restore_run_id', run.id)
      .select('status', db.raw('COUNT(*) as count'))
      .groupBy('status');
    
    res.json({
      success: true,
      data: {
        run: run,
        validations: validations,
        fileOperations: fileOps
      }
    });
  } catch (error) {
    logger.error('Failed to get restore run details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get restore run details'
    });
  }
});

/**
 * Get restore run report
 */
router.get('/run/:id/report', async (req, res) => {
  try {
    const run = await db('restore_runs')
      .where('id', req.params.id)
      .first();
    
    if (!run) {
      return res.status(404).json({
        success: false,
        error: 'Restore run not found'
      });
    }
    
    // Parse JSON fields
    if (run.statistics) run.statistics = JSON.parse(run.statistics);
    if (run.restore_log) run.restore_log = JSON.parse(run.restore_log);
    
    // Generate report
    const report = restoreService.generateRestoreReport({
      success: run.status === 'completed',
      duration: run.duration_seconds,
      dryRun: run.is_dry_run,
      result: run.statistics,
      logs: run.restore_log || []
    });
    
    res.type('text/plain').send(report);
  } catch (error) {
    logger.error('Failed to generate restore report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate restore report'
    });
  }
});

/**
 * List available backups for restore
 */
router.get('/available-backups', async (req, res) => {
  try {
    const backups = [];
    
    // Get local file backups
    const backupConfig = await getBackupConfig();
    if (backupConfig.backup_destination_type === 'local' && backupConfig.backup_destination_path) {
      try {
        const files = await fs.readdir(backupConfig.backup_destination_path);
        for (const file of files) {
          if (file.endsWith('.json') || file.endsWith('.yaml')) {
            const filePath = path.join(backupConfig.backup_destination_path, file);
            const stats = await fs.stat(filePath);
            backups.push({
              type: 'local',
              name: file,
              path: filePath,
              size: stats.size,
              modified: stats.mtime
            });
          }
        }
      } catch (error) {
        logger.warn('Failed to list local backups:', error);
      }
    }
    
    // Get database backups from backup_runs table
    const backupRuns = await db('backup_runs')
      .where('status', 'completed')
      .whereNotNull('manifest_path')
      .orderBy('completed_at', 'desc')
      .limit(20);
    
    for (const run of backupRuns) {
      backups.push({
        type: run.manifest_path.startsWith('s3://') ? 's3' : 'local',
        name: `Backup ${run.completed_at}`,
        path: run.manifest_path,
        manifestId: run.manifest_id,
        size: run.total_size_bytes,
        filesCount: run.files_backed_up,
        duration: run.duration_seconds,
        completed: run.completed_at
      });
    }
    
    res.json({
      success: true,
      data: backups
    });
  } catch (error) {
    logger.error('Failed to list available backups:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list available backups'
    });
  }
});

/**
 * Get restore settings
 */
router.get('/settings', async (req, res) => {
  try {
    const settings = await getRestoreSettings();
    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    logger.error('Failed to get restore settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get restore settings'
    });
  }
});

/**
 * Update restore settings
 */
router.put('/settings', [
  body('restore_allow_force').optional().isBoolean(),
  body('restore_require_pre_backup').optional().isBoolean(),
  body('restore_max_file_size_mb').optional().isInt({ min: 1 }),
  body('restore_verify_checksums').optional().isBoolean(),
  body('restore_email_on_completion').optional().isBoolean(),
  body('restore_retention_days').optional().isInt({ min: 1 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  try {
    // Update settings
    for (const [key, value] of Object.entries(req.body)) {
      await db('app_settings')
        .where('setting_key', key)
        .where('setting_type', 'restore')
        .update({
          setting_value: typeof value === 'boolean' ? (value ? '1' : '0') : value.toString(),
          updated_at: db.fn.now()
        });
    }
    
    logger.info('Restore settings updated', {
      user: req.user.email,
      settings: req.body
    });
    
    res.json({
      success: true,
      message: 'Settings updated successfully'
    });
  } catch (error) {
    logger.error('Failed to update restore settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update settings'
    });
  }
});

/**
 * Helper function to get restore settings
 */
async function getRestoreSettings() {
  const settings = await db('app_settings')
    .where('setting_type', 'restore')
    .select('setting_key', 'setting_value');
  
  const result = {};
  settings.forEach(setting => {
    // Convert boolean strings to actual booleans
    if (setting.setting_value === '1' || setting.setting_value === '0') {
      result[setting.setting_key] = setting.setting_value === '1';
    } else {
      result[setting.setting_key] = setting.setting_value;
    }
  });
  
  return result;
}

/**
 * Helper function to get backup configuration
 */
async function getBackupConfig() {
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
}

module.exports = router;
