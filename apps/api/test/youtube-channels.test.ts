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

  it('GET /api/episodes?channelId= filters episodes by channel', async () => {
    await app.inject({
      method: 'PATCH',
      url: '/api/settings',
      payload: { maxActiveEpisodes: 5 },
    });

    const createA = await app.inject({
      method: 'POST',
      url: '/api/episodes',
      payload: { title: 'Canal A', channelId: 'UC_channel_a' },
    });
    const createB = await app.inject({
      method: 'POST',
      url: '/api/episodes',
      payload: { title: 'Canal B', channelId: 'UC_channel_b' },
    });
    expect(createA.statusCode).toBe(201);
    expect(createB.statusCode).toBe(201);

    const filtered = await app.inject({
      method: 'GET',
      url: '/api/episodes?channelId=UC_channel_a',
    });
    expect(filtered.statusCode).toBe(200);
    const list = filtered.json() as Array<{ title: string; channelId?: string }>;
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ title: 'Canal A', channelId: 'UC_channel_a' });

    const all = await app.inject({ method: 'GET', url: '/api/episodes' });
    expect(all.json()).toHaveLength(2);
  });

  it('POST /api/episodes tags channelId on episode and content', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/episodes',
      payload: { title: 'Tagged episode', channelId: 'UC_tagged' },
    });
    expect(response.statusCode).toBe(201);
    const episode = response.json() as { id: string; channelId?: string };
    expect(episode.channelId).toBe('UC_tagged');

    const detail = await app.inject({ method: 'GET', url: `/api/episodes/${episode.id}` });
    expect(detail.json().content.channelId).toBe('UC_tagged');
  });
});
