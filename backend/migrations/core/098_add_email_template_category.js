/**
 * Migration: Categorise email templates + link them to feature flags.
 *
 * Adds two metadata columns to `email_templates`:
 *
 *   - `category` — display group in the admin Templates UI. One of:
 *       'core'      — gallery delivery, admin, system, backups.
 *                     Always visible, no feature flag.
 *       'customers' — customer-portal lifecycle (invitation, etc.).
 *       'billing'   — Bills feature (#354, not yet built).
 *       'quotes'    — Quotes feature (#354, not yet built).
 *       'calendar'  — Calendar feature (#354, not yet built).
 *     Values outside this set are accepted (forward-compat) but the
 *     UI will lump them under 'core' for now.
 *
 *   - `feature_flag` — name of the feature flag whose `false` value
 *     should mark this template as "Feature off" in the admin UI.
 *     NULL means the template is always active (gallery delivery,
 *     admin lifecycle, system notifications).
 *
 * Categorisation does NOT hide templates. Disabled-feature templates
 * stay visible and editable so admins can prep them before a feature
 * launch; the UI shows a small "Feature off" chip on the entry.
 *
 * Idempotent: re-runs are no-ops.
 */

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('email_templates'))) return;

  const hasCategory = await knex.schema.hasColumn('email_templates', 'category');
  if (!hasCategory) {
    await knex.schema.alterTable('email_templates', (table) => {
      // Default 'core' so existing rows aren't NULL; the backfill below
      // overrides for templates that belong to a feature group.
      table.string('category', 32).notNullable().defaultTo('core');
    });
  }

  const hasFeatureFlag = await knex.schema.hasColumn('email_templates', 'feature_flag');
  if (!hasFeatureFlag) {
    await knex.schema.alterTable('email_templates', (table) => {
      table.string('feature_flag', 64).nullable();
    });
  }

  // Backfill — keyed by template_key so we don't accidentally update
  // a row that's been renamed. Templates not in this map keep the
  // 'core' / NULL defaults from the column definitions above.
  const TEMPLATE_METADATA = {
    // Core galleries — always-on, no flag.
    gallery_created:               { category: 'core',      feature_flag: null },
    expiration_warning:            { category: 'core',      feature_flag: null },
    gallery_expired:               { category: 'core',      feature_flag: null },
    archive_complete:              { category: 'core',      feature_flag: null },
    // Admin / RBAC — always-on (admin login is foundational).
    admin_invitation:              { category: 'core',      feature_flag: null },
    admin_password_reset:          { category: 'core',      feature_flag: null },
    // System — backups, restores, version-update notifications.
    database_backup_completed:     { category: 'core',      feature_flag: null },
    database_backup_failed:        { category: 'core',      feature_flag: null },
    restore_completed:             { category: 'core',      feature_flag: null },
    restore_failed:                { category: 'core',      feature_flag: null },
    backup_completed:              { category: 'core',      feature_flag: null },
    backup_failed:                 { category: 'core',      feature_flag: null },
    version_update_available:      { category: 'core',      feature_flag: null },
    version_update_test:           { category: 'core',      feature_flag: null },
    // Customer portal (#354). customer_invitation is the only template
    // here today; calendar / quotes / bills get their templates added
    // when those features ship.
    customer_invitation:           { category: 'customers', feature_flag: 'customerPortal' },
  };

  for (const [key, meta] of Object.entries(TEMPLATE_METADATA)) {
    await knex('email_templates')
      .where({ template_key: key })
      .update({ category: meta.category, feature_flag: meta.feature_flag });
  }
};

exports.down = async function(knex) {
  if (!(await knex.schema.hasTable('email_templates'))) return;

  if (await knex.schema.hasColumn('email_templates', 'feature_flag')) {
    await knex.schema.alterTable('email_templates', (table) => {
      table.dropColumn('feature_flag');
    });
  }

  if (await knex.schema.hasColumn('email_templates', 'category')) {
    await knex.schema.alterTable('email_templates', (table) => {
      table.dropColumn('category');
    });
  }
};
