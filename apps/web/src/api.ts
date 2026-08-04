import type {
  AgentDefinition,
  AgentRunRecord,
  AppSettings,
  CreateEpisodeInput,
  CreateJobInput,
  CreateTeamInviteInput,
  ElevenLabsVoice,
  EpisodeDetail,
  EpisodeStage,
  EpisodeStageStatus,
  EpisodeSummary,
  ProductionJob,
  ProjectStatus,
  JobStatus,
  SecretProvider,
  SecretsPatch,
  SecretStatus,
  SecretTestResult,
  StorageStats,
  SyncTeamOwnerInput,
  TeamResponse,
  TeamRole,
  TtsProvider,
  YouTubeChannelsResponse,
  UpdateEpisodeInput,
} from '@creator-ai-studio/shared';

import { getSupabaseClient, isSupabaseAuthEnabled } from './lib/supabase';

const RAW_API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

function resolveApiBaseUrl(): string {
  const raw = RAW_API_BASE_URL;
  if (typeof window === 'undefined' || !raw.startsWith('http')) {
    return raw;
  }

  try {
    const target = new URL(raw);
    const currentOrigin = window.location.origin;
    const isLocalTarget = ['localhost', '127.0.0.1', '0.0.0.0'].includes(target.hostname);
    if (isLocalTarget && target.origin !== currentOrigin) {
      return '/api';
    }
    return raw;
  } catch {
    return raw;
  }
}

const API_BASE_URL = resolveApiBaseUrl();

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

export class ApiHttpError extends Error {
  readonly status: number;

  constructor(status: number, message?: string) {
    super(message ?? `API error (${status})`);
    this.name = 'ApiHttpError';
    this.status = status;
  }
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
    throw new ApiHttpError(response.status);
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
    throw new ApiHttpError(response.status);
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

/** Map legacy narration paths to the authenticated files endpoint. */
export function resolveEpisodeMediaUrl(episodeId: string, url: string | undefined): string | null {
  if (!url?.trim()) return null;
  if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('http')) return url;
  if (url.includes(`/episodes/${episodeId}/files/`)) return url;
  if (url.includes('/api/episodes/audio/') || (url.includes('narration.') && !url.includes('/files/'))) {
    return `/api/episodes/${episodeId}/files/audio`;
  }
  if (url.includes('/api/episodes/media/video')) {
    return `/api/episodes/${episodeId}/files/video`;
  }
  if (url.includes('/files/music') || url.includes('background-music')) {
    return `/api/episodes/${episodeId}/files/music`;
  }
  return url;
}

