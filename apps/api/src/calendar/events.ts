import type { EpisodeStorage } from '../storage/index.js';
import {
  fetchYouTubeScheduledVideos,
  hasYouTubeScopes,
  resolveYouTubeAccessTokenForCalendar,
} from '../integrations/youtube.js';

export type CalendarEventStatus = 'published' | 'scheduled' | 'draft';
export type CalendarEventSource = 'local' | 'youtube';

export interface CalendarEventDto {
  id: string;
  title: string;
  /** YYYY-MM-DD (UTC date part of scheduledAt when available). */
  date: string;
  /** HH:MM (UTC time part when derived from scheduledAt). */
  time: string;
  channel: string;
  status: CalendarEventStatus;
  source: CalendarEventSource;
  episodeId?: string;
  scheduledAt?: string;
  youtubeVideoId?: string;
  youtubeUrl?: string;
}

function isoToDateParts(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return { date: iso.slice(0, 10), time: '18:00' };
  }
  const date = d.toISOString().slice(0, 10);
  const time = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
  return { date, time };
}

function eventSortKey(event: CalendarEventDto): string {
  const time = event.scheduledAt ?? `${event.date}T${event.time}:00.000Z`;
  return time;
}

async function loadLocalCalendarEvents(
  storage: EpisodeStorage,
  userId?: string,
): Promise<CalendarEventDto[]> {
  const summaries = await storage.listEpisodes(userId);
  const events: CalendarEventDto[] = [];

  for (const summary of summaries) {
    const detail = await storage.getEpisode(summary.id);
    if (!detail) continue;

    const scheduledAt = detail.content.scheduledAt;
    const isScheduled = summary.status === 'review' && Boolean(scheduledAt);
    const isPublished = summary.status === 'published';

    if (!isScheduled && !isPublished) continue;

    const when = scheduledAt ?? summary.updatedAt;
    const { date, time } = isoToDateParts(when);

    events.push({
      id: `ep_${summary.id}`,
      title: summary.title,
      date,
      time,
      channel: 'YouTube',
      status: isPublished ? 'published' : 'scheduled',
      source: 'local',
      episodeId: summary.id,
      scheduledAt: scheduledAt ?? undefined,
      youtubeVideoId: detail.content.youtubeVideoId,
      youtubeUrl: detail.content.youtubeVideoId
        ? `https://www.youtube.com/watch?v=${detail.content.youtubeVideoId}`
        : undefined,
    });
  }

  return events;
}

async function loadYouTubeCalendarEvents(
  linkedVideoIds: Set<string>,
): Promise<CalendarEventDto[]> {
  const accessToken = await resolveYouTubeAccessTokenForCalendar();
  if (!accessToken || !(await hasYouTubeScopes())) {
    return [];
  }

  try {
    const videos = await fetchYouTubeScheduledVideos(accessToken);
    return videos
      .filter(video => !linkedVideoIds.has(video.videoId))
      .map(video => {
        const { date, time } = isoToDateParts(video.publishAt);
        return {
          id: `yt_${video.videoId}`,
          title: video.title,
          date,
          time,
          channel: video.channelTitle ?? 'YouTube',
          status: 'scheduled' as const,
          source: 'youtube' as const,
          scheduledAt: video.publishAt,
          youtubeVideoId: video.videoId,
          youtubeUrl: `https://www.youtube.com/watch?v=${video.videoId}`,
        };
      });
  } catch {
    return [];
  }
}

export interface CalendarEventsResult {
  events: CalendarEventDto[];
  youtubeConnected: boolean;
  youtubeSynced: boolean;
}

/** Merge local episode schedules with optional YouTube scheduled uploads. */
export async function buildCalendarEvents(
  storage: EpisodeStorage,
  userId?: string,
): Promise<CalendarEventsResult> {
  const localEvents = await loadLocalCalendarEvents(storage, userId);
  const linkedVideoIds = new Set(
    localEvents.map(e => e.youtubeVideoId).filter((id): id is string => Boolean(id)),
  );

  const accessToken = await resolveYouTubeAccessTokenForCalendar();
  const youtubeConnected = Boolean(accessToken && (await hasYouTubeScopes()));
  const youtubeEvents = youtubeConnected ? await loadYouTubeCalendarEvents(linkedVideoIds) : [];

  const events = [...localEvents, ...youtubeEvents].sort((a, b) =>
    eventSortKey(a).localeCompare(eventSortKey(b)),
  );

  return {
    events,
    youtubeConnected,
    youtubeSynced: youtubeConnected && youtubeEvents.length >= 0,
  };
}
