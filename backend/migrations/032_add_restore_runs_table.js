// No helpers needed for this migration

/**
 * Add restore_runs table for tracking restore operations
 */
exports.up = async function(knex) {
  // Create restore_runs table
  await knex.schema.createTable('restore_runs', table => {
    table.increments('id').primary();
    
    // Timing
    table.timestamp('started_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('completed_at');
    table.integer('duration_seconds');
    
    // Status and type
    table.string('status', 50).notNullable().defaultTo('running');
    table.string('restore_type', 50).notNullable(); // full, database, files, selective
    
    // Source information
    table.string('source', 500).notNullable(); // Backup source path or S3 URL
    table.string('manifest_path', 500); // Path to manifest file
    
    // Results
    table.text('error_message');
    table.text('statistics'); // JSON object with detailed statistics
    table.text('restore_log'); // JSON array of log entries
    
    // Safety backup
    table.string('pre_restore_backup_path', 500); // Path to pre-restore safety backup
    
    // Flags
    table.boolean('is_dry_run').defaultTo(false);
    table.boolean('was_rollback_attempted').defaultTo(false);
    table.boolean('was_successful').defaultTo(false);
    
    // Operator information
    table.string('operator_type', 50).defaultTo('manual'); // manual, scheduled, api
    table.integer('operator_user_id').references('id').inTable('admin_users').onDelete('SET NULL');
    table.string('operator_ip', 50);
    
    // Metadata
    table.text('metadata'); // JSON object for additional data
    
    table.index(['status', 'started_at']);
    table.index(['restore_type', 'started_at']);
  });
  
  // Create restore_file_operations table for tracking individual file operations
  await knex.schema.createTable('restore_file_operations', table => {
    table.increments('id').primary();
    
    table.integer('restore_run_id').notNullable()
      .references('id').inTable('restore_runs').onDelete('CASCADE');
    
    table.string('file_path', 500).notNullable();
    table.string('operation', 50).notNullable(); // restore, skip, error
    table.string('status', 50).notNullable(); // pending, in_progress, completed, failed
    
    table.bigInteger('file_size');
    table.string('checksum', 64);
    table.boolean('checksum_verified').defaultTo(false);
    
    table.text('error_message');
    table.timestamp('started_at');
    table.timestamp('completed_at');
    
    table.index(['restore_run_id', 'status']);
    table.index(['file_path']);
  });
  
  // Create restore_validation_results table
  await knex.schema.createTable('restore_validation_results', table => {
    table.increments('id').primary();
    
    table.integer('restore_run_id').notNullable()
      .references('id').inTable('restore_runs').onDelete('CASCADE');
    
    table.string('validation_type', 50).notNullable(); // pre-restore, post-restore
    table.boolean('is_valid').notNullable();
    
    table.text('errors'); // JSON array of errors
    table.text('warnings'); // JSON array of warnings
    table.text('checksums'); // JSON object with checksum comparisons
    
    table.timestamp('validated_at').notNullable().defaultTo(knex.fn.now());
    
    table.index(['restore_run_id', 'validation_type']);
  });
  
  // Add restore-related settings to app_settings
  await knex('app_settings').insert([
    {
      setting_key: 'restore_allow_force',
      setting_value: JSON.stringify(false),
      setting_type: 'restore'
    },
    {
      setting_key: 'restore_require_pre_backup',
      setting_value: JSON.stringify(true),
      setting_type: 'restore'
    },
    {
      setting_key: 'restore_max_file_size_mb',
      setting_value: '5000',
      setting_type: 'restore'
    },
    {
      setting_key: 'restore_verify_checksums',
      setting_value: JSON.stringify(true),
      setting_type: 'restore'
    },
    {
      setting_key: 'restore_email_on_completion',
      setting_value: JSON.stringify(true),
      setting_type: 'restore'
    },
    {
      setting_key: 'restore_retention_days',
      setting_value: '30',
      setting_type: 'restore'
    }
  ]);
  
  // Add new email templates for restore notifications
  const emailTemplates = [
    {
      template_key: 'restore_completed',
      subject_en: '✅ Restore Completed Successfully',
      subject_de: '✅ Wiederherstellung erfolgreich abgeschlossen',
      body_html_en: `<h2>Restore Operation Completed</h2>
<p>A restore operation has completed successfully.</p>

<h3>Details:</h3>
<ul>
  <li><strong>Restore Type:</strong> {{restore_type}}</li>
  <li><strong>Duration:</strong> {{duration}}</li>
  <li><strong>Files Restored:</strong> {{files_restored}}</li>
  <li><strong>Backup ID:</strong> {{backup_id}}</li>
  <li><strong>Timestamp:</strong> {{timestamp}}</li>
</ul>

<p>Please verify that all systems are functioning correctly after the restore.</p>`,
      body_html_de: `<h2>Wiederherstellungsvorgang abgeschlossen</h2>
<p>Ein Wiederherstellungsvorgang wurde erfolgreich abgeschlossen.</p>

<h3>Details:</h3>
<ul>
  <li><strong>Wiederherstellungstyp:</strong> {{restore_type}}</li>
  <li><strong>Dauer:</strong> {{duration}}</li>
  <li><strong>Wiederhergestellte Dateien:</strong> {{files_restored}}</li>
  <li><strong>Backup-ID:</strong> {{backup_id}}</li>
  <li><strong>Zeitstempel:</strong> {{timestamp}}</li>
</ul>

<p>Bitte überprüfen Sie, ob alle Systeme nach der Wiederherstellung ordnungsgemäß funktionieren.</p>`,
      body_text_en: `Restore Operation Completed

A restore operation has completed successfully.

Details:
- Restore Type: {{restore_type}}
- Duration: {{duration}}
- Files Restored: {{files_restored}}
- Backup ID: {{backup_id}}
- Timestamp: {{timestamp}}

Please verify that all systems are functioning correctly after the restore.`,
      body_text_de: `Wiederherstellungsvorgang abgeschlossen

Ein Wiederherstellungsvorgang wurde erfolgreich abgeschlossen.

Details:
- Wiederherstellungstyp: {{restore_type}}
- Dauer: {{duration}}
- Wiederhergestellte Dateien: {{files_restored}}
- Backup-ID: {{backup_id}}
- Zeitstempel: {{timestamp}}

Bitte überprüfen Sie, ob alle Systeme nach der Wiederherstellung ordnungsgemäß funktionieren.`,
      variables: JSON.stringify(['restore_type', 'duration', 'files_restored', 'backup_id', 'timestamp'])
    },
    {
      template_key: 'restore_failed',
      subject_en: '❌ Restore Operation Failed',
      subject_de: '❌ Wiederherstellungsvorgang fehlgeschlagen',
      body_html_en: `<h2>Restore Operation Failed</h2>
<p>A restore operation has failed and requires attention.</p>

<h3>Details:</h3>
<ul>
  <li><strong>Restore Type:</strong> {{restore_type}}</li>
  <li><strong>Error:</strong> {{error_message}}</li>
  <li><strong>Timestamp:</strong> {{timestamp}}</li>
</ul>

<p>Please check the system logs for more details and take appropriate action.</p>

<p><strong>Important:</strong> If a pre-restore backup was created, it may be used for recovery.</p>`,
      body_html_de: `<h2>Wiederherstellungsvorgang fehlgeschlagen</h2>
<p>Ein Wiederherstellungsvorgang ist fehlgeschlagen und erfordert Ihre Aufmerksamkeit.</p>

<h3>Details:</h3>
<ul>
  <li><strong>Wiederherstellungstyp:</strong> {{restore_type}}</li>
  <li><strong>Fehler:</strong> {{error_message}}</li>
  <li><strong>Zeitstempel:</strong> {{timestamp}}</li>
</ul>

<p>Bitte überprüfen Sie die Systemprotokolle für weitere Details und ergreifen Sie entsprechende Maßnahmen.</p>

<p><strong>Wichtig:</strong> Falls ein Backup vor der Wiederherstellung erstellt wurde, kann es zur Wiederherstellung verwendet werden.</p>`,
      body_text_en: `Restore Operation Failed

A restore operation has failed and requires attention.

Details:
- Restore Type: {{restore_type}}
- Error: {{error_message}}
- Timestamp: {{timestamp}}

Please check the system logs for more details and take appropriate action.

Important: If a pre-restore backup was created, it may be used for recovery.`,
      body_text_de: `Wiederherstellungsvorgang fehlgeschlagen

Ein Wiederherstellungsvorgang ist fehlgeschlagen und erfordert Ihre Aufmerksamkeit.

Details:
- Wiederherstellungstyp: {{restore_type}}
- Fehler: {{error_message}}
- Zeitstempel: {{timestamp}}

Bitte überprüfen Sie die Systemprotokolle für weitere Details und ergreifen Sie entsprechende Maßnahmen.

Wichtig: Falls ein Backup vor der Wiederherstellung erstellt wurde, kann es zur Wiederherstellung verwendet werden.`,
      variables: JSON.stringify(['restore_type', 'error_message', 'timestamp'])
    }
  ];
  
  await knex('email_templates').insert(emailTemplates);
};

exports.down = async function(knex) {
  // Remove email templates
  await knex('email_templates')
    .whereIn('template_key', ['restore_completed', 'restore_failed'])
    .delete();
  
  // Remove settings
  await knex('app_settings')
    .where('setting_type', 'restore')
    .delete();
  
  // Drop tables
  await knex.schema.dropTableIfExists('restore_validation_results');
  await knex.schema.dropTableIfExists('restore_file_operations');
  await knex.schema.dropTableIfExists('restore_runs');
};