const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const { db } = require('../database/db');

class WatermarkService {
  constructor() {
    this.cache = new Map();
    this.cacheMaxAge = 3600000; // 1 hour in milliseconds
  }

  /**
   * Get watermark settings from database
   */
  async getWatermarkSettings() {
    try {
      const settings = await db('app_settings')
        .whereIn('setting_key', [
          'branding_watermark_enabled',
          'branding_watermark_logo_path',
          'branding_watermark_position',
          'branding_watermark_opacity',
          'branding_watermark_size',
          'branding_company_name'
        ])
        .select('setting_key', 'setting_value');

      const settingsObj = {};
      settings.forEach(setting => {
        try {
          settingsObj[setting.setting_key] = JSON.parse(setting.setting_value);
        } catch (e) {
          settingsObj[setting.setting_key] = setting.setting_value;
        }
      });

      return {
        enabled: settingsObj.branding_watermark_enabled || false,
        logoPath: settingsObj.branding_watermark_logo_path || null,
        position: settingsObj.branding_watermark_position || 'bottom-right',
        opacity: parseInt(settingsObj.branding_watermark_opacity || 50),
        size: parseInt(settingsObj.branding_watermark_size || 15),
        companyName: settingsObj.branding_company_name || 'Photo Gallery'
      };
    } catch (error) {
      console.error('Error fetching watermark settings:', error);
      return null;
    }
  }

  /**
   * Calculate position coordinates based on position string
   */
  getPositionCoordinates(imageWidth, imageHeight, watermarkWidth, watermarkHeight, position) {
    const padding = 20;
    let left, top;

    switch (position) {
    case 'top-left':
      left = padding;
      top = padding;
      break;
    case 'top-right':
      left = imageWidth - watermarkWidth - padding;
      top = padding;
      break;
    case 'bottom-left':
      left = padding;
      top = imageHeight - watermarkHeight - padding;
      break;
    case 'bottom-right':
      left = imageWidth - watermarkWidth - padding;
      top = imageHeight - watermarkHeight - padding;
      break;
    case 'center':
      left = Math.floor((imageWidth - watermarkWidth) / 2);
      top = Math.floor((imageHeight - watermarkHeight) / 2);
      break;
    default:
      // Default to bottom-right
      left = imageWidth - watermarkWidth - padding;
      top = imageHeight - watermarkHeight - padding;
    }

    return { left: Math.max(0, left), top: Math.max(0, top) };
  }

  /**
   * Apply watermark to an image
   */
  async applyWatermark(imagePath, settings) {
    try {
      if (!settings || !settings.enabled) {
        // Return original image if watermarking is disabled
        return await fs.readFile(imagePath);
      }

      // Check cache first
      const cacheKey = `${imagePath}_${JSON.stringify(settings)}`;
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheMaxAge) {
        return cached.buffer;
      }

      // Load the main image
      const image = sharp(imagePath);
      const metadata = await image.metadata();

      let watermarkBuffer;
      let watermarkMetadata;

      // Try to use logo watermark first
      if (settings.logoPath) {
        try {
          const watermarkImage = sharp(settings.logoPath);
          watermarkMetadata = await watermarkImage.metadata();
          
          // Calculate watermark size based on percentage of main image
          const scaleFactor = settings.size / 100;
          const targetWidth = Math.floor(metadata.width * scaleFactor);
          const targetHeight = Math.floor(watermarkMetadata.height * (targetWidth / watermarkMetadata.width));

          // Resize watermark and apply opacity
          watermarkBuffer = await watermarkImage
            .resize(targetWidth, targetHeight, { fit: 'inside' })
            .composite([{
              input: Buffer.from([255, 255, 255, Math.floor(255 * (settings.opacity / 100))]),
              raw: {
                width: 1,
                height: 1,
                channels: 4
              },
              tile: true,
              blend: 'dest-in'
            }])
            .toBuffer();

          watermarkMetadata = { width: targetWidth, height: targetHeight };
        } catch (error) {
          console.error('Error processing watermark logo:', error);
          watermarkBuffer = null;
        }
      }

      // If no logo or logo failed, create text watermark
      if (!watermarkBuffer) {
        const fontSize = Math.max(16, Math.floor(metadata.width * 0.03));
        const padding = 10;
        
        // Create SVG text watermark
        const svg = `
          <svg width="${settings.companyName.length * fontSize * 0.6 + padding * 2}" height="${fontSize + padding * 2}">
            <rect x="0" y="0" width="100%" height="100%" fill="black" opacity="0.5" rx="5"/>
            <text x="${padding}" y="${fontSize + padding/2}" 
              font-family="Arial, sans-serif" 
              font-size="${fontSize}" 
              fill="white" 
              opacity="${settings.opacity / 100}">
              ${settings.companyName}
            </text>
          </svg>
        `;
        
        watermarkBuffer = Buffer.from(svg);
        watermarkMetadata = {
          width: settings.companyName.length * fontSize * 0.6 + padding * 2,
          height: fontSize + padding * 2
        };
      }

      // Calculate position
      const position = this.getPositionCoordinates(
        metadata.width,
        metadata.height,
        watermarkMetadata.width,
        watermarkMetadata.height,
        settings.position
      );

      // Apply watermark
      const watermarkedBuffer = await image
        .composite([{
          input: watermarkBuffer,
          top: position.top,
          left: position.left
        }])
        .toBuffer();

      // Cache the result
      this.cache.set(cacheKey, {
        buffer: watermarkedBuffer,
        timestamp: Date.now()
      });

      // Clean old cache entries
      this.cleanCache();

      return watermarkedBuffer;
    } catch (error) {
      console.error('Error applying watermark:', error);
      // Return original image on error
      return await fs.readFile(imagePath);
    }
  }

  /**
   * Clean old cache entries
   */
  cleanCache() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.cacheMaxAge) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear entire cache
   */
  clearCache() {
    this.cache.clear();
  }
}

module.exports = new WatermarkService();