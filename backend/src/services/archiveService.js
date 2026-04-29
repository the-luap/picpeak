const archiver = require('archiver');
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { db } = require('../database/db');
const { queueEmail } = require('./emailProcessor');
const logger = require('../utils/logger');
const feedbackService = require('./feedbackService');
const { getStorage } = require('./storage');

async function archiveEvent(event) {
  const storage = getStorage();
  const archiveName = `${event.slug}.zip`;
  const archiveRelKey = path.posix.join('events/archived', archiveName);
  const eventPrefix = path.posix.join('events/active', event.slug);

  const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'picpeak-archive-'));
  const tmpArchive = path.join(tmpDir, `${crypto.randomBytes(4).toString('hex')}-${archiveName}`);

  try {
    // Collect feedback data first so it can be included as in-memory entries.
    const feedbackEntries = [];
    const feedbackSettings = await feedbackService.getEventFeedbackSettings(event.id);
    if (feedbackSettings.feedback_enabled) {
      try {
        logger.info(`Exporting feedback data for event ${event.slug}`);
        const feedbackData = await feedbackService.exportEventFeedback(event.id);

        if (feedbackData && feedbackData.length > 0) {
          feedbackEntries.push({
            name: 'feedback_data.json',
            buffer: Buffer.from(JSON.stringify(feedbackData, null, 2), 'utf8'),
          });
          feedbackEntries.push({
            name: 'feedback_data.csv',
            buffer: Buffer.from(convertToCSV(feedbackData), 'utf8'),
          });
          const summary = await feedbackService.getEventFeedbackSummary(event.id);
          feedbackEntries.push({
            name: 'feedback_summary.json',
            buffer: Buffer.from(JSON.stringify(summary, null, 2), 'utf8'),
          });
          logger.info(`Feedback data exported: ${feedbackData.length} entries`);
        }
      } catch (error) {
        logger.error(`Error exporting feedback for event ${event.slug}:`, error);
        // Continue with archiving even if feedback export fails
      }
    }

    // Stream every photo (and any other content under events/active/{slug}/) into
    // the zip directly from the storage backend.
    const photoEntries = await storage.list(eventPrefix);

    let totalBytes = 0;
    await new Promise((resolve, reject) => {
      const output = fs.createWriteStream(tmpArchive);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => {
        totalBytes = archive.pointer();
        resolve();
      });
      archive.on('error', reject);
      archive.pipe(output);

      const append = async () => {
        for (const entry of photoEntries) {
          const nameInZip = entry.key.startsWith(`${eventPrefix}/`)
            ? entry.key.slice(eventPrefix.length + 1)
            : entry.key;
          const stream = await storage.get(entry.key);
          archive.append(stream, { name: nameInZip });
        }
        for (const f of feedbackEntries) {
          archive.append(f.buffer, { name: f.name });
        }
        archive.finalize();
      };

      append().catch(reject);
    });

    // Upload the finalized zip to the storage backend.
    await storage.putFromFile(archiveRelKey, tmpArchive, { contentType: 'application/zip' });

    logger.info(`Archive created: ${archiveName} (${totalBytes} bytes)`);

    // Update DB BEFORE deleting originals so a crash mid-cleanup leaves the
    // archive accessible rather than orphaning the photos.
    await db('events').where('id', event.id).update({
      is_archived: true,
      archive_path: archiveRelKey,
      archived_at: new Date(),
    });

    // Fire event.archived webhook (#327). Receivers infer per-photo loss
    // from this event — we deliberately do NOT fire photo.deleted for each
    // archived photo to avoid flooding subscribers on bulk archives.
    // Canonical event subject (#341) so the shape matches event.created /
    // event.published / event.expired; archive_path is an event.archived-
    // specific extra.
    try {
      const webhookService = require('./webhookService');
      await webhookService.fire('event.archived', {
        event: {
          ...webhookService.buildEventSubject({
            id: event.id,
            slug: event.slug,
            event_name: event.event_name,
            event_type: event.event_type,
            event_date: event.event_date,
            share_token: event.share_token,
            customer_name: event.customer_name || event.host_name,
            customer_email: event.customer_email || event.host_email,
            customer_phone: event.customer_phone,
          }),
          archive_path: archiveRelKey,
        },
      });
    } catch (e) { /* non-fatal */ }

    // Delete the originals from storage.
    for (const entry of photoEntries) {
      await storage.delete(entry.key).catch((err) =>
        logger.warn(`Failed to delete archived original ${entry.key}: ${err.message}`)
      );
    }

    // Delete thumbnails for this event's photos.
    const photos = await db('photos').where('event_id', event.id);
    for (const photo of photos) {
      if (photo.thumbnail_path) {
        await storage.delete(photo.thumbnail_path).catch(() => {});
      }
      if (photo.hero_path) {
        await storage.delete(photo.hero_path).catch(() => {});
      }
      // Best effort: remove watermarked variants too if a refactor added them.
      if (photo.watermark_path) {
        await storage.delete(photo.watermark_path).catch(() => {});
      }
    }

    // Queue completion email — admin_email is nullable on events (migration 073);
    // skip queueing rather than violating email_queue.recipient_email NOT NULL.
    if (event.admin_email) {
      await queueEmail(event.id, event.admin_email, 'archive_complete', {
        event_name: event.event_name,
        archive_size: (totalBytes / 1024 / 1024).toFixed(2) + ' MB',
      });
    } else {
      logger.info(`Skipping archive_complete email for event ${event.slug}: no admin_email set`);
    }
  } catch (error) {
    logger.error(`Error archiving event ${event.slug}:`, error);
    throw error;
  } finally {
    await fsp.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

// Helper function to convert JSON to CSV
function convertToCSV(data) {
  if (!data || data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const csvHeaders = headers.join(',');

  const csvRows = data.map(row => {
    return headers.map(header => {
      const value = row[header];
      // Escape quotes and wrap in quotes if contains comma
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value || '';
    }).join(',');
  });

  return [csvHeaders, ...csvRows].join('\n');
}

module.exports = { archiveEvent };
