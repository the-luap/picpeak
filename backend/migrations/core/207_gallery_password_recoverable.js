const { addColumnIfNotExists } = require('../helpers');

/**
 * Opt-in recoverable storage for gallery passwords (#1271).
 *
 * Both columns hold an AES-256-GCM ciphertext (see utils/galleryPasswordVault)
 * and stay NULL unless the security setting
 * `security_gallery_password_recoverable` is on. The bcrypt hashes remain the
 * only thing the login path reads; these columns exist so an admin can show
 * or resend a password without regenerating it.
 */
exports.up = async function (knex) {
  await addColumnIfNotExists(knex, 'events', 'password_recoverable', (table) => {
    table.text('password_recoverable').nullable();
  });
  await addColumnIfNotExists(knex, 'events', 'client_password_recoverable', (table) => {
    table.text('client_password_recoverable').nullable();
  });
};

exports.down = async function (knex) {
  if (await knex.schema.hasColumn('events', 'password_recoverable')) {
    await knex.schema.alterTable('events', (table) => table.dropColumn('password_recoverable'));
  }
  if (await knex.schema.hasColumn('events', 'client_password_recoverable')) {
    await knex.schema.alterTable('events', (table) => table.dropColumn('client_password_recoverable'));
  }
};
