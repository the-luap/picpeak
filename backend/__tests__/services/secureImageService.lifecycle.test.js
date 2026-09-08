jest.mock('../../src/database/db', () => ({ db: jest.fn() }));
const secure = require('../../src/services/secureImageService');
beforeEach(() => { jest.useFakeTimers(); secure.dispose(); });
afterEach(() => { secure.dispose(); jest.useRealTimers(); });
it('owns one timer for many tokens and sweeps expired capabilities', () => {
  for (let i = 0; i < 100; i++) secure.generateSecureToken(i, 'gallery_public_1_1', { expiresIn: 1 });
  expect(jest.getTimerCount()).toBe(1); expect(secure.tokenCache.size).toBe(100);
  jest.advanceTimersByTime(60000); expect(secure.tokenCache.size).toBe(0);
  secure.dispose(); expect(jest.getTimerCount()).toBe(0);
});
it('disposes all session/rate caches and restarts on demand', () => {
  secure.generateSecureToken(1, 'session'); secure.sessionTokens.set('a', 'b'); secure.rateLimitCache.set('a', 'b');
  secure.dispose(); expect(secure.sessionTokens.size + secure.rateLimitCache.size + secure.tokenCache.size).toBe(0);
  secure.generateSecureToken(1, 'session'); expect(jest.getTimerCount()).toBe(1);
});
