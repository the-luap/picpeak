const cron = require('node-cron');
const { db } = require('../database/db');
const { archiveEvent } = require('./archiveService');
const { queueEmail, getSupportEmail } = require('./emailProcessor');
const logger = require('../utils/logger');
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
    // Skip events with null expires_at (they never expire)
    const eventsNeedingWarning = await db('events')
      .where('is_active', formatBoolean(true))
      .where('is_archived', formatBoolean(false))
      .whereNotNull('expires_at')
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
    // Skip events with null expires_at (they never expire)
    const expiredEvents = await db('events')
      .where('is_active', formatBoolean(true))
      .where('is_archived', formatBoolean(false))
      .whereNotNull('expires_at')
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

  const recipientEmail = event.customer_email || event.host_email;
  const recipientName = event.customer_name || event.host_name || (recipientEmail ? recipientEmail.split('@')[0] : null);

  // Date formatting + language detection happen inside processTemplate using
  // the recipient's resolved language — pass the raw ISO date and let the
  // processor format it. Don't pre-format here with a hard-coded `.de`/`en`
  // sniff (that helper got the wrong language for nl/pt/ru recipients).
  //
  // gallery_password is sent as the security-message sentinel because by the
  // time the warning fires we no longer have the plaintext (only the bcrypt
  // hash); the processor localises this to "(Not shown for security reasons)".
  await queueEmail(event.id, recipientEmail, 'expiration_warning', {
    customer_name: recipientName,
    customer_email: recipientEmail,
    host_name: recipientName,
    event_name: event.event_name,
    event_date: event.event_date,
    days_remaining: daysRemaining.toString(),
    expiry_date: event.expires_at,
    gallery_link: event.share_link,
    gallery_password: '{{password_security_message}}'
  });

  logger.info(`Queued expiration warning for event ${event.slug}`);
}

async function handleExpiredEvent(event) {
  try {
    // Mark as inactive
    await db('events').where('id', event.id).update({ is_active: formatBoolean(false) });

    // Fire event.expired BEFORE the cascading archive call so receivers
    // get the lifecycle in order (expired → archived). Canonical event
    // subject (#341) so receivers see the same shape across all event.*
    // types; expires_at retained as an event.expired-specific extra.
    try {
      const webhookService = require('./webhookService');
      await webhookService.fire('event.expired', {
        event: {
          ...webhookService.buildEventSubject({
            id: event.id,
            slug: event.slug,
            event_name: event.event_name,
            event_type: event.event_type,
            event_date: event.event_date,
            share_token: event.share_token,
            customer_name: event.customer_name || event.host_name,
            customer_email: event.customer_email || event.host_email,
            customer_phone: event.customer_phone,
          }),
          expires_at: event.expires_at,
        },
      });
    } catch (e) { /* non-fatal */ }

    // Queue expiration emails. The shipped templates (EN/DE in legacy 028,
    // NL/PT/RU in core 075) reference {{host_name}}, {{event_date}},
    // {{expiry_date}} and {{support_email}}. Without these, customers used
    // to literally see "Hello {{host_name}}, your gallery expired on
    // {{expiry_date}}…" — fill them all here.
    const recipientEmail = event.customer_email || event.host_email;
    const recipientName = event.customer_name || event.host_name || (recipientEmail ? recipientEmail.split('@')[0] : null);
    const supportEmail = await getSupportEmail();

    const customerVars = {
      customer_name: recipientName,
      customer_email: recipientEmail,
      host_name: recipientName,
      event_name: event.event_name,
      event_date: event.event_date,
      expiry_date: event.expires_at,
      admin_email: event.admin_email,
      support_email: supportEmail
    };

    if (recipientEmail) {
      await queueEmail(event.id, recipientEmail, 'gallery_expired', customerVars);
    }

    // Also notify admin (when configured).
    if (event.admin_email && event.admin_email !== recipientEmail) {
      await queueEmail(event.id, event.admin_email, 'gallery_expired', {
        ...customerVars,
        host_name: 'Admin'
      });
    }
    
    // Start archiving process
    await archiveEvent(event);
    
    logger.info(`Handled expiration for event ${event.slug}`);
  } catch (error) {
    logger.error(`Error handling expired event ${event.slug}:`, error);
  }
}

module.exports = { startExpirationChecker };
