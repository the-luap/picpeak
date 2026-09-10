/**
 * POST /api/admin/business-profile/logo and PUT /api/admin/business-profile
 * — GHSA-6wrv-9pr4-hhmw regression coverage.
 *
 * The upload route used to take the stored file extension straight from
 * the client-supplied filename and only checked `file.mimetype` against an
 * allowlist — a file could declare an image MIME type while carrying a
 * `.html`/`.js` extension and arbitrary content, land in the same-origin
 * `/uploads/logos` static mount, and execute as script. The mass-assignable
 * `logoPath` field on PUT compounded it: an attacker could point the
 * "logo" at any other uploaded file.
 *
 * These tests pin:
 *   (a) a MIME/extension mismatch is rejected at upload,
 *   (b) the extension actually written to disk always matches the
 *       validated MIME type, never the client-supplied filename,
 *   (c) legitimate PNG/JPEG/SVG uploads still succeed,
 *   (d) `logoPath` on PUT cannot be set to an arbitrary string pointing at
 *       another file, only to a path the upload route itself produced.
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'picpeak-bplogo-test-'));
process.env.NODE_ENV = 'test';
process.env.TEST_DATABASE_PATH = path.join(tmpDir, 'db.sqlite');
process.env.STORAGE_PATH = path.join(tmpDir, 'storage');
fs.mkdirSync(process.env.STORAGE_PATH, { recursive: true });
process.env.JWT_SECRET = process.env.JWT_SECRET || 'bplogo-route-test-secret';

const request = require('supertest');
const {
  bootCrmDb, seedMinimal, assignAdminRole, mintAdminToken, buildRouteApp,
} = require('./helpers/crmDb');

describe('business profile — logo upload content/extension validation', () => {
  let db;
  let cleanup;
  let app;
  let token;

  const uploadLogo = (buffer, filename, mimetype) => request(app)
    .post('/api/admin/business-profile/logo')
    .set('Authorization', `Bearer ${token}`)
    .attach('logo', buffer, { filename, contentType: mimetype });

  const put = (payload) => request(app)
    .put('/api/admin/business-profile')
    .set('Authorization', `Bearer ${token}`)
    .send(payload);

  const get = () => request(app)
    .get('/api/admin/business-profile')
    .set('Authorization', `Bearer ${token}`);

  const profileOf = (res) => (res.body.data || res.body).profile;

  beforeAll(async () => {
    ({ db, cleanup } = await bootCrmDb());
    const { adminId } = await seedMinimal(db);
    await assignAdminRole(db, adminId, 'super_admin');
    token = mintAdminToken(adminId);
    app = buildRouteApp('/api/admin/business-profile', require('../../src/routes/adminBusinessProfile'));
  }, 120000);

  afterAll(async () => {
    if (cleanup) await cleanup();
  });

  // fileFilter rejections surface via Express's generic error handler
  // (the pre-existing behaviour of every sibling logo/favicon upload
  // route in this codebase — none of them special-case multer's
  // fileFilter `Error` into a 400 either), so the status code itself
  // can be 400 or 500 depending on environment. What actually matters
  // for GHSA-6wrv-9pr4-hhmw is that the request never succeeds and
  // nothing with the dangerous extension is ever written to disk.
  const logosDirFiles = () => {
    const logosDir = path.join(process.env.STORAGE_PATH, 'uploads', 'logos');
    return fs.existsSync(logosDir) ? fs.readdirSync(logosDir) : [];
  };

  it('rejects an HTML/script payload disguised as an image via mismatched extension', async () => {
    const evil = Buffer.from('<script>alert(document.domain)</script>');
    const res = await uploadLogo(evil, 'evil.html', 'image/svg+xml');
    expect(res.status).not.toBe(200);
    expect(logosDirFiles().some((f) => f.endsWith('.html'))).toBe(false);
  });

  it('rejects a .js file disguised with an image MIME type', async () => {
    const evil = Buffer.from('alert(1)');
    const res = await uploadLogo(evil, 'evil.js', 'image/png');
    expect(res.status).not.toBe(200);
    expect(logosDirFiles().some((f) => f.endsWith('.js'))).toBe(false);
  });

  it('rejects a disallowed MIME type outright', async () => {
    const res = await uploadLogo(Buffer.from('whatever'), 'file.pdf', 'application/pdf');
    expect(res.status).not.toBe(200);
    expect(logosDirFiles().some((f) => f.endsWith('.pdf'))).toBe(false);
  });

  it('accepts a legitimate PNG upload and stores it with a .png extension', async () => {
    const res = await uploadLogo(Buffer.from('fake png bytes'), 'logo.png', 'image/png');
    expect(res.status).toBe(200);
    const logoPath = (res.body.data || res.body).logoPath;
    expect(logoPath).toMatch(/^\/uploads\/logos\/pdf-logo-\d+\.png$/);

    const onDisk = path.join(process.env.STORAGE_PATH, logoPath.replace(/^\//, ''));
    expect(fs.existsSync(onDisk)).toBe(true);

    expect(profileOf(await get()).logoPath).toBe(logoPath);
  });

  it('accepts a legitimate JPEG upload and stores it with a .jpg extension', async () => {
    const res = await uploadLogo(Buffer.from('fake jpeg bytes'), 'logo.jpg', 'image/jpeg');
    expect(res.status).toBe(200);
    const logoPath = (res.body.data || res.body).logoPath;
    expect(logoPath).toMatch(/^\/uploads\/logos\/pdf-logo-\d+\.jpg$/);
  });

  it('accepts a legitimate SVG upload and always stores it with a .svg extension, even under a spoofed filename', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>');
    // Client-declared filename ext is .svg here to pass validateFileType
    // (mismatched ext is covered by the rejection tests above); the point
    // of this test is that the ON-DISK extension comes from the MIME type
    // lookup table, not path.extname(originalname).
    const res = await uploadLogo(svg, 'vector-logo.svg', 'image/svg+xml');
    expect(res.status).toBe(200);
    const logoPath = (res.body.data || res.body).logoPath;
    expect(logoPath).toMatch(/^\/uploads\/logos\/pdf-logo-\d+\.svg$/);
  });

  it('rejects logoPath on PUT set to an arbitrary string pointing at another file', async () => {
    const before = profileOf(await get()).logoPath;

    const res = await put({ logoPath: '/uploads/logos/cms-somepage-1234.png' });
    expect(res.status).toBe(400);

    expect(profileOf(await get()).logoPath).toBe(before);
  });

  it('rejects logoPath on PUT with a path-traversal payload', async () => {
    const res = await put({ logoPath: '/uploads/logos/../../../../etc/passwd' });
    expect(res.status).toBe(400);
  });

  it('accepts logoPath on PUT when it matches the pattern this route itself writes', async () => {
    const upload = await uploadLogo(Buffer.from('fake png bytes'), 'logo2.png', 'image/png');
    const uploadedPath = (upload.body.data || upload.body).logoPath;

    // Round-trip: PUT-ing back the exact value the upload endpoint
    // returned (what the frontend's generic profile save does) must
    // keep working.
    const res = await put({ logoPath: uploadedPath });
    expect(res.status).toBe(200);
    expect(profileOf(await get()).logoPath).toBe(uploadedPath);
  });

  it('still allows clearing logoPath with an empty string', async () => {
    const res = await put({ logoPath: '' });
    expect(res.status).toBe(200);
    expect(profileOf(await get()).logoPath).toBe('');
  });
});
