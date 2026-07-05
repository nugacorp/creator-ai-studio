import { stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { getSecret, invalidateSecretCache } from '../secrets/resolver.js';
import {
  fetchGoogleAccountEmail,
  getValidGoogleAccessToken,
  refreshGoogleAccessTokenOrClear,
} from '../secrets/google-auth.js';

export interface YouTubeUploadResult {
  videoId: string;
  url: string;
  status: 'uploaded' | 'scheduled' | 'demo';
}

async function resolveYouTubeAccessToken(): Promise<string | undefined> {
  const dedicated = await getSecret('YOUTUBE_ACCESS_TOKEN');
  if (dedicated) {
    return dedicated;
  }
  return getValidGoogleAccessToken();
}

/** Exported for calendar sync (same token resolution as uploads/analytics). */
export async function resolveYouTubeAccessTokenForCalendar(): Promise<string | undefined> {
  return resolveYouTubeAccessToken();
}

export interface YouTubeScheduledVideo {
  videoId: string;
  title: string;
  publishAt: string;
  channelTitle?: string;
}

/**
 * List videos scheduled on YouTube (private + status.publishAt).
 * Requires `youtube.readonly` — already requested by YouTube OAuth in Settings.
 */
export async function fetchYouTubeScheduledVideos(
  accessToken?: string,
): Promise<YouTubeScheduledVideo[]> {
  const token = accessToken ?? (await resolveYouTubeAccessToken());
  if (!token) return [];

  const channelResponse = await fetch(
    'https://www.googleapis.com/youtube/v3/channels?part=contentDetails,snippet&mine=true',
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!channelResponse.ok) return [];

  const channelData = (await channelResponse.json()) as {
    items?: Array<{
      snippet?: { title?: string };
      contentDetails?: { relatedPlaylists?: { uploads?: string } };
    }>;
  };
  const channel = channelData.items?.[0];
  const uploadsPlaylistId = channel?.contentDetails?.relatedPlaylists?.uploads;
  const channelTitle = channel?.snippet?.title;
  if (!uploadsPlaylistId) return [];

  const playlistResponse = await fetch(
    `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails,snippet&playlistId=${encodeURIComponent(uploadsPlaylistId)}&maxResults=50`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!playlistResponse.ok) return [];

  const playlistData = (await playlistResponse.json()) as {
    items?: Array<{ contentDetails?: { videoId?: string } }>;
  };
  const videoIds = (playlistData.items ?? [])
    .map(item => item.contentDetails?.videoId)
    .filter((id): id is string => Boolean(id));
  if (videoIds.length === 0) return [];

  const videosResponse = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=status,snippet&id=${videoIds.map(encodeURIComponent).join(',')}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!videosResponse.ok) return [];

  const videosData = (await videosResponse.json()) as {
    items?: Array<{
      id?: string;
      snippet?: { title?: string };
      status?: { publishAt?: string; privacyStatus?: string };
    }>;
  };

  const now = Date.now();
  return (videosData.items ?? [])
    .filter(item => {
      const publishAt = item.status?.publishAt;
      if (!publishAt) return false;
      return new Date(publishAt).getTime() > now;
    })
    .map(item => ({
      videoId: item.id ?? '',
      title: item.snippet?.title ?? 'Sin título',
      publishAt: item.status?.publishAt ?? '',
      channelTitle,
    }))
    .filter(item => item.videoId && item.publishAt);
}

/** True when the shared Google OAuth token was granted YouTube scopes. */
export async function hasYouTubeScopes(): Promise<boolean> {
  const scopes = (await getSecret('GOOGLE_OAUTH_SCOPES')) ?? '';
  return scopes.includes('youtube');
}

export interface YouTubeChannelInfo {
  id: string;
  name: string;
  thumbnailUrl: string;
  subscribers: number;
  viewCount: number;
  customUrl?: string;
}

export interface YouTubeChannelsResult {
  connected: boolean;
  channels: YouTubeChannelInfo[];
  accountEmail?: string;
  error?: string;
}

