const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const { adminAuth } = require('../middleware/auth');
const { list, resolveExternalPath, getExternalMediaRoot } = require('../services/externalMediaService');
const { db, logActivity } = require('../database/db');

const router = express.Router();

// GET /api/admin/external-media/list?path=relative/dir
router.get('/list', adminAuth, async (req, res) => {
  try {
    const relPath = (req.query.path || '').replace(/^\/+/, '');
    const result = await list(relPath);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: 'Invalid path', details: error.message });
  }
});

// Helper to recursively collect files under a directory, filtered by image extensions
async function walkDir(dir, baseDir) {
  const results = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      results.push(...await walkDir(full, baseDir));
    } else if (e.isFile()) {
      const ext = path.extname(e.name).toLowerCase();
      if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
        const rel = path.relative(baseDir, full);
        results.push({ full, rel, name: e.name });
      }
    }
  }
  return results;
}

// POST /api/admin/events/:id/import-external
// Body: { external_path: string, recursive?: boolean, map?: { individual?: string, collages?: string } }
router.post('/events/:id/import-external', adminAuth, async (req, res) => {
  try {
    const eventId = parseInt(req.params.id);
    const { external_path, recursive = true, map = { individual: 'individual', collages: 'collages' } } = req.body || {};
    if (!external_path) return res.status(400).json({ error: 'external_path is required' });

    // Load event
    const event = await db('events').where('id', eventId).first();
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const baseAbs = resolveExternalPath({ external_path }, '');
    // Collect files
    const files = recursive ? await walkDir(baseAbs, baseAbs) : (await fs.readdir(baseAbs, { withFileTypes: true }))
      .filter(e => e.isFile())
      .map(e => ({ full: path.join(baseAbs, e.name), rel: e.name, name: e.name }))
      .filter(f => ['.jpg', '.jpeg', '.png', '.webp'].includes(path.extname(f.name).toLowerCase()));

    let imported = 0;
    let skipped = 0;

    // Insert photos
    for (const f of files) {
      // Infer type by subfolder names
      const segs = f.rel.split(path.sep);
      let type = 'individual';
      if (segs[0] === map.collages) type = 'collage';
      if (segs[0] === map.individual) type = 'individual';

      try {
        // Check if already exists (by external_relpath)
        const exists = await db('photos')
          .where({ event_id: eventId, external_relpath: f.rel })
          .first();
        if (exists) { skipped++; continue; }

        const stats = await fs.stat(f.full);
        const inserted = await db('photos')
          .insert({
            event_id: eventId,
            filename: f.name,
            // Keep path as a hint for legacy code but not used for resolution in external mode
            path: path.join(event.slug, f.name),
            thumbnail_path: null,
            type,
            size_bytes: stats.size,
            source_origin: 'external',
            external_relpath: f.rel
          })
          .returning('id');

        imported += (inserted?.length ? 1 : 0);
      } catch (e) {
        skipped++;
      }
    }

    // Update event fields
    await db('events').where('id', eventId).update({ source_mode: 'reference', external_path });

    // Queue thumbnail generation lazily by reading thumbnails via ensure endpoint as needed
    await logActivity('external_import_completed', { event_id: eventId, imported, skipped, external_path }, eventId, { type: 'admin' });

    res.json({ imported, skipped, thumbnailsQueued: 0 });
  } catch (error) {
    res.status(500).json({ error: 'Failed to import external media', details: error.message });
  }
});

module.exports = router;

