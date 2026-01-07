const express = require('express');
const nodemailer = require('nodemailer');
const { body, validationResult } = require('express-validator');
const { db, logActivity } = require('../database/db');
const { adminAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const router = express.Router();

// Get email configuration
router.get('/config', adminAuth, requirePermission('email.view'), async (req, res) => {
  try {
    const config = await db('email_configs').first();
    
    if (!config) {
      return res.json({
        smtp_host: '',
        smtp_port: 587,
        smtp_secure: false,
        smtp_user: '',
        smtp_pass: '', // Don't send actual password
        from_email: '',
        from_name: '',
        tls_reject_unauthorized: true
      });
    }

    // Don't send the actual password
    res.json({
      ...config,
      smtp_pass: config.smtp_pass ? '********' : ''
    });
  } catch (error) {
    console.error('Email config fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch email configuration' });
  }
});

// Update email configuration
router.post('/config', [
  adminAuth,
  requirePermission('email.edit'),
  body('smtp_host').notEmpty().withMessage('SMTP host is required'),
  body('smtp_port').isInt({ min: 1, max: 65535 }).withMessage('Invalid port number'),
  body('from_email').isEmail().withMessage('Invalid from email address')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      smtp_host,
      smtp_port,
      smtp_secure,
      smtp_user,
      smtp_pass,
      from_email,
      from_name,
      tls_reject_unauthorized
    } = req.body;

    // Check if config exists
    const existingConfig = await db('email_configs').first();
    
    const configData = {
      smtp_host,
      smtp_port: parseInt(smtp_port),
      smtp_secure: smtp_secure || false,
      smtp_user: smtp_user || '',
      from_email,
      from_name: from_name || 'Photo Sharing',
      tls_reject_unauthorized: tls_reject_unauthorized !== false, // Default to true
      updated_at: new Date()
    };

    // Only update password if provided and not masked
    if (smtp_pass && smtp_pass !== '********') {
      configData.smtp_pass = smtp_pass;
    }

    if (existingConfig) {
      await db('email_configs')
        .where('id', existingConfig.id)
        .update(configData);
    } else {
      await db('email_configs').insert(configData);
    }

    // Log activity
    await logActivity('email_config_updated', 
      { smtp_host, from_email }, 
      null, 
      { type: 'admin', id: req.admin.id, name: req.admin.username }
    );

    res.json({ message: 'Email configuration updated successfully' });
  } catch (error) {
    console.error('Email config update error:', error);
    res.status(500).json({ error: 'Failed to update email configuration' });
  }
});

