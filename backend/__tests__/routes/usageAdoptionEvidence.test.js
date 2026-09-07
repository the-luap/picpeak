const express = require('express');
const request = require('supertest');
const knex = require('knex');
const { changedFields, settingsChanged } = require('../../src/usage/adoptionEvidence');

jest.mock('../../src/middleware/auth', () => ({ adminAuth: (req, res, next) => { req.admin = { id: 1 }; next(); } }));
jest.mock('../../src/middleware/permissions', () => ({ requirePermission: () => (req, res, next) => next() }));
jest.mock('../../src/middleware/requireFeatureFlag', () => ({ requireFeatureFlag: () => (req, res, next) => next() }));
jest.mock('../../src/services/productUsageService', () => ({ markUsed: jest.fn().mockResolvedValue() }));
jest.mock('../../src/services/emailProcessor', () => ({
  htmlToText: body => body, wrapEmailHtml: jest.fn(async body => body), buildSignatureTextFor: jest.fn(async () => ''),
}));
jest.mock('../../src/services/businessProfileService', () => ({ getEmailSignature: jest.fn(async () => null) }));

describe('v5 evidence comes from real edits, not the generic successful-route marker', () => {
  let db, app;
  const marker = require('../../src/services/productUsageService').markUsed;
  const recorded = () => marker.mock.calls.flatMap(([keys]) => keys).filter(key => /_editing$/.test(key));
  beforeAll(async () => {
    db = knex({ client: 'sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
    jest.doMock('../../src/database/db', () => ({ db, logActivity: jest.fn(async () => {}) }));
    await db.schema.createTable('cms_pages', t => {
      t.increments('id'); t.string('slug');
      for (const key of ['title_en', 'title_de', 'content_en', 'content_de', 'logo_url', 'external_url']) t.text(key);
      t.boolean('use_external_url').defaultTo(false); t.boolean('show_in_footer').defaultTo(true); t.timestamp('updated_at');
    });
    await db.schema.createTable('email_templates', t => { t.increments('id'); t.string('template_key'); t.timestamp('updated_at'); });
    await db.schema.createTable('email_template_translations', t => {
      t.increments('id'); t.integer('template_id'); t.string('language');
      for (const key of ['subject', 'body_html', 'body_text']) t.text(key);
      t.timestamp('updated_at'); t.timestamp('created_at');
    });
    await db.schema.createTable('app_settings', t => { t.string('setting_key').primary(); t.text('setting_value'); });
    await db.schema.createTable('event_types', t => {
      t.increments('id'); for (const key of ['name', 'slug_prefix', 'emoji', 'theme_preset', 'theme_config']) t.text(key);
      t.integer('display_order'); t.boolean('is_active'); t.boolean('is_system'); t.timestamp('updated_at'); t.timestamp('created_at');
    });
    await db.schema.createTable('photo_categories', t => {
      t.increments('id'); t.text('name'); t.text('slug'); t.integer('hero_photo_id'); t.integer('event_id');
      t.integer('display_order'); t.boolean('allow_downloads'); t.boolean('is_folder'); t.boolean('is_global');
    });
    app = express(); app.use(express.json());
    app.use(require('../../src/middleware/productUsage').productUsage);
    app.use('/cms', require('../../src/routes/adminCMS'));
    app.use('/email', require('../../src/routes/adminEmail'));
    app.use('/event-types', require('../../src/routes/adminEventTypes'));
    app.use('/categories', require('../../src/routes/adminCategories'));
  });
  beforeEach(async () => {
    marker.mockClear();
    for (const table of ['cms_pages', 'email_templates', 'email_template_translations', 'app_settings', 'event_types', 'photo_categories']) await db(table).delete();
    await db('cms_pages').insert({ slug: 'privacy', title_en: 'Privacy', content_en: 'Seeded content' });
    await db('email_templates').insert({ id: 1, template_key: 'PRIVATE-template' });
    await db('email_template_translations').insert({ template_id: 1, language: 'en', subject: 'Seeded subject', body_html: 'Seeded body', body_text: '' });
  });
  afterAll(() => db.destroy());
  test('CMS reads, unchanged saves and external content do not imply internal content editing', async () => {
    await request(app).get('/cms/pages').expect(200);
    await request(app).put('/cms/pages/privacy').send({ content_en: 'Seeded content' }).expect(200);
    await request(app).put('/cms/pages/privacy').send({ use_external_url: true, external_url: 'https://example.test/privacy', content_en: 'Other' }).expect(200);
    expect(recorded()).toEqual([]);
    await request(app).put('/cms/pages/privacy').send({ use_external_url: false, content_en: 'PRIVATE real content' }).expect(200);
    expect(recorded()).toEqual(['cms_content_editing']);
    expect(JSON.stringify(marker.mock.calls)).not.toMatch(/PRIVATE|example\.test|privacy/);
  });
  test('template preview, empty and unchanged saves are excluded; actual content changes count', async () => {
    await request(app).post('/email/templates/PRIVATE-template/preview').send({}).expect(200);
    await request(app).put('/email/templates/PRIVATE-template').send({ translations: {} }).expect(200);
    const translation = { subject: 'Seeded subject', body_html: 'Seeded body', body_text: '' };
    await request(app).put('/email/templates/PRIVATE-template').send({ translations: { en: translation } }).expect(200);
    expect(recorded()).toEqual([]);
    await request(app).put('/email/templates/PRIVATE-template').send({ translations: { en: { ...translation, subject: 'PRIVATE custom subject' } } }).expect(200);
    expect(recorded()).toEqual(['email_template_editing']);
    expect(JSON.stringify(marker.mock.calls)).not.toContain('PRIVATE');
  });
  test('failed saves do not count; new nonempty templates do', async () => {
    await request(app).put('/email/templates/missing').send({ translations: {} }).expect(404);
    await request(app).post('/email/templates').send({ template_key: 'empty', translations: {} }).expect(201);
    expect(recorded()).toEqual([]);
    await request(app).post('/email/templates').send({ template_key: 'custom', translations: { de: { subject: 'Privat' } } }).expect(201);
    expect(recorded()).toEqual(['email_template_editing']);
  });
  test('seeded event types and categories count only after a real edit, not identical saves', async () => {
    await db('event_types').insert({ id: 1, name: 'Wedding', slug_prefix: 'wedding', is_active: true, is_system: true });
    await db('photo_categories').insert({ id: 1, name: 'All', slug: 'all', is_global: true, is_folder: false });
    await request(app).get('/event-types').expect(200);
    await request(app).get('/categories/global').expect(200);
    await request(app).put('/event-types/1').send({ name: 'Wedding', is_active: true }).expect(200);
    await request(app).put('/categories/1').send({ name: 'All', is_folder: false }).expect(200);
    expect(recorded()).toEqual([]);
    await request(app).put('/event-types/1').send({ name: 'PRIVATE event type' }).expect(200);
    await request(app).put('/categories/1').send({ name: 'PRIVATE category' }).expect(200);
    expect(recorded()).toEqual(['event_type_editing', 'category_editing']);
    expect(JSON.stringify(marker.mock.calls)).not.toContain('PRIVATE');
  });
  test('settings compare persisted values, not timestamps, JSON order or defaults materialized as rows', async () => {
    await db('app_settings').insert({ setting_key: 'theme_config', setting_value: JSON.stringify({ a: 1, b: 2 }) });
    expect(await settingsChanged(db, { theme_config: { b: 2, a: 1 } }, ['theme_config'])).toBe(false);
    expect(await settingsChanged(db, { theme_config: { b: 2, a: 2 } }, ['theme_config'])).toBe(true);
    expect(await settingsChanged(db, { missing: 'fallback' }, ['missing'])).toBe(false);
    expect(await settingsChanged(db, { secret: 'PRIVATE' }, ['theme_config'])).toBe(false);
    expect(changedFields({ enabled: 1, updated_at: 'old' }, { enabled: true, updated_at: 'new' }, ['enabled'])).toBe(false);
    expect(changedFields({ body: '' }, { body: null }, ['body'])).toBe(false);
  });
});
