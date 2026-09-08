// Tracks whether this installation has ever been offered the one-time
// usage-reporting opt-in prompt shown to an existing admin on their first
// login after an update (see UsageService.markPromptShown()). A fresh
// install that went through the setup wizard's own opt-in step sets this
// too, so upgraded and brand-new installs share one "already asked" marker
// and neither gets asked twice. Separate from `notice_dismissed`, which
// governs the persistent, re-visitable dashboard banner instead.
const { formatBoolean } = require('../../src/utils/dbCompat');

exports.up = async function (knex) {
  if (!(await knex.schema.hasTable('product_usage_state'))) return;
  if (!(await knex.schema.hasColumn('product_usage_state', 'prompt_shown'))) {
    await knex.schema.alterTable('product_usage_state', (t) => {
      t.boolean('prompt_shown').notNullable().defaultTo(false);
    });
  }
  // Existing participants already made their choice before this marker
  // existed. Preserve it through withdrawal, pending delivery and identity
  // recovery; none of those transitions should produce a fresh invitation.
  await knex('product_usage_state')
    .whereNot('status', 'disabled')
    .update({ prompt_shown: formatBoolean(true) });
};
exports.down = async function (knex) {
  if (
    (await knex.schema.hasTable('product_usage_state')) &&
    (await knex.schema.hasColumn('product_usage_state', 'prompt_shown'))
  ) {
    await knex.schema.alterTable('product_usage_state', (t) => t.dropColumn('prompt_shown'));
  }
};
