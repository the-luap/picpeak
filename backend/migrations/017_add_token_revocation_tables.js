exports.up = function(knex) {
  return knex.schema
    // Table for individual token revocations
    .createTable('revoked_tokens', table => {
      table.increments('id').primary();
      table.string('token_id').notNullable().unique(); // JWT ID or generated ID
      table.integer('user_id').nullable(); // User who owned the token
      table.string('token_type', 20); // admin, gallery, etc.
      table.timestamp('revoked_at').defaultTo(knex.fn.now());
      table.timestamp('expires_at').notNullable(); // When token would have expired
      table.string('reason', 100); // password_change, logout, compromised, etc.
      table.text('metadata'); // Additional JSON data
      
      // Indexes for performance
      table.index('token_id');
      table.index('user_id');
      table.index('expires_at'); // For cleanup
    })
    // Table for user-level revocations (revoke all tokens before a certain time)
    .createTable('user_token_revocations', table => {
      table.integer('user_id').primary();
      table.timestamp('revoked_at').notNullable();
      table.string('reason', 100);
      
      // Index for quick lookups
      table.index('revoked_at');
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('user_token_revocations')
    .dropTableIfExists('revoked_tokens');
};