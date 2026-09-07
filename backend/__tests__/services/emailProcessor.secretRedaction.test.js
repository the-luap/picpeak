/**
 * Passwords leave the email archive once a row is final (see
 * utils/emailSecretRedaction.js). The gallery-created email carries the
 * gallery password and the client PIN; after the mail is out — or after the
 * row is out of retries — neither survives in email_data or rendered_html.
 */
const path = require('path');
const fs = require('fs');
const os = require('os');

process.env.NODE_ENV = 'test';
process.env.TEST_DATABASE_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'picpeak-mailredact-')), 'db.sqlite');
process.env.JWT_SECRET = process.env.JWT_SECRET || 'mailredact-test-secret';
process.env.STORAGE_PATH = fs.mkdtempSync(path.join(os.tmpdir(), 'picpeak-mailredact-storage-'));

const { bootCrmDb, seedMinimal } = require('../integration/helpers/crmDb');
const { MASK } = require('../../src/utils/emailSecretRedaction');

function stubWebhookTransport(impl) {
  const transport = require('../../src/services/emailWebhookTransport');
  const savedFrom = process.env.EMAIL_FROM;
  process.env.EMAIL_FROM = 'noreply@example.com';
  const mails = [];
  const enabled = jest.spyOn(transport, 'isEnabled').mockReturnValue(true);
  // mockRestore() wipes mock.calls, so keep our own copy of what went out
  const send = jest.spyOn(transport, 'send').mockImplementation(async (mail) => { mails.push(mail); return impl(mail); });
  return { mails, restore() { enabled.mockRestore(); send.mockRestore(); if (savedFrom === undefined) delete process.env.EMAIL_FROM; else process.env.EMAIL_FROM = savedFrom; } };
}

describe('email archive redaction', () => {
  let db; let cleanup; let eventId;
  const PASSWORD = 'Sunset-42!'; const PIN = '7788';
  const queue = (extra = {}) => db('email_queue').insert({
    event_id: eventId, recipient_email: 'client@example.com', email_type: 'gallery_created',
    email_data: JSON.stringify({
      customer_name: 'Ada', host_name: 'Ada', event_name: 'Redaction Wedding', event_date: '2026-09-07',
      gallery_link: 'https://photos.example/gallery/redaction-wedding/tok', gallery_password: PASSWORD,
      client_link: 'https://photos.example/gallery/redaction-wedding/client-access?token=abc', client_password: PIN,
      expiry_date: null, welcome_message: '',
    }),
    status: 'pending', created_at: new Date().toISOString(), scheduled_at: new Date().toISOString(), retry_count: 0,
    ...extra,
  }).returning('id').then((r) => r[0]?.id ?? r[0]);

  beforeAll(async () => {
    ({ db, cleanup } = await bootCrmDb());
    await seedMinimal(db);
    const ins = await db('events').insert({
      slug: 'redaction-wedding', event_type: 'wedding', event_name: 'Redaction Wedding', event_date: '2026-09-07',
      customer_email: 'client@example.com', customer_name: 'Ada', password_hash: 'x', share_link: '/gallery/redaction-wedding/tok',
      share_token: 'tok', expires_at: new Date(Date.now() + 86400000).toISOString(), is_active: true, created_at: new Date().toISOString(),
    }).returning('id');
    eventId = ins[0]?.id ?? ins[0];
  }, 120000);
  afterAll(async () => { if (cleanup) await cleanup(); });

  it('scrubs the variables and the rendered body once the mail is out', async () => {
    const id = await queue();
    const stub = stubWebhookTransport(async () => ({ messageId: 'sent-1' }));
    try {
      const { processEmailQueue } = require('../../src/services/emailProcessor');
      await processEmailQueue({ ignoreSchedule: true, onlyId: id });
    } finally { stub.restore(); }
    const row = await db('email_queue').where('id', id).first();
    expect(row.status).toBe('sent');
    const data = JSON.parse(row.email_data);
    expect(data.gallery_password).toBe(MASK);
    expect(data.client_password).toBe(MASK);
    expect(data.customer_name).toBe('Ada');
    expect(row.rendered_html).toBeTruthy();
    expect(row.rendered_html).not.toContain(PASSWORD);
    expect(row.rendered_html).not.toContain(PIN);
    expect(row.rendered_html).toContain(MASK);
    // the mail itself went out with the real password; only the archive lost it
    expect(stub.mails).toHaveLength(1);
    expect(String(stub.mails[0].html)).toContain(PASSWORD);
    expect(String(stub.mails[0].html)).not.toContain(MASK);

    // Messages "resend" copies the archived variables into a new pending
    // row and "retry" re-queues the row itself: both mails must say the
    // password is not shown rather than print the mask (or the password).
    const { resendEmail, retryEmail } = require('../../src/services/projectService');
    const resent = await resendEmail(id);
    await retryEmail(id);
    for (const rowId of [resent.id, id]) {
      const stub2 = stubWebhookTransport(async () => ({ messageId: `sent-again-${rowId}` }));
      try {
        const { processEmailQueue } = require('../../src/services/emailProcessor');
        await processEmailQueue({ ignoreSchedule: true, onlyId: rowId });
      } finally { stub2.restore(); }
      expect(stub2.mails).toHaveLength(1);
      const html = String(stub2.mails[0].html);
      expect(html).not.toContain(MASK);
      expect(html).not.toContain(PASSWORD);
      expect(html).not.toContain(PIN);
      expect(html).not.toContain('{{password_security_message}}');
      expect(html).toContain('security');
      // archived again without the password (mask or sentinel, never the value)
      expect(JSON.parse((await db('email_queue').where('id', rowId).first()).email_data).gallery_password).not.toBe(PASSWORD);
    }
  });

  it('keeps the variables in the clear while the row can still be retried', async () => {
    const id = await queue({ retry_count: 1 });
    const stub = stubWebhookTransport(async () => { throw new Error('transport down'); });
    try {
      const { processEmailQueue } = require('../../src/services/emailProcessor');
      await processEmailQueue({ ignoreSchedule: true, onlyId: id });
      let row = await db('email_queue').where('id', id).first();
      expect(row.retry_count).toBe(2);
      expect(JSON.parse(row.email_data).gallery_password).toBe(PASSWORD);
      // out of retries — a Messages "retry" resets the counter and this row
      // must still be able to send the real password
      await processEmailQueue({ ignoreSchedule: true, onlyId: id });
      row = await db('email_queue').where('id', id).first();
      expect(row.retry_count).toBe(3);
      expect(row.status).not.toBe('sent');
      expect(JSON.parse(row.email_data).gallery_password).toBe(PASSWORD);
    } finally { stub.restore(); }
  });
});
