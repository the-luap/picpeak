/**
 * DownloadZipService
 *
 * Pre-generates ZIP archives for "Download All" so guests get instant
 * downloads with Content-Length instead of on-the-fly streaming that
 * crashes mobile browsers.
 *
 * Pattern follows watermarkGeneratorService.js — singleton with
 * in-memory locking and debounced background regeneration.
 */

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const archiver = require('archiver');
const { db } = require('../database/db');
const watermarkService = require('./watermarkService');
const { resolvePhotoFilePath } = require('./photoResolver');
const { getStoragePath } = require('../config/storage');
const logger = require('../utils/logger');

const DEBOUNCE_MS = 5000;

class DownloadZipService {
  constructor() {
    this.activeBuilds = new Map();   // eventId -> { promise, version }
    this.debounceTimers = new Map();  // eventId -> setTimeout handle
    this.versions = new Map();        // eventId -> generation counter
  }

  /**
   * Absolute path to the cached zip for an event slug.
   */
  getCachePath(slug) {
    return path.join(getStoragePath(), 'events', 'active', slug, '.download-cache', 'all.zip');
  }

  /**
   * Check if a valid cached zip exists.
   * Returns { path, size, generatedAt } or null.
   */
  async getZipInfo(eventId) {
    try {
      const event = await db('events')
        .where({ id: eventId })
        .select('download_zip_path', 'download_zip_generated_at', 'slug')
        .first();

      if (!event || !event.download_zip_path) return null;

      const absPath = this.getCachePath(event.slug);
      try {
        const stat = await fsp.stat(absPath);
        return {
          path: absPath,
          size: stat.size,
          generatedAt: event.download_zip_generated_at,
        };
      } catch {
        // File gone — clear stale DB record
        await db('events').where({ id: eventId }).update({
          download_zip_path: null,
          download_zip_generated_at: null,
        });
        return null;
      }
    } catch (err) {
      logger.warn('downloadZipService.getZipInfo error', { eventId, error: err.message });
      return null;
    }
  }

  /**
   * Generate the pre-zip for an event. Returns { success, path, size } or { success: false }.
   * Concurrent calls for the same eventId share one in-flight build.
   */
  async generateZip(eventId) {
    // If already building, return the existing promise
    const existing = this.activeBuilds.get(eventId);
    if (existing) return existing.promise;

    const version = (this.versions.get(eventId) || 0) + 1;
    this.versions.set(eventId, version);

    const promise = this._build(eventId, version);
    this.activeBuilds.set(eventId, { promise, version });

    try {
      return await promise;
    } finally {
      // Only clear if this is still the active build
      const current = this.activeBuilds.get(eventId);
      if (current && current.version === version) {
        this.activeBuilds.delete(eventId);
      }
    }
  }

