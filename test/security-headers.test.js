import { describe, it, expect } from 'vitest';
import { securityHeaders, authChallengeHeaders, setHeaders, respond } from '../src/security-headers.js';

describe('security-headers.js', () => {
  it('returns all required security headers', () => {
    const headers = securityHeaders();
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['X-Frame-Options']).toBe('DENY');
    expect(headers['Strict-Transport-Security']).toContain('max-age');
    expect(headers['Cache-Control']).toBe('no-store');
  });

  it('merges custom headers with security headers', () => {
    const headers = securityHeaders({ 'Custom-Header': 'custom-value' });
    // Check that security headers are still present
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    // Check that custom header was added
    expect(headers['Custom-Header']).toBe('custom-value');
  });

  it('custom headers override default security headers', () => {
    const headers = securityHeaders({ 'X-Frame-Options': 'SAMEORIGIN' });
    expect(headers['X-Frame-Options']).toBe('SAMEORIGIN');
  });

  it('authChallengeHeaders includes WWW-Authenticate', () => {
    const headers = authChallengeHeaders();
    expect(headers['WWW-Authenticate']).toContain('Basic');
    // Also check that it inherits security headers
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
  });

  it('setHeaders adds security headers to response', async () => {
    const originalResponse = new Response('body', { status: 200 });
    const modifiedResponse = setHeaders(originalResponse, securityHeaders());

    // Check that the response has the security headers
    expect(modifiedResponse.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(modifiedResponse.headers.get('X-Frame-Options')).toBe('DENY');

    // Check that the original properties are preserved
    expect(modifiedResponse.status).toBe(200);
    expect(await modifiedResponse.text()).toBe('body');
  });

  it('respond creates a new response with appropriate status, body, and headers', async () => {
    const response = respond('test body', 418, securityHeaders());
    expect(response.status).toBe(418);
    expect(await response.text()).toBe('test body');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });
});
