const knex = require('knex');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { UsageService } = require('../../src/usage/UsageService');
const { generateIdentity, digest, canonical } = require('../../src/usage/protocol.cjs');
const migration = require('../../migrations/core/211_product_usage_prompt_shown');

let db;
let directory;
beforeEach(async () => {
  db = knex({ client: 'sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'picpeak-prompt-test-'));
  for (const name of [
    '201_product_usage', '202_product_usage_cancel_requested', '203_product_usage_cancel_seq',
    '204_product_usage_privacy_receipts', '205_product_usage_consent_version', '206_product_usage_delivery_backoff'
  ]) await require(`../../migrations/core/${name}`).up(db);
});
afterEach(async () => {
  await db.destroy();
  fs.rmSync(directory, { recursive: true, force: true });
});

test.each(['active', 'activation_pending', 'deletion_pending', 'identity_conflict'])(
  'preserves an existing %s participation without altering its consent or pending packet', async (status) => {
    await db('product_usage_state').where({ id: 1 }).update({
      status, consent_version: 'usage-consent.v2', pending_packet: 'retained-packet',
    });
    await migration.up(db);
    await migration.up(db);
    const state = await db('product_usage_state').where({ id: 1 }).first();
    expect(state).toMatchObject({ status, consent_version: 'usage-consent.v2', pending_packet: 'retained-packet', prompt_shown: 1 });
  }
);

test('a previously participating installation stays acknowledged after a confirmed withdrawal', async () => {
  const actions = [];
  const service = new UsageService(db, {
    secret: 'test-only-prompt-encryption-secret-32-characters',
    endpoint: 'https://collector.example.test',
    bindingPath: path.join(directory, 'instance.key'),
    fetch: async (_url, init) => {
      const { packet } = JSON.parse(init.body);
      actions.push(packet.action);
      return new Response(JSON.stringify({
        packet_id: packet.packet_id, installation_id: packet.installation_id,
        packet_digest: digest(canonical(packet)), action: packet.action,
        sequence: packet.sequence, status: 'deleted',
      }));
    },
  });
  const identity = generateIdentity();
  await db('product_usage_state').where({ id: 1 }).update({
    status: 'active', notice_dismissed: 1, consent_version: 'usage-consent.v5', sequence: 1,
    installation_id: identity.installation_id, public_key: identity.public_key,
    private_key_encrypted: service.encrypt(identity.private_key), instance_binding: await service.binding(true),
  });
  await migration.up(db);
  const state = await service.disable();
  expect(actions).toEqual(['delete']);
  expect(state).toMatchObject({ status: 'disabled', prompt_shown: true, installation_id: null });
  expect(state.privacy_receipts.last_deletion.status).toBe('collector-confirmed');
});

test('a fresh installation can decline once without changing consent or the separate banner', async () => {
  await migration.up(db);
  const fetch = jest.fn();
  const service = new UsageService(db, { fetch });
  expect(await service.status()).toMatchObject({ status: 'disabled', prompt_shown: false, notice_dismissed: false });
  await service.markPromptShown();
  await migration.up(db);
  expect(await service.status()).toMatchObject({ status: 'disabled', prompt_shown: true, notice_dismissed: false });
  expect(fetch).not.toHaveBeenCalled();
});

test('migration guards tolerate a missing table', async () => {
  await db.schema.dropTable('product_usage_state');
  await expect(migration.up(db)).resolves.toBeUndefined();
  await expect(migration.down(db)).resolves.toBeUndefined();
});