  async _build(eventId, version) {
    try {
      const event = await db('events').where({ id: eventId }).first();
      if (!event) return { success: false, error: 'Event not found' };

      const photos = await db('photos')
        .where({ event_id: eventId })
        .select('*')
        .orderBy('type', 'asc')
        .orderBy('uploaded_at', 'desc');

      if (photos.length === 0) return { success: false, error: 'No photos' };

      // Watermark logic (same as gallery.js download-all)
      const watermarkSettings = await watermarkService.getWatermarkSettings();
      const eventWatermarkEnabled = event.watermark_downloads === true || event.watermark_downloads === 1;
      const shouldApplyWatermark = (watermarkSettings && watermarkSettings.enabled) || eventWatermarkEnabled;
      const effectiveSettings = shouldApplyWatermark ? {
        ...watermarkSettings,
        enabled: true,
        text: event.watermark_text || watermarkSettings?.text || 'Protected',
      } : null;

      const cacheDir = path.dirname(this.getCachePath(event.slug));
      await fsp.mkdir(cacheDir, { recursive: true });

      const tmpPath = this.getCachePath(event.slug) + `.tmp.${Date.now()}`;
      const finalPath = this.getCachePath(event.slug);

      // Build zip — level 0 (store only) since photos are already compressed
      await new Promise((resolve, reject) => {
        const output = fs.createWriteStream(tmpPath);
        const archive = archiver('zip', { zlib: { level: 0 } });

        output.on('close', resolve);
        archive.on('error', reject);
        archive.pipe(output);

        const uniqueTypes = new Set(photos.map(p => p.type)).size;
        const hasMultipleTypes = uniqueTypes > 1;

        const addPhotos = async () => {
          for (const photo of photos) {
            // Check if build was invalidated
            if (this.versions.get(eventId) !== version) {
              archive.abort();
              return reject(new Error('Build invalidated'));
            }

            let filePath;
            try {
              filePath = resolvePhotoFilePath(event, photo);
            } catch {
              continue;
            }

            let archiveName;
            if (hasMultipleTypes) {
              const folderName = photo.type === 'individual' ? 'Individual Photos' : 'Collages';
              archiveName = path.join(folderName, photo.filename);
            } else {
              archiveName = photo.filename;
            }

            if (shouldApplyWatermark && effectiveSettings) {
              try {
                const buf = await watermarkService.applyWatermark(filePath, effectiveSettings);
                archive.append(buf, { name: archiveName });
              } catch (err) {
                logger.warn('Skipping watermark in pre-zip', { photoId: photo.id, error: err.message });
              }
            } else {
              archive.file(filePath, { name: archiveName });
            }
          }

          archive.finalize();
        };

        addPhotos().catch(reject);
      });

      // Check version again — another invalidation may have arrived
      if (this.versions.get(eventId) !== version) {
        await fsp.unlink(tmpPath).catch(() => {});
        return { success: false, error: 'Build invalidated' };
      }

      // Atomic rename
      await fsp.rename(tmpPath, finalPath);

      const stat = await fsp.stat(finalPath);

      // Update DB
      await db('events').where({ id: eventId }).update({
        download_zip_path: `events/active/${event.slug}/.download-cache/all.zip`,
        download_zip_generated_at: new Date(),
      });

      logger.info('Pre-zip generated', { eventId, slug: event.slug, size: stat.size, photos: photos.length });
      return { success: true, path: finalPath, size: stat.size };
    } catch (err) {
      if (err.message === 'Build invalidated') {
        return { success: false, error: 'Build invalidated' };
      }
      logger.error('downloadZipService._build error', { eventId, error: err.message });
      return { success: false, error: err.message };
    }
  }

  /**
   * Invalidate the cached zip for an event.
   * Deletes the file, clears DB, debounces regeneration.
   */
  invalidate(eventId) {
    // Bump version to signal any in-flight build is stale
    this.versions.set(eventId, (this.versions.get(eventId) || 0) + 1);

    // Cancel pending debounce
    const timer = this.debounceTimers.get(eventId);
    if (timer) clearTimeout(timer);

    // Fire-and-forget cleanup
    this._cleanup(eventId).catch(err =>
      logger.warn('downloadZipService.invalidate cleanup error', { eventId, error: err.message })
    );

    // Debounce regeneration
    const newTimer = setTimeout(() => {
      this.debounceTimers.delete(eventId);
      this.generateZip(eventId).catch(err =>
        logger.warn('downloadZipService debounced regen error', { eventId, error: err.message })
      );
    }, DEBOUNCE_MS);
    this.debounceTimers.set(eventId, newTimer);
  }

  /**
   * Invalidate all events (e.g., global watermark settings changed).
   */
  async invalidateAll() {
    try {
      const events = await db('events')
        .whereNotNull('download_zip_path')
        .select('id');
      for (const event of events) {
        this.invalidate(event.id);
      }
    } catch (err) {
      logger.error('downloadZipService.invalidateAll error', { error: err.message });
    }
  }

  /**
   * Full cleanup — delete file and clear DB. Used on event deletion/archival.
   */
  async cleanup(eventId) {
    this.versions.set(eventId, (this.versions.get(eventId) || 0) + 1);
    const timer = this.debounceTimers.get(eventId);
    if (timer) {
      clearTimeout(timer);
      this.debounceTimers.delete(eventId);
    }
    await this._cleanup(eventId);
  }

  async _cleanup(eventId) {
    try {
      const event = await db('events')
        .where({ id: eventId })
        .select('slug', 'download_zip_path')
        .first();

      if (event && event.download_zip_path) {
        const absPath = this.getCachePath(event.slug);
        await fsp.unlink(absPath).catch(() => {});
        // Also try to remove the cache directory if empty
        const cacheDir = path.dirname(absPath);
        await fsp.rmdir(cacheDir).catch(() => {});
      }

      await db('events').where({ id: eventId }).update({
        download_zip_path: null,
        download_zip_generated_at: null,
      });
    } catch (err) {
      logger.warn('downloadZipService._cleanup error', { eventId, error: err.message });
    }
  }
}

module.exports = new DownloadZipService();
