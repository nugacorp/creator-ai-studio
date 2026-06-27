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
  let tempDir: string;

  beforeEach(async () => {
    prevKey = process.env.CAS_SECRETS_KEY;
    prevStorage = process.env.LOCAL_STORAGE_PATH;
    tempDir = await mkdtemp(path.join(tmpdir(), 'cas-secrets-'));
    process.env.CAS_SECRETS_KEY = 'test-master-key-for-unit-tests-32chars';
    process.env.LOCAL_STORAGE_PATH = path.join(tempDir, 'episodes');
  });

  afterEach(async () => {
    process.env.CAS_SECRETS_KEY = prevKey;
    process.env.LOCAL_STORAGE_PATH = prevStorage;
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

  it('stores secrets under the persistent episodes volume', async () => {
    await patchSecrets({ geminiApiKey: 'AIza-test-key-1234' });
    const secretsPath = path.join(tempDir, 'episodes', '.secrets', 'secrets.enc');
    const { existsSync } = await import('node:fs');
    expect(existsSync(secretsPath)).toBe(true);
  });
});