export async function fetchEpisodes(options?: { channelId?: string }): Promise<EpisodeSummary[]> {
  const params = new URLSearchParams();
  if (options?.channelId) params.set('channelId', options.channelId);
  const qs = params.toString();
  return apiFetch<EpisodeSummary[]>(`/episodes${qs ? `?${qs}` : ''}`);
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

export async function fetchIdeas(options?: { channelId?: string }): Promise<import('@creator-ai-studio/shared').EpisodeIdea[]> {
  const params = new URLSearchParams();
  if (options?.channelId) params.set('channelId', options.channelId);
  const qs = params.toString();
  const body = await apiFetch<{ ideas: import('@creator-ai-studio/shared').EpisodeIdea[] }>(
    `/ideas${qs ? `?${qs}` : ''}`,
  );
  return body.ideas;
}

export async function createIdea(input: import('@creator-ai-studio/shared').CreateIdeaInput) {
  return apiFetch<import('@creator-ai-studio/shared').EpisodeIdea>('/ideas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function brainstormIdea(id: string) {
  return apiFetch<{
    idea: import('@creator-ai-studio/shared').EpisodeIdea;
    proposals: import('@creator-ai-studio/shared').IdeaProposal[];
  }>(`/ideas/${encodeURIComponent(id)}/brainstorm`, { method: 'POST' });
}

export async function approveIdeaProposal(ideaId: string, proposalId: string) {
  return apiFetch<{
    idea: import('@creator-ai-studio/shared').EpisodeIdea;
    episodeId: string;
    jobId?: string;
    message: string;
  }>(`/ideas/${encodeURIComponent(ideaId)}/proposals/${encodeURIComponent(proposalId)}/approve`, {
    method: 'PATCH',
  });
}

export async function discardIdeaProposal(ideaId: string, proposalId: string) {
  return apiFetch<{ idea: import('@creator-ai-studio/shared').EpisodeIdea; message: string }>(
    `/ideas/${encodeURIComponent(ideaId)}/proposals/${encodeURIComponent(proposalId)}/discard`,
    { method: 'PATCH' },
  );
}

export async function deleteIdea(id: string) {
  return apiFetch<{ ok: boolean; id: string }>(`/ideas/${encodeURIComponent(id)}`, {
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

export async function generateSubtitles(
  episodeId: string,
  options?: { force?: boolean },
): Promise<{ subtitlesSrt: string; skipped?: boolean }> {
  return apiFetch(`/episodes/${encodeURIComponent(episodeId)}/subtitles/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options?.force ? { force: true } : {}),
  });
}

export async function renderEpisodeVideo(
  episodeId: string,
  options?: { force?: boolean },
): Promise<{ ok: boolean; message: string; videoUrl?: string; skipped?: boolean }> {
  return apiFetch(`/episodes/${encodeURIComponent(episodeId)}/render`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options?.force ? { force: true } : {}),
  });
}

export async function generateEpisodeThumbnail(
  episodeId: string,
  options?: { force?: boolean; prompt?: string },
): Promise<{ imageUrl: string; saved: boolean; skipped?: boolean }> {
  return apiFetch(`/episodes/${encodeURIComponent(episodeId)}/thumbnail`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...(options?.force ? { force: true } : {}),
      ...(options?.prompt ? { prompt: options.prompt } : {}),
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

export async function fetchEpisodeJobs(episodeId: string): Promise<ProductionJob[]> {
  return apiFetch<ProductionJob[]>(`/episodes/${encodeURIComponent(episodeId)}/jobs`);
}

export interface ProductionJobsResponse {
  jobs: ProductionJob[];
  summary: Record<JobStatus, number>;
}

export async function fetchProductionJobs(options?: {
  status?: JobStatus[];
  limit?: number;
}): Promise<ProductionJobsResponse> {
  const params = new URLSearchParams();
  if (options?.status?.length) params.set('status', options.status.join(','));
  if (options?.limit !== undefined) params.set('limit', String(options.limit));
  const qs = params.toString();
  return apiFetch<ProductionJobsResponse>(`/jobs${qs ? `?${qs}` : ''}`);
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

export async function fetchTeam(): Promise<TeamResponse> {
  return apiFetch<TeamResponse>('/team');
}

export async function syncTeamOwner(input: SyncTeamOwnerInput): Promise<TeamResponse> {
  return apiFetch<TeamResponse>('/team/sync-owner', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function inviteTeamMember(input: CreateTeamInviteInput): Promise<TeamResponse> {
  return apiFetch<TeamResponse>('/team/invites', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function updateTeamMemberRole(
  memberId: string,
  role: Exclude<TeamRole, 'owner'>,
): Promise<TeamResponse> {
  return apiFetch<TeamResponse>(`/team/members/${memberId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  });
}

export async function removeTeamMember(memberId: string): Promise<TeamResponse> {
  return apiFetch<TeamResponse>(`/team/members/${memberId}`, { method: 'DELETE' });
}

export async function revokeTeamInvite(inviteId: string): Promise<TeamResponse> {
  return apiFetch<TeamResponse>(`/team/invites/${inviteId}`, { method: 'DELETE' });
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  channel: string;
  channelId?: string;
  status: 'published' | 'scheduled' | 'draft';
  source?: 'local' | 'youtube';
  episodeId?: string;
  scheduledAt?: string;
  youtubeVideoId?: string;
  youtubeUrl?: string;
}

export async function fetchCalendarEvents(channelId?: string): Promise<CalendarEvent[]> {
  const params = new URLSearchParams();
  if (channelId) params.set('channelId', channelId);
  const qs = params.toString();
  return apiFetch<CalendarEvent[]>(`/calendar/events${qs ? `?${qs}` : ''}`);
}

export interface SundayServicePost {
  generatedAt: string;
  fridayDate: string;
  sundayDate?: string;
  foundSundayEvent: boolean;
  message: string;
  event?: {
    id: string;
    title: string;
    time: string;
    channel: string;
    youtubeUrl?: string;
  };
}

export async function fetchSundayServicePost(channelId?: string): Promise<SundayServicePost> {
  const params = new URLSearchParams();
  if (channelId) params.set('channelId', channelId);
  const qs = params.toString();
  return apiFetch<SundayServicePost>(`/calendar/sunday-service-post${qs ? `?${qs}` : ''}`);
}

export interface SundayServicePostImage {
  imageUrl: string;
  prompt: string;
  isFallback?: boolean;
  fallbackReason?: string;
  templateUsed?: boolean;
  post: SundayServicePost;
}

export interface SundayServicePostTemplate {
  serviceTopic?: string;
  visualDirection?: string;
  promptOverride?: string;
  updatedAt: string;
}

export interface SundayServicePostArtifact {
  channelId: string;
  generatedAt: string;
  fridayDate: string;
  imageUrl: string;
  prompt: string;
  isFallback: boolean;
  fallbackReason?: string;
  post: SundayServicePost;
}

export async function generateSundayServicePostImage(
  channelId?: string,
  input?: {
    serviceTopic?: string;
    visualDirection?: string;
    promptOverride?: string;
  },
): Promise<SundayServicePostImage> {
  const params = new URLSearchParams();
  if (channelId) params.set('channelId', channelId);
  const qs = params.toString();
  return apiFetch<SundayServicePostImage>(
    `/calendar/sunday-service-post/image${qs ? `?${qs}` : ''}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input ?? {}),
    },
  );
}

export async function fetchLatestSundayServicePostArtifact(channelId?: string): Promise<{
  artifact: SundayServicePostArtifact | null;
}> {
  const params = new URLSearchParams();
  if (channelId) params.set('channelId', channelId);
  const qs = params.toString();
  return apiFetch<{ artifact: SundayServicePostArtifact | null }>(
    `/calendar/sunday-service-post/latest${qs ? `?${qs}` : ''}`,
  );
}

export async function fetchSundayServicePostTemplate(channelId?: string): Promise<{
  template: SundayServicePostTemplate | null;
}> {
  const params = new URLSearchParams();
  if (channelId) params.set('channelId', channelId);
  const qs = params.toString();
  return apiFetch<{ template: SundayServicePostTemplate | null }>(
    `/calendar/sunday-service-post/template${qs ? `?${qs}` : ''}`,
  );
}

export async function saveSundayServicePostTemplate(
  input: {
    channelId?: string;
    serviceTopic?: string;
    visualDirection?: string;
    promptOverride?: string;
  },
): Promise<{ template: SundayServicePostTemplate }> {
  const params = new URLSearchParams();
  if (input.channelId) params.set('channelId', input.channelId);
  const qs = params.toString();
  return apiFetch<{ template: SundayServicePostTemplate }>(
    `/calendar/sunday-service-post/template${qs ? `?${qs}` : ''}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceTopic: input.serviceTopic,
        visualDirection: input.visualDirection,
        promptOverride: input.promptOverride,
      }),
    },
  );
}

export async function triggerSundayServicePostAutoRun(input?: {
  channelId?: string;
  force?: boolean;
}): Promise<{
  created: boolean;
  skipped: boolean;
  reason?: string;
  channelId: string;
  artifact?: SundayServicePostArtifact | null;
}> {
  const params = new URLSearchParams();
  if (input?.channelId) params.set('channelId', input.channelId);
  const qs = params.toString();
  return apiFetch(
    `/calendar/sunday-service-post/auto-run${qs ? `?${qs}` : ''}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ force: input?.force === true }),
    },
  );
}

export interface AnalyticsData {
  isDemo?: boolean;
  connected?: boolean;
  hasData?: boolean;
  kpis: { views: number; subscribers: number; watchTimeHours: number; engagement: string };
  chartData: number[];
  channelDistribution?: Array<{ name: string; views: number; percentage: number }>;
}

export async function fetchAnalytics(channelId?: string): Promise<AnalyticsData> {
  const params = new URLSearchParams();
  if (channelId) params.set('channelId', channelId);
  const qs = params.toString();
  return apiFetch<AnalyticsData>(`/analytics${qs ? `?${qs}` : ''}`);
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

export type { YouTubeChannelInfo, YouTubeChannelsResponse } from '@creator-ai-studio/shared';

export async function fetchYouTubeChannels(): Promise<YouTubeChannelsResponse> {
  return apiFetch<YouTubeChannelsResponse>('/integrations/youtube/channels');
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

export async function aiChat(message: string): Promise<{ reply: string; out_of_scope?: boolean }> {
  return apiFetch<{ reply: string; out_of_scope?: boolean }>('/gemini/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
}

export interface CopilotToolResult {
  tool: string;
  success: boolean;
  summary: string;
  data?: Record<string, unknown>;
}

export interface CopilotPendingAction {
  id: string;
  type: 'confirm_publish';
  episodeId: string;
  episodeTitle: string;
  label: string;
}

export interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  outOfScope?: boolean;
  toolResults?: CopilotToolResult[];
  pendingActions?: CopilotPendingAction[];
  createdAt: string;
}

export interface CopilotChatResponse {
  reply: string;
  out_of_scope?: boolean;
  toolResults?: CopilotToolResult[];
  pendingActions?: CopilotPendingAction[];
  messages?: CopilotMessage[];
}

export async function fetchCopilotMessages(channelId?: string | null): Promise<{
  messages: CopilotMessage[];
  welcome: string;
}> {
  const query = channelId ? `?channelId=${encodeURIComponent(channelId)}` : '';
  return apiFetch<{ messages: CopilotMessage[]; welcome: string }>(`/copilot/messages${query}`);
}

export async function copilotChat(input: {
  message: string;
  channelId?: string | null;
  activeEpisodeId?: string | null;
  episodeTitle?: string | null;
}): Promise<CopilotChatResponse> {
  return apiFetch<CopilotChatResponse>('/copilot/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: input.message,
      ...(input.channelId ? { channelId: input.channelId } : {}),
      ...(input.activeEpisodeId ? { activeEpisodeId: input.activeEpisodeId } : {}),
      ...(input.episodeTitle ? { episodeTitle: input.episodeTitle } : {}),
    }),
  });
}

export async function copilotConfirmAction(input: {
  action: string;
  episodeId: string;
  channelId?: string | null;
  scheduledAt?: string;
}): Promise<CopilotChatResponse> {
  return apiFetch<CopilotChatResponse>('/copilot/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: input.action,
      episodeId: input.episodeId,
      ...(input.channelId ? { channelId: input.channelId } : {}),
      ...(input.scheduledAt ? { scheduledAt: input.scheduledAt } : {}),
    }),
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
  options?: { scheduledAt?: string },
): Promise<{ job: ProductionJob; checklist: PublishChecklistItem[] }> {
  return apiFetch(`/episodes/${encodeURIComponent(episodeId)}/authorize-publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      confirm: true,
      ...(options?.scheduledAt ? { scheduledAt: options.scheduledAt } : {}),
    }),
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

export interface EpisodeSceneAsset {
  sceneId: string;
  index: number;
  label: string;
  filename: string;
  available: boolean;
  imageUrl?: string;
  text?: string;
}

export interface EpisodeAssetsResponse {
  episodeId: string;
  workspacePath: string;
  storageLocation: 'local' | 'remote';
  storageRoot?: string;
  drivePath?: string | null;
  message?: string;
  files: EpisodeAssetFile[];
  sceneImages?: EpisodeSceneAsset[];
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

export type DigitalAssetType = import('@creator-ai-studio/shared').DigitalAssetType;
export type DigitalMinistry = import('@creator-ai-studio/shared').DigitalMinistry;
export type DigitalPlatform = import('@creator-ai-studio/shared').DigitalPlatform;
export type DigitalAssetSourceKind = import('@creator-ai-studio/shared').DigitalAssetSourceKind;

export interface DigitalAssetRecord {
  id: string;
  name: string;
  type: DigitalAssetType;
  ministry: DigitalMinistry;
  tags: string[];
  platforms: DigitalPlatform[];
  sourceKind: DigitalAssetSourceKind;
  episodeId?: string;
  assetKey?: string;
  externalUrl?: string;
  uploadedFileName?: string;
  uploadedMimeType?: string;
  uploadedSizeBytes?: number;
  uploadedFilePath?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  userId?: string;
}

export interface CreateDigitalAssetInput {
  name: string;
  type: DigitalAssetType;
  ministry?: DigitalMinistry;
  tags?: string[];
  platforms?: DigitalPlatform[];
  sourceKind: DigitalAssetSourceKind;
  episodeId?: string;
  assetKey?: string;
  externalUrl?: string;
  notes?: string;
}

export interface UpdateDigitalAssetInput {
  name?: string;
  type?: DigitalAssetType;
  ministry?: DigitalMinistry;
  tags?: string[];
  platforms?: DigitalPlatform[];
  sourceKind?: DigitalAssetSourceKind;
  episodeId?: string;
  assetKey?: string;
  externalUrl?: string;
  notes?: string;
}

export interface UploadDigitalAssetInput {
  name: string;
  type: DigitalAssetType;
  ministry?: DigitalMinistry;
  tags?: string[];
  platforms?: DigitalPlatform[];
  notes?: string;
  file: {
    name: string;
    mimeType?: string;
    contentBase64: string;
  };
}

export async function fetchDigitalAssets(options?: {
  ministry?: DigitalMinistry;
  type?: DigitalAssetType;
  search?: string;
}): Promise<DigitalAssetRecord[]> {
  const params = new URLSearchParams();
  if (options?.ministry) params.set('ministry', options.ministry);
  if (options?.type) params.set('type', options.type);
  if (options?.search?.trim()) params.set('search', options.search.trim());
  const query = params.toString();
  const data = await apiFetch<{ items: DigitalAssetRecord[] }>(`/digital-assets${query ? `?${query}` : ''}`);
  return data.items;
}

export async function createDigitalAsset(input: CreateDigitalAssetInput): Promise<DigitalAssetRecord> {
  return apiFetch<DigitalAssetRecord>('/digital-assets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function updateDigitalAsset(
  id: string,
  input: UpdateDigitalAssetInput,
): Promise<DigitalAssetRecord> {
  return apiFetch<DigitalAssetRecord>(`/digital-assets/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function uploadDigitalAsset(input: UploadDigitalAssetInput): Promise<DigitalAssetRecord> {
  return apiFetch<DigitalAssetRecord>('/digital-assets/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function deleteDigitalAsset(id: string): Promise<{ ok: boolean; id: string }> {
  return apiFetch<{ ok: boolean; id: string }>(`/digital-assets/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function downloadDigitalAssetFile(
  id: string,
  fallbackFilename = 'asset-file',
): Promise<void> {
  const headers = await buildAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/digital-assets/${encodeURIComponent(id)}/file`, {
    headers,
  });
  if (!response.ok) {
    throw new Error(`download failed (${response.status})`);
  }
  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match?.[1] ?? fallbackFilename;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
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
  baseSkills: string[];
  overrides: import('@creator-ai-studio/shared').AgentOverride;
}

export async function fetchAgentConfig(agentId: string): Promise<AgentConfigResponse> {
  return apiFetch<AgentConfigResponse>(`/agents/${encodeURIComponent(agentId)}/config`);
}

export type AgentOverride = import('@creator-ai-studio/shared').AgentOverride;

export interface PatchAgentOverridesResponse {
  agentId: string;
  overrides: AgentOverride;
  skills: string[];
  message: string;
}

export async function patchAgentOverrides(
  agentId: string,
  overrides: Partial<AgentOverride>,
): Promise<PatchAgentOverridesResponse> {
  return apiFetch<PatchAgentOverridesResponse>(`/agents/${encodeURIComponent(agentId)}/overrides`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(overrides),
  });
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

export async function generateEpisodeMusic(
  episodeId: string,
  options?: {
    prompt?: string;
    model?: 'lyria-3-clip-preview' | 'lyria-3-pro-preview';
    force?: boolean;
    assignToScenes?: boolean;
  },
): Promise<{
  musicUrl: string;
  saved: boolean;
  skipped?: boolean;
  label: string;
  model?: string;
}> {
  return apiFetch(`/episodes/${encodeURIComponent(episodeId)}/music/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...(options?.prompt ? { prompt: options.prompt } : {}),
      ...(options?.model ? { model: options.model } : {}),
      ...(options?.force ? { force: true } : {}),
      ...(options?.assignToScenes === false ? { assignToScenes: false } : {}),
    }),
  });
}

export async function aiGenerateMusic(body: {
  prompt: string;
  model?: 'lyria-3-clip-preview' | 'lyria-3-pro-preview';
}): Promise<{ audio: string; mimeType: string; model: string; lyrics?: string }> {
  return apiFetch('/ai/generate-music', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function renderEpisodeShorts(
  episodeId: string,
): Promise<{ ok: boolean; message: string; rendered?: Array<{ id: string; filename: string }> }> {
  return apiFetch(`/episodes/${encodeURIComponent(episodeId)}/shorts`, { method: 'POST' });
}

export async function aiSeo(
  title: string,
  script: string,
): Promise<{
  titles?: string[];
  description?: string;
  tags?: string[];
  chapters?: { time: string; title: string }[];
  pinnedComment?: string;
}> {
  return apiFetch('/gemini/seo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, script }),
  });
}

export type { SecretsPatch, SecretProvider, SecretStatus };
