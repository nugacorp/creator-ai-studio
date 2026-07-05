import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import type { SecretProvider, SecretSource, SecretStatus, SecretsPatch } from '@creator-ai-studio/shared';
import { resolveDataPath, resolveStoragePath } from '../storage/index.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

export const SECRET_STORE_FIELDS = {
  googleOAuthClientId: 'GOOGLE_OAUTH_CLIENT_ID',
  googleOAuthClientSecret: 'GOOGLE_OAUTH_CLIENT_SECRET',
  googleOAuthAccessToken: 'GOOGLE_OAUTH_ACCESS_TOKEN',
  googleOAuthRefreshToken: 'GOOGLE_OAUTH_REFRESH_TOKEN',
  googleOAuthExpiresAt: 'GOOGLE_OAUTH_EXPIRES_AT',
  googleOAuthScopes: 'GOOGLE_OAUTH_SCOPES',
  geminiApiKey: 'GEMINI_API_KEY',
  openaiApiKey: 'OPENAI_API_KEY',
  anthropicApiKey: 'ANTHROPIC_API_KEY',
  elevenlabsApiKey: 'ELEVENLABS_API_KEY',
  elevenlabsVoiceId: 'ELEVENLABS_VOICE_ID',
  youtubeClientId: 'YOUTUBE_CLIENT_ID',
  youtubeClientSecret: 'YOUTUBE_CLIENT_SECRET',
  youtubeAccessToken: 'YOUTUBE_ACCESS_TOKEN',
  webhookUrl: 'WEBHOOK_URL',
} as const;

export type SecretStoreField = keyof typeof SECRET_STORE_FIELDS;

const PROVIDER_FIELDS: Record<SecretProvider, SecretStoreField[]> = {
  gemini: ['geminiApiKey'],
  openai: ['openaiApiKey'],
  anthropic: ['anthropicApiKey'],
  elevenlabs: ['elevenlabsApiKey', 'elevenlabsVoiceId'],
  youtube: ['youtubeClientId', 'youtubeClientSecret', 'youtubeAccessToken'],
  webhook: ['webhookUrl'],
};

function secretsDir(): string {
  return path.join(resolveDataPath(), 'settings', '.secrets');
}

function secretsFilePath(): string {
  return path.join(secretsDir(), 'secrets.enc');
}

/** Older locations that may still hold OAuth tokens on upgraded VPS instances. */
function legacySecretsPaths(): string[] {
  return [
    path.join(resolveStoragePath(), '.secrets', 'secrets.enc'),
    path.join(resolveDataPath(), 'secrets.enc'),
    path.join(resolveStoragePath(), '..', 'secrets.enc'),
  ];
}

async function ensureSecretsMigrated(): Promise<void> {
  const current = secretsFilePath();
  if (existsSync(current)) {
    return;
  }
  for (const legacy of legacySecretsPaths()) {
    if (existsSync(legacy)) {
      await mkdir(secretsDir(), { recursive: true });
      await copyFile(legacy, current);
      return;
    }
  }
}

// scrypt is intentionally expensive; cache the derived key so we don't block
// the event loop on every secrets read (the master key never changes at runtime).
let derivedKeyCache: { master: string; key: Buffer } | null = null;

function deriveKey(master: string): Buffer {
  if (derivedKeyCache?.master === master) {
    return derivedKeyCache.key;
  }
  const key = scryptSync(master, 'creator-ai-studio-secrets-v1', 32);
  derivedKeyCache = { master, key };
  return key;
}

function encryptPayload(data: Record<string, string>, masterKey: string): Buffer {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, deriveKey(masterKey), iv);
  const json = JSON.stringify(data);
  const encrypted = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]);
}

function decryptPayload(buffer: Buffer, masterKey: string): Record<string, string> {
  const iv = buffer.subarray(0, IV_LENGTH);
  const tag = buffer.subarray(IV_LENGTH, IV_LENGTH + 16);
  const encrypted = buffer.subarray(IV_LENGTH + 16);
  const decipher = createDecipheriv(ALGORITHM, deriveKey(masterKey), iv);
  decipher.setAuthTag(tag);
  const json = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  return JSON.parse(json) as Record<string, string>;
}

export function isSecretsEncryptionAvailable(): boolean {
  return Boolean(process.env.CAS_SECRETS_KEY && process.env.CAS_SECRETS_KEY.length >= 16);
}

async function readStore(): Promise<Record<string, string>> {
  const master = process.env.CAS_SECRETS_KEY;
  if (!master) return {};

  await ensureSecretsMigrated();

  const file = secretsFilePath();
  if (!existsSync(file)) return {};

  const raw = await readFile(file);
  try {
    return decryptPayload(raw, master);
  } catch {
    return {};
  }
}

async function writeStore(data: Record<string, string>): Promise<void> {
  const master = process.env.CAS_SECRETS_KEY;
  if (!master) {
    throw new Error('CAS_SECRETS_KEY is not configured on the server');
  }

  await ensureSecretsMigrated();

  const file = secretsFilePath();
  await mkdir(secretsDir(), { recursive: true });
  await writeFile(file, encryptPayload(data, master));
}

export function maskSecret(value: string): string {
  if (value.length <= 4) return '••••';
  return `••••••••${value.slice(-4)}`;
}

export async function getStoredSecrets(): Promise<Record<string, string>> {
  return readStore();
}

