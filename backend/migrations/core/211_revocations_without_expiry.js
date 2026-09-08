/** Non-expiring JWTs need revocation records that cleanup never removes. */
exports.up = async function (knex) {
  if (!await knex.schema.hasTable('revoked_tokens')) return;
  if (!await knex.schema.hasColumn('revoked_tokens', 'expires_at')) return;
  const column = await knex('revoked_tokens').columnInfo('expires_at');
  if (!column.nullable) {
    await knex.schema.alterTable('revoked_tokens', table => {
      table.timestamp('expires_at').nullable().alter();
    });
  }
};

exports.down = async function (knex) {
  if (!await knex.schema.hasTable('revoked_tokens')) return;
  if (!await knex.schema.hasColumn('revoked_tokens', 'expires_at')) return;
  // Refuse to discard permanent revocations or silently give them a TTL.
  if (await knex('revoked_tokens').whereNull('expires_at').first()) {
    throw new Error('Cannot roll back while permanent token revocations exist');
  }
  const column = await knex('revoked_tokens').columnInfo('expires_at');
  if (column.nullable) {
    await knex.schema.alterTable('revoked_tokens', table => {
      table.timestamp('expires_at').notNullable().alter();
    });
  }
};
