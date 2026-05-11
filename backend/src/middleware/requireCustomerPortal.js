/**
 * Customer portal feature-flag gate.
 *
 * Blocks every /api/customer/* and /api/admin/customers/* endpoint
 * when the `customerPortal` flag is off. Returns 410 Gone so the
 * frontend can distinguish "feature has been disabled" from "you
 * don't have access" (which would be 403) — useful for the customer
 * dashboard's auto-redirect on a soft-kill scenario.
 *
 * Reads the flag via customerAccountsService.isCustomerPortalEnabled
 * (which itself reads from the maintainer's feature_flags table),
 * so a single source of truth.
 */

const customerAccountsService = require('../services/customerAccountsService');
const logger = require('../utils/logger');

async function isEnabled() {
  try {
    return await customerAccountsService.isCustomerPortalEnabled();
  } catch (err) {
    // Defensive: if the lookup throws (DB unavailable, table missing
    // mid-migration), fail closed so an enabled-by-default fallback
    // can't accidentally expose customer surfaces during boot.
    logger.warn('requireCustomerPortal: feature flag lookup failed, treating as off', {
      error: err?.message,
    });
    return false;
  }
}

/**
 * Customer-facing endpoints. Returns 410 with a code the frontend
 * can interpret to clear stale session storage + redirect to
 * /admin/login.
 */
async function requireCustomerPortalEnabled(req, res, next) {
  if (await isEnabled()) return next();
  return res.status(410).json({
    error: 'Customer portal is disabled',
    code: 'CUSTOMER_PORTAL_DISABLED',
  });
}

/**
 * Admin-facing /api/admin/customers/* endpoints. Same gate, same
 * status code — keeps the contract consistent across both halves of
 * the customer-portal surface. The sidebar UI already hides the
 * entry, but a stale tab or direct API call must also be blocked.
 */
async function requireCustomerPortalEnabledAdmin(req, res, next) {
  if (await isEnabled()) return next();
  return res.status(410).json({
    error: 'Customer portal is disabled',
    code: 'CUSTOMER_PORTAL_DISABLED',
  });
}

module.exports = {
  requireCustomerPortalEnabled,
  requireCustomerPortalEnabledAdmin,
};
