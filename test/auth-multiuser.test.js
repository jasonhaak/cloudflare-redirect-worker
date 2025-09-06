import { describe, it, expect, beforeEach } from 'vitest';

import worker, { invalidateConfigCache } from '../src/index.js';
import { base64Encode } from '../src/base64.js';

const makeAuthHeader = (user, pass) => `Basic ${base64Encode(`${user}:${pass}`)}`;

const baseEnv = {
  ALLOWED_HOST_SUFFIXES: '.example.com',
  PROTECTED_SUBDOMAINS: 'multi,single',
  LINK_MULTI: 'https://multi.example.com',
  LINK_SINGLE: 'https://single.example.com',
  FALLBACK_USER: 'fallback',
  FALLBACK_PASS: 'fallbackpw',
};

describe('Multi-user Basic Auth (USERS_<SUBDOMAIN>)', () => {
  beforeEach(() => invalidateConfigCache());

  it('accepts any valid user/pass in USERS_<SUBDOMAIN>', async () => {
    const env = {
      ...baseEnv,
      USERS_MULTI: JSON.stringify([
        { user: 'alice', pass: 'pw1' },
        { user: 'bob', pass: 'pw2' }
      ])
    };
    for (const { user, pass } of JSON.parse(env.USERS_MULTI)) {
      const req = new Request('https://multi.example.com', {
        headers: { Authorization: makeAuthHeader(user, pass) }
      });
      const res = await worker.fetch(req, env);
      expect(res.status).toBe(302);
      expect(res.headers.get('Location')).toBe('https://multi.example.com/');
    }
  });

  it('rejects invalid credentials for all users in USERS_<SUBDOMAIN>', async () => {
    const env = {
      ...baseEnv,
      USERS_MULTI: JSON.stringify([
        { user: 'alice', pass: 'pw1' },
        { user: 'bob', pass: 'pw2' }
      ])
    };
    const req = new Request('https://multi.example.com', {
      headers: { Authorization: makeAuthHeader('charlie', 'pw3') }
    });
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(401);
  });

  it('falls back to USER_/PASS_ if USERS_ is not set', async () => {
    const env = {
      ...baseEnv,
      USER_SINGLE: 'singleuser',
      PASS_SINGLE: 'singlepass',
    };
    const req = new Request('https://single.example.com', {
      headers: { Authorization: makeAuthHeader('singleuser', 'singlepass') }
    });
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('https://single.example.com/');
  });

  it('falls back to fallback credentials if nothing else is set', async () => {
    const env = { ...baseEnv };
    const req = new Request('https://single.example.com', {
      headers: { Authorization: makeAuthHeader('fallback', 'fallbackpw') }
    });
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('https://single.example.com/');
  });

  it('rejects malformed USERS_<SUBDOMAIN> JSON and falls back', async () => {
    const env = {
      ...baseEnv,
      USERS_MULTI: '[{"user":"alice","pass":"pw1"},', // malformed JSON
      USER_MULTI: 'singleuser',
      PASS_MULTI: 'singlepass',
    };
    const req = new Request('https://multi.example.com', {
      headers: { Authorization: makeAuthHeader('singleuser', 'singlepass') }
    });
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('https://multi.example.com/');
  });

  it('rejects if USERS_<SUBDOMAIN> is an empty array', async () => {
    const env = {
      ...baseEnv,
      USERS_MULTI: '[]'
    };
    const req = new Request('https://multi.example.com', {
      headers: { Authorization: makeAuthHeader('alice', 'pw1') }
    });
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(401);
  });
});
