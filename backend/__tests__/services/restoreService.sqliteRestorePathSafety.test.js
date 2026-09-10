/**
 * GHSA-xfvx-j447-732c: the SQLite restore path let an attacker-influenced
 * `manifest.database.backup_file` replace the live database.
 *
 * Two independent bugs, both fixed here:
 *
 *   1. Candidate resolution (restoreService.js's performDatabaseRestore,
 *      ~L1000) tried an absolute `dbBackupFile` and a
 *      `path.join(backupPath, dbBackupFile)` candidate with NO check that
 *      the resolved path actually stayed inside the configured backup
 *      root — a manifest could point `.restore` at any file on disk.
 *
 *   2. The resolved path was interpolated unescaped into a
 *      `sqlite3 .restore '<path>'` dot-command string. sqlite3's CLI
 *      parses that string itself (not the shell), so a single quote in
 *      the path breaks out of the quoted argument regardless of
 *      spawn()'s `shell: false` argv separation.
 *
 * These tests pin the fix directly against the exported helpers
 * (`resolveContainedDbBackupCandidates`, `assertSafeSqlitePath`,
 * `isContainedInRoots`, `getConfiguredBackupRoots`) — the exact functions
 * `performDatabaseRestore` calls before ever running `sqlite3 .restore` —
 * rather than driving the full restore (which does a real `db.destroy()` +
 * live-file swap against the shared app db and isn't worth the added
 * fragility for what's fundamentally a path-validation contract).
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

process.env.NODE_ENV = 'test';
process.env.TEST_DATABASE_PATH = path.join(
  fs.mkdtempSync(path.join(os.tmpdir(), 'picpeak-restoresvc-')), 'db.sqlite',
);
process.env.JWT_SECRET = process.env.JWT_SECRET || 'restoresvc-test-secret';

const { bootCrmDb, seedMinimal } = require('../integration/helpers/crmDb');

describe('restoreService — sqlite restore path safety (GHSA-xfvx)', () => {
  let db; let cleanup; let _internal;
  let backupPath;

  beforeAll(async () => {
    ({ db, cleanup } = await bootCrmDb());
    await seedMinimal(db);

    // The restore run's resolved local backup root — analogous to
    // `localBackupPath` in restoreService.restore(). Real directory with a
    // real database/ subfolder, matching what a genuine backup run leaves
    // on disk.
    backupPath = fs.mkdtempSync(path.join(os.tmpdir(), 'picpeak-xfvx-backuproot-'));
    fs.mkdirSync(path.join(backupPath, 'database'), { recursive: true });

    ({ _internal } = require('../../src/services/restoreService'));
  }, 120000);

  afterAll(async () => { if (cleanup) await cleanup(); });

  describe('assertSafeSqlitePath — the sqlite3 dot-command injection gate', () => {
    it.each([
      ['/backup/database/picpeak-db-sqlite-1.sql'],
      [`${backupPath || '/backup'}/database/picpeak-db-sqlite-2024-01-01.sql.gz`],
    ])('accepts a normal backup path: %s', (p) => {
      expect(() => _internal.assertSafeSqlitePath(p)).not.toThrow();
    });

    it.each([
      ['/backup/database/x\'; DROP TABLE admin_users; --.sql'],
      ['/backup/database/x\' .restore \'/etc/passwd'],
      ['/backup/database/x\n.shell rm -rf /'],
      ['/backup/database/has space.sql'],
      ['/backup/database/semi;colon.sql'],
      [null],
      [undefined],
      [42],
    ])('rejects an unsafe/non-string path: %j', (p) => {
      expect(() => _internal.assertSafeSqlitePath(p)).toThrow(/unsafe path/i);
    });
  });

  describe('isContainedInRoots', () => {
    it('accepts a path inside a root', () => {
      expect(_internal.isContainedInRoots('/backup/database/x.sql', ['/backup'])).toBe(true);
    });

    it('accepts a root path equal to the root itself', () => {
      expect(_internal.isContainedInRoots('/backup', ['/backup'])).toBe(true);
    });

    it('rejects a path outside every root', () => {
      expect(_internal.isContainedInRoots('/etc/passwd', ['/backup'])).toBe(false);
    });

    it('rejects a sibling directory that merely shares a prefix', () => {
      // '/backup-evil' starts with the string '/backup' but is NOT inside it.
      expect(_internal.isContainedInRoots('/backup-evil/x.sql', ['/backup'])).toBe(false);
    });

    it('rejects a `..`-traversal path that resolves outside the root', () => {
      expect(_internal.isContainedInRoots('/backup/../etc/passwd', ['/backup'])).toBe(false);
    });
  });

  describe('getConfiguredBackupRoots', () => {
    afterEach(async () => {
      delete process.env.RESTORE_ALLOWED_ROOTS;
      await db('app_settings').whereIn('setting_key', ['backup_destination_path', 'backup_manifest_path']).del();
    });

    it('always includes the trusted root even with nothing else configured', async () => {
      const roots = await _internal.getConfiguredBackupRoots('/some/trusted/backup-path');
      expect(roots).toContain(path.resolve('/some/trusted/backup-path'));
    });

    it('adds configured backup_destination_path / backup_manifest_path and RESTORE_ALLOWED_ROOTS', async () => {
      await db('app_settings').insert([
        { setting_key: 'backup_destination_path', setting_value: JSON.stringify('/backup/dest'), setting_type: 'backup' },
        { setting_key: 'backup_manifest_path', setting_value: JSON.stringify('/backup/manifests'), setting_type: 'backup' },
      ]);
      process.env.RESTORE_ALLOWED_ROOTS = '/extra/root';

      const roots = await _internal.getConfiguredBackupRoots('/trusted');
      expect(roots).toEqual(expect.arrayContaining([
        path.resolve('/trusted'),
        path.resolve('/backup/dest'),
        path.resolve('/backup/manifests'),
        path.resolve('/extra/root'),
      ]));
    });
  });

  describe('resolveContainedDbBackupCandidates — the manifest.database.backup_file gate', () => {
    it('rejects an absolute backup_file outside every configured root, but still offers the safe legacy basename candidate', async () => {
      const candidates = await _internal.resolveContainedDbBackupCandidates(
        backupPath, '/etc/passwd', () => {}
      );
      // The raw absolute escape must NOT be present.
      expect(candidates).not.toContain('/etc/passwd');
      // Candidate (3), the basename-only legacy reconstruct, is inherently
      // safe (can't escape backupPath) and stays available as a fallback.
      expect(candidates).toContain(path.join(backupPath, 'database', 'passwd'));
    });

    it('rejects a `..`-traversal relative backup_file, keeping only the contained legacy candidate', async () => {
      const candidates = await _internal.resolveContainedDbBackupCandidates(
        backupPath, '../../../../etc/passwd', () => {}
      );
      const escaped = candidates.some((c) => !_internal.isContainedInRoots(c, [path.resolve(backupPath)]));
      expect(escaped).toBe(false);
      expect(candidates).toContain(path.join(backupPath, 'database', 'passwd'));
    });

    it('accepts a legitimate relative backup_file recorded by a real backup run', async () => {
      const candidates = await _internal.resolveContainedDbBackupCandidates(
        backupPath, 'database/picpeak-db-sqlite-2024-01-01.sql.gz', () => {}
      );
      expect(candidates).toContain(path.join(backupPath, 'database', 'picpeak-db-sqlite-2024-01-01.sql.gz'));
      // Every returned candidate must actually be safe to use.
      for (const c of candidates) {
        expect(_internal.isContainedInRoots(c, [path.resolve(backupPath)])).toBe(true);
      }
    });

    it('accepts a legitimate absolute backup_file that IS inside backupPath (the real dumper shape)', async () => {
      const absFile = path.join(backupPath, 'database', 'picpeak-db-sqlite-2024-02-02.sql.gz');
      const candidates = await _internal.resolveContainedDbBackupCandidates(
        backupPath, absFile, () => {}
      );
      expect(candidates).toContain(absFile);
    });
  });
});
