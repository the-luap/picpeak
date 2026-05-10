/**
 * Feature flags admin endpoints (#feature-flags-settings-reorg).
 *
 * GET  /api/admin/feature-flags  → { [key]: boolean }
 * PUT  /api/admin/feature-flags  → body { [key]: boolean }, replaces in tx
 *
 * Server-side dependency rules mirror the frontend:
 *   - quotes=false  forces bills=false
 *   - calendar=false forces calendarBooking=false
 *   - galleries is hard-coded true regardless of input
 *
 * Audit log: every successful PUT writes one activity_logs row with the
 * before/after diff so changes are traceable.
 */

const express = require('express');
const router = express.Router();
const { db, logActivity } = require('../database/db');
const { adminAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const logger = require('../utils/logger');

// Canonical flag list. Keep in sync with frontend
// `FeatureKey` union in frontend/src/contexts/FeatureFlagsContext.tsx.
const KNOWN_FLAGS = [
  'galleries',
  'reminderEmails',
  'calendar',
  'calendarBooking',
  'quotes',
  'bills',
  'messaging',
  'analytics',
  'userManagement',
  // Foundation flag for the customer-side surface (#354). See migration
  // 094 for the seeding rule.
  'customerPortal',
];

// Spec defaults for any flag missing from the DB (e.g. a row added by a
// new release that hasn't run its migration yet on this instance).
const DEFAULT_FLAGS = {
  galleries: true,
  reminderEmails: true,
  calendar: false,
  calendarBooking: false,
  quotes: false,
  bills: false,
  messaging: false,
  analytics: true,
  userManagement: true,
};

async function readAllFlags() {
  const rows = await db('feature_flags').select('key', 'value');
  const result = { ...DEFAULT_FLAGS };
  for (const row of rows) {
    if (KNOWN_FLAGS.includes(row.key)) {
      result[row.key] = Boolean(row.value);
    }
  }
  return result;
}

function applyDependencyRules(flags) {
  const out = { ...flags };
  // Galleries is the foundation — never off.
  out.galleries = true;
  // Sub-features can't outlive their parents.
  if (out.quotes === false) out.bills = false;
  if (out.calendar === false) out.calendarBooking = false;
  return out;
}

router.get('/', adminAuth, requirePermission('settings.view'), async (req, res) => {
  try {
    const flags = await readAllFlags();
    res.json(flags);
  } catch (error) {
    logger.error('Failed to read feature flags', { error: error.message });
    res.status(500).json({ error: 'Failed to read feature flags' });
  }
});

router.put('/', adminAuth, requirePermission('settings.edit'), async (req, res) => {
  try {
    const body = req.body || {};
    if (typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({ error: 'Body must be an object of { key: boolean } pairs' });
    }

    // Validate keys + types up front.
    const cleaned = {};
    for (const [key, value] of Object.entries(body)) {
      if (!KNOWN_FLAGS.includes(key)) {
        return res.status(400).json({ error: `Unknown feature flag: ${key}` });
      }
      if (typeof value !== 'boolean') {
        return res.status(400).json({ error: `Flag ${key} must be boolean, got ${typeof value}` });
      }
      cleaned[key] = value;
    }

    const before = await readAllFlags();
    const merged = applyDependencyRules({ ...before, ...cleaned });

    // Compute diff for audit log.
    const changed = {};
    for (const key of KNOWN_FLAGS) {
      if (merged[key] !== before[key]) {
        changed[key] = { from: before[key], to: merged[key] };
      }
    }

    if (Object.keys(changed).length === 0) {
      // No-op write — return current state, skip audit log.
      return res.json(merged);
    }

    const adminId = req.admin?.id || null;
    const adminUsername = req.admin?.username || 'unknown';

    await db.transaction(async (trx) => {
      for (const key of KNOWN_FLAGS) {
        const value = merged[key];
        const existing = await trx('feature_flags').where({ key }).first();
        if (existing) {
          await trx('feature_flags')
            .where({ key })
            .update({ value, updated_at: trx.fn.now(), updated_by: adminId });
        } else {
          await trx('feature_flags').insert({ key, value, updated_by: adminId });
        }
      }
    });

    await logActivity(
      'feature_flags_updated',
      { changed, actor: adminUsername },
      null,
      { type: 'admin' }
    );

    res.json(merged);
  } catch (error) {
    logger.error('Failed to update feature flags', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to update feature flags' });
  }
});

module.exports = router;
