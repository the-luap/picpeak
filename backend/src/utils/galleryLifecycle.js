const { toTimestamp } = require('./dateNormalize');
const { AppError } = require('./errors');

const isTrue = (value) => value === true || value === 1 || value === '1';

function isGalleryExpired(event, now = Date.now()) {
  if (event.expires_at == null || event.expires_at === '') return false;
  const expiry = toTimestamp(event.expires_at);
  return !Number.isFinite(expiry) || expiry <= now;
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
