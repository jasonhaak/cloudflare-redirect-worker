import { describe, it, expect } from 'vitest';
import { checkBasicAuth, constantTimeEqual, isNonEmpty } from '../src/auth.js';
import { base64Encode } from '../src/base64.js';

describe('auth.js', () => {
  describe('isNonEmpty', () => {
    it('returns true for non-empty strings', () => {
      expect(isNonEmpty('foo')).toBe(true);
      expect(isNonEmpty('  bar  ')).toBe(true);
    });
    it('returns false for empty or whitespace-only strings', () => {
      expect(isNonEmpty('')).toBe(false);
      expect(isNonEmpty('   ')).toBe(false);
      expect(isNonEmpty(null)).toBe(false);
      expect(isNonEmpty(undefined)).toBe(false);
    });
  });

  describe('constantTimeEqual', () => {
    it('returns true for equal strings', () => {
      expect(constantTimeEqual('abc', 'abc')).toBe(true);
    });
    it('returns false for different strings or types', () => {
      expect(constantTimeEqual('abc', 'def')).toBe(false);
      expect(constantTimeEqual('abc', 'abcd')).toBe(false);
      expect(constantTimeEqual('abc', null)).toBe(false);
      expect(constantTimeEqual(null, 'abc')).toBe(false);
    });
  });

  describe('checkBasicAuth', () => {
    function makeHeader(user, pass) {
      return 'Basic ' + base64Encode(`${user}:${pass}`);
    }
    it('returns true for correct credentials', () => {
      const header = makeHeader('user', 'pass');
      expect(checkBasicAuth(header, 'user', 'pass')).toBe(true);
    });
    it('returns false for wrong credentials', () => {
      const header = makeHeader('user', 'wrong');
      expect(checkBasicAuth(header, 'user', 'pass')).toBe(false);
    });
    it('returns false for malformed header', () => {
      expect(checkBasicAuth('Basic notbase64', 'user', 'pass')).toBe(false);
      expect(checkBasicAuth('Bearer token', 'user', 'pass')).toBe(false);
    });
    it('returns false for missing colon', () => {
      const b64 = base64Encode('userpass');
      expect(checkBasicAuth('Basic ' + b64, 'user', 'pass')).toBe(false);
    });
    it('returns false for undefined or empty authorization header', () => {
      expect(checkBasicAuth(undefined, 'user', 'pass')).toBe(false);
      expect(checkBasicAuth(null, 'user', 'pass')).toBe(false);
      expect(checkBasicAuth('', 'user', 'pass')).toBe(false);
    });
    it('returns false if decoded credentials lack a colon', () => {
      // 'dXNlcnBhc3M=' is base64 for 'userpass' (no colon)
      const malformed = 'Basic dXNlcnBhc3M=';
      expect(checkBasicAuth(malformed, 'user', 'pass')).toBe(false);
    });
  });
});
