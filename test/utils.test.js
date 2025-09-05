import { describe, it, expect } from 'vitest';
import { getClientIdFromCloudflare, respond, setHeaders } from '../src/utils.js';

describe('utils.js', () => {
  describe('getClientIdFromCloudflare', () => {
    it('returns IP from CF-Connecting-IP header', () => {
      const req = { headers: { get: (k) => k === 'CF-Connecting-IP' ? '1.2.3.4' : undefined } };
      expect(getClientIdFromCloudflare(req)).toBe('1.2.3.4');
    });
    it('returns "unknown" for missing or long IP', () => {
      const req1 = { headers: { get: () => undefined } };
      const req2 = { headers: { get: () => 'x'.repeat(65) } };
      expect(getClientIdFromCloudflare(req1)).toBe('unknown');
      expect(getClientIdFromCloudflare(req2)).toBe('unknown');
    });
  });

  describe('respond', () => {
    it('returns a Response with correct body, status, and headers', async () => {
      const res = respond('hello', 201, { foo: 'bar' });
      expect(res).toBeInstanceOf(Response);
      expect(res.status).toBe(201);
      expect(await res.text()).toBe('hello');
      expect(res.headers.get('foo')).toBe('bar');
    });
    it('defaults status to 200 and headers to empty', async () => {
      const res = respond('ok');
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('ok');
    });
  });

  describe('setHeaders', () => {
    it('adds new headers to a Response', async () => {
      const res = respond('body', 200, { a: '1' });
      const res2 = setHeaders(res, { b: '2' });
      expect(res2.headers.get('a')).toBe('1');
      expect(res2.headers.get('b')).toBe('2');
      expect(res2.status).toBe(200);
      expect(await res2.text()).toBe('body');
    });
    it('overrides existing headers', async () => {
      const res = respond('body', 200, { foo: 'bar' });
      const res2 = setHeaders(res, { foo: 'baz' });
      expect(res2.headers.get('foo')).toBe('baz');
    });
  });
});
