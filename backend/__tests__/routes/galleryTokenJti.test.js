/**
 * Gallery tokens must carry a per-token `jti`. tokenRevocation falls back to
 * `${eventId}-${iat}-gallery` without one, so a guest logging out would revoke
 * every other guest whose token was minted for the same event in the same
 * second (QR-code share links at an event make that routine).
 */
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

const mintSites = [
  'src/routes/auth.js',
  'src/routes/customer.js',
  'src/routes/gallery/slideshow.js',
];

describe('gallery token mint sites', () => {
  it.each(mintSites)('%s sets a unique jti on every gallery token', (file) => {
    const source = fs.readFileSync(path.join(__dirname, '../../', file), 'utf8');
    const payloads = source.split('jwt.sign(').slice(1)
      .map((chunk) => chunk.split('process.env.JWT_SECRET')[0])
      .filter((payload) => payload.includes("type: 'gallery'"));
    expect(payloads.length).toBeGreaterThan(0);
    for (const payload of payloads) expect(payload).toContain('jti: crypto.randomUUID()');
  });
});

describe('revocation key', () => {
  beforeAll(() => { process.env.JWT_SECRET = process.env.JWT_SECRET || 'jti-regression-secret-at-least-32-characters-long'; });
  it('is distinct for two same-second gallery logins of the same event', () => {
    const { buildTokenId } = require('../../src/utils/tokenRevocation');
    const crypto = require('crypto');
    const iat = Math.floor(Date.now() / 1000);
    const mint = () => jwt.decode(jwt.sign({ eventId: 7, type: 'gallery', iat, jti: crypto.randomUUID() }, process.env.JWT_SECRET));
    expect(buildTokenId(mint())).not.toBe(buildTokenId(mint()));
    // Without a jti the key collapses to eventId + login second.
    const bare = jwt.decode(jwt.sign({ eventId: 7, type: 'gallery', iat }, process.env.JWT_SECRET));
    expect(buildTokenId(bare)).toBe(buildTokenId({ ...bare }));
  });
});
