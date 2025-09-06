import { describe, it, expect } from 'vitest';
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
    it('handles undefined input', () => {
      expect(parseCommaList(undefined)).toEqual([]);
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
