const { db } = require('../src/database/db');
const winston = require('winston');

// Create a simple console logger
const logger = winston.createLogger({
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

async function fixStuckEmails() {
  try {
    logger.info('=== Fix Stuck Emails Script ===\n');
    
    // 1. Find stuck emails
    logger.info('1. Finding stuck emails (pending with retry_count >= 3)...');
    const stuckEmails = await db('email_queue')
      .where('status', 'pending')
      .where('retry_count', '>=', 3)
      .select('*');
    
    if (stuckEmails.length === 0) {
      logger.info('   ✅ No stuck emails found!');
      logger.info('\n=== Script complete ===');
      await db.destroy();
      process.exit(0);
    }
    
    logger.info(`   Found ${stuckEmails.length} stuck email(s)\n`);
    
    // 2. Show details
    logger.info('2. Stuck email details:');
    stuckEmails.forEach((email, index) => {
      logger.info(`\n   Email ${index + 1}:`);
      logger.info(`     ID: ${email.id}`);
      logger.info(`     Type: ${email.email_type}`);
      logger.info(`     Recipient: ${email.recipient_email}`);
      logger.info(`     Retry Count: ${email.retry_count}`);
      logger.info(`     Last Error: ${email.error_message || 'None'}`);
    });
    
    // 3. Ask for action
    logger.info('\n\n3. Choose an action:');
    logger.info('   1. Reset retry count to 0 (emails will be retried)');
    logger.info('   2. Mark as failed (emails will not be retried)');
    logger.info('   3. Delete these emails');
    logger.info('   4. Cancel (do nothing)');
    
    // Get command line argument
    const action = process.argv[2];
    
    if (!action || !['reset', 'fail', 'delete'].includes(action)) {
      logger.info('\n❗ No valid action specified');
      logger.info('\nUsage:');
      logger.info('  node fix-stuck-emails.js reset   - Reset retry count to 0');
      logger.info('  node fix-stuck-emails.js fail    - Mark as failed');
      logger.info('  node fix-stuck-emails.js delete  - Delete stuck emails');
      await db.destroy();
      process.exit(1);
    }
    
    // 4. Execute action
    logger.info(`\n4. Executing action: ${action.toUpperCase()}`);
    
    const emailIds = stuckEmails.map(e => e.id);
    
    switch (action) {
      case 'reset':
        await db('email_queue')
          .whereIn('id', emailIds)
          .update({
            retry_count: 0,
            error_message: null
          });
        logger.info(`   ✅ Reset retry count for ${emailIds.length} email(s)`);
        logger.info('   These emails will be processed on the next run');
        break;
        
      case 'fail':
        await db('email_queue')
          .whereIn('id', emailIds)
          .update({
            status: 'failed'
          });
        logger.info(`   ✅ Marked ${emailIds.length} email(s) as failed`);
        logger.info('   These emails will not be retried');
        break;
        
      case 'delete':
        await db('email_queue')
          .whereIn('id', emailIds)
          .delete();
        logger.info(`   ✅ Deleted ${emailIds.length} email(s)`);
        break;
    }
    
    // 5. Show updated counts
    logger.info('\n5. Updated email queue status:');
    const [pendingCount] = await db('email_queue')
      .where('status', 'pending')
      .count('* as count');
    const [processableCount] = await db('email_queue')
      .where('status', 'pending')
      .where('retry_count', '<', 3)
      .count('* as count');
    
    logger.info(`   Total pending: ${pendingCount.count}`);
    logger.info(`   Processable (retry < 3): ${processableCount.count}`);
    
    if (pendingCount.count !== processableCount.count) {
      logger.info(`   ⚠️  Still have ${pendingCount.count - processableCount.count} stuck email(s)`);
    } else {
      logger.info('   ✅ No stuck emails remaining');
    }
    
    logger.info('\n=== Script complete ===');
    
  } catch (error) {
    logger.error('Error:', error);
  } finally {
    await db.destroy();
    process.exit(0);
  }
}

// Run the fix
fixStuckEmails();