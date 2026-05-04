const fs = require('fs');
const fsPromises = fs.promises;
const os = require('os');
const path = require('path');

// Silence the logger so test output stays clean. Capture calls so the
// "warning logged" assertions can still verify behaviour.
jest.mock('../../src/utils/logger', () => ({
  warn: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const logger = require('../../src/utils/logger');

let bundledRoot;
let userRoot;
let fontsService;

/**
 * Create a font family folder with the given weights (and optional meta.json).
 * @param {string} root absolute path to the bundled or user root
 * @param {string} folderName e.g. "Inter" or "Playfair-Display"
 * @param {Array<number>|Array<string>} weights numeric weights (creates `<w>.woff2`)
 *                                              or filenames to create directly
 * @param {Object|null} meta optional meta.json contents (object) or null
 */
async function makeFamily(root, folderName, weights, meta = null) {
  const dir = path.join(root, folderName);
  await fsPromises.mkdir(dir, { recursive: true });
  for (const w of weights) {
    const fname = typeof w === 'number' ? `${w}.woff2` : w;
    await fsPromises.writeFile(path.join(dir, fname), Buffer.from([]));
  }
  if (meta !== null) {
    await fsPromises.writeFile(
      path.join(dir, 'meta.json'),
      typeof meta === 'string' ? meta : JSON.stringify(meta)
    );
  }
  return dir;
}

beforeEach(async () => {
  jest.clearAllMocks();

  bundledRoot = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'picpeak-fonts-bundled-'));
  userRoot = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'picpeak-fonts-user-'));

  process.env.PICPEAK_BUNDLED_FONTS_ROOT = bundledRoot;
  // The user root resolves under STORAGE_PATH/fonts, so STORAGE_PATH must
  // point at the parent of userRoot — we name the leaf "fonts" ourselves.
  const storageParent = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'picpeak-fonts-storage-'));
  await fsPromises.rename(userRoot, path.join(storageParent, 'fonts'));
  userRoot = path.join(storageParent, 'fonts');
  process.env.STORAGE_PATH = storageParent;

  // Re-require fresh after env is set so module-level constants (none here,
  // but cache state is module-level) start clean.
  jest.resetModules();
  fontsService = require('../../src/services/fontsService');
  fontsService.clearFontsCache();
});

afterEach(async () => {
  fontsService.clearFontsCache();
  await fsPromises.rm(bundledRoot, { recursive: true, force: true }).catch(() => {});
  // userRoot's parent is the actual mkdtemp; remove it.
  await fsPromises.rm(path.dirname(userRoot), { recursive: true, force: true }).catch(() => {});
  delete process.env.PICPEAK_BUNDLED_FONTS_ROOT;
  delete process.env.STORAGE_PATH;
});

