import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { EpisodeStorage } from '../src/storage/index.js';

describe('settings routes', () => {
  let rootDir: string;
  let storageDir: string;
  let app: FastifyInstance;

  beforeEach(async () => {
    rootDir = await mkdtemp(path.join(tmpdir(), 'cas-settings-'));
    storageDir = path.join(rootDir, 'episodes');
    process.env.LOCAL_STORAGE_PATH = storageDir;
    app = buildApp({ storage: new EpisodeStorage(storageDir) });
    await app.ready();
  });

  afterEach(async () => {
    delete process.env.LOCAL_STORAGE_PATH;
    await app.close();
    await rm(rootDir, { recursive: true, force: true });
  });

  function settingsFile(): string {
    return path.join(rootDir, 'settings', 'settings.json');
  }

  it('GET /settings returns defaults when settings.json is missing', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/settings' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ttsSampleRate: '24000',
      maxActiveEpisodes: 1,
    });
  });

  it('GET /settings recovers from corrupt settings.json', async () => {
    const file = settingsFile();
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, '{ "maxActiveEpisodes": ', 'utf8');

    const response = await app.inject({ method: 'GET', url: '/api/settings' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ttsSampleRate: '24000',
      maxActiveEpisodes: 1,
    });

    const backups = readdirSync(path.dirname(file)).filter(name =>
      name.startsWith('settings.json.corrupt.'),
    );
    expect(backups).toHaveLength(1);
    expect(await readFile(path.join(path.dirname(file), backups[0]!), 'utf8')).toBe(
      '{ "maxActiveEpisodes": ',
    );
  });
});
