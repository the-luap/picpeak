const knex = require('knex');
const { randomUUID } = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const request = require('supertest');
const pgUrl = process.env.PICPEAK_PG_TEST_URL;
(pgUrl ? describe : describe.skip)('fresh PostgreSQL gallery contract', () => {
  let owner, db, schema, tmpDir, cleanup, previousClient;
  beforeAll(async () => {
    schema = `fresh_gallery_${randomUUID().replace(/-/g, '')}`;
    owner = knex({ client: 'pg', connection: pgUrl });
    await owner.schema.createSchema(schema);
    previousClient = process.env.DATABASE_CLIENT;
    process.env.DATABASE_CLIENT = 'pg';
    process.env.JWT_SECRET = 'fresh-pg-gallery-test-secret-at-least-32-characters';
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'picpeak-fresh-pg-'));
    process.env.STORAGE_PATH = path.join(tmpDir, 'storage');
    jest.doMock('../../knexfile', () => ({ client: 'pg', connection: pgUrl, searchPath: [schema] }));
    ({ db } = require('../../src/database/db'));
    // bootCrmDb runs the complete core chain against the shared db singleton.
    ({ cleanup } = await require('../integration/helpers/crmDb').bootCrmDb());
  }, 120000);
  afterAll(async () => {
    await require('../../src/services/serviceShutdown').stopServices();
    if (cleanup) await cleanup(); else if (db) await db.destroy();
    if (owner) { await owner.schema.dropSchema(schema, true); await owner.destroy(); }
    if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
    if (previousClient === undefined) delete process.env.DATABASE_CLIENT; else process.env.DATABASE_CLIENT = previousClient;
    jest.dontMock('../../knexfile');
  });
  it('creates through the real admin route, then toggles a typed boolean and timestamp', async () => {
    const { seedMinimal, assignAdminRole, mintAdminToken, buildRouteApp } = require('../integration/helpers/crmDb');
    const { adminId } = await seedMinimal(db);
    await assignAdminRole(db, adminId);
    const app = buildRouteApp('/api/admin/events', require('../../src/routes/adminEvents'));
    const bearer = `Bearer ${mintAdminToken(adminId)}`;
    const created = await request(app).post('/api/admin/events').set('Authorization', bearer).send({
      event_type: 'wedding', event_name: 'Fresh PostgreSQL', event_date: '2026-10-01',
      customer_name: 'Customer', customer_email: 'customer@example.test', admin_email: 'admin@example.test',
      password: 'Strong-Test-Photo-Pass-924!', expiration_days: 30, feedback_enabled: true,
    });
    expect(created.status).toBe(200);
    const event = await db('events').where({ event_name: 'Fresh PostgreSQL' }).first();
    expect(event.created_by).toBe(adminId);
    expect(event.is_active).toBe(true);
    expect(event.updated_at).toBeInstanceOf(Date);
    expect(await db('event_feedback_settings').where({ event_id: event.id }).first()).toBeTruthy();
    const toggled = await request(app).post(`/api/admin/events/${event.id}/toggle-status`).set('Authorization', bearer).send({});
    expect(toggled.status).toBe(200);
    const row = await db('events').where({ id: event.id }).first();
    expect(row.is_active).toBe(false);
    expect(row.updated_at).toBeInstanceOf(Date);
    await require('../../migrations/core/210_events_updated_at').up(db);
    expect((await db('events').where({ id: event.id }).first()).updated_at).toEqual(row.updated_at);
  });
});
