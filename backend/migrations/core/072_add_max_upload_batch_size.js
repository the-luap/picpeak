exports.up = async function(knex) {
  const exists = await knex('app_settings')
    .where({ setting_key: 'general_max_upload_batch_size_mb' })
    .first();

  if (!exists) {
    await knex('app_settings').insert({
      setting_key: 'general_max_upload_batch_size_mb',
      setting_value: JSON.stringify(95),
      setting_type: 'general',
      updated_at: new Date()
    });
  }
};

exports.down = async function(knex) {
  await knex('app_settings')
    .where({ setting_key: 'general_max_upload_batch_size_mb' })
    .del();
};
