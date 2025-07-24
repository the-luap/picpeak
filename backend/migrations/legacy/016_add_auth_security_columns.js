exports.up = function(knex) {
  return knex.schema.table('admin_users', table => {
    // Add password change tracking
    table.timestamp('password_changed_at').nullable();
    
    // Add last login IP for security monitoring
    table.string('last_login_ip', 45).nullable();
    
    // Add account security flags
    table.boolean('two_factor_enabled').defaultTo(false);
    table.string('two_factor_secret').nullable();
    
    // Add index for performance
    table.index('password_changed_at');
  });
};

exports.down = function(knex) {
  return knex.schema.table('admin_users', table => {
    table.dropColumn('password_changed_at');
    table.dropColumn('last_login_ip');
    table.dropColumn('two_factor_enabled');
    table.dropColumn('two_factor_secret');
  });
};