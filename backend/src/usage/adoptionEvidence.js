'use strict';
const { isDeepStrictEqual } = require('node:util');
const { capabilityEvidence } = require('./capabilityEvidence');

// Compare values already handled locally by an admin operation. Never retain
// these values, hashes, IDs or a before/after record in the usage subsystem.
function normalized(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'string' && (value.startsWith('[') || value.startsWith('{'))) {
    try { return normalized(JSON.parse(value)); } catch { return value; }
  }
  if (Array.isArray(value)) return value.map(normalized);
  if (value && typeof value === 'object') return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, normalized(item)])
  );
  return value;
}
function changedFields(before, after, fields) {
  return fields.some(key => {
    if (after[key] === undefined) return false;
    let left = before?.[key], right = after[key];
    if (typeof left === 'boolean' && (right === 0 || right === 1)) right = Boolean(right);
    if (typeof right === 'boolean' && (left === 0 || left === 1)) left = Boolean(left);
    return !isDeepStrictEqual(normalized(left), normalized(right));
  });
}
function changedEvidence(res, key, before, after, fields) {
  if (changedFields(before, after, fields)) capabilityEvidence(res, key);
}

// Restrict comparisons to named product settings. Missing rows are unknown,
// not evidence of customization: persisting a fallback for the first time must
// not turn a default-only installation into an observed customization.
async function settingsChanged(db, updates, allowedKeys) {
  const keys = allowedKeys.filter(key => updates[key] !== undefined);
  if (!keys.length) return false;
  try {
    const rows = await db('app_settings').whereIn('setting_key', keys).select('setting_key', 'setting_value');
    return rows.some(row => {
      let previous = row.setting_value;
      try { previous = JSON.parse(previous); } catch { /* legacy plain value */ }
      return changedFields({ value: previous }, { value: updates[row.setting_key] }, ['value']);
    });
  } catch {
    // Optional evidence must not prevent the product operation from running.
    require('../utils/logger').warn('Product usage settings comparison unavailable');
    return false;
  }
}
module.exports = { changedFields, changedEvidence, settingsChanged };
