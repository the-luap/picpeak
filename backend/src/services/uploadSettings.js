const { db } = require('../database/db');

const DEFAULT_MAX_FILES_PER_UPLOAD = 500;
const MAX_ALLOWED_FILES_PER_UPLOAD = 2000;
const CACHE_TTL_MS = 60_000;

let cachedValue = DEFAULT_MAX_FILES_PER_UPLOAD;
let cacheExpiresAt = 0;

const parseSettingValue = (setting) => {
  if (!setting || setting.setting_value == null) {
    return null;
  }

  let rawValue = setting.setting_value;

  if (typeof rawValue === 'string') {
    try {
      rawValue = JSON.parse(rawValue);
    } catch {
      // keep original string
    }
  }

  if (typeof rawValue === 'string') {
    const trimmed = rawValue.trim();
    if (trimmed === '') {
      return null;
    }
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (typeof rawValue === 'number') {
    return rawValue;
  }

  return null;
};

const normalizeLimit = (value) => {
  if (!Number.isFinite(value)) {
    return DEFAULT_MAX_FILES_PER_UPLOAD;
  }

  const intValue = Math.floor(value);
  if (intValue < 1) {
    return DEFAULT_MAX_FILES_PER_UPLOAD;
  }
  if (intValue > MAX_ALLOWED_FILES_PER_UPLOAD) {
    return MAX_ALLOWED_FILES_PER_UPLOAD;
  }
  return intValue;
};

const getMaxFilesPerUpload = async () => {
  if (Date.now() < cacheExpiresAt) {
    return cachedValue;
  }

  try {
    const setting = await db('app_settings')
      .where({ setting_key: 'general_max_files_per_upload' })
      .first();

    const parsedValue = normalizeLimit(parseSettingValue(setting));
    cachedValue = parsedValue;
    cacheExpiresAt = Date.now() + CACHE_TTL_MS;
    return parsedValue;
  } catch (error) {
    console.error('Failed to read max files per upload setting:', error.message);
    cachedValue = DEFAULT_MAX_FILES_PER_UPLOAD;
    cacheExpiresAt = Date.now() + CACHE_TTL_MS;
    return DEFAULT_MAX_FILES_PER_UPLOAD;
  }
};

const clearMaxFilesPerUploadCache = () => {
  cacheExpiresAt = 0;
};

module.exports = {
  getMaxFilesPerUpload,
  clearMaxFilesPerUploadCache,
  DEFAULT_MAX_FILES_PER_UPLOAD,
  MAX_ALLOWED_FILES_PER_UPLOAD
};
