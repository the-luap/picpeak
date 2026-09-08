/** Session restoration uses the same live policy as protected routes. */
const request = require('supertest');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { bootCrmDb, seedMinimal, assignAdminRole, buildRouteApp } = require('../integration/helpers/crmDb');
process.env.JWT_SECRET = 'session-symmetry-test-secret-with-at-least-32-characters';
let db, cleanup, app, adminId, customerId, eventId, cutoff;
const slug = 'session-symmetry';
const sign = (claims = {}) => jwt.sign({ type: 'admin', id: adminId, username: 'tester',
  iat: Math.floor(Date.now() / 1000) - 60, jti: crypto.randomUUID(), ...claims },
process.env.JWT_SECRET, { issuer: 'picpeak-auth', expiresIn: '4h' });
const gallery = (claims = {}) => sign({ type: 'gallery', eventId, eventSlug: slug, ...claims });
const session = bearer => request(app).get(`/api/auth/session?slug=${slug}`).set('Authorization', `Bearer ${bearer}`);
beforeAll(async () => {
  ({ db, cleanup } = await bootCrmDb());
  ({ adminId, customerId } = await seedMinimal(db));
  await assignAdminRole(db, adminId);
  const row = await require('../../src/services/eventCreationService').createEvent({
    event_type: 'wedding', event_name: 'Session symmetry', event_date: '2026-10-01',
    slug, password: 'Session-Strong-Password-924!', expiration_days: 30,
    customer_email: 'customer@example.test', admin_email: 'admin@example.test',
  }, { actor: { id: adminId }, source: 'v1' });
  eventId = row.id;
  await db('events').where({ id: eventId }).update({ slug });
  await db('event_customer_assignments').insert({ event_id: eventId, customer_account_id: customerId });
  cutoff = require('../../src/utils/sessionCutoff');
  app = buildRouteApp('/api/auth', require('../../src/routes/auth'));
}, 120000);
beforeEach(async () => {
  await db('admin_users').where({ id: adminId }).update({ is_active: 1, password_changed_at: null });
  await db('customer_accounts').where({ id: customerId }).update({ is_active: 1, password_changed_at: null });
  await db('events').where({ id: eventId }).update({ is_active: 1, is_archived: 0, is_draft: 0,
    expires_at: new Date(Date.now() + 86400000).toISOString() });
  await cutoff.setSessionsValidAfter(0);
});
afterAll(async () => {
  await require('../../src/services/serviceShutdown').stopServices();
  if (cleanup) await cleanup();
});
it('hydrates an active admin and its role', async () => {
  const res = await session(sign());
  expect(res.body).toMatchObject({ valid: true, type: 'admin', adminUser: { id: adminId, role: { name: 'super_admin' } } });
});
it.each(['disabled', 'password', 'deleted', 'idle'])('rejects an admin after %s', async reason => {
  let bearer = sign();
  if (reason === 'disabled') await db('admin_users').where({ id: adminId }).update({ is_active: 0 });
  if (reason === 'password') await db('admin_users').where({ id: adminId }).update({ password_changed_at: new Date().toISOString() });
  if (reason === 'deleted') bearer = sign({ id: 999999 });
  if (reason === 'idle') bearer = sign({ iat: Math.floor(Date.now() / 1000) - 7200 });
  expect((await session(bearer)).body.valid).toBe(false);
});
it('accepts a session issued after a previous password change', async () => {
  await db('admin_users').where({ id: adminId }).update({ password_changed_at: new Date(Date.now() - 120000).toISOString() });
  expect((await session(sign())).body.valid).toBe(true);
});
it.each(['archived', 'expired', 'draft', 'inactive'])('rejects a gallery that is %s', async reason => {
  await db('events').where({ id: eventId }).update({
    ...(reason === 'archived' && { is_archived: 1 }), ...(reason === 'draft' && { is_draft: 1 }),
    ...(reason === 'inactive' && { is_active: 0 }), ...(reason === 'expired' && { expires_at: new Date(Date.now() - 1000).toISOString() }),
  });
  expect((await session(gallery())).body.valid).toBe(false);
});
it.each(['guest', 'client', 'customer'])('restores the %s gallery session kind', async kind => {
  const res = await session(gallery(kind === 'customer' ? { via: 'customer', customerId } : { accessLevel: kind }));
  expect(res.body).toMatchObject({ valid: true, accessLevel: kind === 'client' ? 'client' : 'guest', viaCustomer: kind === 'customer' });
});
it.each(['revoked', 'restore'])('invalidates both admin and gallery sessions after %s', async reason => {
  const tokens = [sign(), gallery()];
  if (reason === 'restore') await cutoff.setSessionsValidAfter(Math.floor(Date.now() / 1000));
  else for (const bearer of tokens) await require('../../src/utils/tokenRevocation').revokeToken(bearer, 'test');
  for (const bearer of tokens) expect((await session(bearer)).body.valid).toBe(false);
});
it('refuses a deactivated customer gallery session', async () => {
  const bearer = gallery({ via: 'customer', customerId });
  expect((await session(bearer)).body.valid).toBe(true);
  await db('customer_accounts').where({ id: customerId }).update({ is_active: 0 });
  expect((await session(bearer)).body.valid).toBe(false);
});
it('refuses an unrelated JWT type', async () => {
  const res = await session(sign({ type: 'password-reset' }));
  expect(res.status).toBe(403); expect(res.body.valid).toBe(false);
});
