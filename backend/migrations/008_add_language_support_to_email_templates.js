exports.up = async function(knex) {
  // Add language-specific columns to email_templates
  await knex.schema.alterTable('email_templates', function(table) {
    // Add English versions (rename existing columns for consistency)
    table.renameColumn('subject', 'subject_en');
    table.renameColumn('body_html', 'body_html_en');
    table.renameColumn('body_text', 'body_text_en');
    
    // Add German versions
    table.string('subject_de');
    table.text('body_html_de');
    table.text('body_text_de');
  });

  // Copy existing values to German columns as defaults
  await knex('email_templates').update({
    subject_de: knex.raw('subject_en'),
    body_html_de: knex.raw('body_html_en'),
    body_text_de: knex.raw('body_text_en')
  });
};

exports.down = async function(knex) {
  await knex.schema.alterTable('email_templates', function(table) {
    // Remove German columns
    table.dropColumn('subject_de');
    table.dropColumn('body_html_de');
    table.dropColumn('body_text_de');
    
    // Rename columns back
    table.renameColumn('subject_en', 'subject');
    table.renameColumn('body_html_en', 'body_html');
    table.renameColumn('body_text_en', 'body_text');
  });
};