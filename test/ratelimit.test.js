import { describe, it, beforeEach, expect, vi, afterEach } from 'vitest';
import * as ratelimit from '../src/ratelimit.js';

describe('ratelimit.js', () => {
  // Save original Date.now implementation
  const originalDateNow = Date.now;
  let mockTime = originalDateNow();

  beforeEach(() => {
    // Clear the internal bucket before each test
    ratelimit.RATE_LIMIT_BUCKET && ratelimit.RATE_LIMIT_BUCKET.clear && ratelimit.RATE_LIMIT_BUCKET.clear();

    // Reset mock time to current time
    mockTime = originalDateNow();

    // Mock Date.now instead of nowMs
    Date.now = vi.fn(() => mockTime);
  });

  afterEach(() => {
    // Restore original Date.now after each test
    Date.now = originalDateNow;
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

  it('prunes expired rate limit entries', () => {
    const client = '1.2.3.4';
    const sub = 'admin';

    // Register a failed attempt
    ratelimit.registerFailedAttempt(client, sub);
    expect(ratelimit.isRateLimited(client, sub)).toBe(false);

    // Add more failed attempts to reach the limit
    for (let i = 1; i < ratelimit.MAX_FAILED_ATTEMPTS; i++) {
      ratelimit.registerFailedAttempt(client, sub);
    }
    expect(ratelimit.isRateLimited(client, sub)).toBe(true);

    // Advance time beyond the rate limit window
    mockTime += ratelimit.RATE_LIMIT_WINDOW_MS + 1000;

    // Rate limit should be cleared now
    expect(ratelimit.isRateLimited(client, sub)).toBe(false);
  });

  it('evicts old entries when reaching capacity limit', () => {
    // Fill the bucket to capacity
    for (let i = 0; i < ratelimit.MAX_RATE_LIMIT_KEYS; i++) {
      const clientId = `client-${i}`;
      ratelimit.registerFailedAttempt(clientId, 'admin');
    }

    // At this point, bucket should be at max capacity
    expect(ratelimit.RATE_LIMIT_BUCKET.size).toBe(ratelimit.MAX_RATE_LIMIT_KEYS);

    // Add one more entry, which should evict the oldest one
    ratelimit.registerFailedAttempt('new-client', 'admin');

    // Size should remain at max capacity
    expect(ratelimit.RATE_LIMIT_BUCKET.size).toBe(ratelimit.MAX_RATE_LIMIT_KEYS);

    // First client should be evicted
    expect(ratelimit.RATE_LIMIT_BUCKET.has(ratelimit.makeRateLimitKey('client-0', 'admin'))).toBe(false);
  });

  it('calculates remaining window seconds correctly', () => {
    const client = '1.2.3.4';
    const sub = 'admin';

    // Register a failed attempt
    ratelimit.registerFailedAttempt(client, sub);

    // Get headers which should contain Retry-After with the remaining window time
    const headers = ratelimit.rateLimitRetryHeaders(client, sub);
    const retryAfter = parseInt(headers['Retry-After'], 10);

    // Should be close to the full window duration (in seconds)
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(ratelimit.RATE_LIMIT_WINDOW_MS / 1000);

    // Advance time by half the window
    mockTime += ratelimit.RATE_LIMIT_WINDOW_MS / 2;

    // Get new headers
    const newHeaders = ratelimit.rateLimitRetryHeaders(client, sub);
    const newRetryAfter = parseInt(newHeaders['Retry-After'], 10);

    // Should be approximately half the window duration
    expect(newRetryAfter).toBeGreaterThan(0);
    expect(newRetryAfter).toBeLessThanOrEqual(ratelimit.RATE_LIMIT_WINDOW_MS / 2 / 1000);
  });

  it('returns 0 remaining seconds if no rate limit entry exists', () => {
    const client = 'no-entry-client';
    const sub = 'no-entry-sub';
    // Ensure the bucket is clear
    ratelimit.RATE_LIMIT_BUCKET && ratelimit.RATE_LIMIT_BUCKET.clear && ratelimit.RATE_LIMIT_BUCKET.clear();
    expect(ratelimit.rateLimitRetryHeaders(client, sub)['Retry-After']).toBe('0');
  });
});
