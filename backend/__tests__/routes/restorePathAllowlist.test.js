/**
 * Restore path containment must not break the normal restore wizard
 * (GHSA-fw4c, codex round 2).
 *
 * `source` is usually a SOURCE TYPE, not a path: RestoreWizard posts
 * 'local' | 's3' | 'upload', and restoreService.restore() branches on those
 * literals before deriving a directory. The first version of the containment
 * check treated `source` as a path, so path.resolve('local') landed outside
 * the configured backup roots and BOTH /validate and /start returned 400 —
 * blocking every normal restore.
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

process.env.NODE_ENV = 'test';
process.env.TEST_DATABASE_PATH = path.join(
  fs.mkdtempSync(path.join(os.tmpdir(), 'picpeak-restorepath-')), 'db.sqlite',
);
process.env.JWT_SECRET = process.env.JWT_SECRET || 'restorepath-test-secret';

const { bootCrmDb, seedMinimal } = require('../integration/helpers/crmDb');

// `bootCrmDb()` hands back the process-wide `db` singleton (module cache —
// see its own comment), so it must only be called ONCE per test file: a
// second call re-runs migrations against the same connection, and the first
// call's `cleanup()` (db.destroy()) would tear down the connection both
// describe blocks below share. Boot once at file scope; each describe below
// only touches app_settings / env vars, never the connection lifecycle.
let db; let cleanup; let checkRestorePathsAllowed;

beforeAll(async () => {
  ({ db, cleanup } = await bootCrmDb());
  await seedMinimal(db);
  ({ checkRestorePathsAllowed } = require('../../src/routes/adminRestore')._internal);
}, 120000);

afterAll(async () => { if (cleanup) await cleanup(); });

async function setBackupSetting(key, value) {
  const existing = await db('app_settings').where({ setting_key: key }).first();
  if (existing) {
    await db('app_settings').where({ setting_key: key }).update({ setting_value: JSON.stringify(value) });
  } else {
    await db('app_settings').insert({
      setting_key: key, setting_value: JSON.stringify(value), setting_type: 'backup',
    });
  }
}

describe('restore path allowlist (GHSA-fw4c)', () => {
  beforeAll(async () => {
    // Configure a backup root so the allowlist is actually active.
    await setBackupSetting('backup_destination_path', '/backup');
  });

  it('allows the wizard\'s source TYPE tokens', async () => {
    for (const source of ['local', 's3', 'upload']) {
      const err = await checkRestorePathsAllowed({
        source, manifestPath: '/backup/manifests/backup-manifest-1.json',
      });
      expect(err).toBeNull();
    }
  });

  it('allows an s3:// source URL', async () => {
    const err = await checkRestorePathsAllowed({
      source: 's3://bucket/key/backup.tar.gz',
      manifestPath: '/backup/manifests/backup-manifest-1.json',
    });
    expect(err).toBeNull();
  });

  it('still rejects a manifestPath outside the configured roots', async () => {
    const err = await checkRestorePathsAllowed({
      source: 'local', manifestPath: '/etc/passwd',
    });
    expect(err).toMatch(/inside a configured backup location/i);
  });

  it('still rejects a traversal manifestPath', async () => {
    const err = await checkRestorePathsAllowed({
      source: 'local', manifestPath: '/backup/../etc/shadow',
    });
    expect(err).toBeTruthy();
  });

  it('accepts a real path source inside the roots', async () => {
    const err = await checkRestorePathsAllowed({
      source: '/backup/run-1', manifestPath: '/backup/run-1/manifest.json',
    });
    expect(err).toBeNull();
  });
});

/**
 * GHSA-xfvx-j447-732c: `checkRestorePathsAllowed` constrained the top-level
 * `source`/`manifestPath` request fields (GHSA-fw4c above), but never looked
 * INSIDE the manifest itself. `manifest.database.backup_file` — handed
 * straight to restoreService's candidate resolution and eventually
 * interpolated into `sqlite3 .restore '<path>'` — was unchecked, so an
 * absolute path there could point the restore at an arbitrary file even
 * though `source`/`manifestPath` both passed containment.
 */
describe('restore path allowlist — manifest database.backup_file containment (GHSA-xfvx)', () => {
  let tmpRoot;

  beforeAll(async () => {
    await setBackupSetting('backup_destination_path', '/backup');

    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'picpeak-xfvx-manifest-'));
    // Additional allowed root via the documented escape hatch — keeps this
    // describe block's fixtures out of the shared '/backup' root above.
    process.env.RESTORE_ALLOWED_ROOTS = tmpRoot;
  });

  afterAll(() => {
    delete process.env.RESTORE_ALLOWED_ROOTS;
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  const writeManifest = (name, databaseSection) => {
    const manifestPath = path.join(tmpRoot, name);
    fs.writeFileSync(manifestPath, JSON.stringify({
      manifest: { version: '1.0', id: 'test' },
      backup: { type: 'full' },
      system: { platform: 'linux' },
      application: { version: '1.0.0' },
      files: { count: 0, manifest: [] },
      database: databaseSection,
      verification: { total_checksum: null, checksum_algorithm: null },
    }));
    return manifestPath;
  };

  it('rejects a manifest whose database.backup_file is an absolute path outside every configured root', async () => {
    const manifestPath = writeManifest('evil-1.json', { backup_file: '/etc/passwd' });
    const err = await checkRestorePathsAllowed({ source: 'local', manifestPath });
    expect(err).toMatch(/database\.backup_file must be inside a configured backup location/i);
  });

  it('accepts a manifest whose database.backup_file is an absolute path inside a configured root', async () => {
    const dbFile = path.join(tmpRoot, 'database', 'picpeak-db-sqlite-1.sql.gz');
    fs.mkdirSync(path.dirname(dbFile), { recursive: true });
    fs.writeFileSync(dbFile, 'not a real sqlite dump, just a fixture');
    const manifestPath = writeManifest('legit-1.json', { backup_file: dbFile });
    const err = await checkRestorePathsAllowed({ source: 'local', manifestPath });
    expect(err).toBeNull();
  });

  it('does not choke on a manifest whose database.backup_file is a legitimate relative path', async () => {
    // Relative candidates are resolved against restoreService's own
    // `backupPath` (which this route-level pre-check doesn't have — it only
    // sees `source`/`manifestPath`), so this layer intentionally defers
    // relative-path containment to restoreService.performDatabaseRestore
    // and must not false-positive here.
    const manifestPath = writeManifest('legit-2.json', { backup_file: 'database/picpeak-db-sqlite-1.sql.gz' });
    const err = await checkRestorePathsAllowed({ source: 'local', manifestPath });
    expect(err).toBeNull();
  });

  it('rejects everything when no backup location is configured at all (fail closed, not fail open)', async () => {
    // Simulate an install that never had backup_destination_path /
    // backup_manifest_path seeded/configured, and isn't using the
    // RESTORE_ALLOWED_ROOTS escape hatch either.
    const savedRoots = process.env.RESTORE_ALLOWED_ROOTS;
    delete process.env.RESTORE_ALLOWED_ROOTS;
    await db('app_settings').whereIn('setting_key', ['backup_destination_path', 'backup_manifest_path']).del();

    try {
      const err = await checkRestorePathsAllowed({
        source: '/backup/run-1', manifestPath: '/backup/run-1/manifest.json',
      });
      expect(err).toMatch(/no backup location is configured/i);
    } finally {
      process.env.RESTORE_ALLOWED_ROOTS = savedRoots;
      await setBackupSetting('backup_destination_path', '/backup');
    }
  });
});
