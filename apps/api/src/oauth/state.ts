import { SignJWT, jwtVerify } from 'jose';
import type { GoogleOAuthPurpose } from './google.js';

export interface OAuthStatePayload {
  purpose: GoogleOAuthPurpose;
  returnUrl: string;
}

function stateSecret(): Uint8Array {
  const secret = process.env.CAS_SECRETS_KEY ?? process.env.CAS_OAUTH_STATE_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error('CAS_SECRETS_KEY is required for OAuth state signing');
  }
  return new TextEncoder().encode(secret);
}

export async function signOAuthState(payload: OAuthStatePayload): Promise<string> {
  return new SignJWT({ purpose: payload.purpose, returnUrl: payload.returnUrl })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(stateSecret());
}

export async function verifyOAuthState(state: string): Promise<OAuthStatePayload> {
  const { payload } = await jwtVerify(state, stateSecret());
  const purpose = payload.purpose;
  const returnUrl = payload.returnUrl;
  if (purpose !== 'gemini' && purpose !== 'youtube') {
    throw new Error('invalid_oauth_purpose');
  }
  if (typeof returnUrl !== 'string' || returnUrl.length === 0) {
    throw new Error('invalid_return_url');
  }
  return { purpose, returnUrl };
}
