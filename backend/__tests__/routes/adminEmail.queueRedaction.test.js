/**
 * The Messages reading pane must not serve passwords (see
 * utils/emailSecretRedaction.js). Rows sent before the processor learned to
 * scrub still carry the gallery password in email_data and rendered_html;
 * the route redacts them on read.
 */
const path = require('path');
const fs = require('fs');
const os = require('os');

process.env.NODE_ENV = 'test';
process.env.TEST_DATABASE_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'picpeak-paneredact-')), 'db.sqlite');
process.env.JWT_SECRET = process.env.JWT_SECRET || 'paneredact-test-secret';
process.env.STORAGE_PATH = fs.mkdtempSync(path.join(os.tmpdir(), 'picpeak-paneredact-storage-'));

const request = require('supertest');
const { bootCrmDb, seedMinimal, assignAdminRole, mintAdminToken, buildRouteApp } = require('../integration/helpers/crmDb');
const { invalidateFeatureFlagCache } = require('../../src/middleware/requireFeatureFlag');
const { MASK } = require('../../src/utils/emailSecretRedaction');

describe('GET /admin/email/queue/:id redacts secrets from legacy rows', () => {
  let db; let cleanup; let app; let token; let rowId;
  const PASSWORD = 'Sunset-42!'; const PIN = 'Tom & Ada\'s 7788';

  beforeAll(async () => {
    ({ db, cleanup } = await bootCrmDb());
    const { adminId } = await seedMinimal(db);
    await assignAdminRole(db, adminId, 'super_admin');
    token = mintAdminToken(adminId);
    await db('feature_flags').insert({ key: 'messaging', value: true }).onConflict('key').merge({ value: true });
    invalidateFeatureFlagCache();
    const ins = await db('email_queue').insert({
      recipient_email: 'client@example.com', email_type: 'gallery_created', status: 'sent',
      created_at: new Date().toISOString(), sent_at: new Date().toISOString(), retry_count: 0,
      email_data: JSON.stringify({ customer_name: 'Ada', gallery_password: PASSWORD, client_password: PIN, cc: ['second@example.com'] }),
      rendered_html: `<ul><li>Password: ${PASSWORD}</li><li>PIN: Tom &amp; Ada&#39;s 7788</li></ul>`,
    }).returning('id');
    rowId = ins[0]?.id ?? ins[0];
    app = buildRouteApp('/api/admin/email', require('../../src/routes/adminEmail'));
  }, 120000);
  afterAll(async () => { if (cleanup) await cleanup(); });

  it('masks the password and the PIN in the rendered body, keeps the rest', async () => {
    const res = await request(app).get(`/api/admin/email/queue/${rowId}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.renderedHtml).not.toContain(PASSWORD);
    expect(res.body.renderedHtml).not.toContain('Ada&#39;s 7788');
    expect(res.body.renderedHtml).toContain(`Password: ${MASK}`);
    expect(res.body.renderedHtml).toContain(`PIN: ${MASK}`);
    expect(res.body.cc).toBe('second@example.com');
    expect(JSON.stringify(res.body)).not.toContain(PASSWORD);
    // the stored row is untouched by a read
    const row = await db('email_queue').where('id', rowId).first();
    expect(row.rendered_html).toContain(PASSWORD);
  });
});
