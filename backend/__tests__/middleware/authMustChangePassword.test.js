/**
 * GHSA-h4w8-57xq-53fx enforcement half: `must_change_password` was written
 * by the admin password-reset flow (userManagementService.resetAdminPassword)
 * and returned in a few response payloads, but no route-blocking logic ever
 * checked it — a reset admin could keep using the old/weak password on every
 * protected route indefinitely. adminAuth() is now the server-side backstop:
 * a flagged admin gets 403 MUST_CHANGE_PASSWORD on everything except the
 * routes they need to clear the flag (change-password) or leave (logout).
 *
 * Mirrors the mocking shape of adminAuthRoleFallback.test.js — a stub `db`
 * chain, no real SQLite needed, so this stays a fast unit test.
 */

const jwt = require('jsonwebtoken');

jest.mock('../../src/utils/tokenRevocation', () => ({ isTokenRevoked: jest.fn().mockResolvedValue(false) }));
jest.mock('../../src/utils/logger', () => ({ warn: jest.fn(), error: jest.fn(), debug: jest.fn(), info: jest.fn() }));

let mockMustChangePassword = false;
const mockAdminRow = { id: 7, username: 'scoped', email: 's@example.com', password_changed_at: null, role_id: 1, role_name: 'editor' };

jest.mock('../../src/database/db', () => ({
  db: () => ({
    leftJoin() { return this; },
    where() { return this; },
    select() { return this; },
    first: () => Promise.resolve({ ...mockAdminRow, must_change_password: mockMustChangePassword }),
  }),
}));

const { adminAuth } = require('../../src/middleware/auth');

const SECRET = 'test-secret-for-must-change-password';

function makeReq(originalUrl) {
  const token = jwt.sign(
    { id: mockAdminRow.id, type: 'admin' },
    SECRET,
    { algorithm: 'HS256', issuer: 'picpeak-auth' },
  );
  return { headers: { authorization: `Bearer ${token}` }, ip: '127.0.0.1', connection: {}, originalUrl };
}

function makeRes() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

describe('adminAuth must_change_password enforcement (GHSA-h4w8-57xq-53fx)', () => {
  const OLD_SECRET = process.env.JWT_SECRET;
  beforeAll(() => { process.env.JWT_SECRET = SECRET; });
  afterAll(() => { process.env.JWT_SECRET = OLD_SECRET; });
  beforeEach(() => { mockMustChangePassword = false; });

  it('blocks an arbitrary protected route with 403 MUST_CHANGE_PASSWORD when the flag is set', async () => {
    mockMustChangePassword = true;
    const req = makeReq('/api/admin/dashboard/stats');
    const res = makeRes();
    const next = jest.fn();

    await adminAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual(expect.objectContaining({ code: 'MUST_CHANGE_PASSWORD' }));
    expect(req.admin).toBeUndefined();
  });

  it('does not block when the flag is not set', async () => {
    mockMustChangePassword = false;
    const req = makeReq('/api/admin/dashboard/stats');
    const res = makeRes();
    const next = jest.fn();

    await adminAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.admin.mustChangePassword).toBe(false);
  });

  it.each([
    ['/api/admin/auth/change-password'],
    ['/api/admin/auth/logout'],
  ])('still allows %s through when the flag is set', async (originalUrl) => {
    mockMustChangePassword = true;
    const req = makeReq(originalUrl);
    const res = makeRes();
    const next = jest.fn();

    await adminAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.admin.mustChangePassword).toBe(true);
    expect(res.statusCode).toBeNull();
  });

  it('allows the exempt change-password path even with a query string', async () => {
    mockMustChangePassword = true;
    const req = makeReq('/api/admin/auth/change-password?foo=bar');
    const res = makeRes();
    const next = jest.fn();

    await adminAuth(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('does not exempt a route that merely starts with the change-password path', async () => {
    mockMustChangePassword = true;
    const req = makeReq('/api/admin/auth/change-password-history');
    const res = makeRes();
    const next = jest.fn();

    await adminAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });
});
