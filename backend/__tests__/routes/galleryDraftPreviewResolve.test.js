/**
 * Previewing an unpublished gallery through its SHORT share URL (#1386).
 *
 * /info has honoured admin_preview since #868, but two sibling routes never
 * did, and both sit on the short-URL path:
 *
 *   GET /resolve/:identifier      — filtered drafts out via ACTIVE_EVENT_FILTER
 *   GET /:slug/verify-token/:token — same, inline
 *
 * With "use short gallery URLs" OFF the admin's View Gallery link carries the
 * slug, GalleryPage never calls /resolve, and the preview worked. With it ON
 * the link is the token form, GalleryPage resolves it first, and the draft
 * 404'd as "Gallery Not Found" — which is exactly what was reported.
 *
 * The relaxation is admin-preview-only, so the other half of these tests is
 * the part that must NOT move: anonymous callers still get 404 for a draft,
 * and GHSA-rh8r's rule (never hand a share_token back on a bare slug lookup)
 * has to survive the new path too.
 */
const path = require('path');
const fs = require('fs');
const os = require('os');

process.env.NODE_ENV = 'test';
process.env.TEST_DATABASE_PATH = path.join(
  fs.mkdtempSync(path.join(os.tmpdir(), 'picpeak-draft-preview-')), 'db.sqlite',
);
process.env.JWT_SECRET = process.env.JWT_SECRET || 'draft-preview-test-secret';
process.env.STORAGE_PATH = fs.mkdtempSync(path.join(os.tmpdir(), 'picpeak-draft-preview-storage-'));

const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const { bootCrmDb, seedMinimal, assignAdminRole, mintAdminToken } = require('../integration/helpers/crmDb');

// Share-token fixtures, deliberately low-entropy and obviously fake. They
// have to satisfy SHARE_TOKEN_REGEX (32 hex chars), and random-looking hex of
// that shape is exactly what secret scanners flag — GitGuardian raised two
// "Generic High Entropy Secret" findings on the first version of this file.
const DRAFT_SLUG = 'draft-preview-event';
const DRAFT_TOKEN = 'deadbeefdeadbeefdeadbeefdeadbeef';
const LIVE_SLUG = 'published-event';
const LIVE_TOKEN = 'feedfacefeedfacefeedfacefeedface';

