#!/usr/bin/env node

const { db } = require('../src/database/db');
const { 
  initializeTransporter, 
  processEmailQueue, 
  testEmailConnection 
} = require('../src/services/emailProcessor');
const winston = require('winston');

// Create a simple console logger
const logger = winston.createLogger({
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

async function runEmailProcessor(runOnce = false) {
  try {
    logger.info('=== Starting Email Processor ===\n');
    
    // Initialize transporter
    logger.info('Initializing email transporter...');
    await initializeTransporter();
    
    // Test connection
    logger.info('Testing email connection...');
    const connectionOk = await testEmailConnection();
    
    if (!connectionOk) {
      logger.error('Email connection test failed! Check your SMTP configuration.');
      logger.info('\nRequired environment variables:');
      logger.info('- SMTP_HOST');
      logger.info('- SMTP_PORT');
      logger.info('- SMTP_USER');
      logger.info('- SMTP_PASS');
      logger.info('- SMTP_FROM');
      process.exit(1);
    }
    
    logger.info('Email connection test successful!\n');
    
    if (runOnce) {
      // Process queue once
      logger.info('Processing email queue once...');
      await processEmailQueue();
      logger.info('Email processing complete');
      
      // Show final status
      const pendingCount = await db('email_queue')
        .where('status', 'pending')
        .where('retry_count', '<', 3)
        .count('* as count')
        .first();
      
      logger.info(`\nEmails still pending: ${pendingCount.count}`);
      
      await db.destroy();
      process.exit(0);
    } else {
      // Run continuously
      logger.info('Starting continuous email processor...');
      logger.info('Processing emails every 60 seconds. Press Ctrl+C to stop.\n');
      
      // Process immediately
      await processEmailQueue();
      
      // Then every minute
      setInterval(async () => {
        try {
          await processEmailQueue();
        } catch (error) {
          logger.error('Error processing email queue:', error);
        }
      }, 60000);
    }
    
  } catch (error) {
    logger.error('Fatal error:', error);
    await db.destroy();
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('\n\nShutting down email processor...');
  await db.destroy();
  process.exit(0);
});

// Check command line arguments
const args = process.argv.slice(2);
const runOnce = args.includes('--once') || args.includes('-o');

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Email Processor Runner

Usage: node run-email-processor.js [options]

Options:
  --once, -o     Process the email queue once and exit
  --help, -h     Show this help message

By default, the processor runs continuously, checking for emails every 60 seconds.
  `);
  process.exit(0);
}

// Run the processor
runEmailProcessor(runOnce);