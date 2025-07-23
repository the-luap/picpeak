const express = require('express');
const { db, withRetry } = require('../database/db');
const router = express.Router();

// Get public settings (branding and theme)
router.get('/', async (req, res) => {
  try {
    // Fetch branding, theme, general, and security settings
    // Note: We include analytics in the query but it might not exist yet
    const settings = await withRetry(async () => {
      return await db('app_settings')
        .where(function() {
          this.whereIn('setting_type', ['branding', 'theme', 'general', 'security', 'analytics'])
            .orWhere('setting_key', 'like', 'analytics_%');
        })
        .select('setting_key', 'setting_value');
    });
    
    // Convert to object format
    const settingsObject = {};
    settings.forEach(setting => {
      try {
        settingsObject[setting.setting_key] = setting.setting_value 
          ? JSON.parse(setting.setting_value) 
          : null;
      } catch (e) {
        // If parsing fails, use the raw value
        settingsObject[setting.setting_key] = setting.setting_value;
      }
    });

    // Return only safe public settings
    const publicSettings = {
      branding_company_name: settingsObject.branding_company_name || '',
      branding_company_tagline: settingsObject.branding_company_tagline || '',
      branding_support_email: settingsObject.branding_support_email || '',
      branding_footer_text: settingsObject.branding_footer_text || '',
      branding_watermark_enabled: settingsObject.branding_watermark_enabled || false,
      branding_watermark_logo_url: settingsObject.branding_watermark_logo_url || '',
      branding_watermark_position: settingsObject.branding_watermark_position || 'bottom-right',
      branding_watermark_opacity: settingsObject.branding_watermark_opacity || 50,
      branding_watermark_size: settingsObject.branding_watermark_size || 15,
      branding_favicon_url: settingsObject.branding_favicon_url || '',
      branding_logo_url: settingsObject.branding_logo_url || '',
      theme_config: settingsObject.theme_config || null,
      default_language: settingsObject.general_default_language || 'en',
      enable_analytics: settingsObject.general_enable_analytics !== false,
      general_date_format: settingsObject.general_date_format || 'PPP',
      enable_recaptcha: settingsObject.security_enable_recaptcha === true || settingsObject.security_enable_recaptcha === 'true',
      recaptcha_site_key: settingsObject.security_recaptcha_site_key || null,
      maintenance_mode: settingsObject.general_maintenance_mode === true || settingsObject.general_maintenance_mode === 'true',
      // Umami analytics configuration (only if enabled)
      umami_enabled: settingsObject.analytics_umami_enabled === true || settingsObject.analytics_umami_enabled === 'true',
      umami_url: (settingsObject.analytics_umami_enabled === true || settingsObject.analytics_umami_enabled === 'true') ? (settingsObject.analytics_umami_url || null) : null,
      umami_website_id: (settingsObject.analytics_umami_enabled === true || settingsObject.analytics_umami_enabled === 'true') ? (settingsObject.analytics_umami_website_id || null) : null,
      umami_share_url: (settingsObject.analytics_umami_enabled === true || settingsObject.analytics_umami_enabled === 'true') ? (settingsObject.analytics_umami_share_url || null) : null
    };

    res.json(publicSettings);
  } catch (error) {
    console.error('Public settings fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

module.exports = router;