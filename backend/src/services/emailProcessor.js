const nodemailer = require('nodemailer');
const Handlebars = require('handlebars');
const { db } = require('../database/db');
const logger = require('../utils/logger');

let transporter = null;
let lastConfigHash = null;

// Generate hash from config for change detection
function generateConfigHash(config) {
  const crypto = require('crypto');
  const configString = `${config.smtp_host}:${config.smtp_port}:${config.smtp_user}:${config.smtp_pass}:${config.smtp_secure}`;
  return crypto.createHash('md5').update(configString).digest('hex');
}

// Initialize transporter from database config
async function initializeTransporter(forceReinit = false) {
  try {
    const config = await db('email_configs').first();
    
    if (!config) {
      logger.warn('No email configuration found');
      return null;
    }

    // Check if configuration has changed
    const currentConfigHash = generateConfigHash(config);
    if (!forceReinit && transporter && currentConfigHash === lastConfigHash) {
      // Configuration hasn't changed, return existing transporter
      return transporter;
    }

    // Configuration has changed or first initialization
    logger.info('Initializing email transporter' + (lastConfigHash && currentConfigHash !== lastConfigHash ? ' (configuration changed)' : ''));

    transporter = nodemailer.createTransport({
      host: config.smtp_host,
      port: config.smtp_port,
      secure: config.smtp_secure,
      auth: config.smtp_user ? {
        user: config.smtp_user,
        pass: config.smtp_pass
      } : undefined
    });

    // Verify configuration
    await transporter.verify();
    logger.info('Email transporter initialized successfully');
    
    // Update the config hash
    lastConfigHash = currentConfigHash;
    
    return transporter;
  } catch (error) {
    logger.error('Failed to initialize email transporter:', error);
    transporter = null;
    lastConfigHash = null;
    return null;
  }
}

// Get the appropriate language for a recipient
async function getRecipientLanguage(email, eventId = null) {
  // First priority: Check event language setting if eventId is provided
  if (eventId) {
    try {
      const event = await db('events').where('id', eventId).first();
      if (event && event.language) {
        return event.language;
      }
    } catch (error) {
      logger.error('Error fetching event language:', error);
    }
  }
  
  // Second priority: Check app_settings for general default language
  try {
    const langSetting = await db('app_settings')
      .where('setting_key', 'general_default_language')
      .first();
    if (langSetting && langSetting.setting_value) {
      return langSetting.setting_value;
    }
  } catch (error) {
    logger.error('Error fetching app settings language:', error);
  }
  
  // Third priority: Check email configs for default language
  try {
    const emailConfig = await db('email_configs').first();
    if (emailConfig && emailConfig.default_language) {
      return emailConfig.default_language;
    }
  } catch (error) {
    logger.error('Error fetching email config language:', error);
  }
  
  // Fourth priority: Check if the email domain suggests German
  if (email) {
    const germanDomains = ['.de', '.at', '.ch', '.li'];
    const domain = email.toLowerCase();
    if (germanDomains.some(d => domain.endsWith(d))) {
      return 'de';
    }
  }
  
  return 'en'; // Default to English
}

