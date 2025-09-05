import * as ratelimit from '../src/ratelimit.js';

describe('ratelimit.js', () => {
  beforeEach(() => {
    // Clear the internal bucket before each test
    ratelimit.RATE_LIMIT_BUCKET && ratelimit.RATE_LIMIT_BUCKET.clear && ratelimit.RATE_LIMIT_BUCKET.clear();
  });

  it('registers and checks failed attempts', () => {
    const client = '1.2.3.4';
    const sub = 'admin';
    for (let i = 0; i < ratelimit.MAX_FAILED_ATTEMPTS; i++) {
      expect(ratelimit.isRateLimited(client, sub)).toBe(false);
      ratelimit.registerFailedAttempt(client, sub);
    }
    expect(ratelimit.isRateLimited(client, sub)).toBe(true);
  });

  it('resets failures', () => {
    const client = '1.2.3.4';
    const sub = 'admin';
    ratelimit.registerFailedAttempt(client, sub);
    ratelimit.clearFailures(client, sub);
    expect(ratelimit.isRateLimited(client, sub)).toBe(false);
  });

  it('enforces stricter limit for unknown clients', () => {
    const client = 'unknown';
    const sub = 'admin';
    for (let i = 0; i < ratelimit.MAX_FAILED_ATTEMPTS_UNKNOWN; i++) {
      expect(ratelimit.isRateLimited(client, sub)).toBe(false);
      ratelimit.registerFailedAttempt(client, sub);
    }
    expect(ratelimit.isRateLimited(client, sub)).toBe(true);
  });

  it('returns retry headers with Retry-After', () => {
    const client = 'unknown';
    const sub = 'admin';
    ratelimit.registerFailedAttempt(client, sub);
    const headers = ratelimit.rateLimitRetryHeaders(client, sub);
    expect(headers['Retry-After']).toBeDefined();
  });
});
