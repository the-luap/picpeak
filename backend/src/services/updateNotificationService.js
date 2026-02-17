/**
 * Update Notification Service
 * Checks for updates and sends email notifications to administrators.
 */

const { db } = require('../database/db');
const { checkForUpdates } = require('./updateCheckService');
const { sendTemplateEmail, initializeTransporter } = require('./emailProcessor');
const logger = require('../utils/logger');

/**
 * Get update notification settings from database
 */
async function getUpdateNotificationSettings() {
  try {
    const settings = await db('app_settings')
      .whereIn('setting_key', [
        'update_email_notifications_enabled',
        'update_email_recipients',
        'last_notified_version'
      ])
      .select('setting_key', 'setting_value');

    const result = {};
    for (const setting of settings) {
      try {
        result[setting.setting_key] = JSON.parse(setting.setting_value);
      } catch (e) {
        result[setting.setting_key] = setting.setting_value;
      }
    }

    return {
      enabled: result.update_email_notifications_enabled === true,
      recipients: result.update_email_recipients || '',
      lastNotifiedVersion: result.last_notified_version || ''
    };
  } catch (error) {
    logger.error('Error fetching update notification settings:', error);
    return {
      enabled: false,
      recipients: '',
      lastNotifiedVersion: ''
    };
  }
}

/**
 * Update the last notified version in database
 */
async function updateLastNotifiedVersion(version) {
  try {
    await db('app_settings')
      .where('setting_key', 'last_notified_version')
      .update({
        setting_value: JSON.stringify(version),
        updated_at: db.fn.now()
      });
  } catch (error) {
    logger.error('Error updating last notified version:', error);
  }
}

/**
 * Get admin email addresses to notify
 * If recipients setting is empty, get all active admin emails
 */
async function getNotificationRecipients(recipientsSetting) {
  try {
    if (recipientsSetting && recipientsSetting.trim()) {
      // Use configured recipients (comma-separated)
      return recipientsSetting.split(',').map(email => email.trim()).filter(Boolean);
    }

    // Fallback: get all active admin user emails
    const admins = await db('admin_users')
      .where('is_active', true)
      .whereNotNull('email')
      .select('email');

    return admins.map(admin => admin.email).filter(Boolean);
  } catch (error) {
    logger.error('Error fetching notification recipients:', error);
    return [];
  }
}

/**
 * Check for updates and send notification emails if new version is available
 */
async function checkAndNotifyUpdates() {
  logger.info('Update notification service: Checking for updates...');

  try {
    // Check if update notifications are enabled
    const settings = await getUpdateNotificationSettings();

    if (!settings.enabled) {
      logger.info('Update email notifications are disabled');
      return { notified: false, reason: 'notifications_disabled' };
    }

    // Check for available updates
    const updateInfo = await checkForUpdates();

    if (!updateInfo.updateAvailable) {
      logger.info('No updates available');
      return { notified: false, reason: 'no_updates' };
    }

    const newVersion = updateInfo.latest.forChannel;

    // Check if we've already notified about this version
    if (settings.lastNotifiedVersion === newVersion) {
      logger.info(`Already notified about version ${newVersion}`);
      return { notified: false, reason: 'already_notified' };
    }

    // Get recipients
    const recipients = await getNotificationRecipients(settings.recipients);

    if (recipients.length === 0) {
      logger.warn('No recipients configured for update notifications');
      return { notified: false, reason: 'no_recipients' };
    }

    // Ensure email transporter is initialized
    await initializeTransporter();

    // Send email to each recipient
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const releaseNotesUrl = `https://github.com/the-luap/picpeak/releases/tag/v${newVersion}`;
    const channelLabel = updateInfo.channel === 'beta' ? 'Beta' : 'Stable';

    let successCount = 0;
    let errorCount = 0;

    for (const email of recipients) {
      try {
        await sendTemplateEmail(email, 'version_update_available', {
          current_version: updateInfo.current,
          new_version: newVersion,
          channel: channelLabel,
          release_notes_url: releaseNotesUrl,
          admin_url: `${frontendUrl}/admin`
        });
        successCount++;
        logger.info(`Update notification sent to ${email}`);
      } catch (error) {
        errorCount++;
        logger.error(`Failed to send update notification to ${email}:`, error);
      }
    }

    // Update last notified version
    if (successCount > 0) {
      await updateLastNotifiedVersion(newVersion);
      logger.info(`Update notifications sent: ${successCount} success, ${errorCount} failed`);
    }

    return {
      notified: successCount > 0,
      newVersion,
      successCount,
      errorCount,
      totalRecipients: recipients.length
    };
  } catch (error) {
    logger.error('Error in update notification service:', error);
    return { notified: false, reason: 'error', error: error.message };
  }
}

/**
 * Force send update notification (for manual trigger from admin UI)
 */
async function sendUpdateNotificationNow() {
  logger.info('Manually triggering update notification...');

  try {
    // Check for available updates
    const updateInfo = await checkForUpdates(true); // Force refresh

    if (!updateInfo.updateAvailable) {
      return { success: false, message: 'No updates available' };
    }

    const newVersion = updateInfo.latest.forChannel;
    const settings = await getUpdateNotificationSettings();

    // Get recipients
    const recipients = await getNotificationRecipients(settings.recipients);

    if (recipients.length === 0) {
      return { success: false, message: 'No recipients configured' };
    }

    // Ensure email transporter is initialized
    await initializeTransporter();

    // Send email to each recipient
    const releaseNotesUrl = `https://github.com/the-luap/picpeak/releases/tag/v${newVersion}`;
    const channelLabel = updateInfo.channel === 'beta' ? 'Beta' : 'Stable';

    let successCount = 0;
    let errorCount = 0;

    for (const email of recipients) {
      try {
        await sendTemplateEmail(email, 'version_update_available', {
          current_version: updateInfo.current,
          new_version: newVersion,
          channel: channelLabel,
          release_notes_url: releaseNotesUrl
        });
        successCount++;
      } catch (error) {
        errorCount++;
        logger.error(`Failed to send update notification to ${email}:`, error);
      }
    }

    // Update last notified version
    if (successCount > 0) {
      await updateLastNotifiedVersion(newVersion);
    }

    return {
      success: successCount > 0,
      newVersion,
      successCount,
      errorCount,
      totalRecipients: recipients.length
    };
  } catch (error) {
    logger.error('Error sending manual update notification:', error);
    return { success: false, message: error.message };
  }
}

module.exports = {
  checkAndNotifyUpdates,
  sendUpdateNotificationNow,
  getUpdateNotificationSettings,
  getNotificationRecipients
};