// Process email template with variables
async function processTemplate(template, variables, language = 'en') {
  // Import date formatter and text formatters
  const { formatDate } = require('../utils/dateFormatter');
  const { formatWelcomeMessage } = require('../utils/formatters');
  
  // Get the appropriate language fields
  const subjectField = language === 'de' ? 'subject_de' : 'subject_en';
  const htmlField = language === 'de' ? 'body_html_de' : 'body_html_en';
  const textField = language === 'de' ? 'body_text_de' : 'body_text_en';
  
  // Fall back to non-language-specific fields for backward compatibility
  let subject = template[subjectField] || template.subject || '';
  let htmlBody = template[htmlField] || template.body_html || '';
  let textBody = template[textField] || template.body_text || '';
  
  // Process variables before template compilation
  const processedVariables = { ...variables };
  
  // Handle password security message
  if (processedVariables.gallery_password === '{{password_security_message}}') {
    processedVariables.gallery_password = language === 'de' 
      ? '(Aus Sicherheitsgründen nicht angezeigt)' 
      : '(Not shown for security reasons)';
  }
  
  // Format dates if they exist
  if (processedVariables.event_date) {
    processedVariables.event_date = await formatDate(processedVariables.event_date, language);
  }
  if (processedVariables.expiry_date) {
    processedVariables.expiry_date = await formatDate(processedVariables.expiry_date, language);
  }
  if (processedVariables.archive_date) {
    processedVariables.archive_date = await formatDate(processedVariables.archive_date, language);
  }
  
  // Format welcome message for HTML display (preserve line breaks)
  if (processedVariables.welcome_message) {
    processedVariables.welcome_message = formatWelcomeMessage(processedVariables.welcome_message);
  }

  // Get branding settings for logo
  let logoUrl = '';
  let companyName = 'PicPeak';
  try {
    const brandingSettings = await db('app_settings')
      .whereIn('setting_key', ['branding_logo_url', 'branding_company_name'])
      .select('setting_key', 'setting_value');
    
    brandingSettings.forEach(setting => {
      if (setting.setting_key === 'branding_logo_url' && setting.setting_value) {
        try {
          logoUrl = JSON.parse(setting.setting_value);
        } catch (e) {
          logoUrl = setting.setting_value;
        }
      } else if (setting.setting_key === 'branding_company_name' && setting.setting_value) {
        try {
          companyName = JSON.parse(setting.setting_value);
        } catch (e) {
          companyName = setting.setting_value;
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching branding settings:', error);
  }

  // If no custom logo, use default PicPeak logo
  const apiUrl = process.env.API_URL || 'http://localhost:3001';
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3005';
  const logoFullUrl = logoUrl ? `${apiUrl}${logoUrl}` : `${frontendUrl}/picpeak-logo-transparent.png`;

  // Compile templates with Handlebars
  const subjectTemplate = Handlebars.compile(subject);
  const htmlTemplate = Handlebars.compile(htmlBody);
  const textTemplate = Handlebars.compile(textBody);
  
  // Process templates with processedVariables (includes formatted dates and security messages)
  subject = subjectTemplate(processedVariables);
  htmlBody = htmlTemplate(processedVariables);
  textBody = textTemplate(processedVariables);

  // Wrap HTML body in styled template
  const styledHtmlBody = `
<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #f5f5f5;
      color: #333;
    }
    .email-wrapper {
      background-color: #f5f5f5;
      padding: 40px 20px;
    }
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }
    .email-header {
      background-color: #5C8762;
      padding: 30px;
      text-align: center;
    }
    .logo {
      max-width: 180px;
      height: auto;
      margin-bottom: 10px;
    }
    .email-content {
      padding: 40px 30px;
    }
    .email-content h2 {
      color: #5C8762;
      margin-top: 0;
      margin-bottom: 20px;
      font-size: 24px;
    }
    .email-content p {
      line-height: 1.6;
      margin-bottom: 15px;
    }
    .email-content ul {
      background-color: #f9f9f9;
      padding: 20px 20px 20px 40px;
      border-radius: 5px;
      margin: 20px 0;
    }
    .email-content li {
      margin-bottom: 10px;
    }
    .button {
      display: inline-block;
      padding: 12px 30px;
      background-color: #5C8762;
      color: white !important;
      text-decoration: none;
      border-radius: 5px;
      font-weight: 500;
      margin: 20px 0;
    }
    .button:hover {
      background-color: #4a6f4f;
    }
    .email-footer {
      background-color: #f9f9f9;
      padding: 30px;
      text-align: center;
      border-top: 1px solid #eee;
    }
    .email-footer img {
      max-width: 120px;
      height: auto;
      margin-bottom: 15px;
      opacity: 0.8;
    }
    .email-footer p {
      color: #666;
      font-size: 14px;
      margin: 5px 0;
    }
    a {
      color: #5C8762;
      text-decoration: underline;
    }
    a:hover {
      color: #4a6f4f;
    }
    strong {
      color: #333;
    }
    @media only screen and (max-width: 600px) {
      .email-wrapper {
        padding: 20px 10px;
      }
      .email-content {
        padding: 30px 20px;
      }
      .email-header {
        padding: 20px;
      }
      .logo {
        max-width: 150px;
      }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="email-container">
      <div class="email-header">
        <img src="${logoFullUrl}" alt="${companyName}" class="logo">
      </div>
      <div class="email-content">
        ${htmlBody}
      </div>
      <div class="email-footer">
        <img src="${logoFullUrl}" alt="${companyName}">
        <p>${companyName}</p>
        <p style="font-size: 12px; color: #999;">© ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>`;

  return { subject, htmlBody: styledHtmlBody, textBody };
}

// Send email using template
async function sendTemplateEmail(to, templateKey, variables) {
  try {
    // Always check for configuration changes before sending
    transporter = await initializeTransporter();
    if (!transporter) {
      throw new Error('Email service not configured');
    }

    // Get email template
    const template = await db('email_templates')
      .where('template_key', templateKey)
      .first();
    
    if (!template) {
      throw new Error(`Email template '${templateKey}' not found`);
    }

    // Get email config for from address
    const config = await db('email_configs').first();
    if (!config) {
      throw new Error('Email configuration not found');
    }

    // Determine recipient language (pass eventId if available in variables)
    const language = await getRecipientLanguage(to, variables.eventId || null);
    
    // Process template with variables
    const { subject, htmlBody, textBody } = await processTemplate(template, variables, language);

    // Send email
    const info = await transporter.sendMail({
      from: `${config.from_name} <${config.from_email}>`,
      to: to,
      subject: subject,
      html: htmlBody,
      text: textBody || htmlBody.replace(/<[^>]*>/g, '') // Strip HTML if no text version
    });

    logger.info(`Email sent successfully: ${info.messageId} (${language})`);
    return { success: true, messageId: info.messageId, language };
  } catch (error) {
    logger.error('Error sending template email:', error);
    throw error;
  }
}

// Process email queue
async function processEmailQueue() {
  logger.info('Email queue processor: Checking for pending emails...');
  
  try {
    // Try to initialize transporter if it's null (in case it failed at startup)
    if (!transporter) {
      logger.info('Transporter not initialized, attempting to initialize...');
      transporter = await initializeTransporter();
      if (!transporter) {
        logger.warn('Email transporter could not be initialized, skipping queue processing');
        return;
      }
    }
    
    let pendingEmails = [];
    try {
      pendingEmails = await db('email_queue')
        .where('status', 'pending')
        .where('retry_count', '<', 3)
        .orderBy('created_at', 'asc')
        .limit(10);
    } catch (dbError) {
      logger.error('Failed to query email queue:', dbError);
      return;
    }
    
    if (pendingEmails.length === 0) {
      logger.info('Email queue processor: No pending emails found');
      return;
    }

    logger.info(`Processing ${pendingEmails.length} emails from queue`);
    
    for (const email of pendingEmails) {
      try {
        const emailData = typeof email.email_data === 'string' 
          ? JSON.parse(email.email_data || '{}')
          : email.email_data || {};
        
        await sendTemplateEmail(
          email.recipient_email,
          email.email_type,
          emailData
        );
        
        // Mark as sent
        await db('email_queue')
          .where('id', email.id)
          .update({
            status: 'sent',
            sent_at: new Date()
          });
          
        logger.info(`Email ${email.id} sent successfully`);
      } catch (error) {
        // Increment retry count
        try {
          await db('email_queue')
            .where('id', email.id)
            .update({
              retry_count: email.retry_count + 1,
              error_message: error.message
            });
        } catch (updateError) {
          logger.error(`Failed to update email retry count for ${email.id}:`, updateError);
          // If update fails due to column issue, try without any potential auto-added fields
          if (updateError.message && updateError.message.includes('updated_at')) {
            logger.warn('Detected updated_at column issue, attempting raw query...');
            await db.raw(
              'UPDATE email_queue SET retry_count = ?, error_message = ? WHERE id = ?',
              [email.retry_count + 1, error.message, email.id]
            );
          }
        }
          
        logger.error(`Failed to send email ${email.id}:`, error);
      }
    }
  } catch (error) {
    logger.error('Error processing email queue:', error);
  }
}

// Queue an email for sending
async function queueEmail(eventId, recipientEmail, emailType, emailData) {
  try {
    // Add eventId to emailData for language detection
    emailData.eventId = eventId;
    await db('email_queue').insert({
      event_id: eventId,
      recipient_email: recipientEmail,
      email_type: emailType,
      email_data: JSON.stringify(emailData),
      status: 'pending',
      retry_count: 0,
      created_at: new Date()
    });
    
    logger.info(`Email queued: ${emailType} to ${recipientEmail}`);
  } catch (error) {
    logger.error('Error queueing email:', error);
    throw error;
  }
}

// Test email connection
async function testEmailConnection() {
  try {
    if (!transporter) {
      await initializeTransporter();
    }
    if (!transporter) {
      return false;
    }
    await transporter.verify();
    return true;
  } catch (error) {
    logger.error('Email connection test failed:', error);
    return false;
  }
}

// Start email queue processor
let emailQueueInterval = null;

function startEmailQueueProcessor() {
  logger.info('Email queue processor: Attempting to start...');
  
  if (!emailQueueInterval) {
    // Process immediately on start
    processEmailQueue().catch(err => {
      logger.error('Email queue processor: Initial processing failed:', err);
    });
    
    // Then process every minute
    emailQueueInterval = setInterval(() => {
      processEmailQueue().catch(err => {
        logger.error('Email queue processor: Periodic processing failed:', err);
      });
    }, 60000);
    
    logger.info('Email queue processor started successfully');
  } else {
    logger.info('Email queue processor: Already running');
  }
}

function stopEmailQueueProcessor() {
  if (emailQueueInterval) {
    clearInterval(emailQueueInterval);
    emailQueueInterval = null;
    logger.info('Email queue processor stopped');
  }
}

// Initialize on module load - DISABLED for production startup
// This will be called from server.js after database is ready
// initializeTransporter().then(() => {
//   startEmailQueueProcessor();
// });

module.exports = {
  initializeTransporter,
  startEmailQueueProcessor,
  sendTemplateEmail,
  processEmailQueue,
  queueEmail,
  stopEmailQueueProcessor,
  testEmailConnection
};