import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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
});
