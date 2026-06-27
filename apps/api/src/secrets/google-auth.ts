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

/** Project id/number for x-goog-user-project (required for Gemini OAuth REST calls). */
export async function getGoogleCloudProjectId(): Promise<string | undefined> {
  const fromEnv = process.env.GOOGLE_CLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT_NUMBER;
  if (fromEnv?.trim()) {
    return fromEnv.trim();
  }

  const clientId =
    (await getSecret('GOOGLE_OAUTH_CLIENT_ID')) ??
    (await getSecret('YOUTUBE_CLIENT_ID')) ??
    process.env.GOOGLE_OAUTH_CLIENT_ID ??
    process.env.YOUTUBE_CLIENT_ID;

  if (!clientId) {
    return undefined;
  }

  const numericPrefix = clientId.match(/^(\d+)-/);
  if (numericPrefix) {
    return numericPrefix[1];
  }

  return undefined;
}

export async function googleOAuthHeaders(accessToken: string): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
  };
  const projectId = await getGoogleCloudProjectId();
  if (projectId) {
    headers['x-goog-user-project'] = projectId;
  }
  return headers;
}

export async function getGoogleOAuthScopes(): Promise<string> {
  return (await getSecret('GOOGLE_OAUTH_SCOPES')) ?? '';
}

export async function hasYoutubeOAuthScope(): Promise<boolean> {
  const scopes = await getGoogleOAuthScopes();
  return scopes.includes('youtube');
}

export function formatGoogleApiTestError(
  service: 'Gemini' | 'YouTube',
  status: number,
  body: string,
): string {
  if (status === 403) {
    if (body.includes('ACCESS_TOKEN_SCOPE_INSUFFICIENT')) {
      return service === 'YouTube'
        ? 'Faltan permisos de YouTube. Pulsa Reconectar en la tarjeta YouTube (no solo Gemini).'
        : 'Faltan permisos de Gemini. Pulsa Reconectar en Google Gemini.';
    }
    if (service === 'Gemini') {
      return 'Gemini 403: habilita Generative Language API en Google Cloud y verifica OAuth (Reconectar).';
    }
    return 'YouTube 403: habilita YouTube Data API v3 en Google Cloud y reconecta OAuth en la tarjeta YouTube.';
  }
  return `${service} respondió ${status}`;
}
