const cron = require('node-cron');
const { db } = require('../database/db');
const { archiveEvent } = require('./archiveService');
const { queueEmail } = require('./emailProcessor');
const logger = require('../utils/logger');
const { formatDate } = require('../utils/dateFormatter');
const { formatBoolean } = require('../utils/dbCompat');

function startExpirationChecker() {
  // Check every hour for expired events and warnings
  cron.schedule('0 * * * *', async () => {
    await checkExpirations();
  });
  
  logger.info('Expiration checker started');
}

async function checkExpirations() {
  try {
    const now = new Date();
    const warningDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
    
    // Check for events needing warning emails
    const eventsNeedingWarning = await db('events')
      .where('is_active', formatBoolean(true))
      .where('is_archived', formatBoolean(false))
      .where('expires_at', '<=', warningDate)
      .where('expires_at', '>', now);
    
    for (const event of eventsNeedingWarning) {
      // Check if warning email already sent
      const existingWarning = await db('email_queue')
        .where('event_id', event.id)
        .where('email_type', 'expiration_warning')
        .first();
      
      if (!existingWarning) {
        await queueExpirationWarning(event);
      }
    }
    
    // Check for expired events
    const expiredEvents = await db('events')
      .where('is_active', formatBoolean(true))
      .where('is_archived', formatBoolean(false))
      .where('expires_at', '<=', now);
    
    for (const event of expiredEvents) {
      await handleExpiredEvent(event);
    }
    
  } catch (error) {
    logger.error('Error checking expirations:', error);
  }
}

async function queueExpirationWarning(event) {
  const daysRemaining = Math.ceil((new Date(event.expires_at) - new Date()) / (1000 * 60 * 60 * 24));
  
  // Determine language based on email domain
  const emailLang = event.host_email.endsWith('.de') ? 'de' : 'en';
  
  // Queue email to host
  await queueEmail(event.id, event.host_email, 'expiration_warning', {
    host_name: event.host_name || event.host_email.split('@')[0],
    event_name: event.event_name,
    days_remaining: daysRemaining.toString(),
    expiration_date: await formatDate(event.expires_at, emailLang),
    gallery_link: event.share_link
  });
  
  logger.info(`Queued expiration warning for event ${event.slug}`);
}

async function handleExpiredEvent(event) {
  try {
    // Mark as inactive
    await db('events').where('id', event.id).update({ is_active: formatBoolean(false) });
    
    // Queue expiration emails
    await queueEmail(event.id, event.host_email, 'gallery_expired', {
      event_name: event.event_name,
      admin_email: event.admin_email
    });
    
    // Also notify admin
    await queueEmail(event.id, event.admin_email, 'gallery_expired', {
      event_name: event.event_name,
      admin_email: event.admin_email
    });
    
    // Start archiving process
    await archiveEvent(event);
    
    logger.info(`Handled expiration for event ${event.slug}`);
  } catch (error) {
    logger.error(`Error handling expired event ${event.slug}:`, error);
  }
}

module.exports = { startExpirationChecker };
