import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  enforceHttps,
  validateMethod,
  resolveSubdomain,
  authorizeProtectedSubdomain,
  handleRedirect
} from '../src/index.js';
import { base64Encode } from '../src/base64.js';
import {Buffer} from "buffer";

// Mock dependencies
vi.mock('../src/utils.js', () => ({
  getClientIdFromCloudflare: vi.fn(() => 'test-client-id'),
  respond: vi.fn((message, status, headers) => new Response(message, { status, headers })),
  setHeaders: vi.fn((response, headers) => {
    // Always return a new Response with merged headers (do not mutate original)
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: { ...Object.fromEntries(response.headers.entries()), ...headers }
    });
  })
}));

vi.mock('../src/security-headers.js', () => ({
  securityHeaders: vi.fn((extra = {}) => ({ 'X-Security': 'test', ...extra })),
  authChallengeHeaders: vi.fn(() => ({ 'WWW-Authenticate': 'Basic realm="Protected"' }))
}));

vi.mock('../src/host.js', () => ({
  hostIsAllowed: vi.fn((hostname, suffixes) => {
    return suffixes.some(suffix => hostname.endsWith(suffix));
  }),
  extractSubdomain: vi.fn((hostname, suffixes) => {
    const suffix = suffixes.find(s => hostname.endsWith(s));
    return suffix ? hostname.replace(suffix, '') : hostname;
  })
}));

vi.mock('../src/auth.js', () => ({
  checkBasicAuth: vi.fn((authHeader, expectedOrUser, maybePass) => {
    if (!authHeader || !authHeader.startsWith('Basic ')) return false;
    const credentials = authHeader.slice(6);
    // Legacy signature: (header, user, pass)
    if (typeof expectedOrUser === 'string' && typeof maybePass === 'string') {
      const expected = base64Encode(`${expectedOrUser}:${maybePass}`);
      return credentials === expected;
    }
    // New signature: (header, expected)
    const decoded = Buffer.from(credentials, 'base64').toString('utf8');
    const idx = decoded.indexOf(':');
    if (idx === -1) return false;
    const providedUser = decoded.slice(0, idx);
    const providedPass = decoded.slice(idx + 1);
    if (Array.isArray(expectedOrUser)) {
      return expectedOrUser.some(({ user, pass }) => providedUser === user && providedPass === pass);
    } else if (expectedOrUser && typeof expectedOrUser === 'object') {
      return providedUser === expectedOrUser.user && providedPass === expectedOrUser.pass;
    }
    return false;
  }),
  isNonEmpty: vi.fn((value) => value && value.trim().length > 0)
}));

vi.mock('../src/ratelimit.js', () => ({
  isRateLimited: vi.fn(() => false),
  registerFailedAttempt: vi.fn(),
  clearFailures: vi.fn(),
  rateLimitRetryHeaders: vi.fn(() => ({ 'Retry-After': '60' })),
  MAX_AUTH_HEADER_LENGTH: 8192
}));

describe('enforceHttps', () => {
  it('redirects HTTP to HTTPS with 301 status', () => {
    const url = new URL('http://example.com/path');
    const response = enforceHttps(url);

    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(301);
    expect(response.headers.get('Location')).toBe('https://example.com/path');
  });

  it('returns null for HTTPS URLs', () => {
    const url = new URL('https://example.com/path');
    const response = enforceHttps(url);

    expect(response).toBeNull();
  });

  it('preserves query parameters and hash in redirect', () => {
    const url = new URL('http://example.com/path?param=value#section');
    const response = enforceHttps(url);

    expect(response.headers.get('Location')).toBe('https://example.com/path?param=value#section');
  });
});

describe('validateMethod', () => {
  it('returns null for GET method', () => {
    const response = validateMethod('GET');
    expect(response).toBeNull();
  });

  it('returns null for HEAD method', () => {
    const response = validateMethod('HEAD');
    expect(response).toBeNull();
  });

  it('returns null for lowercase get method', () => {
    const response = validateMethod('get');
    expect(response).toBeNull();
  });

  it('returns 405 response for POST method', () => {
    const response = validateMethod('POST');
    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(405);
  });

  it('returns 405 response for PUT method', () => {
    const response = validateMethod('PUT');
    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(405);
  });

  it('returns 405 response for DELETE method', () => {
    const response = validateMethod('DELETE');
    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(405);
  });
});

describe('resolveSubdomain', () => {
  const allowedSuffixes = ['.example.com', '.test.org'];

  it('returns subdomain for allowed hostname', () => {
    const result = resolveSubdomain('api.example.com', allowedSuffixes);
    expect(result).toEqual({ subdomain: 'api' });
  });

  it('returns subdomain for multi-level subdomain', () => {
    const result = resolveSubdomain('v1.api.example.com', allowedSuffixes);
    expect(result).toEqual({ subdomain: 'v1.api' });
  });

  it('returns error response for disallowed hostname', () => {
    const result = resolveSubdomain('malicious.com', allowedSuffixes);
    expect(result.error).toBeInstanceOf(Response);
    expect(result.error.status).toBe(404);
    expect(result.subdomain).toBeUndefined();
  });

  it('handles different allowed suffixes', () => {
    const result = resolveSubdomain('staging.test.org', allowedSuffixes);
    expect(result).toEqual({ subdomain: 'staging' });
  });
});

