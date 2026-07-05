import type {
  AgentDefinition,
  AgentRunRecord,
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

import { getSupabaseClient, isSupabaseAuthEnabled } from './lib/supabase';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

let apiAccessToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setApiAccessToken(token: string | null): void {
  apiAccessToken = token;
}

export function setOnUnauthorized(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

/** Resolve Bearer token: in-memory cache first, then live Supabase session. */
async function resolveAccessToken(): Promise<string | null> {
  if (apiAccessToken) return apiAccessToken;
  if (!isSupabaseAuthEnabled()) return null;
  const client = getSupabaseClient();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  const token = data.session?.access_token ?? null;
  if (token) apiAccessToken = token;
  return token;
}

async function buildAuthHeaders(extra?: HeadersInit): Promise<Headers> {
  const headers = new Headers(extra);
  const token = await resolveAccessToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return headers;
}

export class ApiUnauthorizedError extends Error {
  constructor() {
    super('unauthorized');
    this.name = 'ApiUnauthorizedError';
  }
}

export interface AuthStatus {
  authRequired: boolean;
  apiKeyAuth: boolean;
  supabaseAuth: boolean;
}

export async function fetchAuthStatus(): Promise<AuthStatus> {
  const response = await fetch(`${API_BASE_URL}/auth/status`);
  if (!response.ok) {
    throw new Error(`API error (${response.status})`);
  }
  return (await response.json()) as AuthStatus;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let headers = await buildAuthHeaders(init?.headers);
  let response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });

  // Retry once after refresh when the first call raced ahead of session hydration.
  if (response.status === 401 && isSupabaseAuthEnabled()) {
    const client = getSupabaseClient();
    if (client) {
      const { data } = await client.auth.refreshSession();
      const token = data.session?.access_token ?? null;
      if (token) {
        apiAccessToken = token;
        headers = await buildAuthHeaders(init?.headers);
        response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
      }
    }
  }

  if (response.status === 401) {
    const body = (await response.clone().json().catch(() => ({}))) as { error?: string };
    if (body.error === 'invalid_token') {
      onUnauthorized?.();
    }
    throw new ApiUnauthorizedError();
  }
  if (!response.ok) {
    throw new Error(`API error (${response.status})`);
  }
  return (await response.json()) as T;
}

