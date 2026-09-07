/**
 * The general API rate limiter's settings, read and written by the admin
 * (#1337).
 *
 * Until now the six rate_limit_* keys had a write route and no screen, and
 * the write route used a plain UPDATE — on a fresh install, which has no
 * rows, it answered 200 and changed nothing. The settings read did not
 * mention the keys at all when they had no row, so the budget in force
 * (300 per 15 minutes per IP) was invisible. Pins: the read surfaces the
 * defaults, the write creates rows, validation holds, and the limiter picks
 * the new values up at once.
 */
const path = require('path');
const fs = require('fs');
const os = require('os');

process.env.NODE_ENV = 'test';
process.env.TEST_DATABASE_PATH = path.join(
  fs.mkdtempSync(path.join(os.tmpdir(), 'picpeak-ratelimit-')), 'db.sqlite',
);
process.env.JWT_SECRET = process.env.JWT_SECRET || 'ratelimit-test-secret';
process.env.STORAGE_PATH = fs.mkdtempSync(path.join(os.tmpdir(), 'picpeak-ratelimit-storage-'));

const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const { bootCrmDb, seedMinimal, assignAdminRole, mintAdminToken } = require('../integration/helpers/crmDb');
const { clearPermissionCache } = require('../../src/middleware/permissions');
const rateLimitService = require('../../src/services/rateLimitService');
const { MemoryStore } = require('express-rate-limit');

describe('admin rate limiter settings', () => {
  let db; let cleanup; let app; let tok; let general;
  const auth = (req) => req.set('Authorization', `Bearer ${tok}`);
  const rows = () => db('app_settings').where('setting_key', 'like', 'rate_limit_%').orderBy('setting_key');

  beforeAll(async () => {
    ({ db, cleanup } = await bootCrmDb());
    const { adminId } = await seedMinimal(db);
    await assignAdminRole(db, adminId, 'super_admin');
    tok = mintAdminToken(adminId);
    await db('app_settings').where('setting_key', 'like', 'rate_limit_%').delete();
    clearPermissionCache();
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/api/admin/settings', require('../../src/routes/adminSettings'));
  }, 120000);
  afterAll(async () => { if (cleanup) await cleanup(); });

  it('surfaces the code defaults in the settings read when no row exists', async () => {
    expect(await rows()).toHaveLength(0);
    const res = await auth(request(app).get('/api/admin/settings'));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      rate_limit_enabled: true, rate_limit_window_minutes: 15, rate_limit_max_requests: 300,
      rate_limit_auth_max_requests: 5, rate_limit_skip_authenticated: true, rate_limit_public_endpoints_only: false,
    });
    // and only when asked for, with a key filter
    const filtered = await auth(request(app).get('/api/admin/settings?keys=rate_limit_max_requests,general_site_url'));
    expect(filtered.body.rate_limit_max_requests).toBe(300);
    expect(filtered.body).not.toHaveProperty('rate_limit_window_minutes');
  });

  it('creates the rows on a fresh install and the limiter sees the change at once', async () => {
    const before = await rateLimitService.getRateLimitSettings();
    expect(before.maxRequests).toBe(300);
    const res = await auth(request(app).put('/api/admin/settings/security/rate-limit')).send({
      rate_limit_enabled: true, rate_limit_window_minutes: 10, rate_limit_max_requests: 5000,
      rate_limit_auth_max_requests: 8, rate_limit_skip_authenticated: true, rate_limit_public_endpoints_only: false,
    });
    expect(res.status).toBe(200);
    const stored = await rows();
    expect(stored.map((r) => r.setting_key)).toEqual([
      'rate_limit_auth_max_requests', 'rate_limit_enabled', 'rate_limit_max_requests',
      'rate_limit_public_endpoints_only', 'rate_limit_skip_authenticated', 'rate_limit_window_minutes',
    ]);
    expect(stored.every((r) => r.setting_type === 'security')).toBe(true);
    const read = await auth(request(app).get('/api/admin/settings'));
    expect(read.body.rate_limit_max_requests).toBe(5000);
    expect(read.body.rate_limit_window_minutes).toBe(10);
    // The route clears the limiter's 60-second cache, so the new budget applies now.
    // The window is fixed per limiter instance, so the route rebuilds them too.
    expect(rateLimitService.getGeneralLimiter()).toEqual(expect.any(Function));
    expect(rateLimitService.getAuthLimiter()).toEqual(expect.any(Function));
    general = rateLimitService.getGeneralLimiter();
    const after = await rateLimitService.getRateLimitSettings();
    expect(after.maxRequests).toBe(5000);
    expect(after.windowMinutes).toBe(10);
    expect(after.authMaxRequests).toBe(8);
  });

  it('updates existing rows rather than duplicating them', async () => {
    // A rebuild must not leak the previous stores' cleanup intervals.
    const shutdown = jest.spyOn(MemoryStore.prototype, 'shutdown');
    await auth(request(app).put('/api/admin/settings/security/rate-limit')).send({
      rate_limit_enabled: false, rate_limit_window_minutes: 15, rate_limit_max_requests: 300,
      rate_limit_auth_max_requests: 5, rate_limit_skip_authenticated: false, rate_limit_public_endpoints_only: true,
    });
    expect(await rows()).toHaveLength(6);
    const after = await rateLimitService.getRateLimitSettings();
    expect(after).toMatchObject({ enabled: false, maxRequests: 300, skipAuthenticated: false, publicEndpointsOnly: true });
    // and every save hands the gates a fresh instance, shutting the old stores down
    expect(rateLimitService.getGeneralLimiter()).not.toBe(general);
    expect(shutdown).toHaveBeenCalledTimes(2);
    shutdown.mockRestore();
  });

  it('rejects values outside the documented ranges', async () => {
    for (const bad of [
      { rate_limit_window_minutes: 0 }, { rate_limit_window_minutes: 61 },
      { rate_limit_max_requests: 9 }, { rate_limit_max_requests: 10001 },
      { rate_limit_auth_max_requests: 0 }, { rate_limit_enabled: 'yes' },
    ]) {
      const res = await auth(request(app).put('/api/admin/settings/security/rate-limit')).send({
        rate_limit_enabled: true, rate_limit_window_minutes: 15, rate_limit_max_requests: 300,
        rate_limit_auth_max_requests: 5, rate_limit_skip_authenticated: true, rate_limit_public_endpoints_only: false,
        ...bad,
      });
      expect(res.status).toBe(400);
    }
  });
});
