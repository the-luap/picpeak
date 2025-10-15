const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { body, validationResult } = require('express-validator');
const { db, logActivity } = require('../database/db');
const { formatBoolean } = require('../utils/dbCompat');
const { adminAuth } = require('../middleware/auth');
const { clearMaintenanceCache } = require('../middleware/maintenance');
const { clearSettingsCache } = require('../services/rateLimitService');
const {
  DEFAULT_PUBLIC_SITE_HTML,
  DEFAULT_PUBLIC_SITE_CSS,
} = require('../constants/publicSiteDefaults');
const {
  clearPublicSiteCache,
  getDefaultPublicSitePayload,
  getRawPublicSiteSettings,
} = require('../services/publicSiteService');
const { sanitizeCss } = require('../utils/cssSanitizer');
const { clearShareLinkSettingsCache } = require('../services/shareLinkService');
const router = express.Router();
const { clearMaxFilesPerUploadCache, MAX_ALLOWED_FILES_PER_UPLOAD } = require('../services/uploadSettings');

const getStoragePath = () => process.env.STORAGE_PATH || path.join(__dirname, '../../../storage');

// Configure multer for logo uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(getStoragePath(), 'uploads/logos');
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `logo-${Date.now()}${ext}`);
  }
});

const { validateFileType } = require('../utils/fileSecurityUtils');

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    // Note: SVG files are excluded from magic number validation for logos
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml'];
    
    if (validateFileType(file.originalname, file.mimetype, allowedMimeTypes)) {
      return cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, GIF and SVG image files are allowed'));
    }
  }
});

// Configure multer for favicon uploads
const faviconStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(getStoragePath(), 'uploads/favicons');
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `favicon-${Date.now()}${ext}`);
  }
});

const faviconUpload = multer({
  storage: faviconStorage,
  limits: { fileSize: 1 * 1024 * 1024 }, // 1MB
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ['image/png', 'image/x-icon', 'image/vnd.microsoft.icon'];
    
    // For ICO files, we can't use the standard validateFileType
    if (file.mimetype === 'image/png') {
      if (validateFileType(file.originalname, file.mimetype, ['image/png'])) {
        cb(null, true);
      } else {
        cb(new Error('Invalid PNG file'));
      }
    } else if (allowedMimeTypes.includes(file.mimetype) && 
               (file.originalname.toLowerCase().endsWith('.ico') || 
                file.originalname.toLowerCase().endsWith('.png'))) {
      cb(null, true);
    } else {
      cb(new Error('Favicon must be PNG or ICO format'));
    }
  }
});

