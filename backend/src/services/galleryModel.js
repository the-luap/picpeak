// #756: a NULL per-event hero_logo_visible means "inherit the global
// branding_logo_display_hero toggle". Only an explicit true/false is a
// per-gallery override. `globalDefault` is branding_logo_display_hero
// (defaults true when unset).
function resolveHeroLogoVisible(perEvent, globalDefault) {
  if (perEvent === null || perEvent === undefined) {
    return globalDefault !== false;
  }
  return perEvent !== false && perEvent !== 0 && perEvent !== '0';
}

// Formats whose ORIGINAL bytes a browser can't render in an <img> (HEIC/HEIF,
// camera RAW/DNG). For these the lightbox must be served the generated JPEG
// preview instead of `url` (the original) — otherwise it shows a broken image.
// So we force `preview_url` for them regardless of the lightbox_preview_enabled
// toggle. Detection is by MIME first, extension as a fallback (browsers report
// these MIMEs inconsistently). EXPERIMENTAL: whether a preview actually renders
// still depends on the backend being able to decode the source (HEVC-in-HEIC on
// the prod image; exiftool for DNG) — see #821.
const NON_DISPLAYABLE_ORIGINAL_EXT = new Set(['heic', 'heif', 'dng']);
const NON_DISPLAYABLE_ORIGINAL_MIME = new Set(['image/heic', 'image/heif', 'image/x-adobe-dng']);
function originalNeedsPreview(photo) {
  const mime = (photo.mime_type || '').toLowerCase();
  if (NON_DISPLAYABLE_ORIGINAL_MIME.has(mime)) return true;
  const name = photo.original_filename || photo.filename || '';
  const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : '';
  return NON_DISPLAYABLE_ORIGINAL_EXT.has(ext);
}

module.exports = { resolveHeroLogoVisible, originalNeedsPreview };
