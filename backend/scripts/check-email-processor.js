const { db } = require('../src/database/db');
const winston = require('winston');

// Create a simple console logger
const logger = winston.createLogger({
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

async function checkEmailProcessor() {
  try {
    logger.info('=== Email Processor Diagnostic Check ===\n');
    
    // 1. Check pending emails
    logger.info('1. Checking pending emails in queue...');
    const pendingEmails = await db('email_queue')
      .where('status', 'pending')
      .where('retry_count', '<', 3)
      .orderBy('created_at', 'asc');
    
    logger.info(`Found ${pendingEmails.length} pending emails\n`);
    
    if (pendingEmails.length > 0) {
      logger.info('Pending email details:');
      pendingEmails.forEach((email, index) => {
        logger.info(`\nEmail ${index + 1}:`);
        logger.info(`  ID: ${email.id}`);
        logger.info(`  Type: ${email.email_type}`);
        logger.info(`  Recipient: ${email.recipient_email}`);
        logger.info(`  Event ID: ${email.event_id}`);
        logger.info(`  Status: ${email.status}`);
        logger.info(`  Retry Count: ${email.retry_count}`);
        logger.info(`  Scheduled At: ${email.scheduled_at}`);
        logger.info(`  Created At: ${email.created_at}`);
        logger.info(`  Error: ${email.error_message || 'None'}`);
        
        // Check if email_data needs parsing
        logger.info(`  Email Data Type: ${typeof email.email_data}`);
        if (email.email_data) {
          try {
            const data = typeof email.email_data === 'string' 
              ? JSON.parse(email.email_data) 
              : email.email_data;
            logger.info(`  Email Data Keys: ${Object.keys(data).join(', ')}`);
          } catch (e) {
            logger.error(`  Failed to parse email_data: ${e.message}`);
          }
        }
      });
    }
    
    // 2. Check failed emails
    logger.info('\n\n2. Checking failed emails...');
    const failedEmails = await db('email_queue')
      .where('status', 'failed')
      .orderBy('created_at', 'desc')
      .limit(5);
    
    logger.info(`Found ${failedEmails.length} failed emails (showing last 5)\n`);
    
    if (failedEmails.length > 0) {
      failedEmails.forEach((email, index) => {
        logger.info(`\nFailed Email ${index + 1}:`);
        logger.info(`  ID: ${email.id}`);
        logger.info(`  Type: ${email.email_type}`);
        logger.info(`  Retry Count: ${email.retry_count}`);
        logger.info(`  Error: ${email.error_message || 'No error message'}`);
        logger.info(`  Last Attempt: ${email.sent_at || 'Never'}`);
      });
    }
    
    // 3. Check if email processor should be running
    logger.info('\n\n3. Checking email processor configuration...');
    
    // Check environment variables
    const emailConfig = {
      SMTP_HOST: process.env.SMTP_HOST,
      SMTP_PORT: process.env.SMTP_PORT,
      SMTP_USER: process.env.SMTP_USER,
      SMTP_FROM: process.env.SMTP_FROM,
      SMTP_SECURE: process.env.SMTP_SECURE,
      EMAIL_PROCESSOR_ENABLED: process.env.EMAIL_PROCESSOR_ENABLED || 'true'
    };
    
    logger.info('Email configuration:');
    Object.entries(emailConfig).forEach(([key, value]) => {
      if (key === 'SMTP_USER') {
        logger.info(`  ${key}: ${value ? '***' : 'NOT SET'}`);
      } else {
        logger.info(`  ${key}: ${value || 'NOT SET'}`);
      }
    });
    
    // 4. Test email processor functionality
    logger.info('\n\n4. Testing email processor functionality...');
    
    // Import the email processor
    const { processEmailQueue, testEmailConnection } = require('../src/services/emailProcessor');
    
    // Test email connection
    logger.info('Testing email connection...');
    try {
      const connectionTest = await testEmailConnection();
      logger.info(`Email connection test: ${connectionTest ? 'SUCCESS' : 'FAILED'}`);
    } catch (error) {
      logger.error(`Email connection test failed: ${error.message}`);
    }
    
    // Try to process queue once manually
    if (pendingEmails.length > 0) {
      logger.info('\n\n5. Attempting to process email queue manually...');
      try {
        await processEmailQueue();
        logger.info('Manual queue processing completed');
        
        // Check status after processing
        const stillPending = await db('email_queue')
          .where('status', 'pending')
          .where('retry_count', '<', 3)
          .count('* as count')
          .first();
        
        logger.info(`Emails still pending after processing: ${stillPending.count}`);
      } catch (error) {
        logger.error(`Error processing queue: ${error.message}`);
        logger.error(`Stack trace: ${error.stack}`);
      }
    }
    
    // 5. Check for any recent successful emails
    logger.info('\n\n6. Checking recent successful emails...');
    const recentSuccess = await db('email_queue')
      .where('status', 'sent')
      .orderBy('sent_at', 'desc')
      .limit(3);
    
    if (recentSuccess.length > 0) {
      logger.info(`Last ${recentSuccess.length} successful emails:`);
      recentSuccess.forEach((email, index) => {
        logger.info(`  ${index + 1}. Type: ${email.email_type}, Sent: ${email.sent_at}`);
      });
    } else {
      logger.info('No successfully sent emails found');
    }
    
    logger.info('\n\n=== Diagnostic check complete ===');
    
  } catch (error) {
    logger.error('Error running diagnostic check:', error);
  } finally {
    await db.destroy();
    process.exit(0);
  }
}

// Run the check
checkEmailProcessor();