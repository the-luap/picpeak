const knex = require('knex');
const migration = require('../../migrations/core/210_events_updated_at');
const { toTimestamp } = require('../../src/utils/dateNormalize');
const { randomUUID } = require('crypto');

const engines = [['sqlite', null], ...(process.env.PICPEAK_PG_TEST_URL ? [['pg', process.env.PICPEAK_PG_TEST_URL]] : [])];
describe.each(engines)('event timestamp migration contract (%s)', (engine, connection) => {
  let db, owner, schema;
  beforeEach(async () => {
    if (engine === 'pg') {
      schema = `event_contract_${randomUUID().replace(/-/g, '')}`;
      owner = knex({ client: 'pg', connection });
      await owner.schema.createSchema(schema);
      db = knex({ client: 'pg', connection, searchPath: [schema] });
    } else db = knex({ client: 'sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
  });
  afterEach(async () => {
    await db.destroy();
    if (owner) { await owner.schema.dropSchema(schema, true); await owner.destroy(); }
  });
  it('upgrades legacy data, is repeatable and preserves subsequent edits', async () => {
    await db.schema.createTable('events', table => {
      table.increments('id'); table.timestamp('created_at').defaultTo(db.fn.now()); table.boolean('is_active').defaultTo(true);
    });
    const created = '2026-01-02T03:04:05.000Z';
    await db('events').insert({ created_at: created });
    await migration.up(db); await migration.up(db);
    let row = await db('events').first();
    expect(toTimestamp(row.updated_at)).toBe(Date.parse(created));
    await db('events').where({ id: row.id }).update({ updated_at: db.fn.now(), is_active: engine === 'pg' ? false : 0 });
    const changed = (await db('events').first()).updated_at;
    await migration.up(db); row = await db('events').first();
    expect(toTimestamp(row.updated_at)).toBe(toTimestamp(changed)); expect([false, 0]).toContain(row.is_active);
  });
  it('handles a fresh table and an already present updated_at column', async () => {
    await db.schema.createTable('events', table => { table.increments('id'); table.timestamp('created_at'); table.timestamp('updated_at'); });
    await migration.up(db);
    expect(await db.schema.hasColumn('events', 'updated_at')).toBe(true);
  });
});
