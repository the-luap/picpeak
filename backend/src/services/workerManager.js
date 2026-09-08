/**
 * Worker Manager - Background service for PicPeak
 *
 * This service runs as a separate process to handle:
 * - File watching for new photos
 * - Expiration checking for events
 * - Other background tasks
 */

const path = require('path');
const logger = require('../utils/logger');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Import services
const { startFileWatcher } = require('./fileWatcher');
const { startExpirationChecker } = require('./expirationChecker');

let isShuttingDown = false;

async function startWorkers() {
  logger.info('Starting PicPeak background workers...');

  try {
    // Start file watcher for automatic photo processing
    startFileWatcher();
    logger.info('File watcher started successfully');

    // Start expiration checker for event lifecycle management
    startExpirationChecker();
    logger.info('Expiration checker started successfully');

    logger.info('All background workers started successfully');
  } catch (error) {
    logger.error('Failed to start background workers:', error);
    process.exitCode = 1;
    await handleShutdown('startup failure');
  }
}

async function handleShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  try {
    await require('./serviceShutdown').stopServices();
    await require('../database/db').db.destroy();
    logger.info('Worker manager shutdown complete');
  } catch (error) {
    logger.error('Worker shutdown failed', { error: error.message });
    process.exitCode = 1;
  }
}

// Handle shutdown signals
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception in worker manager:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection in worker manager:', reason);
});

// Start workers
startWorkers();