describe('draft preview through the short share URL (#1386)', () => {
  let db; let cleanup; let app; let adminId; let foreignId;

  // Stable's isAdminPreview accepts the token from the x-admin-preview header
  // (what the frontend sends) or ?preview= (what the page URL carries).
  const preview = (id = adminId) => `preview=${mintAdminToken(id)}`;
  const withHeader = (req, id = adminId) => req.set('x-admin-preview', mintAdminToken(id));

  async function insertEvent({ slug, token, isDraft }) {
    await db('events').insert({
      slug,
      event_type: 'wedding',
      event_name: slug,
      event_date: '2026-09-01',
      host_email: 'h@example.com',
      admin_email: 'a@example.com',
      password_hash: 'x',
      share_link: `/gallery/${slug}/${token}`,
      share_token: token,
      require_password: 0,
      expires_at: new Date(Date.now() + 7 * 864e5).toISOString(),
      is_active: 1,
      is_archived: 0,
      is_draft: isDraft ? 1 : 0,
      created_by: adminId,
      created_at: new Date().toISOString(),
    });
  }

  beforeAll(async () => {
    ({ db, cleanup } = await bootCrmDb());
    ({ adminId } = await seedMinimal(db));
    await assignAdminRole(db, adminId);
    const [row] = await db('admin_users').insert({
      username: 'foreign', email: 'foreign@example.test', password_hash: 'unused', is_active: 1,
    }).returning('id');
    foreignId = row?.id ?? row;
    await assignAdminRole(db, foreignId, 'viewer');

    await insertEvent({ slug: DRAFT_SLUG, token: DRAFT_TOKEN, isDraft: true });
    await insertEvent({ slug: LIVE_SLUG, token: LIVE_TOKEN, isDraft: false });

    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/api/gallery', require('../../src/routes/gallery'));
  }, 120000);

  afterAll(async () => { if (cleanup) await cleanup(); });

  describe('the reported case — admin previewing a draft', () => {
    it('resolves the draft by share token (was 404 "Gallery Not Found")', async () => {
      const res = await request(app).get(`/api/gallery/resolve/${DRAFT_TOKEN}?${preview()}`);
      expect(res.status).toBe(200);
      expect(res.body.slug).toBe(DRAFT_SLUG);
      expect(res.body.matchType).toBe('token');
    });

    it('resolves the draft by full share link', async () => {
      const identifier = encodeURIComponent(`/gallery/${DRAFT_SLUG}/${DRAFT_TOKEN}`);
      const res = await request(app).get(`/api/gallery/resolve/${identifier}?${preview()}`);
      expect(res.status).toBe(200);
      expect(res.body.slug).toBe(DRAFT_SLUG);
    });

    it('clears verify-token for the draft, the next step of the same flow', async () => {
      const res = await request(app)
        .get(`/api/gallery/${DRAFT_SLUG}/verify-token/${DRAFT_TOKEN}?${preview()}`);
      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(true);
    });
  });

  // The transport the SHIPPED frontend uses. The first cut of this fix only
  // tested ?preview=, which the browser never sends on an API call — so the
  // suite passed while the feature stayed broken end to end. Caught in review.
  describe('the header transport the frontend actually sends', () => {
    it('resolves the draft from the x-admin-preview header alone', async () => {
      const res = await withHeader(request(app).get(`/api/gallery/resolve/${DRAFT_TOKEN}`));
      expect(res.status).toBe(200);
      expect(res.body.slug).toBe(DRAFT_SLUG);
    });

    it('clears verify-token from the header alone', async () => {
      const res = await withHeader(
        request(app).get(`/api/gallery/${DRAFT_SLUG}/verify-token/${DRAFT_TOKEN}`),
      );
      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(true);
    });

    it('serves /info for the draft from the header alone', async () => {
      const res = await withHeader(request(app).get(`/api/gallery/${DRAFT_SLUG}/info`));
      expect(res.status).toBe(200);
    });

    it('404s when the header carries something that is not an admin JWT', async () => {
      const res = await request(app)
        .get(`/api/gallery/resolve/${DRAFT_TOKEN}`)
        .set('x-admin-preview', 'not-a-jwt');
      expect(res.status).toBe(404);
    });
  });

  describe('what must not move', () => {
    it('404s an anonymous resolve of the draft token', async () => {
      const res = await request(app).get(`/api/gallery/resolve/${DRAFT_TOKEN}`);
      expect(res.status).toBe(404);
    });

    it('404s when ?preview= carries a token that is not a valid admin JWT', async () => {
      const res = await request(app).get(`/api/gallery/resolve/${DRAFT_TOKEN}?preview=not-a-jwt`);
      expect(res.status).toBe(404);
    });

    it('404s when ?preview= is absent entirely', async () => {
      const res = await request(app).get(`/api/gallery/resolve/${DRAFT_TOKEN}?preview=`);
      expect(res.status).toBe(404);
    });

    // Documenting stable's actual reach, not endorsing it: isAdminPreview here
    // checks the JWT signature and type only — no role, permission or event
    // ownership. /info has the same reach for drafts, so this route now matches
    // it rather than being stricter than the branch it lives on. Main tightened
    // this by routing preview through verifyAdminPreview -> access.authorize.
    it('accepts any valid admin token, matching /info on this branch', async () => {
      const res = await request(app).get(`/api/gallery/resolve/${DRAFT_TOKEN}?${preview(foreignId)}`);
      expect(res.status).toBe(200);

      const info = await request(app)
        .get(`/api/gallery/${DRAFT_SLUG}/info?${preview(foreignId)}`);
      expect(info.status).toBe(200);
    });

    it('404s an anonymous verify-token for the draft', async () => {
      const res = await request(app)
        .get(`/api/gallery/${DRAFT_SLUG}/verify-token/${DRAFT_TOKEN}`);
      expect(res.status).toBe(404);
    });

    it('still withholds the share_token on a bare slug lookup (GHSA-rh8r)', async () => {
      // The draft path must not become a way around the token-withholding rule.
      const res = await request(app).get(`/api/gallery/resolve/${DRAFT_SLUG}?${preview()}`);
      expect(res.status).toBe(200);
      expect(res.body.matchType).toBe('slug');
      expect(res.body.token).toBeUndefined();
      expect(res.body.share_link).toBeUndefined();
      expect(res.body.share_url).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toContain(DRAFT_TOKEN);
    });

    it('leaves the published gallery resolving anonymously, as before', async () => {
      const res = await request(app).get(`/api/gallery/resolve/${LIVE_TOKEN}`);
      expect(res.status).toBe(200);
      expect(res.body.slug).toBe(LIVE_SLUG);
      expect(res.body.token).toBe(LIVE_TOKEN);
    });

    it('still 404s an identifier that matches nothing', async () => {
      const res = await request(app).get(`/api/gallery/resolve/no-such-gallery?${preview()}`);
      expect(res.status).toBe(404);
    });
  });
});
