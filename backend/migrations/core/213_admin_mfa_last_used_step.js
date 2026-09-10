/**
 * Migration 213: TOTP replay protection for admin MFA (GHSA-qcwx-r25m-j869).
 *
 * verifyTotp()/verifyTotpEncrypted() were stateless: otplib's window:1
 * tolerance means a captured 6-digit code stays valid across several real
 * time-steps (~90s), so the same code could complete two independent admin
 * logins. `two_factor_last_used_step` tracks, per admin, the absolute TOTP
 * time-step (Math.floor(Date.now() / 30000)) that their last successfully
 * consumed code matched; mfaService now rejects a code whose matched step
 * doesn't advance past it.
 *
 * Additive and idempotent: only adds a column, guarded by hasColumn, so it
 * is safe to re-run and touches no existing data.
 */
exports.up = async function (knex) {
  if (!(await knex.schema.hasColumn('admin_users', 'two_factor_last_used_step'))) {
    await knex.schema.alterTable('admin_users', (t) => {
      t.integer('two_factor_last_used_step').nullable();
    });
  }
};

exports.down = async function (knex) {
  if (await knex.schema.hasColumn('admin_users', 'two_factor_last_used_step')) {
    await knex.schema.alterTable('admin_users', (t) => {
      t.dropColumn('two_factor_last_used_step');
    });
  }
};
