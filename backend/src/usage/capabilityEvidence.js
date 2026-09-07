'use strict';
const { ALL_FEATURE_KEYS, ALL_FEATURES } = require('./schema.cjs');

// Trusted route handlers call this AFTER their business operation succeeds.
// Only fixed, allowlisted keys reach finish middleware. It still requires an
// authenticated admin, a 2xx response and active consent before persisting.
function capabilityEvidence(res, ...keys) {
  res.locals.productUsageFeatures = [...new Set([
    ...(res.locals.productUsageFeatures || []),
    ...keys.filter((key) => ALL_FEATURE_KEYS.includes(key) && ALL_FEATURES[key]?.used)
  ])];
}
function acceptedUpload(res, { video = false, raw = false, s3 = false } = {}) {
  capabilityEvidence(res, 'photo_management',
    ...(video ? ['video_uploads'] : []),
    ...(raw ? ['camera_raw_uploads'] : []),
    ...(s3 ? ['s3_storage', 's3_photo_storage'] : []));
}
module.exports = { capabilityEvidence, acceptedUpload };
