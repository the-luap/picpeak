const { toTimestamp } = require('./dateNormalize');
const { AppError } = require('./errors');
const logger = require('./logger');

const warnedExpiry = new Set();

const isTrue = (value) => value === true || value === 1 || value === '1';

function isGalleryExpired(event, now = Date.now()) {
  if (event.expires_at == null || event.expires_at === '') return false;
  const expiry = toTimestamp(event.expires_at);
  if (!Number.isFinite(expiry)) {
    // Fail closed, but name the row once so an operator can repair it.
    if (!warnedExpiry.has(event.id)) {
      warnedExpiry.add(event.id);
      logger.warn('Unparseable events.expires_at treated as expired', { eventId: event.id, expires_at: String(event.expires_at) });
    }
    return true;
  }
  return expiry <= now;
}

function requiresGalleryPassword(event) {
  return !(event.require_password === false || event.require_password === 0 || event.require_password === '0');
}

function isGalleryAvailable(event, { adminPreview = false } = {}) {
  return !!event && isTrue(event.is_active) && !isTrue(event.is_archived)
    && (adminPreview || (!isTrue(event.is_draft) && !isGalleryExpired(event)));
}

function assertGalleryAvailable(event, { adminPreview = false } = {}) {
  if (!isGalleryAvailable(event, { adminPreview })) {
    throw new AppError('Gallery not found or expired', 404, 'GALLERY_UNAVAILABLE');
  }
}

module.exports = { isGalleryAvailable, assertGalleryAvailable, isGalleryExpired, requiresGalleryPassword };
