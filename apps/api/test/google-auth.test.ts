import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  clearGoogleOAuthTokens,
  getValidGoogleAccessToken,
  refreshGoogleAccessTokenOrClear,
} from '../src/secrets/google-auth.js';
import { patchSecrets } from '../src/secrets/store.js';
import { invalidateSecretCache } from '../src/secrets/resolver.js';

describe('google OAuth token refresh', () => {
  let prevKey: string | undefined;
  let prevStorage: string | undefined;
  let prevData: string | undefined;
  let tempDir: string;

  beforeEach(async () => {
    prevKey = process.env.CAS_SECRETS_KEY;
    prevStorage = process.env.LOCAL_STORAGE_PATH;
    prevData = process.env.CAS_DATA_PATH;
    tempDir = await mkdtemp(path.join(tmpdir(), 'cas-google-auth-'));
    process.env.CAS_SECRETS_KEY = 'test-master-key-for-unit-tests-32chars';
    process.env.CAS_DATA_PATH = path.join(tempDir, 'data');
    process.env.LOCAL_STORAGE_PATH = path.join(tempDir, 'data', 'episodes');
    process.env.GOOGLE_OAUTH_CLIENT_ID = '123-test.apps.googleusercontent.com';
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'test-client-secret';
    invalidateSecretCache();
    vi.restoreAllMocks();
  });

  afterEach(async () => {
    process.env.CAS_SECRETS_KEY = prevKey;
    process.env.LOCAL_STORAGE_PATH = prevStorage;
    process.env.CAS_DATA_PATH = prevData;
    delete process.env.GOOGLE_OAUTH_CLIENT_ID;
    delete process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    await rm(tempDir, { recursive: true, force: true });
  });

  it('returns cached access token when not expired', async () => {
    const future = String(Date.now() + 3600_000);
    await patchSecrets({
      googleOAuthAccessToken: 'access-valid',
      googleOAuthRefreshToken: 'refresh-valid',
      googleOAuthExpiresAt: future,
      googleOAuthScopes: 'https://www.googleapis.com/auth/youtube.readonly',
    });
    invalidateSecretCache();

    const token = await getValidGoogleAccessToken();
    expect(token).toBe('access-valid');
  });

  it('refreshes expired access token and persists the new one', async () => {
    const past = String(Date.now() - 60_000);
    await patchSecrets({
      googleOAuthAccessToken: 'access-expired',
      googleOAuthRefreshToken: 'refresh-valid',
      googleOAuthExpiresAt: past,
      googleOAuthScopes: 'youtube.readonly',
    });
    invalidateSecretCache();

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'access-refreshed',
          expires_in: 3600,
          scope: 'youtube.readonly',
        }),
      }),
    );

    const token = await getValidGoogleAccessToken();
    expect(token).toBe('access-refreshed');

    invalidateSecretCache();
    const again = await getValidGoogleAccessToken();
    expect(again).toBe('access-refreshed');
  });

  it('clears stored OAuth when refresh fails', async () => {
    await patchSecrets({
      googleOAuthAccessToken: 'access-expired',
      googleOAuthRefreshToken: 'refresh-invalid',
      googleOAuthExpiresAt: String(Date.now() - 60_000),
      googleOAuthScopes: 'youtube.readonly',
      youtubeAccessToken: 'access-expired',
    });
    invalidateSecretCache();

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ error: 'invalid_grant' }),
      }),
    );

    const token = await refreshGoogleAccessTokenOrClear();
    expect(token).toBeUndefined();

    invalidateSecretCache();
    const afterClear = await getValidGoogleAccessToken();
    expect(afterClear).toBeUndefined();
  });

  it('clearGoogleOAuthTokens removes all OAuth fields', async () => {
    await patchSecrets({
      googleOAuthAccessToken: 'access',
      googleOAuthRefreshToken: 'refresh',
      googleOAuthExpiresAt: String(Date.now() + 3600_000),
      googleOAuthScopes: 'youtube',
      youtubeAccessToken: 'access',
    });
    invalidateSecretCache();

    await clearGoogleOAuthTokens();
    invalidateSecretCache();

    expect(await getValidGoogleAccessToken()).toBeUndefined();
  });
});
