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

function payloadToUser(payload: { sub?: unknown }): { userId: string } | null {
  if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
    return null;
  }
  return { userId: payload.sub };
}

async function verifyWithSecret(token: string, jwtSecret: string): Promise<{ userId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(jwtSecret));
    return payloadToUser(payload);
  } catch {
    return null;
  }
}

export async function verifySupabaseAccessToken(
  token: string,
): Promise<{ userId?: string } | null> {
  const jwtSecret = process.env.SUPABASE_JWT_SECRET;
  const jwksKey = getSupabaseJwks();

  if (!jwtSecret && !jwksKey) {
    return null;
  }

  if (jwksKey) {
    try {
      const { payload } = await jwtVerify(token, jwksKey);
      const user = payloadToUser(payload);
      if (user) return user;
    } catch {
      // Fall through to legacy HS256 secret when tokens predate ECC rotation.
    }
  }

  if (jwtSecret) {
    return verifyWithSecret(token, jwtSecret);
  }

  return null;
}

export function isSupabaseAuthConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL || process.env.SUPABASE_JWT_SECRET);
}
