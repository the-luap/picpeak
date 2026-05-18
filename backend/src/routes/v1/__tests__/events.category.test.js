/**
 * Regression test for PR the_luap/picpeak#500.
 *
 * The v1 upload endpoint POST /events/:id/photos used to accept any
 * photo_categories.id, including ones belonging to a different event.
 * apiTokenAuth has no per-event scoping, so this let a programmatic
 * uploader silently mis-file photos under a category that doesn't
 * belong to the target event.
 *
 * The fix scopes the lookup to (event_id = event.id OR is_global = true)
 * — see backend/migrations/legacy/004_add_categories_and_cms.js for the
 * photo_categories columns. These tests verify both that the scoping
 * clause is exactly that, and that the 400 response carries the new
 * "Unknown or out-of-scope category_id" error string.
 *
 * Pattern lifted from src/routes/__tests__/adminAuth.test.js.
 */

const request = require('supertest');
const express = require('express');

const buildChain = ({ firstResult, insertResult } = {}) => ({
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  orWhere: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  first: jest.fn().mockResolvedValue(firstResult),
  insert: jest.fn().mockResolvedValue(insertResult ?? [1]),
});

jest.mock('../../../database/db', () => {
  const dbMock = jest.fn();
  dbMock.raw = jest.fn();
  dbMock.__setImplementations = (...chains) => {
    dbMock.mockReset();
    chains.forEach((chain) => {
      dbMock.mockImplementationOnce(() => chain);
    });
  };
  return {
    db: dbMock,
    logActivity: jest.fn().mockResolvedValue(undefined),
  };
});

jest.mock('../../../middleware/apiTokenAuth', () => ({
  apiTokenAuth: (req, _res, next) => {
    req.apiToken = { id: 1, admin_id: 1, scopes: ['write'] };
    req.admin = { id: 1, username: 'token-admin' };
    next();
  },
  requireApiScope: () => (_req, _res, next) => next(),
}));

// photoUpload is built inside events.js (multer({...})), not imported
// from a shared module. Mock the multer factory so .single(field)
// returns middleware that injects a stub req.file synchronously.
//
// Caveat: `path` points at a file that doesn't exist on disk. The
// current 400-path tests short-circuit before the handler touches the
// filesystem. Any future test that exercises a happy-path category
// match must either create the file under beforeAll() or stub the
// `fs`/`fsSync` modules — otherwise `fsSync.statSync(tempPath)` will
// throw and the test will surface a misleading 500.
jest.mock('multer', () => {
  const fakeUpload = {
    single: () => (req, _res, next) => {
      req.file = {
        path: '/tmp/fake-v1-upload.jpg',
        originalname: 'fake.jpg',
        size: 1,
        mimetype: 'image/jpeg',
      };
      next();
    },
  };
  const factory = jest.fn(() => fakeUpload);
  factory.diskStorage = jest.fn(() => ({}));
  return factory;
});

const { db } = require('../../../database/db');
const eventsRouter = require('../events');

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/', eventsRouter);
  return app;
};

describe('v1 POST /events/:id/photos — category scoping', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('scopes the category lookup to event-owned or global rows', async () => {
    const eventChain = buildChain({ firstResult: { id: 42, slug: 'wedding-2026' } });
    const categoryChain = buildChain({ firstResult: null });
    db.__setImplementations(eventChain, categoryChain);

    // Use JSON body (express.json parses it before the mocked multer
    // middleware runs). The route reads req.body.category_id either
    // way — multer would have parsed the field as a string, json sends
    // a string too.
    // .expect(400) also pins the response status — without it a future
    // regression that swallowed the error and returned 500 would still
    // satisfy the scoping-call assertions below.
    await request(buildApp())
      .post('/events/42/photos')
      .send({ category_id: '7' })
      .expect(400);

    // The category lookup chain receives the id filter…
    expect(categoryChain.where).toHaveBeenCalledWith({ id: 7 });
    // …and a single andWhere() with the scoping callback.
    expect(categoryChain.andWhere).toHaveBeenCalledTimes(1);
    const scopingCb = categoryChain.andWhere.mock.calls[0][0];
    expect(typeof scopingCb).toBe('function');

    // Invoke the callback against a knex-shaped builder spy and verify
    // the OR-clause it builds: event_id = 42 OR is_global = true.
    const builderSpy = {
      where: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
    };
    scopingCb.call(builderSpy);
    expect(builderSpy.where).toHaveBeenCalledWith({ event_id: 42 });
    expect(builderSpy.orWhere).toHaveBeenCalledWith('is_global', true);
  });

  it('returns 400 with out-of-scope error when no category row matches', async () => {
    db.__setImplementations(
      buildChain({ firstResult: { id: 42, slug: 'wedding-2026' } }),
      buildChain({ firstResult: null }),
    );

    const response = await request(buildApp())
      .post('/events/42/photos')
      .send({ category_id: '7' })
      .expect(400);

    expect(response.body).toEqual({
      error: 'Unknown or out-of-scope category_id 7',
    });
  });
});
