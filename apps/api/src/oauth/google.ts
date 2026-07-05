import process from 'node:process';
import type { SecretsPatch } from '@creator-ai-studio/shared';
import { getSecret } from '../secrets/resolver.js';
import { patchSecrets } from '../secrets/store.js';
import { invalidateSecretCache } from '../secrets/resolver.js';

export type GoogleOAuthPurpose = 'gemini' | 'youtube';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

const PURPOSE_SCOPES: Record<GoogleOAuthPurpose, string[]> = {
  gemini: [
    'openid',
    'email',
    'profile',
    'https://www.googleapis.com/auth/cloud-platform',
    'https://www.googleapis.com/auth/generative-language.retriever',
  ],
  youtube: [
    'openid',
    'email',
    'profile',
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube.readonly',
    'https://www.googleapis.com/auth/yt-analytics.readonly',
  ],
};

export interface GoogleOAuthClient {
  clientId: string;
  clientSecret: string;
}

export async function getGoogleOAuthClient(): Promise<GoogleOAuthClient | null> {
  const clientId =
    (await getSecret('GOOGLE_OAUTH_CLIENT_ID')) ??
    (await getSecret('YOUTUBE_CLIENT_ID')) ??
    process.env.GOOGLE_OAUTH_CLIENT_ID ??
    process.env.YOUTUBE_CLIENT_ID;
  const clientSecret =
    (await getSecret('GOOGLE_OAUTH_CLIENT_SECRET')) ??
    (await getSecret('YOUTUBE_CLIENT_SECRET')) ??
    process.env.GOOGLE_OAUTH_CLIENT_SECRET ??
    process.env.YOUTUBE_CLIENT_SECRET;

  if (!clientId?.trim() || !clientSecret?.trim()) {
    return null;
  }
  return { clientId: clientId.trim(), clientSecret: clientSecret.trim() };
}

export function resolvePublicBaseUrl(requestProtocol: string, requestHost: string): string {
  const configured = process.env.CAS_PUBLIC_URL ?? process.env.PUBLIC_STAGING_URL;
  if (configured) {
    return configured.replace(/\/$/, '');
  }
  return `${requestProtocol}://${requestHost}`.replace(/\/$/, '');
}

export function googleOAuthRedirectUri(publicBaseUrl: string): string {
  return `${publicBaseUrl}/api/oauth/google/callback`;
}

export function buildGoogleAuthorizeUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  purpose: GoogleOAuthPurpose;
  promptConsent?: boolean;
}): string {
  const params = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: 'code',
    scope: PURPOSE_SCOPES[input.purpose].join(' '),
    state: input.state,
    access_type: 'offline',
  });
  if (input.promptConsent) {
    params.set('prompt', 'consent');
  }
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function hasGoogleOAuthRefreshToken(): Promise<boolean> {
  return Boolean(await getSecret('GOOGLE_OAUTH_REFRESH_TOKEN'));
}

interface GoogleTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

async function postToken(body: URLSearchParams): Promise<GoogleTokenResponse> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  return (await response.json()) as GoogleTokenResponse;
}

export async function exchangeGoogleCode(input: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<GoogleTokenResponse> {
  const body = new URLSearchParams({
    code: input.code,
    client_id: input.clientId,
    client_secret: input.clientSecret,
    redirect_uri: input.redirectUri,
    grant_type: 'authorization_code',
  });
  return postToken(body);
}

export async function refreshGoogleAccessToken(input: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<GoogleTokenResponse> {
  const body = new URLSearchParams({
    refresh_token: input.refreshToken,
    client_id: input.clientId,
    client_secret: input.clientSecret,
    grant_type: 'refresh_token',
  });
  return postToken(body);
}

export async function persistGoogleTokens(
  tokens: GoogleTokenResponse,
  purpose: GoogleOAuthPurpose,
): Promise<void> {
  if (!tokens.access_token) {
    throw new Error(tokens.error_description ?? tokens.error ?? 'missing_access_token');
  }

  const expiresAt = tokens.expires_in
    ? String(Date.now() + tokens.expires_in * 1000)
    : String(Date.now() + 3600 * 1000);

  const patch: SecretsPatch = {
    googleOAuthAccessToken: tokens.access_token,
    googleOAuthExpiresAt: expiresAt,
  };

  if (tokens.refresh_token) {
    patch.googleOAuthRefreshToken = tokens.refresh_token;
  }
  if (tokens.scope) {
    const existing = (await getSecret('GOOGLE_OAUTH_SCOPES')) ?? '';
    const merged = new Set(
      [...existing.split(/\s+/), ...tokens.scope.split(/\s+/)].filter(Boolean),
    );
    patch.googleOAuthScopes = [...merged].join(' ');
  }

  if (purpose === 'youtube') {
    patch.youtubeAccessToken = tokens.access_token;
  }

  invalidateSecretCache();
  await patchSecrets(patch);
}
