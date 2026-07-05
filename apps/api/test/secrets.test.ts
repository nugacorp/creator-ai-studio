import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  isSecretsEncryptionAvailable,
  listSecretStatuses,
  maskSecret,
  patchSecrets,
} from '../src/secrets/store.js';

describe('secrets store', () => {
  let prevKey: string | undefined;
  let prevStorage: string | undefined;
  let prevData: string | undefined;
  let tempDir: string;

  beforeEach(async () => {
    prevKey = process.env.CAS_SECRETS_KEY;
    prevStorage = process.env.LOCAL_STORAGE_PATH;
    prevData = process.env.CAS_DATA_PATH;
    tempDir = await mkdtemp(path.join(tmpdir(), 'cas-secrets-'));
    process.env.CAS_SECRETS_KEY = 'test-master-key-for-unit-tests-32chars';
    process.env.CAS_DATA_PATH = path.join(tempDir, 'data');
    process.env.LOCAL_STORAGE_PATH = path.join(tempDir, 'data', 'episodes');
  });

  afterEach(async () => {
    process.env.CAS_SECRETS_KEY = prevKey;
    process.env.LOCAL_STORAGE_PATH = prevStorage;
    process.env.CAS_DATA_PATH = prevData;
    await rm(tempDir, { recursive: true, force: true });
  });

  it('masks secret values', () => {
    expect(maskSecret('abcdefghijklmnop')).toBe('••••••••mnop');
  });

  it('encrypts and lists patched secrets', async () => {
    expect(isSecretsEncryptionAvailable()).toBe(true);
    const items = await patchSecrets({ geminiApiKey: 'AIza-test-key-1234' });
    const gemini = items.find(i => i.provider === 'gemini');
    expect(gemini?.configured).toBe(true);
    expect(gemini?.source).toBe('store');
    expect(gemini?.maskedValue).toContain('1234');

    const listed = await listSecretStatuses();
    expect(listed.find(i => i.provider === 'gemini')?.configured).toBe(true);
  });

  it('stores secrets under the persistent data volume', async () => {
    await patchSecrets({ geminiApiKey: 'AIza-test-key-1234' });
    const secretsPath = path.join(tempDir, 'data', 'settings', '.secrets', 'secrets.enc');
    const { existsSync } = await import('node:fs');
    expect(existsSync(secretsPath)).toBe(true);
  });

  it('migrates legacy secrets from episodes/.secrets', async () => {
    await patchSecrets({ geminiApiKey: 'AIza-legacy-key-9999' });
    const targetFile = path.join(tempDir, 'data', 'settings', '.secrets', 'secrets.enc');
    const legacyDir = path.join(tempDir, 'data', 'episodes', '.secrets');
    const legacyFile = path.join(legacyDir, 'secrets.enc');
    const { existsSync, mkdirSync, copyFileSync, rmSync } = await import('node:fs');
    expect(existsSync(targetFile)).toBe(true);

    mkdirSync(legacyDir, { recursive: true });
    copyFileSync(targetFile, legacyFile);
    rmSync(path.join(tempDir, 'data', 'settings'), { recursive: true, force: true });

    const { getStoredSecrets } = await import('../src/secrets/store.js');
    const stored = await getStoredSecrets();
    expect(stored.GEMINI_API_KEY).toBe('AIza-legacy-key-9999');
    expect(existsSync(targetFile)).toBe(true);
  });
});
