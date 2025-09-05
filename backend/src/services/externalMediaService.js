const fs = require('fs').promises;
const path = require('path');
const { safePathJoin } = require('../utils/fileSecurityUtils');

function getExternalMediaRoot() {
  return process.env.EXTERNAL_MEDIA_ROOT || '/external-media';
}

function isUnderRoot(p) {
  const root = path.resolve(getExternalMediaRoot());
  const resolved = path.resolve(p);
  return resolved === root || resolved.startsWith(root + path.sep);
}

async function list(relativePath = '') {
  const root = getExternalMediaRoot();
  // Normalize and ensure safe join under root
  const targetDir = safePathJoin(root, relativePath || '.');

  const entries = [];
  try {
    const dirents = await fs.readdir(targetDir, { withFileTypes: true });
    for (const d of dirents) {
      // Skip hidden files and directories
      if (d.name.startsWith('.')) continue;
      const full = path.join(targetDir, d.name);
      const stat = await fs.stat(full).catch(() => null);
      if (!stat) continue;

      if (d.isDirectory()) {
        entries.push({ name: d.name, type: 'dir' });
      } else if (d.isFile()) {
        const ext = path.extname(d.name).toLowerCase();
        if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
          entries.push({ name: d.name, type: 'file', size: stat.size, mtime: stat.mtime });
        }
      }
    }
  } catch (e) {
    // Propagate errors for caller to handle (e.g., invalid path)
    throw e;
  }

  const rootResolved = path.resolve(root);
  const currentResolved = path.resolve(targetDir);
  const canNavigateUp = currentResolved !== rootResolved;

  // Return normalized relative path from root
  const relFromRoot = path.relative(rootResolved, currentResolved);

  return { path: relFromRoot, entries, canNavigateUp };
}

function resolveExternalPath(event, relpath) {
  const root = getExternalMediaRoot();
  const base = event?.external_path ? path.join(event.external_path) : '';
  const combined = base ? path.join(base, relpath || '') : (relpath || '');
  return safePathJoin(root, combined);
}

module.exports = {
  getExternalMediaRoot,
  isUnderRoot,
  list,
  resolveExternalPath,
};