// Get all settings
router.get('/', adminAuth, async (req, res) => {
  try {
    const settings = await db('app_settings').select('*');
    
    // Convert to object format
    const settingsObject = {};
    settings.forEach(setting => {
      if (setting.setting_value) {
        try {
          // Try to parse as JSON first
          settingsObject[setting.setting_key] = JSON.parse(setting.setting_value);
        } catch (e) {
          // If it's not valid JSON, use the raw value
          settingsObject[setting.setting_key] = setting.setting_value;
        }
      } else {
        settingsObject[setting.setting_key] = null;
      }
    });

    res.json(settingsObject);
  } catch (error) {
    console.error('Settings fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Get settings by type
router.get('/:type', adminAuth, async (req, res) => {
  try {
    const { type } = req.params;
    const settings = await db('app_settings')
      .where('setting_type', type)
      .select('*');
    
    // Convert to object format
    const settingsObject = {};
    settings.forEach(setting => {
      if (setting.setting_value) {
        try {
          // Try to parse as JSON first
          settingsObject[setting.setting_key] = JSON.parse(setting.setting_value);
        } catch (e) {
          // If it's not valid JSON, use the raw value
          settingsObject[setting.setting_key] = setting.setting_value;
        }
      } else {
        settingsObject[setting.setting_key] = null;
      }
    });

    res.json(settingsObject);
  } catch (error) {
    console.error('Settings fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Get password complexity settings for frontend
router.get('/password/complexity', adminAuth, async (req, res) => {
  try {
    const { getPasswordComplexitySettings, getPasswordConfigForComplexity } = require('../utils/passwordValidation');
    
    // Get current complexity level from database
    const complexityLevel = await getPasswordComplexitySettings();
    
    // Get configuration for the complexity level
    const config = getPasswordConfigForComplexity(complexityLevel);
    
    res.json({
      complexityLevel,
      config
    });
  } catch (error) {
    console.error('Password complexity settings fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch password complexity settings' });
  }
});

// Update branding settings
router.put('/branding', adminAuth, async (req, res) => {
  try {
    const {
      company_name,
      company_tagline,
      support_email,
      footer_text,
      watermark_enabled,
      watermark_position,
      watermark_opacity,
      watermark_size,
      favicon_url,
      logo_url,
      watermark_logo_url,
      logo_size,
      logo_max_height,
      logo_position,
      logo_display_header,
      logo_display_hero,
      logo_display_mode
    } = req.body;

    const brandingSettings = {
      company_name,
      company_tagline,
      support_email,
      footer_text,
      watermark_enabled,
      watermark_position,
      watermark_opacity,
      watermark_size,
      favicon_url,
      logo_url,
      watermark_logo_url,
      logo_size,
      logo_max_height,
      logo_position,
      logo_display_header,
      logo_display_hero,
      logo_display_mode
    };

    // Handle favicon deletion if empty string or null is provided
    if (favicon_url === '' || favicon_url === null || favicon_url === undefined) {
      // Get current favicon path to delete file
      const currentFaviconSetting = await db('app_settings')
        .where('setting_key', 'branding_favicon_url')
        .first();
      
      if (currentFaviconSetting && currentFaviconSetting.setting_value) {
        let currentFaviconUrl;
        try {
          // Try to parse as JSON first
          currentFaviconUrl = JSON.parse(currentFaviconSetting.setting_value);
        } catch (e) {
          // If it's not valid JSON, use the raw value
          currentFaviconUrl = currentFaviconSetting.setting_value;
        }
        
        if (currentFaviconUrl && typeof currentFaviconUrl === 'string' && currentFaviconUrl.startsWith('/uploads/favicons/')) {
          // Delete the file from filesystem
          const relativePath = currentFaviconUrl.replace(/^\//, '');
          const faviconPath = path.join(getStoragePath(), relativePath);
          try {
            await fs.unlink(faviconPath);
            console.log('Deleted favicon file:', faviconPath);
          } catch (err) {
            console.error('Error deleting favicon file:', err);
          }
        }
      }
    }

    // Handle logo deletion if empty string or null is provided
    if (logo_url === '' || logo_url === null || logo_url === undefined) {
      // Get current logo path to delete file
      const currentLogoSetting = await db('app_settings')
        .where('setting_key', 'branding_logo_url')
        .first();
      
      if (currentLogoSetting && currentLogoSetting.setting_value) {
        let currentLogoUrl;
        try {
          // Try to parse as JSON first
          currentLogoUrl = JSON.parse(currentLogoSetting.setting_value);
        } catch (e) {
          // If it's not valid JSON, use the raw value
          currentLogoUrl = currentLogoSetting.setting_value;
        }
        
        if (currentLogoUrl && typeof currentLogoUrl === 'string' && currentLogoUrl.startsWith('/uploads/logos/')) {
          // Delete the file from filesystem
          const relativePath = currentLogoUrl.replace(/^\//, '');
          const logoPath = path.join(getStoragePath(), relativePath);
          try {
            await fs.unlink(logoPath);
            console.log('Deleted logo file:', logoPath);
          } catch (err) {
            console.error('Error deleting logo file:', err);
          }
        }
      }
    }

    // Update or insert each setting
    for (const [key, value] of Object.entries(brandingSettings)) {
      await db('app_settings')
        .insert({
          setting_key: `branding_${key}`,
          setting_value: JSON.stringify(value),
          setting_type: 'branding',
          updated_at: new Date()
        })
        .onConflict('setting_key')
        .merge({
          setting_value: JSON.stringify(value),
          updated_at: new Date()
        });
    }

    // Log activity
    await db('activity_logs').insert({
      activity_type: 'branding_updated',
      actor_type: 'admin',
      actor_id: req.admin.id,
      actor_name: req.admin.username,
      metadata: JSON.stringify({ company_name })
    });

    clearPublicSiteCache();

    res.json({ message: 'Branding settings updated successfully' });
  } catch (error) {
    console.error('Branding update error:', error);
    res.status(500).json({ error: 'Failed to update branding settings' });
  }
});

// Upload logo
router.post('/logo', adminAuth, upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No logo file uploaded' });
    }

    // Get old logo to delete
    const oldLogoSetting = await db('app_settings')
      .where('setting_key', 'branding_logo_path')
      .first();

    if (oldLogoSetting && oldLogoSetting.setting_value) {
      const oldPath = JSON.parse(oldLogoSetting.setting_value);
      try {
        await fs.unlink(oldPath);
      } catch (error) {
        console.error('Failed to delete old logo:', error);
      }
    }

    // Save new logo path
    const logoPath = req.file.path;
    const publicPath = `/uploads/logos/${req.file.filename}`;

    await db('app_settings')
      .insert({
        setting_key: 'branding_logo_path',
        setting_value: JSON.stringify(logoPath),
        setting_type: 'branding',
        updated_at: new Date()
      })
      .onConflict('setting_key')
      .merge({
        setting_value: JSON.stringify(logoPath),
        updated_at: new Date()
      });

    // Save public URL
    await db('app_settings')
      .insert({
        setting_key: 'branding_logo_url',
        setting_value: publicPath,
        setting_type: 'branding',
        updated_at: new Date()
      })
      .onConflict('setting_key')
      .merge({
        setting_value: publicPath,
        updated_at: new Date()
      });

    res.json({ 
      message: 'Logo uploaded successfully',
      logoUrl: publicPath
    });
  } catch (error) {
    console.error('Logo upload error:', error);
    res.status(500).json({ error: 'Failed to upload logo' });
  }
});

// Upload watermark logo
router.post('/branding/watermark-logo', adminAuth, upload.single('watermarkLogo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Delete old watermark logo if exists
    const oldWatermarkLogoSetting = await db('app_settings')
      .where('setting_key', 'branding_watermark_logo_path')
      .first();

    if (oldWatermarkLogoSetting && oldWatermarkLogoSetting.setting_value) {
      const oldPath = JSON.parse(oldWatermarkLogoSetting.setting_value);
      try {
        await fs.unlink(oldPath);
      } catch (error) {
        console.error('Failed to delete old watermark logo:', error);
      }
    }

    // Save new watermark logo path
    const logoPath = req.file.path;
    const publicPath = `/uploads/logos/${req.file.filename}`;

    await db('app_settings')
      .insert({
        setting_key: 'branding_watermark_logo_path',
        setting_value: JSON.stringify(logoPath),
        setting_type: 'branding',
        updated_at: new Date()
      })
      .onConflict('setting_key')
      .merge({
        setting_value: JSON.stringify(logoPath),
        updated_at: new Date()
      });

    // Save public URL
    await db('app_settings')
      .insert({
        setting_key: 'branding_watermark_logo_url',
        setting_value: publicPath,
        setting_type: 'branding',
        updated_at: new Date()
      })
      .onConflict('setting_key')
      .merge({
        setting_value: publicPath,
        updated_at: new Date()
      });

    res.json({ 
      message: 'Watermark logo uploaded successfully',
      watermarkLogoUrl: publicPath
    });
  } catch (error) {
    console.error('Watermark logo upload error:', error);
    res.status(500).json({ error: 'Failed to upload watermark logo' });
  }
});

// Update theme settings
router.put('/theme', adminAuth, async (req, res) => {
  try {
    const themeSettings = req.body;

    // Save theme settings
    await db('app_settings')
      .insert({
        setting_key: 'theme_config',
        setting_value: JSON.stringify(themeSettings),
        setting_type: 'theme',
        updated_at: new Date()
      })
      .onConflict('setting_key')
      .merge({
        setting_value: JSON.stringify(themeSettings),
        updated_at: new Date()
      });

    // Log activity
    await db('activity_logs').insert({
      activity_type: 'theme_updated',
      actor_type: 'admin',
      actor_id: req.admin.id,
      actor_name: req.admin.username,
      metadata: JSON.stringify({ theme_name: themeSettings.name || 'custom' })
    });

    clearPublicSiteCache();

    res.json({ message: 'Theme settings updated successfully' });
  } catch (error) {
    console.error('Theme update error:', error);
    res.status(500).json({ error: 'Failed to update theme settings' });
  }
});

// Update general settings
router.put('/general', adminAuth, async (req, res) => {
  try {
    const settings = { ...req.body };
    let uploadLimitTouched = false;

    const publicSiteKeysTouched = Object.keys(settings).some((key) => key.startsWith('general_public_site_'));

    if (Object.prototype.hasOwnProperty.call(settings, 'general_max_files_per_upload')) {
      uploadLimitTouched = true;
      const rawValue = Number(settings.general_max_files_per_upload);
      const normalizedValue = Number.isFinite(rawValue) ? Math.floor(rawValue) : NaN;

      if (!Number.isInteger(normalizedValue) || normalizedValue < 1 || normalizedValue > MAX_ALLOWED_FILES_PER_UPLOAD) {
        return res.status(400).json({
          error: `general_max_files_per_upload must be an integer between 1 and ${MAX_ALLOWED_FILES_PER_UPLOAD}`
        });
      }

      settings.general_max_files_per_upload = normalizedValue;
    }

    if (publicSiteKeysTouched) {
      if (Object.prototype.hasOwnProperty.call(settings, 'general_public_site_custom_css')) {
        settings.general_public_site_custom_css = sanitizeCss(settings.general_public_site_custom_css || '');
      }

      if (Object.prototype.hasOwnProperty.call(settings, 'general_public_site_html') && typeof settings.general_public_site_html === 'string') {
        settings.general_public_site_html = settings.general_public_site_html.trim();
      }

      if (Object.prototype.hasOwnProperty.call(settings, 'general_public_site_enabled')) {
        settings.general_public_site_enabled = formatBoolean(settings.general_public_site_enabled);
      }

      const enableToggle = settings.general_public_site_enabled;
      if (enableToggle === true) {
        let htmlValue = settings.general_public_site_html;

        if (htmlValue === undefined) {
          const currentSettings = await getRawPublicSiteSettings();
          htmlValue = currentSettings.general_public_site_html;
        }

        if (!htmlValue || !String(htmlValue).trim()) {
          return res.status(400).json({
            error: 'Public site HTML must be provided before enabling the public landing page.'
          });
        }
      }
    }

    // Update or insert each setting
    for (const [key, value] of Object.entries(settings)) {
      await db('app_settings')
        .insert({
          setting_key: key,
          setting_value: JSON.stringify(value),
          setting_type: 'general',
          updated_at: new Date()
        })
        .onConflict('setting_key')
        .merge({
          setting_value: JSON.stringify(value),
          updated_at: new Date()
        });
    }
    
    // Clear maintenance mode cache if it was updated
    if ('general_maintenance_mode' in settings) {
      clearMaintenanceCache();
    }

    if (publicSiteKeysTouched) {
      clearPublicSiteCache();
    }
    if (uploadLimitTouched) {
      clearMaxFilesPerUploadCache();
    }
    if (Object.prototype.hasOwnProperty.call(settings, 'general_short_gallery_urls')) {
      clearShareLinkSettingsCache();
    }

    // Log activity
    await db('activity_logs').insert({
      activity_type: 'general_settings_updated',
      actor_type: 'admin',
      actor_id: req.admin.id,
      actor_name: req.admin.username,
      metadata: JSON.stringify({ settings_count: Object.keys(settings).length })
    });

    res.json({ message: 'General settings updated successfully' });
  } catch (error) {
    console.error('General settings update error:', error);
    res.status(500).json({ error: 'Failed to update general settings' });
  }
});

// Update security settings
router.put('/security', adminAuth, async (req, res) => {
  try {
    const settings = req.body;

    // Update or insert each setting
    for (const [key, value] of Object.entries(settings)) {
      await db('app_settings')
        .insert({
          setting_key: key,
          setting_value: JSON.stringify(value),
          setting_type: 'security',
          updated_at: new Date()
        })
        .onConflict('setting_key')
        .merge({
          setting_value: JSON.stringify(value),
          updated_at: new Date()
        });
    }

    // Log activity
    await db('activity_logs').insert({
      activity_type: 'security_settings_updated',
      actor_type: 'admin',
      actor_id: req.admin.id,
      actor_name: req.admin.username,
      metadata: JSON.stringify({ settings_count: Object.keys(settings).length })
    });

    res.json({ message: 'Security settings updated successfully' });
  } catch (error) {
    console.error('Security settings update error:', error);
    res.status(500).json({ error: 'Failed to update security settings' });
  }
});

// Update analytics settings
router.put('/analytics', adminAuth, async (req, res) => {
  try {
    const settings = req.body;

    // Update or insert each setting
    for (const [key, value] of Object.entries(settings)) {
      await db('app_settings')
        .insert({
          setting_key: key,
          setting_value: JSON.stringify(value),
          setting_type: 'analytics',
          updated_at: new Date()
        })
        .onConflict('setting_key')
        .merge({
          setting_value: JSON.stringify(value),
          updated_at: new Date()
        });
    }

    // Log activity
    await db('activity_logs').insert({
      activity_type: 'analytics_settings_updated',
      actor_type: 'admin',
      actor_id: req.admin.id,
      actor_name: req.admin.username,
      metadata: JSON.stringify({ settings_count: Object.keys(settings).length })
    });

    res.json({ message: 'Analytics settings updated successfully' });
  } catch (error) {
    console.error('Analytics settings update error:', error);
    res.status(500).json({ error: 'Failed to update analytics settings' });
  }
});

// Get storage info
router.get('/storage/info', adminAuth, async (req, res) => {
  try {
    // Get total storage used
    const totalStorage = await db('photos')
      .sum('size_bytes as total')
      .first();

    // Get storage by event
    const storageByEvent = await db('photos')
      .select('events.event_name', 'events.id')
      .sum('photos.size_bytes as size')
      .join('events', 'photos.event_id', 'events.id')
      .groupBy('events.id')
      .orderBy('size', 'desc')
      .limit(10);

    // Get archive storage
    const archives = await db('events')
      .where('is_archived', formatBoolean(true))
      .whereNotNull('archive_path')
      .select('archive_path');

    let archiveStorage = 0;
    for (const archive of archives) {
      if (archive.archive_path) {
        try {
          const storagePath = getStoragePath();
          const fullArchivePath = path.join(storagePath, archive.archive_path);
          const stats = await fs.stat(fullArchivePath);
          archiveStorage += stats.size;
        } catch (error) {
          console.error('Archive file not found:', archive.archive_path, error.message);
        }
      }
    }

    const DEFAULT_SOFT_LIMIT_BYTES = 10 * 1024 * 1024 * 1024; // 10GB fallback
    const storagePath = getStoragePath();

    let diskStats = null;
    let rawDiskTotal = null;
    let rawDiskFree = null;
    let rawDiskAvailable = null;
    try {
      diskStats = await fs.statfs(storagePath);
      rawDiskTotal = Number(diskStats.bsize) * Number(diskStats.blocks);
      rawDiskFree = Number(diskStats.bsize) * Number(diskStats.bfree);
      rawDiskAvailable = Number(diskStats.bsize) * Number(diskStats.bavail);
    } catch (diskError) {
      console.error('Disk stats error:', diskError.message);
    }

    const clampDiskValue = (value) => {
      if (!Number.isFinite(value) || value <= 0) {
        return null;
      }

      // Treat unusually large virtualised values as unreliable (>50TB)
      const MAX_REASONABLE_BYTES = 50 * 1024 * 1024 * 1024 * 1024;
      if (value > MAX_REASONABLE_BYTES) {
        return null;
      }

      return value;
    };

    let diskTotal = null;
    let diskFree = null;
    let diskAvailable = null;

    if (diskStats) {
      diskTotal = clampDiskValue(rawDiskTotal);
      diskFree = clampDiskValue(rawDiskFree);
      diskAvailable = clampDiskValue(rawDiskAvailable);

      if (diskTotal && diskAvailable && diskAvailable > diskTotal) {
        diskAvailable = null;
      }
      if (diskTotal && diskFree && diskFree > diskTotal) {
        diskFree = null;
      }
    }

    const totalUsed = totalStorage?.total || 0;

    const parseBytesValue = (value) => {
      const numeric = Number(value);
      if (!Number.isFinite(numeric) || numeric <= 0) {
        return null;
      }
      return Math.floor(numeric);
    };

    const parseEnvOverride = (bytesVar, gbVar) => {
      if (process.env[bytesVar]) {
        return parseBytesValue(process.env[bytesVar]);
      }
      if (process.env[gbVar]) {
        const value = parseBytesValue(process.env[gbVar]);
        return value ? value * 1024 * 1024 * 1024 : null;
      }
      return null;
    };

    let configuredSoftLimit = null;
    let capacityOverrideDb = null;
    let availableOverrideDb = null;

    try {
      const storageSettings = await db('app_settings')
        .whereIn('setting_key', [
          'general_storage_soft_limit_bytes',
          'general_storage_capacity_override_bytes',
          'general_storage_available_override_bytes'
        ])
        .select('setting_key', 'setting_value');

      storageSettings.forEach((setting) => {
        let parsedValue = null;
        if (setting.setting_value) {
          try {
            parsedValue = JSON.parse(setting.setting_value);
          } catch (error) {
            parsedValue = setting.setting_value;
          }
        }

        switch (setting.setting_key) {
          case 'general_storage_soft_limit_bytes':
            if (typeof parsedValue === 'number' && !Number.isNaN(parsedValue)) {
              configuredSoftLimit = parsedValue;
            }
            break;
          case 'general_storage_capacity_override_bytes':
            if (typeof parsedValue === 'number' && !Number.isNaN(parsedValue)) {
              capacityOverrideDb = parsedValue;
            }
            break;
          case 'general_storage_available_override_bytes':
            if (typeof parsedValue === 'number' && !Number.isNaN(parsedValue)) {
              availableOverrideDb = parsedValue;
            }
            break;
          default:
            break;
        }
      });
    } catch (error) {
      console.error('Storage settings read error:', error.message);
    }

    const capacityOverrideEnv = parseEnvOverride('STORAGE_CAPACITY_OVERRIDE_BYTES', 'STORAGE_CAPACITY_OVERRIDE_GB');
    const availableOverrideEnv = parseEnvOverride('STORAGE_AVAILABLE_OVERRIDE_BYTES', 'STORAGE_AVAILABLE_OVERRIDE_GB');

    let capacityOverrideBytes = null;
    let availableOverrideBytes = null;
    let overrideSource = null;

    if (capacityOverrideEnv != null || availableOverrideEnv != null) {
      capacityOverrideBytes = capacityOverrideEnv;
      availableOverrideBytes = availableOverrideEnv;
      overrideSource = 'env';
    } else if (capacityOverrideDb != null || availableOverrideDb != null) {
      capacityOverrideBytes = capacityOverrideDb;
      availableOverrideBytes = availableOverrideDb;
      overrideSource = 'settings';
    }

    if (capacityOverrideBytes != null) {
      diskTotal = capacityOverrideBytes;
      if (availableOverrideBytes == null) {
        diskAvailable = Math.max(capacityOverrideBytes - totalUsed, 0);
      } else {
        diskAvailable = Math.min(Math.max(availableOverrideBytes, 0), capacityOverrideBytes);
      }
      diskFree = diskAvailable;
    } else if (availableOverrideBytes != null) {
      diskAvailable = Math.max(availableOverrideBytes, 0);
      diskFree = diskAvailable;
    }

    let recommendedSoftLimit = null;
    if (diskTotal && diskAvailable) {
      const projected = totalUsed + Math.floor(diskAvailable * 0.8);
      recommendedSoftLimit = Math.min(diskTotal, Math.max(projected, Math.floor(diskTotal * 0.5)));
    } else if (diskTotal) {
      recommendedSoftLimit = Math.floor(diskTotal * 0.8);
    } else if (diskAvailable) {
      recommendedSoftLimit = Math.max(totalUsed, totalUsed + Math.floor(diskAvailable * 0.8));
    }

    if (recommendedSoftLimit && totalUsed > 0 && recommendedSoftLimit < totalUsed) {
      recommendedSoftLimit = totalUsed;
    }

    const fallbackSoftLimit = recommendedSoftLimit || diskTotal || DEFAULT_SOFT_LIMIT_BYTES;
    if (!recommendedSoftLimit && fallbackSoftLimit) {
      recommendedSoftLimit = fallbackSoftLimit;
    }
    const effectiveSoftLimit = configuredSoftLimit || fallbackSoftLimit || DEFAULT_SOFT_LIMIT_BYTES;

    const diskMetricsReliable = Boolean(diskTotal);

    res.json({
      total_used: totalUsed,
      archive_storage: archiveStorage,
      storage_by_event: storageByEvent,
      storage_limit: effectiveSoftLimit,
      storage_soft_limit: effectiveSoftLimit,
      configured_soft_limit: configuredSoftLimit,
      recommended_soft_limit: recommendedSoftLimit,
      soft_limit_configured: Boolean(configuredSoftLimit),
      disk_total: diskTotal,
      disk_free: diskFree,
      disk_available: diskAvailable,
      disk_total_raw: rawDiskTotal,
      disk_free_raw: rawDiskFree,
      disk_available_raw: rawDiskAvailable,
      disk_metrics_reliable: diskMetricsReliable,
      disk_override_source: overrideSource
    });
  } catch (error) {
    console.error('Storage info error:', error);
    res.status(500).json({ error: 'Failed to fetch storage information' });
  }
});

// Upload favicon endpoint
router.post('/favicon', adminAuth, faviconUpload.single('favicon'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No favicon file provided' });
    }

    // The file is already in the correct location from multer
    const faviconUrl = `/uploads/favicons/${req.file.filename}`;
    
    // Save to database
    await db('app_settings')
      .insert({
        setting_key: 'branding_favicon_url',
        setting_value: faviconUrl,
        setting_type: 'branding',
        updated_at: new Date()
      })
      .onConflict('setting_key')
      .merge({
        setting_value: faviconUrl,
        updated_at: new Date()
      });

    // Log activity
    await logActivity('favicon_uploaded', 
      { faviconUrl }, 
      null,
      { type: 'admin', id: req.admin.id, name: req.admin.username }
    );

    res.json({ faviconUrl });
  } catch (error) {
    console.error('Error uploading favicon:', error);
    res.status(500).json({ error: 'Failed to upload favicon' });
  }
});

// Update rate limit settings
router.put('/security/rate-limit', adminAuth, [
  body('rate_limit_enabled').isBoolean().withMessage('Enabled must be a boolean'),
  body('rate_limit_window_minutes').isInt({ min: 1, max: 60 }).withMessage('Window must be between 1 and 60 minutes'),
  body('rate_limit_max_requests').isInt({ min: 10, max: 10000 }).withMessage('Max requests must be between 10 and 10000'),
  body('rate_limit_auth_max_requests').isInt({ min: 1, max: 100 }).withMessage('Auth max requests must be between 1 and 100'),
  body('rate_limit_skip_authenticated').isBoolean().withMessage('Skip authenticated must be a boolean'),
  body('rate_limit_public_endpoints_only').isBoolean().withMessage('Public endpoints only must be a boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      rate_limit_enabled,
      rate_limit_window_minutes,
      rate_limit_max_requests,
      rate_limit_auth_max_requests,
      rate_limit_skip_authenticated,
      rate_limit_public_endpoints_only
    } = req.body;

    // Update each setting
    const settings = [
      { key: 'rate_limit_enabled', value: rate_limit_enabled },
      { key: 'rate_limit_window_minutes', value: rate_limit_window_minutes },
      { key: 'rate_limit_max_requests', value: rate_limit_max_requests },
      { key: 'rate_limit_auth_max_requests', value: rate_limit_auth_max_requests },
      { key: 'rate_limit_skip_authenticated', value: rate_limit_skip_authenticated },
      { key: 'rate_limit_public_endpoints_only', value: rate_limit_public_endpoints_only }
    ];

    for (const { key, value } of settings) {
      await db('app_settings')
        .where('setting_key', key)
        .update({
          setting_value: JSON.stringify(value),
          updated_at: new Date()
        });
    }

    // Clear the rate limit settings cache to apply changes immediately
    clearSettingsCache();

    // Log activity
    await logActivity('settings_updated', 
      { 
        category: 'security',
        subcategory: 'rate_limit',
        changes: settings.length
      },
      null,
      { type: 'admin', id: req.admin.id, name: req.admin.username }
    );

    res.json({ message: 'Rate limit settings updated successfully' });
  } catch (error) {
    console.error('Rate limit settings update error:', error);
    res.status(500).json({ error: 'Failed to update rate limit settings' });
  }
});

// Get default public site template
router.get('/public-site/default', adminAuth, async (req, res) => {
  try {
    const defaults = await getDefaultPublicSitePayload();

    res.json({
      enabled: false,
      html: DEFAULT_PUBLIC_SITE_HTML.trim(),
      css: '',
      baseCss: DEFAULT_PUBLIC_SITE_CSS.trim(),
      branding: defaults.branding,
      meta: {
        title: defaults.title,
      }
    });
  } catch (error) {
    console.error('Failed to load public site defaults:', error);
    res.status(500).json({ error: 'Failed to load defaults' });
  }
});

// Reset public site template to defaults
router.post('/public-site/reset', adminAuth, async (req, res) => {
  try {
    const entries = [
      {
        key: 'general_public_site_html',
        value: DEFAULT_PUBLIC_SITE_HTML.trim()
      },
      {
        key: 'general_public_site_custom_css',
        value: ''
      }
    ];

    for (const { key, value } of entries) {
      await db('app_settings')
        .insert({
          setting_key: key,
          setting_value: JSON.stringify(value),
          setting_type: 'general',
          updated_at: new Date()
        })
        .onConflict('setting_key')
        .merge({
          setting_value: JSON.stringify(value),
          updated_at: new Date()
        });
    }

    clearPublicSiteCache();

    const defaults = await getDefaultPublicSitePayload();

    await logActivity('public_site_reset_to_default',
      {
        template_length: DEFAULT_PUBLIC_SITE_HTML.length,
      },
      null,
      { type: 'admin', id: req.admin.id, name: req.admin.username }
    );

    res.json({
      message: 'Public site template reset to defaults',
      html: DEFAULT_PUBLIC_SITE_HTML.trim(),
      css: '',
      baseCss: DEFAULT_PUBLIC_SITE_CSS.trim(),
      branding: defaults.branding
    });
  } catch (error) {
    console.error('Failed to reset public site template:', error);
    res.status(500).json({ error: 'Failed to reset template' });
  }
});

module.exports = router;
