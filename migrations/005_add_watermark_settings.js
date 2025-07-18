const knex = require('knex');

exports.up = async function(db) {
  console.log('Adding watermark settings...');
  
  // Add watermark settings to app_settings table
  const watermarkSettings = [
    {
      setting_key: 'branding_watermark_logo_path',
      setting_value: JSON.stringify(null),
      setting_type: 'branding'
    },
    {
      setting_key: 'branding_watermark_logo_url',
      setting_value: JSON.stringify(null),
      setting_type: 'branding'
    },
    {
      setting_key: 'branding_watermark_position',
      setting_value: JSON.stringify('bottom-right'),
      setting_type: 'branding'
    },
    {
      setting_key: 'branding_watermark_opacity',
      setting_value: JSON.stringify(50),
      setting_type: 'branding'
    },
    {
      setting_key: 'branding_watermark_size',
      setting_value: JSON.stringify(15),
      setting_type: 'branding'
    }
  ];

  for (const setting of watermarkSettings) {
    // Check if setting already exists
    const existing = await db('app_settings')
      .where('setting_key', setting.setting_key)
      .first();
    
    if (!existing) {
      await db('app_settings').insert(setting);
      console.log(`Added setting: ${setting.setting_key}`);
    }
  }

  console.log('Watermark settings migration completed');
};

exports.down = async function(db) {
  // Remove watermark settings
  await db('app_settings')
    .whereIn('setting_key', [
      'branding_watermark_logo_path',
      'branding_watermark_logo_url',
      'branding_watermark_position',
      'branding_watermark_opacity',
      'branding_watermark_size'
    ])
    .del();
};