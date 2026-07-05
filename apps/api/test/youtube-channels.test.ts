import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { EpisodeStorage } from '../src/storage/index.js';

describe('YouTube channels integration', () => {
  let storageDir: string;
  let app: FastifyInstance;

  beforeEach(async () => {
    storageDir = await mkdtemp(path.join(tmpdir(), 'cas-yt-channels-'));
    app = buildApp({ storage: new EpisodeStorage(storageDir) });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    await rm(storageDir, { recursive: true, force: true });
  });

  it('GET /api/integrations/youtube/channels returns disconnected when OAuth is missing', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/integrations/youtube/channels',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ connected: false, channels: [] });
  });

  it('PATCH /api/settings accepts activeChannelId', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/settings',
      payload: { activeChannelId: 'UC_test_channel_123' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ activeChannelId: 'UC_test_channel_123' });

    const getResponse = await app.inject({ method: 'GET', url: '/api/settings' });
    expect(getResponse.json()).toMatchObject({ activeChannelId: 'UC_test_channel_123' });
  });
});
