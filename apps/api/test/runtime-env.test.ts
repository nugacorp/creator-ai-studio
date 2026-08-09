import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadRuntimeEnv } from '../src/config/runtime-env.js';

const ENV_KEYS = [
  'CAS_ENV_BASE',
  'CAS_ENV_COMMENT',
  'CAS_ENV_EXISTING',
  'CAS_ENV_QUOTED',
  'SUPABASE_URL',
] as const;

describe('runtime env loader', () => {
  let tempDir: string | null = null;
  const snapshot = new Map<string, string | undefined>();

  afterEach(async () => {
    for (const key of ENV_KEYS) {
      const value = snapshot.get(key);
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    snapshot.clear();

    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  it('loads runtime env files in order without overriding process env', async () => {
    for (const key of ENV_KEYS) {
      snapshot.set(key, process.env[key]);
      delete process.env[key];
    }
    process.env.CAS_ENV_EXISTING = 'from-process';

    tempDir = await mkdtemp(path.join(tmpdir(), 'cas-env-'));
    await writeFile(
      path.join(tempDir, '.env'),
      [
        'CAS_ENV_BASE=from-env',
        'CAS_ENV_COMMENT=value # stripped comment',
        'CAS_ENV_EXISTING=from-file',
        'CAS_ENV_QUOTED="quoted value"',
        'SUPABASE_URL=https://from-env.supabase.co',
      ].join('\n'),
    );
    await writeFile(path.join(tempDir, '.env.local'), 'CAS_ENV_BASE=from-local\n');
    await writeFile(
      path.join(tempDir, '.env.supabase.local'),
      'SUPABASE_URL=https://from-supabase.supabase.co\n',
    );

    const loaded = loadRuntimeEnv({ rootDir: tempDir });

    expect(loaded.map(file => path.basename(file))).toEqual([
      '.env',
      '.env.local',
      '.env.supabase.local',
    ]);
    expect(process.env.CAS_ENV_BASE).toBe('from-local');
    expect(process.env.CAS_ENV_COMMENT).toBe('value');
    expect(process.env.CAS_ENV_EXISTING).toBe('from-process');
    expect(process.env.CAS_ENV_QUOTED).toBe('quoted value');
    expect(process.env.SUPABASE_URL).toBe('https://from-supabase.supabase.co');
  });
});