describe('authorizeProtectedSubdomain', () => {
  const mockEnv = {
    USER_TEST: 'testuser',
    PASS_TEST: 'testpass',
    FALLBACK_USER: 'fallbackuser',
    FALLBACK_PASS: 'fallbackpass'
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    // Always reset isRateLimited to false unless overridden in a test
    const { isRateLimited } = await import('../src/ratelimit.js');
    isRateLimited.mockReturnValue(false);
  });

  it('returns null for valid authentication', async () => {
    const authHeader = `Basic ${base64Encode('testuser:testpass')}`;
    const request = new Request('https://test.example.com', {
      headers: { Authorization: authHeader }
    });
    const response = await authorizeProtectedSubdomain(request, 'test', mockEnv);
    expect(response).toBeNull();
  });

  it('returns 401 when credentials are not configured', async () => {
    const envWithoutCreds = {};
    const request = new Request('https://test.example.com');
    const response = await authorizeProtectedSubdomain(request, 'test', envWithoutCreds);
    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(401);
  });

  it('returns 429 when rate limited', async () => {
    const { isRateLimited } = await import('../src/ratelimit.js');
    isRateLimited.mockReturnValue(true);
    const request = new Request('https://test.example.com');
    const response = await authorizeProtectedSubdomain(request, 'test', mockEnv);
    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(429);
  });

  it('returns 401 for oversized auth header', async () => {
    const { isRateLimited, registerFailedAttempt } = await import('../src/ratelimit.js');
    isRateLimited.mockReturnValue(false);
    const longAuthHeader = 'Basic ' + 'A'.repeat(8200);
    const request = new Request('https://test.example.com', {
      headers: { Authorization: longAuthHeader }
    });
    const response = await authorizeProtectedSubdomain(request, 'test', mockEnv);
    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(401);
    expect(registerFailedAttempt).toHaveBeenCalledWith('test-client-id', 'test');
  });

  it('returns 401 for invalid credentials', async () => {
    const { isRateLimited } = await import('../src/ratelimit.js');
    isRateLimited.mockReturnValue(false);
    const authHeader = `Basic ${base64Encode('wronguser:wrongpass')}`;
    const request = new Request('https://test.example.com', {
      headers: { Authorization: authHeader }
    });
    const response = await authorizeProtectedSubdomain(request, 'test', mockEnv);
    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(401);
  });

  it('registers failed attempt for invalid credentials', async () => {
    const { isRateLimited, registerFailedAttempt } = await import('../src/ratelimit.js');
    isRateLimited.mockReturnValue(false);
    const authHeader = `Basic ${base64Encode('wronguser:wrongpass')}`;
    const request = new Request('https://test.example.com', {
      headers: { Authorization: authHeader }
    });
    await authorizeProtectedSubdomain(request, 'test', mockEnv);
    expect(registerFailedAttempt).toHaveBeenCalledWith('test-client-id', 'test');
  });

  it('clears failures on successful authentication', async () => {
    const { isRateLimited, clearFailures } = await import('../src/ratelimit.js');
    isRateLimited.mockReturnValue(false);
    const authHeader = `Basic ${base64Encode('testuser:testpass')}`;
    const request = new Request('https://test.example.com', {
      headers: { Authorization: authHeader }
    });
    await authorizeProtectedSubdomain(request, 'test', mockEnv);
    expect(clearFailures).toHaveBeenCalledWith('test-client-id', 'test');
  });

  it('uses fallback credentials when subdomain credentials are not set', async () => {
    const { isRateLimited } = await import('../src/ratelimit.js');
    isRateLimited.mockReturnValue(false);
    const authHeader = `Basic ${base64Encode('fallbackuser:fallbackpass')}`;
    const request = new Request('https://noconfig.example.com', {
      headers: { Authorization: authHeader }
    });
    const response = await authorizeProtectedSubdomain(request, 'noconfig', mockEnv);
    expect(response).toBeNull();
  });
});

describe('handleRedirect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 302 redirect for valid target URL', () => {
    const targetUrl = 'https://target.example.com';
    const response = handleRedirect(targetUrl);

    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(302);
    // Accept both with and without trailing slash for robustness
    const location = response.headers.get('Location');
    expect([targetUrl, targetUrl + '/']).toContain(location);
  });

  it('returns 404 response for null target URL', () => {
    const response = handleRedirect(null);

    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(404);
  });

  it('returns 404 response for undefined target URL', () => {
    const response = handleRedirect(undefined);

    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(404);
  });

  it('returns 404 response for empty string target URL', () => {
    const response = handleRedirect('');

    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(404);
  });

  it('handles complex URLs with query parameters', () => {
    const targetUrl = 'https://target.example.com/path?param=value&other=test';
    const response = handleRedirect(targetUrl);

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe(targetUrl);
  });
});
