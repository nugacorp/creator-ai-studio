import type {
  AppSettings,
  CreateEpisodeInput,
  CreateJobInput,
  EpisodeDetail,
  EpisodeStage,
  EpisodeStageStatus,
  EpisodeSummary,
  ProductionJob,
  ProjectStatus,
  UpdateEpisodeInput,
} from '@creator-ai-studio/shared';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, init);
  if (!response.ok) {
    throw new Error(`API error (${response.status})`);
  }
  return (await response.json()) as T;
}

export async function fetchEpisodes(): Promise<EpisodeSummary[]> {
  return apiFetch<EpisodeSummary[]>('/episodes');
}

export async function fetchEpisodeDetail(id: string): Promise<EpisodeDetail> {
  return apiFetch<EpisodeDetail>(`/episodes/${encodeURIComponent(id)}`);
}

export async function updateEpisode(
  id: string,
  input: UpdateEpisodeInput,
): Promise<EpisodeDetail> {
  return apiFetch<EpisodeDetail>(`/episodes/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function updateEpisodeProjectStatus(
  id: string,
  projectStatus: ProjectStatus,
): Promise<EpisodeDetail> {
  return apiFetch<EpisodeDetail>(`/episodes/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectStatus }),
  });
}

export async function updateStageStatus(
  id: string,
  stage: EpisodeStage,
  status: EpisodeStageStatus,
): Promise<EpisodeDetail> {
  return apiFetch<EpisodeDetail>(
    `/episodes/${encodeURIComponent(id)}/stages/${encodeURIComponent(stage)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    },
  );
}

export async function createEpisode(input: CreateEpisodeInput): Promise<EpisodeSummary> {
  return apiFetch<EpisodeSummary>('/episodes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function createJob(
  episodeId: string,
  input: CreateJobInput,
): Promise<ProductionJob> {
  return apiFetch<ProductionJob>(`/episodes/${encodeURIComponent(episodeId)}/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function fetchJob(id: string): Promise<ProductionJob> {
  return apiFetch<ProductionJob>(`/jobs/${encodeURIComponent(id)}`);
}

export type { AppSettings };

export async function fetchSettings(): Promise<AppSettings> {
  return apiFetch<AppSettings>('/settings');
}

export async function updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  return apiFetch<AppSettings>('/settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  status: string;
}

export async function fetchCalendarEvents(): Promise<CalendarEvent[]> {
  return apiFetch<CalendarEvent[]>('/calendar/events');
}

export interface AnalyticsData {
  kpis: { views: number; subscribers: number; watchTimeHours: number; engagement: string };
  chartData: number[];
}

export async function fetchAnalytics(): Promise<AnalyticsData> {
  return apiFetch<AnalyticsData>('/analytics');
}

export interface ChannelData {
  id: string;
  name: string;
  type: string;
  status: string;
  subscribers: number;
  avatar: string;
}

export async function fetchChannels(): Promise<ChannelData[]> {
  return apiFetch<ChannelData[]>('/channels');
}
