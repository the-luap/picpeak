/** Persisted contracts, not a mock tied to the number/order of Knex calls. */
const { bootCrmDb, seedMinimal, assignAdminRole, mintAdminToken } = require('../../../../__tests__/integration/helpers/crmDb');
const request = require('supertest');
const express = require('express');
let db, cleanup, app, adminId, adminToken, apiToken;
const base = { event_type: 'wedding', event_name: 'Creation parity', event_date: '2030-06-15',
  customer_name: 'Ada', customer_email: 'ada@example.test', admin_email: 'admin@example.test',
  require_password: false, is_draft: false, expires_at: '2030-07-15T00:00:00.000Z' };
beforeAll(async () => {
  ({ db, cleanup } = await bootCrmDb()); ({ adminId } = await seedMinimal(db)); await assignAdminRole(db, adminId);
  adminToken = mintAdminToken(adminId);
  const generated = require('../../../middleware/apiTokenAuth').generateApiToken(); apiToken = generated.plaintext;
  await db('api_tokens').insert({ name: 'parity', hashed_token: generated.hashed, scopes: 'admin', created_by: adminId });
  app = express(); app.use(express.json());
  app.use('/admin', require('../../adminEvents'));
  app.use('/v1', require('../events'));
}, 120000);
afterAll(async () => { await require('../../../services/serviceShutdown').stopServices(); await cleanup(); });
async function create(source, extra) {
  const input = { ...base, ...extra };
  if (source === 'legacy') return require('../../../services/eventService').createEvent(input, { actor: { id: adminId } });
  const response = await request(app).post(source === 'admin' ? '/admin' : '/v1/events')
    .set('Authorization', `Bearer ${source === 'admin' ? adminToken : apiToken}`).send(input);
  expect(response.status).toBe(source === 'admin' ? 200 : 201);
  return response.body;
}
it.each(['admin', 'v1', 'legacy'])('%s stores theme, owner, dates and feedback defaults through one use case', async source => {
  const theme = JSON.stringify({ primaryColor: '#ff0066' });
  const created = await create(source, { color_theme: theme, feedback_enabled: true });
  const row = await db('events').where({ id: created.id }).first();
  expect(row).toMatchObject({ color_theme: theme, created_by: adminId, event_name: base.event_name, customer_email: base.customer_email });
  expect(require('../../../utils/dateNormalize').toIso(row.expires_at)).toBe(base.expires_at);
  expect([false, 0]).toContain(row.require_password);
  expect(row.updated_at).toBeTruthy(); expect(row.share_token).toBeTruthy(); expect(row.password_hash).toBeTruthy();
  const feedback = await db('event_feedback_settings').where({ event_id: row.id }).first();
  for (const key of ['feedback_enabled','allow_ratings','allow_likes','allow_comments','allow_favorites','allow_reactions','moderate_comments','show_feedback_to_guests']) expect([true, 1]).toContain(feedback[key]);
  expect([false, 0]).toContain(feedback.allow_color_labels); expect(feedback.keybind_mode).toBe('colors');
});
it('inherits global feedback and preserves explicit overrides for every entry point', async () => {
  await db('app_settings').insert({ setting_key: 'event_default_feedback_enabled', setting_value: 'true', setting_type: 'boolean' })
    .onConflict('setting_key').merge({ setting_value: 'true' });
  for (const source of ['admin', 'v1', 'legacy']) {
    const inherited = await create(source, {});
    expect(await db('event_feedback_settings').where({ event_id: inherited.id }).first()).toBeTruthy();
    const override = await create(source, { feedback_enabled: false });
    expect(await db('event_feedback_settings').where({ event_id: override.id }).first()).toBeUndefined();
  }
});
it('queues a publication email only for published galleries', async () => {
  const draft = await create('admin', { is_draft: true });
  expect(await db('email_queue').where({ event_id: draft.id })).toHaveLength(0);
  const published = await create('v1', {});
  expect(await db('email_queue').where({ event_id: published.id, email_type: 'gallery_created' })).toHaveLength(1);
});
it('rejects a required password that is missing with 400 on both routes', async () => {
  for (const source of ['admin', 'v1']) {
    const response = await request(app).post(source === 'admin' ? '/admin' : '/v1/events')
      .set('Authorization', `Bearer ${source === 'admin' ? adminToken : apiToken}`).send({ ...base, require_password: true });
    expect(response.status).toBe(400);
  }
});
it('keeps accepting "0"/"1" string booleans on the v1 surface', async () => {
  const created = await create('v1', { require_password: '0', feedback_enabled: '1' });
  const row = await db('events').where({ id: created.id }).first();
  expect([false, 0]).toContain(row.require_password);
  expect(await db('event_feedback_settings').where({ event_id: row.id }).first()).toBeTruthy();
});
it.each([{ feedback_enabled: 'maybe' }, { event_type: 'unknown' }])('rejects invalid creation data before persistence: %j', async extra => {
  for (const source of ['admin', 'v1']) {
    const response = await request(app).post(source === 'admin' ? '/admin' : '/v1/events')
      .set('Authorization', `Bearer ${source === 'admin' ? adminToken : apiToken}`).send({ ...base, ...extra });
    expect(response.status).toBe(400);
  }
});
