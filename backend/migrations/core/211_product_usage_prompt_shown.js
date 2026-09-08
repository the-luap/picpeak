// Tracks whether this installation has ever been offered the one-time
// usage-reporting opt-in prompt shown to an existing admin on their first
// login after an update (see UsageService.markPromptShown()). A fresh
// install that went through the setup wizard's own opt-in step sets this
// too, so upgraded and brand-new installs share one "already asked" marker
// and neither gets asked twice. Separate from `notice_dismissed`, which
// governs the persistent, re-visitable dashboard banner instead.
exports.up = async function (knex) {
  if (
    (await knex.schema.hasTable('product_usage_state')) &&
    !(await knex.schema.hasColumn('product_usage_state', 'prompt_shown'))
  ) {
    await knex.schema.alterTable('product_usage_state', (t) => {
      t.boolean('prompt_shown').notNullable().defaultTo(false);
    });
  }
};
exports.down = async function (knex) {
  if (
    (await knex.schema.hasTable('product_usage_state')) &&
    (await knex.schema.hasColumn('product_usage_state', 'prompt_shown'))
  ) {
    await knex.schema.alterTable('product_usage_state', (t) => t.dropColumn('prompt_shown'));
  }
};