// Test email configuration
router.post('/test', adminAuth, requirePermission('email.send'), async (req, res) => {
  try {
    const { test_email } = req.body;
    
    if (!test_email) {
      return res.status(400).json({ error: 'Test email address is required' });
    }

    // Get email config
    const config = await db('email_configs').first();
    
    if (!config) {
      return res.status(400).json({ error: 'Email configuration not found. Please configure SMTP settings first.' });
    }

    // Validate SMTP configuration
    if (!config.smtp_host || !config.smtp_port) {
      return res.status(400).json({ 
        error: 'Incomplete email configuration',
        details: 'SMTP host and port are required'
      });
    }
    
    // Check if password might be masked (this shouldn't happen when fetching from DB)
    if (config.smtp_pass === '********') {
      return res.status(400).json({
        error: 'Invalid email configuration',
        details: 'SMTP password appears to be masked. Please reconfigure your email settings.'
      });
    }

    // Create transporter with detailed logging
    const transportConfig = {
      host: config.smtp_host,
      port: parseInt(config.smtp_port),
      secure: config.smtp_secure === true || config.smtp_secure === 1,
      auth: config.smtp_user && config.smtp_pass ? {
        user: config.smtp_user,
        pass: config.smtp_pass
      } : undefined,
      tls: {
        // Allow ignoring SSL certificate errors when tls_reject_unauthorized is false
        rejectUnauthorized: config.tls_reject_unauthorized !== false
      },
      logger: process.env.NODE_ENV === 'development',
      debug: process.env.NODE_ENV === 'development'
    };

    console.log('Creating email transporter with config:', {
      host: transportConfig.host,
      port: transportConfig.port,
      secure: transportConfig.secure,
      auth: transportConfig.auth ? 'configured' : 'none'
    });

    const transporter = nodemailer.createTransport(transportConfig);

    // Send test email
    await transporter.sendMail({
      from: `${config.from_name} <${config.from_email}>`,
      to: test_email,
      subject: 'Test Email - Photo Sharing Platform',
      html: `
        <h2>Test Email Successful!</h2>
        <p>This is a test email from your Photo Sharing platform.</p>
        <p>If you're seeing this, your email configuration is working correctly.</p>
        <hr>
        <p style="color: #666; font-size: 12px;">
          Sent from: ${config.from_email}<br>
          SMTP Host: ${config.smtp_host}<br>
          Time: ${new Date().toISOString()}
        </p>
      `,
      text: 'Test Email Successful! Your email configuration is working correctly.'
    });

    res.json({ message: 'Test email sent successfully' });
  } catch (error) {
    console.error('Test email error:', error);
    console.error('Error stack:', error.stack);

    // Provide more specific error messages with translation keys
    let errorMessage = 'Error sending email';
    let errorKey = 'email.errors.sendFailed';
    let details = error.message;
    let detailsKey = 'email.errors.unknownError';

    if (error.code === 'ECONNREFUSED') {
      errorMessage = 'Failed to connect to SMTP server';
      errorKey = 'email.errors.connectionRefused';
      details = 'Please check your SMTP host and port settings';
      detailsKey = 'email.errors.checkHostPort';
    } else if (error.code === 'EAUTH') {
      errorMessage = 'SMTP authentication failed';
      errorKey = 'email.errors.authFailed';
      details = 'Please check your SMTP username and password';
      detailsKey = 'email.errors.checkCredentials';
    } else if (error.code === 'ESOCKET') {
      errorMessage = 'Network error connecting to SMTP server';
      errorKey = 'email.errors.networkError';
      details = 'Could not establish connection to SMTP server';
      detailsKey = 'email.errors.connectionFailed';
    } else if (error.code === 'ETIMEDOUT') {
      errorMessage = 'Connection to SMTP server timed out';
      errorKey = 'email.errors.timeout';
      details = 'The server took too long to respond. Please check your network and SMTP settings.';
      detailsKey = 'email.errors.timeoutDetails';
    } else if (error.code === 'ENOTFOUND') {
      errorMessage = 'SMTP server not found';
      errorKey = 'email.errors.serverNotFound';
      details = 'The SMTP host could not be resolved. Please verify the hostname.';
      detailsKey = 'email.errors.checkHostname';
    } else if (error.responseCode >= 500) {
      errorMessage = 'SMTP server error';
      errorKey = 'email.errors.serverError';
      details = `Server returned error code ${error.responseCode}`;
      detailsKey = 'email.errors.serverErrorDetails';
    } else if (error.responseCode >= 400) {
      errorMessage = 'Email rejected by server';
      errorKey = 'email.errors.rejected';
      details = error.response || 'The email was rejected. Check recipient address and settings.';
      detailsKey = 'email.errors.rejectedDetails';
    }

    res.status(500).json({
      error: errorMessage,
      errorKey: errorKey,
      details: details,
      detailsKey: detailsKey,
      code: error.code,
      responseCode: error.responseCode
    });
  }
});

// Get email templates
router.get('/templates', adminAuth, requirePermission('email.view'), async (req, res) => {
  try {
    const templates = await db('email_templates')
      .select('*')
      .orderBy('template_key');

    // Parse variables JSON and format for multi-language support
    const formattedTemplates = templates.map(template => {
      const result = {
        id: template.id,
        template_key: template.template_key,
        variables: (() => {
          try {
            if (!template.variables) return [];
            if (typeof template.variables === 'object') return template.variables;
            return JSON.parse(template.variables);
          } catch (e) {
            console.warn('Failed to parse variables for template:', template.template_key, e.message);
            return [];
          }
        })(),
        updated_at: template.updated_at
      };
      
      // Handle both old and new schema formats
      if (template.subject_en !== undefined) {
        // New schema with language columns
        result.subject_en = template.subject_en;
        result.body_html_en = template.body_html_en;
        result.body_text_en = template.body_text_en;
        result.subject_de = template.subject_de;
        result.body_html_de = template.body_html_de;
        result.body_text_de = template.body_text_de;
      } else {
        // Old schema - use basic columns for both languages
        result.subject_en = template.subject;
        result.body_html_en = template.body_html;
        result.body_text_en = template.body_text;
        result.subject_de = template.subject;
        result.body_html_de = template.body_html;
        result.body_text_de = template.body_text;
      }
      
      return result;
    });

    res.json(formattedTemplates);
  } catch (error) {
    console.error('Email templates fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch email templates' });
  }
});

