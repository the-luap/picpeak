const knex = require('knex');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');
const migration = require('../../migrations/core/211_revocations_without_expiry');

for (const client of ['sqlite3', 'pg']) {
  const enabled = client !== 'pg' || process.env.PICPEAK_PG_TEST_URL;
  (enabled ? describe : describe.skip)(`token revocation expiry (${client})`, () => {
    let db, owner, schema, revocation;
    const sign = claims => jwt.sign({ id: 1, type: 'admin', jti: randomUUID(), ...claims }, process.env.JWT_SECRET);

    beforeAll(async () => {
      if (client === 'pg') {
        schema = `revocation_${randomUUID().replace(/-/g, '')}`;
        owner = knex({ client, connection: process.env.PICPEAK_PG_TEST_URL });
        await owner.schema.createSchema(schema);
        db = knex({ client, connection: process.env.PICPEAK_PG_TEST_URL, searchPath: [schema] });
      } else {
        db = knex({ client, connection: { filename: ':memory:' }, useNullAsDefault: true });
      }
      // Exercise the upgrade from the real legacy NOT NULL schema as well as
      // repeated migration runs, without sharing another test's database.
      await require('../../migrations/legacy/017_add_token_revocation_tables').up(db);
      await db('revoked_tokens').insert({ token_id: 'existing', expires_at: '2099-01-01T00:00:00.000Z' });
      await migration.up(db);
      await migration.up(db);
      jest.resetModules();
      jest.doMock('../../src/database/db', () => ({ db }));
      revocation = require('../../src/utils/tokenRevocation');
    });

    afterAll(async () => {
      await db?.destroy();
      if (owner) { await owner.schema.dropSchema(schema, true); await owner.destroy(); }
      jest.dontMock('../../src/database/db');
    });

    it('preserves existing revocations and their unique key during upgrade', async () => {
      expect(await db('revoked_tokens').where({ token_id: 'existing' }).first()).toBeTruthy();
      await expect(db('revoked_tokens').insert({ token_id: 'existing', expires_at: null })).rejects.toThrow();
    });

    it.each([true, false])('permanently revokes a token without exp (jti: %s)', async withJti => {
      const token = sign(withJti ? {} : { jti: undefined });
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      expect(await revocation.isTokenRevoked(payload)).toBe(false);
      expect(await revocation.revokeToken(token, 'logout')).toBe(true);
      expect(await revocation.revokeToken(token, 'logout')).toBe(true);
      await revocation.cleanupExpiredRevocations();
      expect(await revocation.isTokenRevoked(payload)).toBe(true);
      const rows = await db('revoked_tokens').where({ token_id: revocation.buildTokenId(payload) });
      expect(rows).toHaveLength(1);
      expect(rows[0].expires_at).toBeNull();
    });

    it('cleans up expired revocations and retains future ones', async () => {
      const expired = sign({ exp: Math.floor(Date.now() / 1000) - 60 });
      const future = sign({ exp: Math.floor(Date.now() / 1000) + 3600 });
      expect(await revocation.revokeToken(expired, 'logout')).toBe(true);
      expect(await revocation.revokeToken(future, 'logout')).toBe(true);
      await revocation.cleanupExpiredRevocations();
      expect(await revocation.isTokenRevoked(jwt.decode(expired))).toBe(false);
      expect(await revocation.isTokenRevoked(jwt.decode(future))).toBe(true);
    });

    it.each([true, false])('upgrades an expiring entry with the same key permanently (jti: %s)', async withJti => {
      const claims = { id: 99, iat: Math.floor(Date.now() / 1000), jti: withJti ? randomUUID() : undefined };
      const expiring = sign({ ...claims, exp: claims.iat - 60 });
      const permanent = sign(claims);
      expect(await revocation.revokeToken(expiring, 'logout')).toBe(true);
      expect(await revocation.revokeToken(permanent, 'logout')).toBe(true);
      expect(await revocation.revokeToken(expiring, 'logout')).toBe(true);
      await revocation.cleanupExpiredRevocations();
      expect(await revocation.isTokenRevoked(jwt.decode(permanent))).toBe(true);
    });

    it('retains a signed token whose numeric expiry cannot fit a database timestamp', async () => {
      const token = sign({ exp: 1e100 });
      expect(await revocation.revokeToken(token, 'logout')).toBe(true);
      await revocation.cleanupExpiredRevocations();
      expect(await revocation.isTokenRevoked(jwt.decode(token))).toBe(true);
    });

    it('refuses a rollback that would remove permanent revocations', async () => {
      await expect(migration.down(db)).rejects.toThrow('permanent token revocations');
      expect((await db('revoked_tokens').columnInfo('expires_at')).nullable).toBe(true);
      // A rollback with only expiring records remains supported and reversible.
      await db('revoked_tokens').whereNull('expires_at').delete();
      await migration.down(db);
      await migration.down(db);
      expect((await db('revoked_tokens').columnInfo('expires_at')).nullable).toBe(false);
      await migration.up(db);
      expect(await db('revoked_tokens').where({ token_id: 'existing' }).first()).toBeTruthy();
    });
  });
}