async function fetchChannelsFromYouTube(accessToken: string): Promise<Response> {
  return fetch(
    'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true&maxResults=50',
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
}

function parseYouTubeChannelsResponse(data: {
  items?: Array<{
    id?: string;
    snippet?: {
      title?: string;
      customUrl?: string;
      thumbnails?: { default?: { url?: string }; medium?: { url?: string } };
    };
    statistics?: { subscriberCount?: string; viewCount?: string };
  }>;
}): YouTubeChannelInfo[] {
  return (data.items ?? [])
    .map(item => ({
      id: item.id ?? '',
      name: item.snippet?.title ?? 'Sin nombre',
      thumbnailUrl:
        item.snippet?.thumbnails?.medium?.url ??
        item.snippet?.thumbnails?.default?.url ??
        '',
      subscribers: Number(item.statistics?.subscriberCount ?? 0),
      viewCount: Number(item.statistics?.viewCount ?? 0),
      customUrl: item.snippet?.customUrl,
    }))
    .filter(ch => ch.id);
}

/** List every YouTube channel the connected Google account can manage. */
export async function fetchYouTubeChannels(): Promise<YouTubeChannelsResult> {
  const dedicated = await getSecret('YOUTUBE_ACCESS_TOKEN');
  let accessToken = await resolveYouTubeAccessToken();
  if (!accessToken) {
    return { connected: false, channels: [] };
  }
  if (!dedicated && !(await hasYouTubeScopes())) {
    return {
      connected: false,
      channels: [],
      error: 'Faltan permisos de YouTube. Reconecta en Configuración → Integraciones.',
    };
  }

  let response = await fetchChannelsFromYouTube(accessToken);

  if (response.status === 401) {
    invalidateSecretCache();
    const refreshed =
      (await getValidGoogleAccessToken({ forceRefresh: true })) ??
      (await refreshGoogleAccessTokenOrClear());
    if (!refreshed) {
      return {
        connected: false,
        channels: [],
        error: 'Sesión de YouTube expirada. Reconecta en Configuración → Integraciones.',
      };
    }
    accessToken = refreshed;
    response = await fetchChannelsFromYouTube(accessToken);
  }

  const accountEmail = await fetchGoogleAccountEmail(accessToken);

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    if (response.status === 403 && errText.includes('ACCESS_TOKEN_SCOPE_INSUFFICIENT')) {
      return {
        connected: false,
        channels: [],
        accountEmail,
        error: 'Faltan permisos de YouTube. Pulsa Reconectar en la tarjeta YouTube.',
      };
    }
    return {
      connected: false,
      channels: [],
      accountEmail,
      error: `YouTube API respondió ${response.status}. Revisa OAuth en Configuración → Integraciones.`,
    };
  }

  const data = (await response.json()) as Parameters<typeof parseYouTubeChannelsResponse>[0];
  const channels = parseYouTubeChannelsResponse(data);

  if (channels.length === 0) {
    return {
      connected: true,
      channels: [],
      accountEmail,
      error: 'No encontramos canales de YouTube en esta cuenta Google.',
    };
  }

  return { connected: true, channels, accountEmail };
}

export async function uploadToYouTube(
  title: string,
  description: string,
  videoPath: string,
  options?: { publishAt?: string },
): Promise<YouTubeUploadResult> {
  const accessToken = await resolveYouTubeAccessToken();

  if (!accessToken) {
    throw new Error(
      'YouTube OAuth no conectado. Ve a Configuración → Integraciones y conecta Google/YouTube.',
    );
  }

  if (!videoPath) {
    throw new Error('No se encontró el archivo de video (06-video/episode.mp4)');
  }

  const fileInfo = await stat(videoPath);

  const initResponse = await fetch(
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Upload-Content-Type': 'video/mp4',
        'X-Upload-Content-Length': String(fileInfo.size),
      },
      body: JSON.stringify({
        snippet: { title, description, categoryId: '22' },
        status: {
          privacyStatus: 'private',
          ...(options?.publishAt ? { publishAt: options.publishAt } : {}),
        },
      }),
    },
  );

  if (!initResponse.ok) {
    const errText = await initResponse.text().catch(() => '');
    throw new Error(`YouTube upload init failed (${initResponse.status}): ${errText.slice(0, 200)}`);
  }

  const location = initResponse.headers.get('location');
  if (!location) {
    throw new Error('YouTube no devolvió URL de upload resumible');
  }

  // Stream the file instead of buffering it in memory (episode videos can be
  // hundreds of MB; readFile would OOM a small VPS).
  const uploadResponse = await fetch(location, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'video/mp4',
      'Content-Length': String(fileInfo.size),
    },
    body: Readable.toWeb(createReadStream(videoPath)) as unknown as NonNullable<RequestInit['body']>,
    // Required by Node's fetch (undici) when sending a streamed request body.
    duplex: 'half',
  } as RequestInit & { duplex: 'half' });

  if (!uploadResponse.ok) {
    const errText = await uploadResponse.text().catch(() => '');
    throw new Error(`YouTube upload failed (${uploadResponse.status}): ${errText.slice(0, 200)}`);
  }

  const result = (await uploadResponse.json()) as { id?: string };
  const videoId = result.id ?? `yt_${Date.now()}`;

  return {
    videoId,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    status: options?.publishAt ? 'scheduled' : 'uploaded',
  };
}