// Get single template
router.get('/templates/:key', adminAuth, requirePermission('email.view'), async (req, res) => {
  try {
    const template = await db('email_templates')
      .where('template_key', req.params.key)
      .first();

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Handle both old and new schema formats
    const response = {
      id: template.id,
      template_key: template.template_key,
      variables: (() => {
        try {
          if (!template.variables) return [];
          if (typeof template.variables === 'object') return template.variables;
          return JSON.parse(template.variables);
        } catch (e) {
          console.warn('Failed to parse variables for template:', template.template_key, e.message);
          return [];
        }
      })(),
      updated_at: template.updated_at
    };
    
    // Check which columns exist and use them appropriately
    if (template.subject_en !== undefined) {
      // New schema with language columns
      response.subject_en = template.subject_en;
      response.body_html_en = template.body_html_en;
      response.body_text_en = template.body_text_en;
      response.subject_de = template.subject_de;
      response.body_html_de = template.body_html_de;
      response.body_text_de = template.body_text_de;
    } else {
      // Old schema - use basic columns for both languages
      response.subject_en = template.subject;
      response.body_html_en = template.body_html;
      response.body_text_en = template.body_text;
      response.subject_de = template.subject;
      response.body_html_de = template.body_html;
      response.body_text_de = template.body_text;
    }
    
    res.json(response);
  } catch (error) {
    console.error('Email template fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch email template' });
  }
});

// Update email template
router.put('/templates/:key', [
  adminAuth,
  requirePermission('email.edit'),
  body('subject_en').optional().notEmpty().withMessage('English subject cannot be empty'),
  body('subject_de').optional().notEmpty().withMessage('German subject cannot be empty'),
  body('body_html_en').optional().notEmpty().withMessage('English HTML body cannot be empty'),
  body('body_html_de').optional().notEmpty().withMessage('German HTML body cannot be empty')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      subject_en, subject_de,
      body_html_en, body_html_de,
      body_text_en, body_text_de
    } = req.body;

    const updateData = {
      updated_at: new Date()
    };

    // Check which columns exist in the database
    const template = await db('email_templates')
      .where('template_key', req.params.key)
      .first();
      
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Determine schema type and update accordingly
    if (template.subject_en !== undefined) {
      // New schema with language columns
      if (subject_en !== undefined) updateData.subject_en = subject_en;
      if (subject_de !== undefined) updateData.subject_de = subject_de;
      if (body_html_en !== undefined) updateData.body_html_en = body_html_en;
      if (body_html_de !== undefined) updateData.body_html_de = body_html_de;
      if (body_text_en !== undefined) updateData.body_text_en = body_text_en || '';
      if (body_text_de !== undefined) updateData.body_text_de = body_text_de || '';
      
      // Also update basic columns if they exist
      if (template.subject !== undefined) {
        updateData.subject = subject_en || updateData.subject_en;
        updateData.body_html = body_html_en || updateData.body_html_en;
        updateData.body_text = body_text_en || updateData.body_text_en || '';
      }
    } else {
      // Old schema - only update basic columns
      if (subject_en !== undefined) {
        updateData.subject = subject_en;
        updateData.body_html = body_html_en;
        updateData.body_text = body_text_en || '';
      }
    }

    const updated = await db('email_templates')
      .where('template_key', req.params.key)
      .update(updateData);

    if (!updated) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Log activity
    await logActivity('email_template_updated',
      { template_key: req.params.key },
      null,
      { type: 'admin', id: req.admin.id, name: req.admin.username }
    );

    res.json({ message: 'Email template updated successfully' });
  } catch (error) {
    console.error('Email template update error:', error);
    res.status(500).json({ error: 'Failed to update email template' });
  }
});

// Preview email template
router.post('/templates/:key/preview', adminAuth, requirePermission('email.view'), async (req, res) => {
  try {
    const template = await db('email_templates')
      .where('template_key', req.params.key)
      .first();

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const { preview_data, language = 'en' } = req.body;
    
    // Get the appropriate language version
    const subjectField = language === 'de' && template.subject_de ? 'subject_de' : 'subject_en';
    const htmlField = language === 'de' && template.body_html_de ? 'body_html_de' : 'body_html_en';
    const textField = language === 'de' && template.body_text_de ? 'body_text_de' : 'body_text_en';
    
    // Handle backward compatibility
    let htmlContent = template[htmlField] || template.body_html || '';
    let textContent = template[textField] || template.body_text || '';
    let subject = template[subjectField] || template.subject || '';

    if (preview_data) {
      Object.keys(preview_data).forEach(key => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        htmlContent = htmlContent.replace(regex, preview_data[key]);
        textContent = textContent.replace(regex, preview_data[key]);
        subject = subject.replace(regex, preview_data[key]);
      });
    }

    res.json({
      subject,
      body_html: htmlContent,
      body_text: textContent,
      language
    });
  } catch (error) {
    console.error('Email template preview error:', error);
    res.status(500).json({ error: 'Failed to preview email template' });
  }
});

module.exports = router;