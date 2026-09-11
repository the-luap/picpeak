/**
 * The chunked upload client posts each chunk as application/octet-stream and
 * the route reads the raw request stream. The CSRF gate answered every such
 * request 415 before it reached the route, so the endpoint never accepted a
 * chunk (PicPeak/picpeak#1377).
 *
 * The gate's origin check is the CSRF defence. The Content-Type list only
 * has to keep out what a cross-site page can send without a preflight, and
 * application/octet-stream is not on that list: an HTML form cannot produce
 * it and fetch() with it is not CORS-safelisted.
 */
const express = require('express');
const request = require('supertest');

jest.mock('../../src/utils/logger', () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() }));

function buildApp() {
  const app = express();
  // Same order as server.js: scoped JSON parser, then the gate on /api.
  app.use(['/api/admin', '/api/v1'], express.json({ limit: '50mb' }));
  app.use(express.json({ limit: '2mb' }));
  app.use('/api', require('../../src/middleware/csrf'));
  // Mirrors the chunk route in adminPhotos.js: consume the raw stream.
  app.post('/api/admin/photos/:eventId/chunked-upload/:uploadId/chunk/:chunkIndex', async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    res.json({ received: Buffer.concat(chunks).toString('base64') });
  });
  app.post('/api/admin/other', (req, res) => res.json({ body: req.body }));
  return app;
}

const CHUNK_PATH = '/api/admin/photos/1/chunked-upload/abc/chunk/0';

describe('CSRF gate and application/octet-stream', () => {
  it('lets a same-origin octet-stream chunk reach the route byte for byte', async () => {
    // Not valid UTF-8, so a text decode anywhere on the path would show up.
    const payload = Buffer.concat([Buffer.from('chunkbytes'), Buffer.from([0xff, 0x00, 0xfe])]);
    const res = await request(buildApp())
      .post(CHUNK_PATH)
      .set('sec-fetch-site', 'same-origin')
      .set('Content-Type', 'application/octet-stream')
      .send(payload);
    expect(res.status).toBe(200);
    expect(Buffer.from(res.body.received, 'base64').equals(payload)).toBe(true);
  });

  it('still rejects a cross-site octet-stream post on origin', async () => {
    const res = await request(buildApp())
      .post(CHUNK_PATH)
      .set('sec-fetch-site', 'cross-site')
      .set('Content-Type', 'application/octet-stream')
      .send(Buffer.from('chunkbytes'));
    expect(res.status).toBe(403);
  });

  it('still rejects the types a form can send', async () => {
    const res = await request(buildApp())
      .post('/api/admin/other')
      .set('sec-fetch-site', 'same-origin')
      .set('Content-Type', 'text/plain')
      .send('x=1');
    expect(res.status).toBe(415);
  });

  it('leaves a JSON route with an empty body on an octet-stream post', async () => {
    const res = await request(buildApp())
      .post('/api/admin/other')
      .set('sec-fetch-site', 'same-origin')
      .set('Content-Type', 'application/octet-stream')
      .send(Buffer.from('{"a":1}'));
    expect(res.status).toBe(200);
    expect(res.body.body).toEqual({});
  });
});
