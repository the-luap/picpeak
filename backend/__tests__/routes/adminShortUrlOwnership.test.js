/**
 * GHSA-9h7q-2jpf-vj85 — DELETE /api/admin/short-urls/:id only checked
 * `events.edit` permission, with no ownership scoping. GET and POST for an
 * event's short URLs both chain requireEventOwnership; DELETE takes the
 * short URL row's own :id (not :eventId), so any admin holding events.edit
 * could delete another admin's branded gallery short URL. The route now
 * resolves the short URL's event first and applies the same ownership
 * predicate requireEventOwnership uses. super_admin keeps global access.
 */
const path = require('path');
const fs = require('fs');
const os = require('os');

process.env.NODE_ENV = 'test';
process.env.TEST_DATABASE_PATH = path.join(
  fs.mkdtempSync(path.join(os.tmpdir(), 'picpeak-suown-')), 'db.sqlite',
);
process.env.JWT_SECRET = process.env.JWT_SECRET || 'suown-test-secret';
process.env.STORAGE_PATH = fs.mkdtempSync(path.join(os.tmpdir(), 'picpeak-suown-storage-'));

const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const { bootCrmDb, assignAdminRole, mintAdminToken } = require('../integration/helpers/crmDb');

describe('short URL delete ownership scoping', () => {
  let db; let cleanup; let app; let service;
  let superTok; let ownerTok; let foreignTok;
  let ownerId;
  let foreignShortUrlId;

  const auth = (req, tok) => req.set('Authorization', `Bearer ${tok}`);

  async function seedEvent(createdBy, slugSuffix) {
    const farFuture = new Date(Date.now() + 365 * 86400000).toISOString();
    const [id] = await db('events').insert({
      slug: `suown-${slugSuffix}`,
      event_type: 'wedding',
      event_name: 'Test Event',
      event_date: '2026-08-01',
      host_email: 'h@e.com',
      admin_email: 'a@e.com',
      password_hash: 'x',
      share_link: `suown-${slugSuffix}`,
      share_token: `suown-share-${slugSuffix}`,
      expires_at: farFuture,
      is_active: true,
      is_archived: false,
      created_by: createdBy,
      created_at: new Date().toISOString(),
    });
    return db('events').where({ id }).first();
  }

  beforeAll(async () => {
    ({ db, cleanup } = await bootCrmDb());
    service = require('../../src/services/galleryShortUrlService');

    const superIns = await db('admin_users').insert({
      username: 'suown-super', email: 'suown-super@example.com',
      password_hash: 'x', must_change_password: false, created_at: new Date(),
    }).returning('id');
    const superId = superIns[0]?.id ?? superIns[0];
    await assignAdminRole(db, superId, 'super_admin');
    superTok = mintAdminToken(superId);

    const ownerIns = await db('admin_users').insert({
      username: 'suown-owner', email: 'suown-owner@example.com',
      password_hash: 'x', must_change_password: false, created_at: new Date(),
    }).returning('id');
    ownerId = ownerIns[0]?.id ?? ownerIns[0];
    await assignAdminRole(db, ownerId, 'editor');
    ownerTok = mintAdminToken(ownerId);

    const foreignIns = await db('admin_users').insert({
      username: 'suown-foreign', email: 'suown-foreign@example.com',
      password_hash: 'x', must_change_password: false, created_at: new Date(),
    }).returning('id');
    const foreignId = foreignIns[0]?.id ?? foreignIns[0];
    await assignAdminRole(db, foreignId, 'editor');
    foreignTok = mintAdminToken(foreignId);

    // Event owned by `owner`, NOT `foreign`.
    await seedEvent(ownerId, 'owned');

    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/api/admin', require('../../src/routes/adminShortUrls'));
  }, 120000);

  afterAll(async () => { if (cleanup) await cleanup(); });

  beforeEach(async () => {
    // Fresh short URL per DELETE test so earlier deletes don't interfere.
    const event = await db('events').where({ created_by: ownerId }).first();
    const row = await service.createShortUrl({
      eventId: event.id,
      customSlug: `suown-target-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdBy: ownerId,
    });
    foreignShortUrlId = row.id;
  });

  it('an admin who does not own the event cannot delete its short URL (403, row survives)', async () => {
    const res = await auth(
      request(app).delete(`/api/admin/short-urls/${foreignShortUrlId}`),
      foreignTok,
    );
    expect(res.status).toBe(403);
    const row = await db('gallery_short_urls').where({ id: foreignShortUrlId }).first();
    expect(row).toBeDefined();
    expect(row.deleted_at).toBeFalsy();
  });

  it('the owning admin can delete its own short URL', async () => {
    const res = await auth(
      request(app).delete(`/api/admin/short-urls/${foreignShortUrlId}`),
      ownerTok,
    );
    expect(res.status).toBe(204);
    const row = await db('gallery_short_urls').where({ id: foreignShortUrlId }).first();
    expect(row.deleted_at).toBeTruthy();
  });

  it('super_admin can delete any short URL', async () => {
    const res = await auth(
      request(app).delete(`/api/admin/short-urls/${foreignShortUrlId}`),
      superTok,
    );
    expect(res.status).toBe(204);
    const row = await db('gallery_short_urls').where({ id: foreignShortUrlId }).first();
    expect(row.deleted_at).toBeTruthy();
  });

  it('deleting a nonexistent short URL id returns 404', async () => {
    const res = await auth(
      request(app).delete('/api/admin/short-urls/9999999'),
      superTok,
    );
    expect(res.status).toBe(404);
  });

  it('deleting a nonexistent short URL id as a non-owner also returns 404 (existence check runs first)', async () => {
    const res = await auth(
      request(app).delete('/api/admin/short-urls/9999999'),
      foreignTok,
    );
    expect(res.status).toBe(404);
  });
});
