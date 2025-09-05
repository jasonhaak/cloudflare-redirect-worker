import { describe, it, beforeAll, afterAll, expect } from 'vitest';
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
  });
});
