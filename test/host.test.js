import { describe, it, beforeEach, beforeAll, afterAll, expect } from 'vitest';
import { parseCommaList, hostIsAllowed, extractSubdomain } from '../src/host.js';

describe('host.js', () => {
  describe('parseCommaList', () => {
    it('parses and trims comma-separated values', () => {
      expect(parseCommaList('a, b, c')).toEqual(['a', 'b', 'c']);
      expect(parseCommaList('')).toEqual([]);
      expect(parseCommaList(null)).toEqual([]);
    });
    it('lowercases values', () => {
      expect(parseCommaList('A,B')).toEqual(['a', 'b']);
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
  });

  describe('extractSubdomain', () => {
    beforeAll(() => {
      globalThis.ALLOWED_HOST_SUFFIXES = '.example.com,.test.org';
    });
    afterAll(() => {
      delete globalThis.ALLOWED_HOST_SUFFIXES;
    });
    it('extracts subdomain before allowed suffix', () => {
      expect(extractSubdomain('foo.example.com')).toBe('foo');
      expect(extractSubdomain('bar.baz.example.com')).toBe('bar.baz');
      expect(extractSubdomain('example.com')).toBe('');
      expect(extractSubdomain('foo.test.org')).toBe('foo');
    });
    it('returns empty string if no match', () => {
      expect(extractSubdomain('foo.bar')).toBe('');
    });
  });
});
