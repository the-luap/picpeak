exports.up = async function(knex) {
  // Add user upload settings to events table
  await knex.schema.alterTable('events', function(table) {
    table.boolean('allow_user_uploads').defaultTo(false);
    table.integer('upload_category_id').references('id').inTable('photo_categories').onDelete('SET NULL');
  });
  
  // Add uploaded_by field to photos table to track who uploaded
  await knex.schema.alterTable('photos', function(table) {
    table.string('uploaded_by').defaultTo('admin'); // 'admin' or guest identifier
  });
};

exports.down = async function(knex) {
  await knex.schema.alterTable('events', function(table) {
    table.dropColumn('allow_user_uploads');
    table.dropColumn('upload_category_id');
  });
  
  await knex.schema.alterTable('photos', function(table) {
    table.dropColumn('uploaded_by');
  });
};