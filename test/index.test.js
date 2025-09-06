import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import worker from '../src/index.js';
import * as ratelimit from '../src/ratelimit.js';
import { base64Encode } from '../src/base64.js';

// Mock environment variables
const mockEnv = {
  ALLOWED_HOST_SUFFIXES: '.example.com,.test.org',
  PROTECTED_SUBDOMAINS: 'admin,secure',
  LINK_PUBLIC: 'https://public-target.example.com',
  LINK_ADMIN: 'https://admin-target.example.com',
  LINK_SECURE: 'https://secure-target.example.com',
  USER_ADMIN: 'adminuser',
  PASS_ADMIN: 'adminpass',
  USER_SECURE: 'secureuser',
  PASS_SECURE: 'securepass',
  FALLBACK_USER: 'fallbackuser',
  FALLBACK_PASS: 'fallbackpass'
};

// Mock Request creation helper
function createRequest(options = {}) {
  const {
    method = 'GET',
    hostname = 'public.example.com',
    path = '/',
    headers = {},
    protocol = 'https:',
  } = options;

  const url = `${protocol}//${hostname}${path}`;

  return new Request(url, {
    method,
    headers: new Headers(headers)
  });
}

describe('Worker', () => {
  // Save original Date.now implementation and mock time
  const originalDateNow = Date.now;
  let mockTime = originalDateNow();

  beforeEach(() => {
    // Clear rate limit bucket before each test
    ratelimit.RATE_LIMIT_BUCKET && ratelimit.RATE_LIMIT_BUCKET.clear && ratelimit.RATE_LIMIT_BUCKET.clear();

    // Reset mock time to current time
    mockTime = originalDateNow();

    // Mock Date.now to control time
    Date.now = vi.fn(() => mockTime);
  });

  afterEach(() => {
    // Restore original Date.now
    Date.now = originalDateNow;
  });

  it('redirects HTTP to HTTPS', async () => {
    const request = createRequest({ protocol: 'http:', hostname: 'public.example.com' });
    const response = await worker.fetch(request, mockEnv);

    expect(response.status).toBe(301);
    expect(response.headers.get('Location')).toBe('https://public.example.com/');
  });

  it('returns 405 for non-GET/HEAD methods', async () => {
    const request = createRequest({ method: 'POST' });
    const response = await worker.fetch(request, mockEnv);

    expect(response.status).toBe(405);
    expect(response.headers.get('Allow')).toBe('GET, HEAD');
  });

  it('returns 404 for non-allowed hostnames', async () => {
    const request = createRequest({ hostname: 'unknown.example.net' });
    const response = await worker.fetch(request, mockEnv);

    expect(response.status).toBe(404);
  });

  it('redirects to configured target for public subdomains', async () => {
    const request = createRequest({ hostname: 'public.example.com' });
    const response = await worker.fetch(request, mockEnv);

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('https://public-target.example.com/');
  });

  it('returns 404 for unknown subdomains', async () => {
    const request = createRequest({ hostname: 'unknown.example.com' });
    const response = await worker.fetch(request, mockEnv);

    expect(response.status).toBe(404);
  });

  it('requires authentication for protected subdomains', async () => {
    const request = createRequest({ hostname: 'admin.example.com' });
    const response = await worker.fetch(request, mockEnv);

    expect(response.status).toBe(401);
    expect(response.headers.get('WWW-Authenticate')).toContain('Basic');
  });

  it('redirects after successful authentication', async () => {
    // Base64 encode 'adminuser:adminpass'
    const credentials = base64Encode('adminuser:adminpass');

    const request = createRequest({
      hostname: 'admin.example.com',
      headers: {
        'Authorization': `Basic ${credentials}`
      }
    });

    const response = await worker.fetch(request, mockEnv);

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('https://admin-target.example.com/');
  });

  it('returns 401 for incorrect credentials', async () => {
    // Base64 encode 'adminuser:wrongpass'
    const credentials = base64Encode('adminuser:wrongpass');

    const request = createRequest({
      hostname: 'admin.example.com',
      headers: {
        'Authorization': `Basic ${credentials}`
      }
    });

    const response = await worker.fetch(request, mockEnv);

    expect(response.status).toBe(401);
  });

  it('rate limits after too many failed attempts', async () => {
    const clientIp = '1.2.3.4';

    // Base64 encode 'adminuser:wrongpass'
    const credentials = base64Encode('adminuser:wrongpass');

    // Make multiple failed requests
    for (let i = 0; i < ratelimit.MAX_FAILED_ATTEMPTS; i++) {
      const request = createRequest({
        hostname: 'admin.example.com',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'CF-Connecting-IP': clientIp
        }
      });

      await worker.fetch(request, mockEnv);
    }

    // One more request should be rate limited
    const request = createRequest({
      hostname: 'admin.example.com',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'CF-Connecting-IP': clientIp
      }
    });

    const response = await worker.fetch(request, mockEnv);

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBeDefined();
  });

  it('uses fallback credentials when specific ones not provided', async () => {
    // Define test environment with only fallback credentials
    const testEnv = {
      ...mockEnv,
      USER_TEST: undefined,
      PASS_TEST: undefined,
      LINK_TEST: 'https://test-target.example.com',
      PROTECTED_SUBDOMAINS: 'admin,secure,test'
    };

    // Base64 encode 'fallbackuser:fallbackpass'
    const credentials = base64Encode('fallbackuser:fallbackpass');

    const request = createRequest({
      hostname: 'test.example.com',
      headers: {
        'Authorization': `Basic ${credentials}`
      }
    });

    const response = await worker.fetch(request, testEnv);

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('https://test-target.example.com/');
  });

  it('handles HEAD requests the same as GET requests', async () => {
    const request = createRequest({
      method: 'HEAD',
      hostname: 'public.example.com'
    });

    const response = await worker.fetch(request, mockEnv);

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('https://public-target.example.com/');
  });

  it('returns 404 for protected subdomain with no target', async () => {
    // Define test environment with protected subdomain but no target
    const testEnv = {
      ...mockEnv,
      PROTECTED_SUBDOMAINS: 'admin,secure,missing',
      // No LINK_MISSING defined - this should cause a 404
    };

    const request = createRequest({ hostname: 'missing.example.com' });
    const response = await worker.fetch(request, testEnv);

    expect(response.status).toBe(404);
  });

  it('returns 401 when credentials are misconfigured', async () => {
    // Define test environment with protected subdomain but no credentials
    const testEnv = {
      ...mockEnv,
      USER_SECURE: '',  // Empty username
      PASS_SECURE: '',  // Empty password
      PROTECTED_SUBDOMAINS: 'admin,secure'
    };

    const request = createRequest({ hostname: 'secure.example.com' });
    const response = await worker.fetch(request, testEnv);

    expect(response.status).toBe(401);
  });

  describe('Multi-level subdomains', () => {
    it('forms correct environment keys for multi-level subdomains (dots to underscores)', async () => {
      // Test environment with multi-level subdomain config
      // foo.bar subdomain should map to LINK_FOO_BAR, USER_FOO_BAR, PASS_FOO_BAR
      const testEnv = {
        ...mockEnv,
        LINK_FOO_BAR: 'https://foo-bar-target.example.com',
        USER_FOO_BAR: 'foobaruser',
        PASS_FOO_BAR: 'foobarpass',
        PROTECTED_SUBDOMAINS: 'admin,secure,foo.bar'
      };

      const request = createRequest({ hostname: 'foo.bar.example.com' });
      const response = await worker.fetch(request, testEnv);

      expect(response.status).toBe(401); // Should require auth since it's protected
      expect(response.headers.get('WWW-Authenticate')).toContain('Basic');
    });

    it('redirects multi-level subdomain after successful authentication', async () => {
      const testEnv = {
        ...mockEnv,
        LINK_FOO_BAR: 'https://foo-bar-target.example.com',
        USER_FOO_BAR: 'foobaruser',
        PASS_FOO_BAR: 'foobarpass',
        PROTECTED_SUBDOMAINS: 'admin,secure,foo.bar'
      };

      // Base64 encode 'foobaruser:foobarpass'
      const credentials = base64Encode('foobaruser:foobarpass');

      const request = createRequest({
        hostname: 'foo.bar.example.com',
        headers: {
          'Authorization': `Basic ${credentials}`
        }
      });

      const response = await worker.fetch(request, testEnv);

      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe('https://foo-bar-target.example.com/');
    });

    it('handles unprotected multi-level subdomains', async () => {
      const testEnv = {
        ...mockEnv,
        LINK_API_V1: 'https://api-v1-target.example.com'
        // api.v1 is not in PROTECTED_SUBDOMAINS, so no auth required
      };

      const request = createRequest({ hostname: 'api.v1.example.com' });
      const response = await worker.fetch(request, testEnv);

      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe('https://api-v1-target.example.com/');
    });

    it('uses fallback credentials for multi-level subdomains when specific ones not provided', async () => {
      const testEnv = {
        ...mockEnv,
        LINK_TEST_SUB: 'https://test-sub-target.example.com',
        // No USER_TEST_SUB or PASS_TEST_SUB defined - should use fallback
        PROTECTED_SUBDOMAINS: 'admin,secure,test.sub'
      };

      // Base64 encode 'fallbackuser:fallbackpass'
      const credentials = base64Encode('fallbackuser:fallbackpass');

      const request = createRequest({
        hostname: 'test.sub.example.com',
        headers: {
          'Authorization': `Basic ${credentials}`
        }
      });

      const response = await worker.fetch(request, testEnv);

      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe('https://test-sub-target.example.com/');
    });

    it('handles deeply nested multi-level subdomains', async () => {
      const testEnv = {
        ...mockEnv,
        LINK_DOCS_HELP: 'https://docs-help-target.example.com'
        // docs.help should map to LINK_DOCS_HELP
      };

      const request = createRequest({ hostname: 'docs.help.example.com' });
      const response = await worker.fetch(request, testEnv);

      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe('https://docs-help-target.example.com/');
    });
  });
});