describe('fontsService.listFonts', () => {
  describe('roots', () => {
    test('empty bundled root + missing user root → []', async () => {
      // delete user root so it triggers ENOENT
      await fsPromises.rm(path.dirname(userRoot), { recursive: true, force: true });
      const fonts = await fontsService.listFonts();
      expect(fonts).toEqual([]);
    });

    test('missing bundled root (ENOENT) → [], does not throw', async () => {
      await fsPromises.rm(bundledRoot, { recursive: true, force: true });
      const fonts = await fontsService.listFonts();
      expect(fonts).toEqual([]);
    });

    test('non-directory entries at the root are skipped', async () => {
      await fsPromises.writeFile(path.join(bundledRoot, 'README.md'), 'hi');
      await makeFamily(bundledRoot, 'Inter', [400, 700]);
      const fonts = await fontsService.listFonts();
      expect(fonts.map((f) => f.family)).toEqual(['Inter']);
    });

    test('hidden folders are skipped', async () => {
      await makeFamily(bundledRoot, '.git', [400]);
      await makeFamily(bundledRoot, '.DS_Store', [400]);
      await makeFamily(bundledRoot, 'Inter', [400]);
      const fonts = await fontsService.listFonts();
      expect(fonts.map((f) => f.family)).toEqual(['Inter']);
    });
  });

  describe('weight parsing', () => {
    test('three weight files → sorted ascending', async () => {
      await makeFamily(bundledRoot, 'Inter', [700, 400, 600]);
      const [inter] = await fontsService.listFonts();
      expect(inter.weights).toEqual([400, 600, 700]);
    });

    test('non-numeric filenames are ignored', async () => {
      await makeFamily(bundledRoot, 'Inter', ['bold.woff2', 'regular.woff2', '400.woff2', '700.woff2']);
      const [inter] = await fontsService.listFonts();
      expect(inter.weights).toEqual([400, 700]);
    });

    test('non-.woff2 files are ignored', async () => {
      await makeFamily(bundledRoot, 'Inter', ['400.ttf', '400.woff', '400.woff2', '700.otf']);
      const [inter] = await fontsService.listFonts();
      expect(inter.weights).toEqual([400]);
    });

    test('weight values out of range (sub-1 / over-1000) are ignored', async () => {
      await makeFamily(bundledRoot, 'Inter', [0, 400, 1001, 700]);
      const [inter] = await fontsService.listFonts();
      expect(inter.weights).toEqual([400, 700]);
    });

    test('family folder with no usable .woff2 files is silently skipped', async () => {
      await makeFamily(bundledRoot, 'NoWeights', ['readme.txt', 'bold.ttf']);
      await makeFamily(bundledRoot, 'Inter', [400]);
      const fonts = await fontsService.listFonts();
      expect(fonts.map((f) => f.family)).toEqual(['Inter']);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Skipping NoWeights')
      );
    });
  });

  describe('folder name → display family', () => {
    test('hyphens become spaces', async () => {
      await makeFamily(bundledRoot, 'Playfair-Display', [400]);
      const [pd] = await fontsService.listFonts();
      expect(pd.family).toBe('Playfair Display');
    });

    test('case is preserved', async () => {
      await makeFamily(bundledRoot, 'IBM-Plex-Sans', [400]);
      const [ibm] = await fontsService.listFonts();
      expect(ibm.family).toBe('IBM Plex Sans');
    });
  });

  describe('user-overrides-bundled', () => {
    test('user folder of the same family wins; weights come from user', async () => {
      await makeFamily(bundledRoot, 'Inter', [400, 600, 700]);
      await makeFamily(userRoot, 'Inter', [400, 900]); // different weights
      const [inter] = await fontsService.listFonts();
      expect(inter.weights).toEqual([400, 900]);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('overrides bundled default')
      );
    });

    test('user-only family is included', async () => {
      await makeFamily(userRoot, 'Lobster', [400]);
      const fonts = await fontsService.listFonts();
      expect(fonts.map((f) => f.family)).toEqual(['Lobster']);
    });

    test('case-insensitive duplicate within the same root → second skipped, warning', async () => {
      // Two different folder names both producing the family "Inter".
      // On case-insensitive filesystems (APFS) this can't actually happen at
      // the FS layer; we simulate by using two different display names that
      // normalize identically. "Inter" and "INTER" lowercase to the same key.
      await makeFamily(bundledRoot, 'Inter', [400]);
      await makeFamily(bundledRoot, 'INTER', [700]);
      const fonts = await fontsService.listFonts();
      expect(fonts).toHaveLength(1);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Duplicate family')
      );
    });
  });

  describe('meta.json — generic fallback', () => {
    test('valid generic="serif"', async () => {
      await makeFamily(bundledRoot, 'Playfair-Display', [400], { generic: 'serif' });
      const [pd] = await fontsService.listFonts();
      expect(pd.generic).toBe('serif');
    });

    test('valid generic="cursive"', async () => {
      await makeFamily(bundledRoot, 'Comic-Neue', [400], { generic: 'cursive' });
      const [cn] = await fontsService.listFonts();
      expect(cn.generic).toBe('cursive');
    });

    test('valid generic="monospace"', async () => {
      await makeFamily(bundledRoot, 'Fira-Mono', [400], { generic: 'monospace' });
      const [fm] = await fontsService.listFonts();
      expect(fm.generic).toBe('monospace');
    });

    test('missing meta.json → defaults to sans-serif (no warning)', async () => {
      await makeFamily(bundledRoot, 'Inter', [400]);
      const [inter] = await fontsService.listFonts();
      expect(inter.generic).toBe('sans-serif');
      // No warning for the missing-file case (it's the normal path).
      const noisy = (logger.warn.mock.calls || []).filter((c) =>
        String(c[0]).includes('meta.json')
      );
      expect(noisy).toEqual([]);
    });

    test('invalid generic value → defaults to sans-serif, warning logged', async () => {
      await makeFamily(bundledRoot, 'Inter', [400], { generic: 'bogus' });
      const [inter] = await fontsService.listFonts();
      expect(inter.generic).toBe('sans-serif');
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('invalid generic "bogus"')
      );
    });

    test('malformed JSON → defaults to sans-serif, warning logged', async () => {
      await makeFamily(bundledRoot, 'Inter', [400], '{ this is not json');
      const [inter] = await fontsService.listFonts();
      expect(inter.generic).toBe('sans-serif');
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('not valid JSON')
      );
    });
  });

  describe('result shape', () => {
    test('every family is { family, weights, generic }', async () => {
      await makeFamily(bundledRoot, 'Inter', [400, 700]);
      await makeFamily(bundledRoot, 'Playfair-Display', [400], { generic: 'serif' });
      const fonts = await fontsService.listFonts();
      for (const f of fonts) {
        expect(f).toEqual({
          family: expect.any(String),
          weights: expect.any(Array),
          generic: expect.stringMatching(/^(sans-serif|serif|cursive|monospace)$/)
        });
        expect(f.weights.length).toBeGreaterThan(0);
      }
    });

    test('output sorted alphabetically by family', async () => {
      await makeFamily(bundledRoot, 'Zilla-Slab', [400]);
      await makeFamily(bundledRoot, 'Alpha-Sans', [400]);
      await makeFamily(bundledRoot, 'Mid-Pack', [400]);
      const fonts = await fontsService.listFonts();
      expect(fonts.map((f) => f.family)).toEqual([
        'Alpha Sans',
        'Mid Pack',
        'Zilla Slab'
      ]);
    });
  });

  describe('cache', () => {
    test('cache hit: second call within TTL does not re-readdir', async () => {
      await makeFamily(bundledRoot, 'Inter', [400]);
      const spy = jest.spyOn(fsPromises, 'readdir');
      await fontsService.listFonts();
      const callsAfterFirst = spy.mock.calls.length;
      await fontsService.listFonts();
      expect(spy.mock.calls.length).toBe(callsAfterFirst);
      spy.mockRestore();
    });

    test('clearFontsCache forces a fresh scan on the next call', async () => {
      await makeFamily(bundledRoot, 'Inter', [400]);
      await fontsService.listFonts();

      // Add a new family AFTER the cache was populated.
      await makeFamily(bundledRoot, 'Roboto', [400]);

      // Without clearing, listFonts returns the stale cache.
      const stale = await fontsService.listFonts();
      expect(stale.map((f) => f.family)).toEqual(['Inter']);

      // After clear, the new family appears.
      fontsService.clearFontsCache();
      const fresh = await fontsService.listFonts();
      expect(fresh.map((f) => f.family)).toEqual(['Inter', 'Roboto']);
    });
  });
});
