const { db } = require('../src/database/db');
const winston = require('winston');

// Create a simple console logger
const logger = winston.createLogger({
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

async function debugEmailQueue() {
  try {
    logger.info('=== Email Queue Debug Report ===\n');
    
    // 1. Count exactly like the admin dashboard does
    logger.info('1. Admin Dashboard Query (ALL pending, no retry filter):');
    const [adminCount] = await db('email_queue').where('status', 'pending').count('* as count');
    logger.info(`   Pending emails (admin dashboard view): ${adminCount.count}\n`);
    
    // 2. Count like the email processor does
    logger.info('2. Email Processor Query (pending with retry_count < 3):');
    const [processorCount] = await db('email_queue')
      .where('status', 'pending')
      .where('retry_count', '<', 3)
      .count('* as count');
    logger.info(`   Pending emails (processor view): ${processorCount.count}\n`);
    
    // 3. Show the discrepancy
    logger.info('3. Discrepancy Analysis:');
    if (adminCount.count !== processorCount.count) {
      logger.info(`   ⚠️  DISCREPANCY FOUND!`);
      logger.info(`   Admin shows: ${adminCount.count}`);
      logger.info(`   Processor will process: ${processorCount.count}`);
      logger.info(`   Difference: ${adminCount.count - processorCount.count} email(s)\n`);
      
      // Find the problematic emails
      logger.info('4. Emails with retry_count >= 3 (still pending):');
      const stuckEmails = await db('email_queue')
        .where('status', 'pending')
        .where('retry_count', '>=', 3)
        .select('*');
      
      if (stuckEmails.length > 0) {
        logger.info(`   Found ${stuckEmails.length} stuck email(s):\n`);
        stuckEmails.forEach((email, index) => {
          logger.info(`   Email ${index + 1}:`);
          logger.info(`     ID: ${email.id}`);
          logger.info(`     Type: ${email.email_type}`);
          logger.info(`     Recipient: ${email.recipient_email}`);
          logger.info(`     Status: ${email.status}`);
          logger.info(`     Retry Count: ${email.retry_count} ⚠️`);
          logger.info(`     Created: ${email.created_at}`);
          logger.info(`     Last Error: ${email.error_message || 'None'}\n`);
        });
      }
    } else {
      logger.info(`   ✅ No discrepancy - counts match\n`);
    }
    
    // 5. Show ALL pending emails with details
    logger.info('5. ALL Pending Emails (regardless of retry count):');
    const allPending = await db('email_queue')
      .where('status', 'pending')
      .orderBy('retry_count', 'desc')
      .orderBy('created_at', 'asc');
    
    if (allPending.length > 0) {
      allPending.forEach((email, index) => {
        const willProcess = email.retry_count < 3;
        logger.info(`\n   Email ${index + 1}: ${willProcess ? '✅ WILL PROCESS' : '❌ STUCK (max retries)'}`);
        logger.info(`     ID: ${email.id}`);
        logger.info(`     Type: ${email.email_type}`);
        logger.info(`     Recipient: ${email.recipient_email}`);
        logger.info(`     Event ID: ${email.event_id}`);
        logger.info(`     Retry Count: ${email.retry_count}/3`);
        logger.info(`     Created: ${email.created_at}`);
        logger.info(`     Scheduled: ${email.scheduled_at}`);
        if (email.error_message) {
          logger.info(`     Last Error: ${email.error_message}`);
        }
      });
    } else {
      logger.info('   No pending emails found');
    }
    
    // 6. Show counts by status
    logger.info('\n\n6. Email Queue Summary by Status:');
    const statusCounts = await db('email_queue')
      .select('status')
      .count('* as count')
      .groupBy('status')
      .orderBy('status');
    
    statusCounts.forEach(row => {
      logger.info(`   ${row.status}: ${row.count}`);
    });
    
    // 7. Failed emails summary
    logger.info('\n7. Failed Emails Summary:');
    const failedSummary = await db('email_queue')
      .where('status', 'failed')
      .select('retry_count')
      .count('* as count')
      .groupBy('retry_count')
      .orderBy('retry_count');
    
    if (failedSummary.length > 0) {
      failedSummary.forEach(row => {
        logger.info(`   Retry count ${row.retry_count}: ${row.count} email(s)`);
      });
    } else {
      logger.info('   No failed emails');
    }
    
    // 8. Recommendations
    logger.info('\n\n=== RECOMMENDATIONS ===');
    
    if (adminCount.count > processorCount.count) {
      logger.info('\n❗ You have emails stuck with retry_count >= 3');
      logger.info('   These emails will NOT be processed automatically.');
      logger.info('\n   To fix this, you can:');
      logger.info('   1. Reset retry count: UPDATE email_queue SET retry_count = 0 WHERE status = \'pending\' AND retry_count >= 3;');
      logger.info('   2. Mark as failed: UPDATE email_queue SET status = \'failed\' WHERE status = \'pending\' AND retry_count >= 3;');
      logger.info('   3. Delete them: DELETE FROM email_queue WHERE status = \'pending\' AND retry_count >= 3;');
    }
    
    const anyPending = adminCount.count > 0;
    if (anyPending && processorCount.count === 0) {
      logger.info('\n❗ All pending emails have exceeded retry limit');
      logger.info('   The email processor will not attempt to send them.');
    } else if (anyPending && processorCount.count > 0) {
      logger.info('\n✅ Email processor should process the pending emails on next run');
      logger.info('   Make sure the email processor service is running.');
    }
    
    logger.info('\n=== Debug report complete ===');
    
  } catch (error) {
    logger.error('Error running debug report:', error);
  } finally {
    await db.destroy();
    process.exit(0);
  }
}

// Run the debug
debugEmailQueue();