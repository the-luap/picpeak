/** Fresh installs and upgraded databases expose the same event timestamp. */
exports.up = async function (knex) {
  if (!await knex.schema.hasTable('events')) return;
  if (!await knex.schema.hasColumn('events', 'updated_at')) {
    await knex.schema.alterTable('events', table => {
      table.timestamp('updated_at');
    });
  }
  // Do not replace existing modification times on a repeated migration.
  await knex('events').whereNull('updated_at').update({ updated_at: knex.ref('created_at') });
};
exports.down = async function (knex) {
  if (await knex.schema.hasTable('events') && await knex.schema.hasColumn('events', 'updated_at')) {
    await knex.schema.alterTable('events', table => table.dropColumn('updated_at'));
  }
};
