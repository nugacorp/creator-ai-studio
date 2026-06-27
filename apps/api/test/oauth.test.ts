import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildGoogleAuthorizeUrl } from '../src/oauth/google.js';
import { signOAuthState, verifyOAuthState } from '../src/oauth/state.js';

describe('oauth state', () => {
  let prevKey: string | undefined;

  beforeEach(() => {
    prevKey = process.env.CAS_SECRETS_KEY;
    process.env.CAS_SECRETS_KEY = 'test-master-key-for-unit-tests-32chars';
  });

  afterEach(() => {
    process.env.CAS_SECRETS_KEY = prevKey;
  });

  it('signs and verifies oauth state payload', async () => {
    const state = await signOAuthState({
      purpose: 'gemini',
      returnUrl: 'http://localhost/?view=settings',
    });
    const payload = await verifyOAuthState(state);
    expect(payload.purpose).toBe('gemini');
    expect(payload.returnUrl).toContain('settings');
  });

  it('omits prompt when refresh token already exists', () => {
    const url = buildGoogleAuthorizeUrl({
      clientId: 'client.apps.googleusercontent.com',
      redirectUri: 'https://example.com/api/oauth/google/callback',
      state: 'state',
      purpose: 'gemini',
      promptConsent: false,
    });
    expect(url).not.toContain('prompt=');
  });

  it('includes prompt=consent when forced or first connect', () => {
    const url = buildGoogleAuthorizeUrl({
      clientId: 'client.apps.googleusercontent.com',
      redirectUri: 'https://example.com/api/oauth/google/callback',
      state: 'state',
      purpose: 'gemini',
      promptConsent: true,
    });
    expect(url).toContain('prompt=consent');
  });
});
