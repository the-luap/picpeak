/**
 * generateVideoPlaceholder() must not touch the database when the caller
 * already supplies width/height (videoProcessor.js's thumbnail-generation
 * fallback does exactly this).
 *
 * Why it matters: processUploadedPhotos() (chunked video upload) holds a
 * per-file SQLite transaction open across thumbnail generation. SQLite's
 * knex pool defaults to a single connection, so any second, un-transacted
 * db() query made while that transaction is open blocks until
 * acquireConnectionTimeout (60s in production) — verified directly against
 * an isolated SQLite db (codex review of #1371/#1372). Passing explicit
 * dimensions must skip getThumbnailSettings()'s db() call entirely, not
 * just tolerate its failure.
 */

const path = require('path');
const fs = require('fs').promises;
const os = require('os');

const mockDbSpy = jest.fn(() => {
  throw new Error('db() must not be called when width/height are supplied');
});
jest.mock('../../src/database/db', () => ({ db: (...args) => mockDbSpy(...args) }));

const storageModule = require('../../src/services/storage');
const LocalFsStorage = require('../../src/services/storage/LocalFsStorage');

describe('generateVideoPlaceholder skips the settings DB lookup given explicit dimensions', () => {
  let storage;
  let root;
  let imageProcessor;

  beforeAll(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'picpeak-vidplaceholder-'));
    storage = new LocalFsStorage({ root });
    await storage.init();
    storageModule.setStorageForTesting(storage);
    imageProcessor = require('../../src/services/imageProcessor');
  }, 30000);

  afterAll(async () => {
    storageModule.resetStorage();
    await fs.rm(root, { recursive: true, force: true }).catch(() => {});
  });

  afterEach(() => mockDbSpy.mockClear());

  it('never calls db() when width/height are provided', async () => {
    const key = await imageProcessor.generateVideoPlaceholder('demo.mp4', { width: 300, height: 300 });

    expect(key).toBe('thumbnails/thumb_demo.jpg');
    expect(await storage.exists(key)).toBe(true);
    expect(mockDbSpy).not.toHaveBeenCalled();
  });

  it('falls through to defaults (not a throw) when db() fails and no dimensions were given', async () => {
    const key = await imageProcessor.generateVideoPlaceholder('demo2.mp4');

    expect(key).toBe('thumbnails/thumb_demo2.jpg');
    expect(mockDbSpy).toHaveBeenCalled();
  });
});
