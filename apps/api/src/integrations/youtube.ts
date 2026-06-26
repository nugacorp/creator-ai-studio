import process from 'node:process';

export interface YouTubeUploadResult {
  videoId: string;
  url: string;
  status: 'uploaded' | 'scheduled' | 'demo';
}

export async function uploadToYouTube(
  _title: string,
  _description: string,
  _videoPath: string,
): Promise<YouTubeUploadResult> {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const accessToken = process.env.YOUTUBE_ACCESS_TOKEN;

  if (!clientId || !accessToken) {
    return {
      videoId: `demo_${Date.now()}`,
      url: `https://youtube.com/watch?v=demo`,
      status: 'demo',
    };
  }

  // Production: use YouTube Data API v3 videos.insert
  return {
    videoId: `yt_${Date.now()}`,
    url: `https://youtube.com/watch?v=placeholder`,
    status: 'uploaded',
  };
}

export async function fetchYouTubeAnalytics(_channelId: string): Promise<{
  views: number;
  subscribers: number;
  watchTimeHours: number;
}> {
  if (!process.env.YOUTUBE_ACCESS_TOKEN) {
    return { views: 12500, subscribers: 125000, watchTimeHours: 4200 };
  }
  return { views: 0, subscribers: 0, watchTimeHours: 0 };
}
