import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { getSecret } from '../secrets/resolver.js';
import { getValidGoogleAccessToken } from '../secrets/google-auth.js';

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

/** True when the shared Google OAuth token was granted YouTube scopes. */
export async function hasYouTubeScopes(): Promise<boolean> {
  const scopes = (await getSecret('GOOGLE_OAUTH_SCOPES')) ?? '';
  return scopes.includes('youtube');
}

export async function uploadToYouTube(
  title: string,
  description: string,
  videoPath: string,
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
        status: { privacyStatus: 'private' },
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
    status: 'uploaded',
  };
}

export interface YouTubeAnalyticsResult {
  views: number;
  subscribers: number;
  watchTimeHours: number;
  engagement: string;
  chartData: number[];
  channelDistribution: Array<{ name: string; views: number; percentage: number }>;
  isDemo?: boolean;
<<<<<<< HEAD
  connected?: boolean;
=======
>>>>>>> origin/main
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

export async function fetchYouTubeAnalytics(_channelId: string): Promise<YouTubeAnalyticsResult> {
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
<<<<<<< HEAD
      connected: false,
=======
>>>>>>> origin/main
    };
  }

  const channelResponse = await fetch(
    'https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&mine=true',
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!channelResponse.ok) {
    return empty;
  }

  const channelData = (await channelResponse.json()) as {
    items?: Array<{
      snippet?: { title?: string };
      statistics?: { viewCount?: string; subscriberCount?: string };
    }>;
  };
  const channel = channelData.items?.[0];
  const stats = channel?.statistics;
  const views = Number(stats?.viewCount ?? 0);
  const subscribers = Number(stats?.subscriberCount ?? 0);
  const channelName = channel?.snippet?.title ?? 'YouTube';

  const startDate = daysAgoIso(13);
  const endDate = daysAgoIso(0);
  const analyticsParams = new URLSearchParams({
    ids: 'channel==MINE',
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
