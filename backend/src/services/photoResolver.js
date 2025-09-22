const path = require('path');
const { resolveExternalPath } = require('./externalMediaService');
const { safePathJoin } = require('../utils/fileSecurityUtils');

const getStoragePath = () => process.env.STORAGE_PATH || path.join(__dirname, '../../../storage');

/**
 * Resolve absolute photo file path based on event + photo origin
 * Managed: storage/events/active + photo.path (legacy variants supported)
 * External reference: EXTERNAL_MEDIA_ROOT + event.external_path + photo.external_relpath
 */
function resolvePhotoFilePath(event, photo) {
  if (!event || !photo) throw new Error('resolvePhotoFilePath requires event and photo');

  const mode = (event.source_mode || photo.source_origin || 'managed');
  if (mode === 'reference' || photo.source_origin === 'external') {
    if (!photo.external_relpath) {
      throw new Error('Missing external_relpath for external photo');
    }
    // Normalize duplicate leaf segments (e.g., event.external_path ends with 'individual'
    // and external_relpath starts with 'individual/') to avoid double segment like
    // '/external-media/.../individual/individual/file.jpg'
    let rel = photo.external_relpath;
    try {
      const lastSeg = path.basename(event.external_path || '');
      const firstSeg = rel.split(path.sep)[0];
      if (lastSeg && firstSeg && lastSeg === firstSeg) {
        rel = rel.split(path.sep).slice(1).join(path.sep) || '';
      }
    } catch (_) {
      // ignore normalization errors
    }
    return resolveExternalPath(event, rel);
  }

  const storagePath = getStoragePath();
  const eventsRoot = path.join(storagePath, 'events/active');

  if (photo.path && photo.path.startsWith('events/active/')) {
    // Legacy paths already include prefix; normalize via safe join
    return safePathJoin(storagePath, photo.path.replace(/^events\/active\/?/, 'events/active/'));
  }

  const relativeSegment = photo.path ? photo.path.replace(/^\/+/, '') : '';
  return safePathJoin(eventsRoot, relativeSegment);
}

module.exports = {
  resolvePhotoFilePath,
};