export async function patchSecrets(patch: SecretsPatch): Promise<SecretStatus[]> {
  const current = await readStore();

  for (const [field, envName] of Object.entries(SECRET_STORE_FIELDS)) {
    const key = field as SecretStoreField;
    if (patch[key] === undefined) continue;
    const value = patch[key]!.trim();
    if (value.length === 0) {
      delete current[envName];
    } else {
      current[envName] = value;
    }
  }

  await writeStore(current);
  return listSecretStatuses();
}

export async function listSecretStatuses(): Promise<SecretStatus[]> {
  const stored = await readStore();
  const providers: SecretProvider[] = [
    'gemini',
    'openai',
    'anthropic',
    'elevenlabs',
    'youtube',
    'webhook',
  ];

  return providers.map(provider => {
    if (provider === 'gemini') {
      return statusForGemini(stored);
    }
    if (provider === 'youtube') {
      return statusForYoutube(stored);
    }

    const fields = PROVIDER_FIELDS[provider];
    let source: SecretSource = 'none';
    let maskedValue: string | undefined;
    let configured = false;

    for (const field of fields) {
      const envName = SECRET_STORE_FIELDS[field];
      const fromStore = stored[envName];
      const fromEnv = process.env[envName];
      const value = fromStore ?? fromEnv;
      if (value) {
        configured = true;
        source = fromStore ? 'store' : 'env';
        maskedValue = maskSecret(value);
        break;
      }
    }

    return { provider, configured, maskedValue, source, authMethod: configured ? 'api_key' : 'none' };
  });
}

function readStoredOrEnv(stored: Record<string, string>, envName: string): string | undefined {
  return stored[envName] ?? process.env[envName];
}

function statusForGemini(stored: Record<string, string>): SecretStatus {
  const oauthAccess = readStoredOrEnv(stored, 'GOOGLE_OAUTH_ACCESS_TOKEN');
  const oauthRefresh = readStoredOrEnv(stored, 'GOOGLE_OAUTH_REFRESH_TOKEN');
  if (oauthAccess || oauthRefresh) {
    const fromStore = Boolean(stored.GOOGLE_OAUTH_ACCESS_TOKEN ?? stored.GOOGLE_OAUTH_REFRESH_TOKEN);
    return {
      provider: 'gemini',
      configured: true,
      source: fromStore ? 'store' : 'env',
      maskedValue: maskSecret(oauthAccess ?? 'oauth'),
      authMethod: 'oauth',
    };
  }

  const apiKey = readStoredOrEnv(stored, 'GEMINI_API_KEY');
  if (apiKey) {
    const fromStore = Boolean(stored.GEMINI_API_KEY);
    return {
      provider: 'gemini',
      configured: true,
      source: fromStore ? 'store' : 'env',
      maskedValue: maskSecret(apiKey),
      authMethod: 'api_key',
    };
  }

  return { provider: 'gemini', configured: false, source: 'none', authMethod: 'none' };
}

function statusForYoutube(stored: Record<string, string>): SecretStatus {
  const youtubeToken = readStoredOrEnv(stored, 'YOUTUBE_ACCESS_TOKEN');
  const oauthAccess = readStoredOrEnv(stored, 'GOOGLE_OAUTH_ACCESS_TOKEN');
  const scopes = readStoredOrEnv(stored, 'GOOGLE_OAUTH_SCOPES') ?? '';
  const hasYoutubeScope = scopes.includes('youtube');

  if (youtubeToken) {
    const fromStore = Boolean(stored.YOUTUBE_ACCESS_TOKEN);
    return {
      provider: 'youtube',
      configured: true,
      source: fromStore ? 'store' : 'env',
      maskedValue: maskSecret(youtubeToken),
      authMethod: fromStore && oauthAccess ? 'oauth' : 'api_key',
    };
  }

  if (oauthAccess && hasYoutubeScope) {
    const fromStore = Boolean(stored.GOOGLE_OAUTH_ACCESS_TOKEN);
    return {
      provider: 'youtube',
      configured: true,
      source: fromStore ? 'store' : 'env',
      maskedValue: maskSecret(oauthAccess),
      authMethod: 'oauth',
    };
  }

  const clientId = readStoredOrEnv(stored, 'YOUTUBE_CLIENT_ID');
  const clientSecret = readStoredOrEnv(stored, 'YOUTUBE_CLIENT_SECRET');
  if (clientId && clientSecret) {
    const fromStore = Boolean(stored.YOUTUBE_CLIENT_ID ?? stored.YOUTUBE_CLIENT_SECRET);
    return {
      provider: 'youtube',
      configured: false,
      source: fromStore ? 'store' : 'env',
      maskedValue: maskSecret(clientId),
      authMethod: 'none',
    };
  }

  return { provider: 'youtube', configured: false, source: 'none', authMethod: 'none' };
}

export async function isGoogleOAuthClientConfigured(): Promise<boolean> {
  const stored = await readStore();
  const clientId =
    readStoredOrEnv(stored, 'GOOGLE_OAUTH_CLIENT_ID') ?? readStoredOrEnv(stored, 'YOUTUBE_CLIENT_ID');
  const clientSecret =
    readStoredOrEnv(stored, 'GOOGLE_OAUTH_CLIENT_SECRET') ??
    readStoredOrEnv(stored, 'YOUTUBE_CLIENT_SECRET');
  return Boolean(clientId?.trim() && clientSecret?.trim());
}
