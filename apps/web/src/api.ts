import type {
  AppSettings,
  CreateEpisodeInput,
  CreateJobInput,
  ElevenLabsVoice,
  EpisodeDetail,
  EpisodeStage,
  EpisodeStageStatus,
  EpisodeSummary,
  ProductionJob,
  ProjectStatus,
  SecretProvider,
  SecretsPatch,
  SecretStatus,
  SecretTestResult,
  StorageStats,
  TtsProvider,
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
  channelDistribution?: Array<{ name: string; views: number; percentage: number }>;
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

export interface SecretsResponse {
  encryptionAvailable: boolean;
  googleOAuthClientConfigured?: boolean;
  items: SecretStatus[];
}

export async function fetchSecrets(): Promise<SecretsResponse> {
  return apiFetch<SecretsResponse>('/secrets');
}

export async function updateSecrets(patch: SecretsPatch): Promise<{ items: SecretStatus[] }> {
  return apiFetch<{ items: SecretStatus[] }>('/secrets', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
}

export async function testSecret(provider: SecretProvider): Promise<SecretTestResult> {
  return apiFetch<SecretTestResult>(`/secrets/test/${provider}`, { method: 'POST' });
}

export async function startGoogleOAuth(
  purpose: 'gemini' | 'youtube',
  forceConsent = false,
): Promise<{ authorizeUrl: string }> {
  const returnUrl = `${window.location.origin}${window.location.pathname}?view=settings`;
  const query = new URLSearchParams({
    purpose,
    returnUrl,
    forceConsent: forceConsent ? 'true' : 'false',
  });
  const response = await fetch(`${API_BASE_URL}/oauth/google/start?${query.toString()}`);
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
    throw new Error(body.message ?? body.error ?? `API error (${response.status})`);
  }
  return (await response.json()) as { authorizeUrl: string };
}

export interface SystemMode {
  demoMode: boolean;
  aiProvider: string;
  ttsProvider?: TtsProvider;
  ttsConfigured?: boolean;
}

export async function fetchSystemMode(): Promise<SystemMode> {
  return apiFetch<SystemMode>('/system/mode');
}

export async function scheduleCalendarEvent(input: {
  episodeId: string;
  date?: string;
}): Promise<CalendarEvent> {
  return apiFetch<CalendarEvent>('/calendar/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function aiChat(message: string): Promise<{ reply: string }> {
  return apiFetch<{ reply: string }>('/gemini/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
}

export async function aiGenerateScript(
  prompt: string,
  options?: Record<string, string>,
): Promise<{ text: string }> {
  return apiFetch<{ text: string }>('/gemini/generate-script', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, options }),
  });
}

export async function aiRewrite(script: string, instruction: string): Promise<{ text: string }> {
  return apiFetch<{ text: string }>('/gemini/rewrite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ script, instruction }),
  });
}

export async function aiGenerateImage(body: {
  prompt: string;
  aspectRatio?: string;
  imageSize?: string;
  style?: string;
}): Promise<{ imageUrl: string }> {
  return apiFetch<{ imageUrl: string }>('/gemini/generate-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function aiTts(
  text: string,
  voice?: string,
  episodeId?: string,
): Promise<{ audioUrl?: string; audio?: string; isDemo?: boolean; provider?: string }> {
  return apiFetch('/integrations/elevenlabs/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voiceId: voice, episodeId }),
  });
}

export async function fetchElevenLabsVoices(): Promise<ElevenLabsVoice[]> {
  const res = await apiFetch<{ voices: ElevenLabsVoice[] }>('/integrations/elevenlabs/voices');
  return res.voices;
}

export async function fetchStorageStats(): Promise<StorageStats> {
  return apiFetch<StorageStats>('/system/storage');
}

export async function runEpisodePipeline(episodeId: string): Promise<ProductionJob> {
  return apiFetch<ProductionJob>(`/episodes/${encodeURIComponent(episodeId)}/pipeline`, {
    method: 'POST',
  });
}

export async function confirmPublish(episodeId: string): Promise<EpisodeDetail> {
  return apiFetch<EpisodeDetail>(`/episodes/${encodeURIComponent(episodeId)}/confirm-publish`, {
    method: 'POST',
  });
}

export async function archiveEpisode(episodeId: string): Promise<{ ok: boolean; message: string }> {
  return apiFetch(`/episodes/${encodeURIComponent(episodeId)}/archive`, { method: 'POST' });
}

export type { StorageStats, TtsProvider, ElevenLabsVoice };

export async function aiSeo(
  title: string,
  script: string,
): Promise<{ titles?: string[]; description?: string; tags?: string[] }> {
  return apiFetch<{ titles?: string[]; description?: string; tags?: string[] }>('/gemini/seo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, script }),
  });
}

export type { SecretsPatch, SecretProvider, SecretStatus };
