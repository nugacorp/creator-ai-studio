import { getSecret, invalidateSecretCache } from './resolver.js';
import { patchSecrets } from './store.js';
import { getGoogleOAuthClient, refreshGoogleAccessToken } from '../oauth/google.js';

export type GeminiAuth =
  | { mode: 'api_key'; value: string }
  | { mode: 'oauth'; accessToken: string };

export async function getValidGoogleAccessToken(): Promise<string | undefined> {
  const accessToken = await getSecret('GOOGLE_OAUTH_ACCESS_TOKEN');
  const refreshToken = await getSecret('GOOGLE_OAUTH_REFRESH_TOKEN');
  const expiresAtRaw = await getSecret('GOOGLE_OAUTH_EXPIRES_AT');

  if (!accessToken) {
    return undefined;
  }

  const expiresAt = expiresAtRaw ? Number(expiresAtRaw) : 0;
  const needsRefresh = refreshToken && expiresAt > 0 && Date.now() > expiresAt - 60_000;

  if (!needsRefresh) {
    return accessToken;
  }

  const client = await getGoogleOAuthClient();
  if (!client || !refreshToken) {
    return accessToken;
  }

  const tokens = await refreshGoogleAccessToken({
    refreshToken,
    clientId: client.clientId,
    clientSecret: client.clientSecret,
  });

  if (!tokens.access_token) {
    return accessToken;
  }

  const nextExpiry = tokens.expires_in
    ? String(Date.now() + tokens.expires_in * 1000)
    : String(Date.now() + 3600 * 1000);

  invalidateSecretCache();
  await patchSecrets({
    googleOAuthAccessToken: tokens.access_token,
    googleOAuthExpiresAt: nextExpiry,
    ...(tokens.scope ? { googleOAuthScopes: tokens.scope } : {}),
  });

  return tokens.access_token;
}

export async function getGeminiAuth(): Promise<GeminiAuth | undefined> {
  const oauthToken = await getValidGoogleAccessToken();
  if (oauthToken) {
    return { mode: 'oauth', accessToken: oauthToken };
  }

  const apiKey = await getSecret('GEMINI_API_KEY');
  if (apiKey) {
    return { mode: 'api_key', value: apiKey };
  }

  return undefined;
}

export async function hasGeminiOAuth(): Promise<boolean> {
  return Boolean(await getSecret('GOOGLE_OAUTH_REFRESH_TOKEN') ?? await getSecret('GOOGLE_OAUTH_ACCESS_TOKEN'));
}
