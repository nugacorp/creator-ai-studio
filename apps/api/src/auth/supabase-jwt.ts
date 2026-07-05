import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

let jwks: JWTVerifyGetKey | null = null;

function getSupabaseJwks(): JWTVerifyGetKey | null {
  const url = process.env.SUPABASE_URL;
  if (!url) {
    return null;
  }
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${url.replace(/\/$/, '')}/auth/v1/.well-known/jwks.json`));
  }
  return jwks;
}

export async function verifySupabaseAccessToken(
  token: string,
): Promise<{ userId?: string } | null> {
  const jwtSecret = process.env.SUPABASE_JWT_SECRET;
  const jwksKey = getSupabaseJwks();

  if (!jwtSecret && !jwksKey) {
    return null;
  }

  try {
    const { payload } = jwksKey
      ? await jwtVerify(token, jwksKey)
      : await jwtVerify(token, new TextEncoder().encode(jwtSecret!));

    if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
      return null;
    }
    return { userId: payload.sub };
  } catch {
    return null;
  }
}

export function isSupabaseAuthConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL || process.env.SUPABASE_JWT_SECRET);
}
