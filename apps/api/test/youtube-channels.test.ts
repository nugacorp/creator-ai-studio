import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { EpisodeStorage } from '../src/storage/index.js';
import { patchSecrets } from '../src/secrets/store.js';
import { invalidateSecretCache } from '../src/secrets/resolver.js';

describe('YouTube channels integration', () => {
  let storageDir: string;
  let dataDir: string;
  let app: FastifyInstance;
  let prevKey: string | undefined;
  let prevData: string | undefined;

  beforeEach(async () => {
    prevKey = process.env.CAS_SECRETS_KEY;
    prevData = process.env.CAS_DATA_PATH;
    dataDir = await mkdtemp(path.join(tmpdir(), 'cas-yt-data-'));
    storageDir = path.join(dataDir, 'episodes');
    process.env.CAS_SECRETS_KEY = 'test-master-key-for-unit-tests-32chars';
    process.env.CAS_DATA_PATH = dataDir;
    process.env.LOCAL_STORAGE_PATH = storageDir;
    process.env.GOOGLE_OAUTH_CLIENT_ID = '123-test.apps.googleusercontent.com';
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'test-client-secret';
    app = buildApp({ storage: new EpisodeStorage(storageDir) });
    await app.ready();
    vi.restoreAllMocks();
  });

  afterEach(async () => {
    await app.close();
    process.env.CAS_SECRETS_KEY = prevKey;
    process.env.CAS_DATA_PATH = prevData;
    delete process.env.GOOGLE_OAUTH_CLIENT_ID;
    delete process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    await rm(dataDir, { recursive: true, force: true });
  });

  it('GET /api/integrations/youtube/channels returns disconnected when OAuth is missing', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/integrations/youtube/channels',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ connected: false, channels: [] });
  });

  it('GET /api/integrations/youtube/channels refreshes on 401 and returns channels', async () => {
    await patchSecrets({
      googleOAuthAccessToken: 'access-expired',
      googleOAuthRefreshToken: 'refresh-valid',
      googleOAuthExpiresAt: String(Date.now() + 3600_000),
      googleOAuthScopes: 'https://www.googleapis.com/auth/youtube.readonly openid email',
      youtubeAccessToken: 'access-expired',
    });
    invalidateSecretCache();

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'access-refreshed',
          expires_in: 3600,
          scope: 'youtube.readonly',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              id: 'UC_test',
              snippet: { title: 'Canal Test', thumbnails: { default: { url: 'https://x/y.jpg' } } },
              statistics: { subscriberCount: '1000', viewCount: '5000' },
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ email: 'creator@example.com' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              id: 'UC_test',
              snippet: { title: 'Canal Test', thumbnails: { default: { url: 'https://x/y.jpg' } } },
              statistics: { subscriberCount: '1000', viewCount: '5000' },
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: async () => 'forbidden',
      });
    vi.stubGlobal('fetch', fetchMock);

    const response = await app.inject({
      method: 'GET',
      url: '/api/integrations/youtube/channels',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      connected: boolean;
      channels: Array<{ id: string; name: string }>;
      accountEmail?: string;
    };
    expect(body.connected).toBe(true);
    expect(body.channels).toHaveLength(1);
    expect(body.channels[0]).toMatchObject({ id: 'UC_test', name: 'Canal Test' });
    expect(body.accountEmail).toBe('creator@example.com');
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
