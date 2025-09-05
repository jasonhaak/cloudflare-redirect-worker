import { describe, it, expect } from 'vitest';
import { getClientIdFromCloudflare } from '../src/utils.js';

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
});
