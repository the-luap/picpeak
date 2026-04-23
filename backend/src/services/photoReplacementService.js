/**
 * PhotoReplacementService
 *
 * Handles replacing existing photos by matching original_filename.
 * Preserves the photo's ID, position, feedback, category, and visibility
 * while updating the physical file and metadata.
 */

const path = require('path');
const fsp = require('fs/promises');
const sharp = require('sharp');
const { db } = require('../database/db');
const { generateThumbnail, extractCaptureDate } = require('./imageProcessor');
const { generatePhotoFilename } = require('../utils/filenameSanitizer');
const watermarkGeneratorService = require('./watermarkGeneratorService');
const logger = require('../utils/logger');

const getStoragePath = () => process.env.STORAGE_PATH || path.join(__dirname, '../../../storage');

/**
 * Find a replacement candidate by matching original_filename (case-insensitive).
 * Returns the photo row if exactly one match, { ambiguous: true, count } if multiple, or null.
 */
async function findReplacementCandidate(eventId, originalFilename) {
  if (!originalFilename) return null;

  const matches = await db('photos')
    .where({ event_id: eventId })
    .whereRaw('LOWER(original_filename) = LOWER(?)', [originalFilename]);

  if (matches.length === 1) return matches[0];
  if (matches.length > 1) return { ambiguous: true, count: matches.length };
  return null;
}

/**
 * Replace an existing photo's file while preserving its DB identity.
 *
 * @param {Object} existingPhoto - The current photo DB row
 * @param {string} newFileTempPath - Path to the new file (will be moved)
 * @param {Object} opts - { originalFilename, mimeType, event }
 * @returns {{ success: boolean, photo?: Object, error?: string }}
 */
async function replacePhoto(existingPhoto, newFileTempPath, { originalFilename, mimeType, event }) {
  const eventDir = path.join(getStoragePath(), 'events', 'active', event.slug);
  const categorySlug = existingPhoto.type === 'collage' ? 'collages' : 'individual';
  const targetDir = path.join(eventDir, categorySlug);

  try {
    // Generate new filename
    const ext = path.extname(originalFilename);
    const newFilename = generatePhotoFilename(event.event_name, categorySlug, Date.now(), ext);
    const tempTargetPath = path.join(targetDir, `_replacing_${Date.now()}_${newFilename}`);
    const finalPath = path.join(targetDir, newFilename);
    const relativePath = path.join(event.slug, categorySlug, newFilename);

    // Write new file to temp name in target directory
    await fsp.mkdir(targetDir, { recursive: true });
    await fsp.copyFile(newFileTempPath, tempTargetPath);

    // Delete old physical file
    const oldFilePath = path.join(getStoragePath(), 'events', 'active', existingPhoto.path);
    await fsp.unlink(oldFilePath).catch(() => {});

    // Delete old thumbnail
    if (existingPhoto.thumbnail_path) {
      const oldThumbPath = path.join(getStoragePath(), existingPhoto.thumbnail_path);
      await fsp.unlink(oldThumbPath).catch(() => {});
    }

    // Delete old watermark cache
    try {
      await watermarkGeneratorService.deleteForPhoto(existingPhoto.id);
    } catch {
      // Ignore — watermark may not exist
    }

    // Rename temp → final
    await fsp.rename(tempTargetPath, finalPath);

    // Extract metadata from new file
    let capturedAt = null;
    try {
      capturedAt = await extractCaptureDate(finalPath);
    } catch {
      // No EXIF — keep null
    }

    let width = null;
    let height = null;
    try {
      const metadata = await sharp(finalPath).metadata();
      width = metadata.width || null;
      height = metadata.height || null;
    } catch {
      // Non-image or corrupt
    }

    const stats = await fsp.stat(finalPath);

    // Generate new thumbnail
    let thumbnailPath = null;
    try {
      thumbnailPath = await generateThumbnail(finalPath);
    } catch {
      logger.warn('Failed to generate thumbnail for replaced photo', { photoId: existingPhoto.id });
    }

    // Update DB record — preserve id, event_id, category_id, type, visibility,
    // uploaded_at, sort_order, feedback counts, view/download counts
    const updates = {
      filename: newFilename,
      original_filename: originalFilename,
      path: relativePath,
      thumbnail_path: thumbnailPath,
      size_bytes: stats.size,
      width,
      height,
      captured_at: capturedAt,
      mime_type: mimeType,
      media_type: mimeType?.startsWith('video/') ? 'video' : 'image',
    };

    await db('photos').where({ id: existingPhoto.id }).update(updates);

    const updatedPhoto = await db('photos').where({ id: existingPhoto.id }).first();

    logger.info('Photo replaced', {
      photoId: existingPhoto.id,
      oldFilename: existingPhoto.filename,
      newFilename,
      originalFilename,
    });

    return {
      success: true,
      photo: updatedPhoto,
      previousFilename: existingPhoto.filename,
    };
  } catch (err) {
    logger.error('replacePhoto error', { photoId: existingPhoto.id, error: err.message });
    return { success: false, error: err.message };
  }
}

module.exports = { findReplacementCandidate, replacePhoto };
