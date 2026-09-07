const knex = require('knex');
jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));
jest.mock('../../src/services/emailWebhookTransport', () => ({ isEnabled: jest.fn(), send: jest.fn() }));
jest.mock('../../src/services/productUsageService', () => ({ markUsed: jest.fn().mockResolvedValue() }));
jest.mock('../../src/services/businessProfileService', () => ({ getEmailSignature: jest.fn(async () => null) }));

describe('template delivery is a coarse transport-acceptance bit', () => {
  let db, sendTemplateEmail;
  const sendMail = jest.fn();
  const webhook = require('../../src/services/emailWebhookTransport');
  const marker = require('../../src/services/productUsageService').markUsed;
  beforeAll(async () => {
    db = knex({ client: 'sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
    jest.doMock('../../src/database/db', () => ({ db }));
    await db.schema.createTable('email_configs', t => {
      t.increments('id'); for (const key of ['smtp_host', 'smtp_user', 'smtp_pass', 'from_name', 'from_email']) t.string(key);
      t.integer('smtp_port'); t.boolean('smtp_secure'); t.boolean('tls_reject_unauthorized');
    });
    await db('email_configs').insert({ smtp_host: 'smtp.example.test', smtp_port: 587, from_email: 'sender@example.test' });
    await db.schema.createTable('email_templates', t => { t.increments('id'); t.string('template_key'); t.text('subject'); t.text('body_html'); });
    await db('email_templates').insert({ template_key: 'PRIVATE-template', subject: 'PRIVATE subject', body_html: '<p>PRIVATE body</p>' });
    await db.schema.createTable('app_settings', t => { t.string('setting_key').primary(); t.text('setting_value'); });
    require('nodemailer').createTransport.mockReturnValue({ sendMail, verify: jest.fn(async () => true) });
    ({ sendTemplateEmail } = require('../../src/services/emailProcessor'));
  });
  beforeEach(() => {
    marker.mockClear(); marker.mockResolvedValue(); webhook.isEnabled.mockReturnValue(false);
    sendMail.mockReset(); sendMail.mockResolvedValue({ messageId: 'PRIVATE-message', accepted: ['PRIVATE@example.test'] });
  });
  afterAll(() => db.destroy());
  const send = options => sendTemplateEmail('PRIVATE@example.test', 'PRIVATE-template', { __language: 'en' }, options);
  test('successful real SMTP send transmits only the fixed capability key', async () => {
    await send();
    expect(marker).toHaveBeenCalledWith(['email_template_delivery']);
    expect(JSON.stringify(marker.mock.calls)).not.toContain('PRIVATE');
  });
  test('rejected recipients, failed sends, missing templates and explicit tests do not count', async () => {
    await send({ usageEligible: false });
    sendMail.mockResolvedValueOnce({ messageId: 'private', accepted: [] }); await send();
    sendMail.mockRejectedValueOnce(new Error('mail failed')); await expect(send()).rejects.toThrow('mail failed');
    await expect(sendTemplateEmail('private@example.test', 'missing', { __language: 'en' })).rejects.toThrow('not found');
    expect(marker).not.toHaveBeenCalled();
  });
  test('webhook success counts; failure does not; marker failure never retries successful mail', async () => {
    webhook.isEnabled.mockReturnValue(true); webhook.send.mockResolvedValue({ messageId: 'private' });
    marker.mockRejectedValueOnce(new Error('usage unavailable'));
    await expect(send()).resolves.toMatchObject({ success: true });
    expect(webhook.send).toHaveBeenCalledTimes(1);
    marker.mockClear(); webhook.send.mockRejectedValueOnce(new Error('webhook failed'));
    await expect(send()).rejects.toThrow('webhook failed');
    expect(marker).not.toHaveBeenCalled();
  });
});
