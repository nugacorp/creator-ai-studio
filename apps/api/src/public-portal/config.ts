import process from 'node:process';

/**
 * Resolves the list of origins allowed to consume the public portal.
 *
 * The plugin never serves requests with a wildcard origin. In production the
 * list MUST be set explicitly via `PUBLIC_CORS_ORIGINS`; if empty, plugin
 * registration fails (mirroring the auth fail-closed posture).
 */
export interface ResolvedOrigins {
  origins: string[];
  /** True when the operator did not configure any origin in production. */
  misconfigured: boolean;
}

const PRODUCTION_DEFAULT_DEV_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

export function resolveAllowedOrigins(): ResolvedOrigins {
  const raw = process.env.PUBLIC_CORS_ORIGINS ?? '';
  const origins = raw
    .split(',')
    .map(origin => origin.trim())
    .filter(origin => origin.length > 0 && origin !== '*');

  const isProduction = process.env.NODE_ENV === 'production';

  if (origins.length === 0) {
    if (isProduction) {
      return { origins: [], misconfigured: true };
    }
    return { origins: PRODUCTION_DEFAULT_DEV_ORIGINS, misconfigured: false };
  }
  return { origins, misconfigured: false };
}

export function readCacheTtls(): { live: number; content: number } {
  const live = Number(process.env.PUBLIC_CACHE_TTL_LIVE ?? 30);
  const content = Number(process.env.PUBLIC_CACHE_TTL_CONTENT ?? 60);
  return {
    live: Number.isFinite(live) && live >= 0 ? live : 30,
    content: Number.isFinite(content) && content >= 0 ? content : 60,
  };
}