/** Fetch a protected media path and return a blob URL for use in img/video elements. */
export async function loadAuthenticatedMediaUrl(assetPath: string): Promise<string> {
  if (assetPath.startsWith('data:') || assetPath.startsWith('blob:') || assetPath.startsWith('http')) {
    return assetPath;
  }

  const apiPath = assetPath.startsWith('/api') ? assetPath.slice(4) : assetPath;
  let headers = await buildAuthHeaders();
  let response = await fetch(`${API_BASE_URL}${apiPath}`, { headers });

  if (response.status === 401 && isSupabaseAuthEnabled()) {
    const client = getSupabaseClient();
    if (client) {
      const { data } = await client.auth.refreshSession();
      const token = data.session?.access_token ?? null;
      if (token) {
        apiAccessToken = token;
        headers = await buildAuthHeaders();
        response = await fetch(`${API_BASE_URL}${apiPath}`, { headers });
      }
    }
  }

  if (!response.ok) {
    throw new Error(`Media load failed (${response.status})`);
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
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

export async function deleteEpisode(id: string): Promise<{ ok: boolean; id: string }> {
  return apiFetch<{ ok: boolean; id: string }>(`/episodes/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function generateStoryboardFromScript(
  episodeId: string,
): Promise<{ scenes: import('@creator-ai-studio/shared').Scene[] }> {
  return apiFetch(`/episodes/${encodeURIComponent(episodeId)}/storyboard/from-script`, {
    method: 'POST',
  });
}

export async function generateSceneImages(
  episodeId: string,
  sceneIds?: string[],
  options?: { force?: boolean; skipLlmRefine?: boolean },
): Promise<{ scenes: import('@creator-ai-studio/shared').Scene[]; generated: number }> {
  return apiFetch(`/episodes/${encodeURIComponent(episodeId)}/scenes/generate-images`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...(sceneIds?.length ? { sceneIds } : {}),
      ...(options?.force ? { force: true } : {}),
      ...(options?.skipLlmRefine ? { skipLlmRefine: true } : {}),
    }),
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
  isDemo?: boolean;
  connected?: boolean;
  hasData?: boolean;
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
  const headers = await buildAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/oauth/google/start?${query.toString()}`, {
    headers,
  });
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
  return apiFetch<{ imageUrl: string }>('/ai/generate-image', {
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

export type PipelineMode = 'production-draft' | 'ready-for-review' | 'publish-authorized';

export async function runEpisodePipeline(episodeId: string): Promise<ProductionJob> {
  return runSafePipeline(episodeId, 'production-draft');
}

export async function runSafePipeline(
  episodeId: string,
  mode: PipelineMode = 'production-draft',
): Promise<ProductionJob> {
  return apiFetch<ProductionJob>(`/episodes/${encodeURIComponent(episodeId)}/run-safe-pipeline`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode }),
  });
}

export interface PublishChecklistItem {
  key: string;
  label: string;
  ok: boolean;
  detail?: string;
}

export interface PublishPackageResult {
  ok: boolean;
  ready: boolean;
  metadataPath: string;
  checklistPath: string;
  checklist: PublishChecklistItem[];
}

export async function buildPublishPackage(episodeId: string): Promise<PublishPackageResult> {
  return apiFetch<PublishPackageResult>(
    `/episodes/${encodeURIComponent(episodeId)}/publish-package`,
    { method: 'POST' },
  );
}

export async function authorizePublish(
  episodeId: string,
): Promise<{ job: ProductionJob; checklist: PublishChecklistItem[] }> {
  return apiFetch(`/episodes/${encodeURIComponent(episodeId)}/authorize-publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirm: true }),
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

export interface EpisodeAssetFile {
  key: string;
  label: string;
  available: boolean;
  filename?: string;
}

export interface EpisodeAssetsResponse {
  episodeId: string;
  workspacePath: string;
  storageLocation: 'local' | 'remote';
  storageRoot?: string;
  drivePath?: string | null;
  message?: string;
  files: EpisodeAssetFile[];
}

export async function fetchEpisodeAssets(episodeId: string): Promise<EpisodeAssetsResponse> {
  return apiFetch<EpisodeAssetsResponse>(`/episodes/${encodeURIComponent(episodeId)}/assets`);
}

export async function downloadEpisodeFile(episodeId: string, assetKey: string): Promise<void> {
  const headers = await buildAuthHeaders();
  const response = await fetch(
    `${API_BASE_URL}/episodes/${encodeURIComponent(episodeId)}/files/${encodeURIComponent(assetKey)}`,
    { headers },
  );
  if (!response.ok) {
    throw new Error(`download failed (${response.status})`);
  }
  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match?.[1] ?? `${assetKey}-download`;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Fetch episode file with auth and return a blob URL for inline preview (revoke when done). */
export async function fetchEpisodeAssetObjectUrl(
  episodeId: string,
  assetKey: string,
): Promise<string | null> {
  const headers = await buildAuthHeaders();
  const response = await fetch(
    `${API_BASE_URL}/episodes/${encodeURIComponent(episodeId)}/files/${encodeURIComponent(assetKey)}`,
    { headers },
  );
  if (!response.ok) return null;
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

export interface AgentsListResponse {
  agents: import('@creator-ai-studio/shared').AgentDefinition[];
  orchestrator: string;
}

export interface AgentRunsResponse {
  episodeId: string;
  runs: import('@creator-ai-studio/shared').AgentRunRecord[];
}

export async function fetchAgents(): Promise<AgentsListResponse> {
  return apiFetch<AgentsListResponse>('/agents');
}

export interface AgentConfigResponse extends AgentDefinition {
  systemPrompt: string;
  skills: string[];
}

export async function fetchAgentConfig(agentId: string): Promise<AgentConfigResponse> {
  return apiFetch<AgentConfigResponse>(`/agents/${encodeURIComponent(agentId)}/config`);
}

export async function fetchAgentRuns(episodeId: string): Promise<AgentRunsResponse> {
  return apiFetch<AgentRunsResponse>(`/episodes/${encodeURIComponent(episodeId)}/agent-runs`);
}

export async function runEpisodeAgent(
  episodeId: string,
  agentId: string,
  options?: { autoEnqueuePlan?: boolean },
): Promise<{ job: ProductionJob; message: string }> {
  return apiFetch(`/episodes/${encodeURIComponent(episodeId)}/agents/${encodeURIComponent(agentId)}/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      async: true,
      autoEnqueuePlan: options?.autoEnqueuePlan,
    }),
  });
}

export async function approveAgentRun(
  episodeId: string,
  runId: string,
): Promise<{ run: AgentRunRecord; message: string }> {
  return apiFetch(`/episodes/${encodeURIComponent(episodeId)}/agent-runs/${encodeURIComponent(runId)}/approve`, {
    method: 'POST',
  });
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
