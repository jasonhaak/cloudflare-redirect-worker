const { securityHeaders, authChallengeHeaders } = require('../src/security-headers');

describe('security-headers.js', () => {
  it('returns all required security headers', () => {
    const headers = securityHeaders();
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['X-Frame-Options']).toBe('DENY');
    expect(headers['Strict-Transport-Security']).toContain('max-age');
    expect(headers['Cache-Control']).toBe('no-store');
  });
  it('authChallengeHeaders includes WWW-Authenticate', () => {
    const headers = authChallengeHeaders();
    expect(headers['WWW-Authenticate']).toContain('Basic');
  });
});

