import process from 'node:process';
import { SECRET_STORE_FIELDS, getStoredSecrets } from './store.js';

let cache: Record<string, string> | null = null;
let cacheAt = 0;
const CACHE_MS = 5000;

async function loadSecrets(): Promise<Record<string, string>> {
  const now = Date.now();
  if (cache && now - cacheAt < CACHE_MS) {
    return cache;
  }
  cache = await getStoredSecrets();
  cacheAt = now;
  return cache;
}

/** Resolve a secret: encrypted store first, then process.env. */
export async function getSecret(envName: string): Promise<string | undefined> {
  const stored = await loadSecrets();
  return stored[envName] ?? process.env[envName];
}

export async function getSecretByField(
  field: keyof typeof SECRET_STORE_FIELDS,
): Promise<string | undefined> {
  return getSecret(SECRET_STORE_FIELDS[field]);
}

export function invalidateSecretCache(): void {
  cache = null;
  cacheAt = 0;
}
