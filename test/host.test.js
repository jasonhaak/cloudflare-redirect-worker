import { describe, it, expect } from 'vitest';
import { parseCommaList, hostIsAllowed, extractSubdomain, validateAndNormalizeSuffix, parseSimpleCommaList } from '../src/host.js';

describe('host.js', () => {
  describe('validateAndNormalizeSuffix', () => {
    it('normalizes valid suffixes to start with dot', () => {
      expect(validateAndNormalizeSuffix('example.com')).toBe('.example.com');
      expect(validateAndNormalizeSuffix('.example.com')).toBe('.example.com');
      expect(validateAndNormalizeSuffix('  EXAMPLE.COM  ')).toBe('.example.com');
    });

    it('rejects invalid inputs', () => {
      expect(() => validateAndNormalizeSuffix('')).toThrow('Host suffix must be a non-empty string');
      expect(() => validateAndNormalizeSuffix('  ')).toThrow('Host suffix cannot be empty or whitespace-only');
      expect(() => validateAndNormalizeSuffix(null)).toThrow('Host suffix must be a non-empty string');
      expect(() => validateAndNormalizeSuffix(123)).toThrow('Host suffix must be a non-empty string');
    });

    it('rejects malformed domain tokens', () => {
      expect(() => validateAndNormalizeSuffix('example..com')).toThrow('malformed domain tokens');
      expect(() => validateAndNormalizeSuffix('example.-.com')).toThrow('malformed domain tokens');
      expect(() => validateAndNormalizeSuffix('example.-com')).toThrow('malformed domain tokens');
    });

    it('rejects invalid characters', () => {
      expect(() => validateAndNormalizeSuffix('example.com!')).toThrow('invalid characters');
      expect(() => validateAndNormalizeSuffix('example@com')).toThrow('invalid characters');
      expect(() => validateAndNormalizeSuffix('example_com')).toThrow('invalid characters');
    });

    it('rejects invalid format patterns', () => {
      expect(() => validateAndNormalizeSuffix('.-example.com')).toThrow('malformed domain tokens');
      expect(() => validateAndNormalizeSuffix('example.com-.')).toThrow('malformed domain tokens');
      expect(() => validateAndNormalizeSuffix('example.com.')).toThrow('invalid format');
    });

    it('handles IPv6 addresses', () => {
      expect(validateAndNormalizeSuffix('[2001:db8::1]')).toBe('[2001:db8::1]');
      expect(() => validateAndNormalizeSuffix('2001:db8::1')).toThrow('IPv6 addresses must be wrapped in brackets');
    });

    it('handles international domain names', () => {
      // Test with a simple IDN that should convert to punycode
      const result = validateAndNormalizeSuffix('münchen.de');
      expect(result.startsWith('.xn--')).toBe(true); // Should be punycode
    });
  });

  describe('parseCommaList', () => {
    it('parses and normalizes comma-separated values', () => {
      expect(parseCommaList('example.com, test.org, foo.net')).toEqual(['.example.com', '.test.org', '.foo.net']);
      expect(parseCommaList('')).toEqual([]);
      expect(parseCommaList(null)).toEqual([]);
    });
    it('lowercases and normalizes values', () => {
      expect(parseCommaList('EXAMPLE.COM,TEST.ORG')).toEqual(['.example.com', '.test.org']);
    });
    it('handles undefined input', () => {
      expect(parseCommaList(undefined)).toEqual([]);
    });
    it('skips invalid suffixes with warnings', () => {
      // Mock console.warn to capture warnings
      const originalWarn = console.warn;
      const warnings = [];
      console.warn = (msg) => warnings.push(msg);

      const result = parseCommaList('example.com,invalid..suffix,test.org');
      expect(result).toEqual(['.example.com', '.test.org']);
      expect(warnings.length).toBe(1);
      expect(warnings[0]).toContain('invalid..suffix');

      console.warn = originalWarn;
    });
  });

  describe('parseSimpleCommaList', () => {
    it('parses comma-separated values without normalization', () => {
      expect(parseSimpleCommaList('admin,secure,public')).toEqual(['admin', 'secure', 'public']);
      expect(parseSimpleCommaList('a, b, c')).toEqual(['a', 'b', 'c']);
      expect(parseSimpleCommaList('')).toEqual([]);
      expect(parseSimpleCommaList(null)).toEqual([]);
    });

    it('removes whitespace from each item', () => {
      expect(parseSimpleCommaList(' admin , secure , public ')).toEqual(['admin', 'secure', 'public']);
      expect(parseSimpleCommaList('  test1  ,  test2  ')).toEqual(['test1', 'test2']);
    });

    it('filters out empty values', () => {
      expect(parseSimpleCommaList('admin,,secure,,')).toEqual(['admin', 'secure']);
      expect(parseSimpleCommaList(',admin,,')).toEqual(['admin']);
      expect(parseSimpleCommaList(',,,')).toEqual([]);
    });

    it('handles undefined input', () => {
      expect(parseSimpleCommaList(undefined)).toEqual([]);
    });

    it('preserves case and does not add dots (unlike parseCommaList)', () => {
      expect(parseSimpleCommaList('Admin,SECURE,public')).toEqual(['Admin', 'SECURE', 'public']);
      expect(parseSimpleCommaList('test.subdomain')).toEqual(['test.subdomain']);
    });
  });

  describe('hostIsAllowed', () => {
    it('returns true if suffixes is empty', () => {
      expect(hostIsAllowed('foo.com', [])).toBe(true);
    });
    it('matches allowed suffixes', () => {
      expect(hostIsAllowed('foo.example.com', ['.example.com'])).toBe(true);
      expect(hostIsAllowed('foo.example.org', ['.example.com'])).toBe(false);
    });
    it('matches any of multiple suffixes', () => {
      expect(hostIsAllowed('foo.example.com', ['.example.org', '.example.com'])).toBe(true);
      expect(hostIsAllowed('foo.example.net', ['.example.com', '.example.org'])).toBe(false);
    });
  });

  describe('extractSubdomain', () => {
    const ALLOWED_HOST_SUFFIXES = '.example.com,.test.org';

    it('extracts subdomain before allowed suffix', () => {
      expect(extractSubdomain('foo.example.com', ALLOWED_HOST_SUFFIXES)).toBe('foo');
      expect(extractSubdomain('bar.baz.example.com', ALLOWED_HOST_SUFFIXES)).toBe('bar.baz');
      expect(extractSubdomain('example.com', ALLOWED_HOST_SUFFIXES)).toBe('');
      expect(extractSubdomain('foo.test.org', ALLOWED_HOST_SUFFIXES)).toBe('foo');
    });
    it('returns empty string if no match', () => {
      expect(extractSubdomain('foo.bar', ALLOWED_HOST_SUFFIXES)).toBe('');
    });
    it('handles edge cases with hostname exactly matching suffix', () => {
      expect(extractSubdomain('example.com', '.example.com')).toBe('');
      expect(extractSubdomain('test.org', '.example.com,.test.org')).toBe('');
    });
  });
});
