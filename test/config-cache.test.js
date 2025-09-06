import { describe, it, expect, beforeEach } from 'vitest';
import worker, { invalidateConfigCache } from '../src/index.js';

describe('Configuration Caching', () => {
  beforeEach(() => {
    // Clear cache before each test
    invalidateConfigCache();
  });

  const mockEnv1 = {
    ALLOWED_HOST_SUFFIXES: '.example.com,.test.org',
    PROTECTED_SUBDOMAINS: 'admin,secure',
    LINK_PUBLIC: 'https://public-target.example.com',
    LINK_ADMIN: 'https://admin-target.example.com',
    USER_ADMIN: 'adminuser',
    PASS_ADMIN: 'adminpass',
    FALLBACK_USER: 'fallbackuser',
    FALLBACK_PASS: 'fallbackpass'
  };

  const mockEnv2 = {
    ALLOWED_HOST_SUFFIXES: '.example.com,.test.org,.newdomain.com',
    PROTECTED_SUBDOMAINS: 'admin,secure,private',
    LINK_PUBLIC: 'https://public-target.example.com',
    LINK_ADMIN: 'https://admin-target.example.com',
    LINK_PRIVATE: 'https://private-target.example.com',
    USER_ADMIN: 'adminuser',
    PASS_ADMIN: 'adminpass',
    USER_PRIVATE: 'privateuser',
    PASS_PRIVATE: 'privatepass',
    FALLBACK_USER: 'fallbackuser',
    FALLBACK_PASS: 'fallbackpass'
  };

  function createRequest(hostname = 'public.example.com', method = 'GET') {
    return new Request(`https://${hostname}/`, { method });
  }

  it('caches parsed configuration on first request', async () => {
    const request = createRequest('public.example.com');

    // First request should parse and cache configuration
    const response1 = await worker.fetch(request, mockEnv1);
    expect(response1.status).toBe(302); // Should redirect

    // Second request with same env should reuse cached config
    const response2 = await worker.fetch(request, mockEnv1);
    expect(response2.status).toBe(302); // Should redirect
  });

  it('detects configuration changes and re-parses', async () => {
    const request1 = createRequest('public.example.com');
    const request2 = createRequest('public.newdomain.com');

    // First request with original config
    const response1 = await worker.fetch(request1, mockEnv1);
    expect(response1.status).toBe(302); // Should redirect

    // Request to newdomain.com should fail with original config
    const response2 = await worker.fetch(request2, mockEnv1);
    expect(response2.status).toBe(404); // Not allowed

    // Same request with updated config should work
    const response3 = await worker.fetch(request2, mockEnv2);
    expect(response3.status).toBe(302); // Should redirect (newdomain.com now allowed)
  });

  it('handles protected subdomain changes correctly', async () => {
    const requestAdmin = createRequest('admin.example.com');
    const requestPrivate = createRequest('private.example.com');

    // Admin should be protected with original config
    const response1 = await worker.fetch(requestAdmin, mockEnv1);
    expect(response1.status).toBe(401); // Should require auth

    // Private should not be protected with original config
    const response2 = await worker.fetch(requestPrivate, mockEnv1);
    expect(response2.status).toBe(404); // No target configured

    // With updated config, private should be protected too
    const response3 = await worker.fetch(requestPrivate, mockEnv2);
    expect(response3.status).toBe(401); // Should require auth now
  });

  it('invalidateConfigCache forces re-parsing', async () => {
    const request = createRequest('public.example.com');

    // First request caches config
    const response1 = await worker.fetch(request, mockEnv1);
    expect(response1.status).toBe(302);

    // Manually invalidate cache
    invalidateConfigCache();

    // Next request should re-parse even with same env
    const response2 = await worker.fetch(request, mockEnv1);
    expect(response2.status).toBe(302);
  });

  it('handles empty configuration values gracefully', async () => {
    const emptyEnv = {
      ALLOWED_HOST_SUFFIXES: '',
      PROTECTED_SUBDOMAINS: '',
      FALLBACK_USER: 'fallbackuser',
      FALLBACK_PASS: 'fallbackpass'
    };

    const request = createRequest('any.example.com');

    // Should work with empty config (no restrictions)
    const response = await worker.fetch(request, emptyEnv);
    expect(response.status).toBe(404); // No target configured, but allowed
  });

  it('handles undefined configuration values gracefully', async () => {
    const undefinedEnv = {
      // ALLOWED_HOST_SUFFIXES and PROTECTED_SUBDOMAINS are undefined
      FALLBACK_USER: 'fallbackuser',
      FALLBACK_PASS: 'fallbackpass'
    };

    const request = createRequest('any.example.com');

    // Should work with undefined config (no restrictions)
    const response = await worker.fetch(request, undefinedEnv);
    expect(response.status).toBe(404); // No target configured, but allowed
  });
});