/** Upload custom thumbnail after video upload (requires youtube.upload scope). */
export async function uploadYouTubeThumbnail(
  videoId: string,
  thumbnailPath: string,
): Promise<void> {
  const accessToken = await resolveYouTubeAccessToken();
  if (!accessToken) {
    throw new Error('YouTube OAuth no conectado');
  }

  const fileInfo = await stat(thumbnailPath);
  const stream = createReadStream(thumbnailPath);

  const response = await fetch(
    `https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${encodeURIComponent(videoId)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'image/png',
        'Content-Length': String(fileInfo.size),
      },
      body: Readable.toWeb(stream) as unknown as NonNullable<RequestInit['body']>,
      duplex: 'half',
    } as RequestInit & { duplex: 'half' },
  );

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`YouTube thumbnail upload failed (${response.status}): ${errText.slice(0, 200)}`);
  }
}

export interface YouTubeAnalyticsResult {
  views: number;
  subscribers: number;
  watchTimeHours: number;
  engagement: string;
  chartData: number[];
  channelDistribution: Array<{ name: string; views: number; percentage: number }>;
  isDemo?: boolean;
  connected?: boolean;
}

function formatEngagement(views: number, likes: number, comments: number): string {
  if (views <= 0) {
    return '0%';
  }
  return `${(((likes + comments) / views) * 100).toFixed(1)}%`;
}

function daysAgoIso(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

export async function fetchYouTubeAnalytics(channelId: string): Promise<YouTubeAnalyticsResult> {
  const accessToken = await resolveYouTubeAccessToken();
  const empty: YouTubeAnalyticsResult = {
    views: 0,
    subscribers: 0,
    watchTimeHours: 0,
    engagement: '0%',
    chartData: [],
    channelDistribution: [],
    connected: false,
  };

  if (!accessToken) {
    // FASE 8: fake analytics numbers are a mock — only in dev environments.
    const { areMocksAllowed } = await import('../config/mocks.js');
    if (!areMocksAllowed()) {
      return empty;
    }
    return {
      views: 12500,
      subscribers: 125000,
      watchTimeHours: 4200,
      engagement: '4.2%',
      chartData: [120, 180, 150, 220, 280, 310, 290],
      channelDistribution: [{ name: 'YouTube', views: 12500, percentage: 100 }],
      isDemo: true,
      connected: false,
    };
  }

  const channelUrl =
    channelId.length > 0
      ? `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&id=${encodeURIComponent(channelId)}`
      : 'https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&mine=true';

  const channelResponse = await fetch(channelUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!channelResponse.ok) {
    return empty;
  }

  const channelData = (await channelResponse.json()) as {
    items?: Array<{
      id?: string;
      snippet?: { title?: string };
      statistics?: { viewCount?: string; subscriberCount?: string };
    }>;
  };
  const channel = channelData.items?.[0];
  if (!channel) {
    return empty;
  }
  const stats = channel?.statistics;
  const views = Number(stats?.viewCount ?? 0);
  const subscribers = Number(stats?.subscriberCount ?? 0);
  const channelName = channel?.snippet?.title ?? 'YouTube';
  const resolvedChannelId = channel.id ?? channelId;

  const startDate = daysAgoIso(13);
  const endDate = daysAgoIso(0);
  const analyticsParams = new URLSearchParams({
    ids: resolvedChannelId ? `channel==${resolvedChannelId}` : 'channel==MINE',
    startDate,
    endDate,
    metrics: 'views,estimatedMinutesWatched,likes,comments',
    dimensions: 'day',
    sort: 'day',
  });

  const analyticsResponse = await fetch(
    `https://youtubeanalytics.googleapis.com/v2/reports?${analyticsParams.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  let chartData: number[] = [];
  let watchTimeHours = 0;
  let totalLikes = 0;
  let totalComments = 0;
  let periodViews = 0;

  if (analyticsResponse.ok) {
    const analyticsData = (await analyticsResponse.json()) as {
      rows?: Array<[string, number, number, number, number]>;
    };
    for (const row of analyticsData.rows ?? []) {
      const dayViews = row[1] ?? 0;
      const minutes = row[2] ?? 0;
      const likes = row[3] ?? 0;
      const comments = row[4] ?? 0;
      chartData.push(dayViews);
      watchTimeHours += minutes / 60;
      totalLikes += likes;
      totalComments += comments;
      periodViews += dayViews;
    }
  }

  const engagementViews = periodViews > 0 ? periodViews : views;

  return {
    views,
    subscribers,
    watchTimeHours: Math.round(watchTimeHours),
    engagement: formatEngagement(engagementViews, totalLikes, totalComments),
    chartData,
    channelDistribution: [{ name: channelName, views, percentage: 100 }],
    connected: true,
    isDemo: false,
  };
}
