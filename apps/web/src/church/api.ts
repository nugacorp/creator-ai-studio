import type {
  Approval,
  Asset,
  AssetKind,
  CalendarEntry,
  ChecklistItem,
  Church,
  ChurchMember,
  ChurchPermission,
  ChurchRole,
  LiveCrewAssignment,
  LiveEvent,
  Ministry,
  Production,
  ProductionComment,
  ProductionFormat,
  ProductionStatus,
  PublishMode,
  PublishPlatform,
  PublishTarget,
  RenderPreset,
} from '@creator-ai-studio/shared';
import { apiFetch, apiFetchRaw, API_BASE_URL, buildAuthHeaders } from '../api';

/**
 * Typed client for the church platform endpoints.
 * Every call goes through the same auth-aware fetch the rest of the app uses,
 * so a 401 still triggers the shared session-refresh path.
 */

export interface ChurchSessionResponse {
  configured: boolean;
  church: Church | null;
  member: ChurchMember | null;
  role: ChurchRole | null;
  permissions: ChurchPermission[];
  memberships: Array<{ church: Church; role: ChurchRole }>;
}

export async function fetchChurchSession(): Promise<ChurchSessionResponse> {
  return apiFetch<ChurchSessionResponse>('/church/me');
}

export async function createChurch(input: {
  name: string;
  timezone?: string;
}): Promise<{ church: Church; importedMembers: number }> {
  return apiFetch('/church', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function updateChurch(input: {
  name?: string;
  timezone?: string;
}): Promise<{ church: Church }> {
  return apiFetch('/church', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

// --- Today ------------------------------------------------------------------

export interface TodayResponse {
  church: Church;
  role: ChurchRole;
  assignedToMe: Production[];
  inReview: Production[];
  upcomingPublications: Array<{ entry: CalendarEntry; production: Production | null }>;
  upcomingLiveEvents: LiveEvent[];
  pendingApprovals: Array<{ approval: Approval; production: Production | null }>;
}

export async function fetchToday(): Promise<TodayResponse> {
  return apiFetch<TodayResponse>('/church/today');
}

export interface InsightsResponse {
  range: { from: string; to: string };
  totals: { productions: number; published: number; scheduled: number; failed: number };
  byMinistry: Array<{ ministryId: string | null; name: string; total: number; published: number }>;
  byStatus: Record<string, number>;
  averageLeadTimeDays: number | null;
  calendarCompliance: number | null;
}

export async function fetchInsights(range?: { from?: string; to?: string }): Promise<InsightsResponse> {
  const params = new URLSearchParams();
  if (range?.from) params.set('from', range.from);
  if (range?.to) params.set('to', range.to);
  const qs = params.toString();
  return apiFetch<InsightsResponse>(`/church/insights${qs ? `?${qs}` : ''}`);
}

// --- Ministries & team ------------------------------------------------------

export async function fetchMinistries(): Promise<Ministry[]> {
  const data = await apiFetch<{ items: Ministry[] }>('/church/ministries');
  return data.items;
}

export async function createMinistry(input: {
  name: string;
  description?: string;
}): Promise<Ministry> {
  return apiFetch<Ministry>('/church/ministries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function updateMinistry(
  id: string,
  input: { name?: string; description?: string; isActive?: boolean },
): Promise<Ministry> {
  return apiFetch<Ministry>(`/church/ministries/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function deleteMinistry(id: string): Promise<{ ok: boolean }> {
  return apiFetch(`/church/ministries/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function fetchMembers(): Promise<ChurchMember[]> {
  const data = await apiFetch<{ items: ChurchMember[] }>('/church/members');
  return data.items;
}

export async function addMember(input: {
  email?: string;
  userId?: string;
  role: ChurchRole;
  title?: string;
}): Promise<ChurchMember> {
  return apiFetch<ChurchMember>('/church/members', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function updateMember(
  id: string,
  input: { role?: ChurchRole; title?: string; status?: ChurchMember['status'] },
): Promise<ChurchMember> {
  return apiFetch<ChurchMember>(`/church/members/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function removeMember(id: string): Promise<{ ok: boolean }> {
  return apiFetch(`/church/members/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

// --- Library (DAM) ----------------------------------------------------------

export interface AssetQuery {
  ministryId?: string;
  kind?: AssetKind;
  series?: string;
  preacher?: string;
  bibleRef?: string;
  tag?: string;
  from?: string;
  to?: string;
  search?: string;
}

export async function fetchAssets(query: AssetQuery = {}): Promise<Asset[]> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value) params.set(key, String(value));
  }
  const qs = params.toString();
  const data = await apiFetch<{ items: Asset[] }>(`/church/assets${qs ? `?${qs}` : ''}`);
  return data.items;
}

export interface AssetsSummary {
  totalAssets: number;
  totalBytes: number;
  byKind: Record<string, { count: number; bytes: number }>;
}

export async function fetchAssetsSummary(): Promise<AssetsSummary> {
  return apiFetch<AssetsSummary>('/church/assets-summary');
}

export interface UploadAssetInput {
  file: File;
  name?: string;
  kind?: AssetKind;
  ministryId?: string;
  series?: string;
  preacher?: string;
  bibleRef?: string;
  tags?: string[];
  serviceDate?: string;
}

/**
 * Upload with real progress. Uses XMLHttpRequest rather than fetch because
 * fetch still cannot report upload progress, and a volunteer dragging in a 2 GB
 * sermon needs to see that something is happening.
 */
export async function uploadAsset(
  input: UploadAssetInput,
  onProgress?: (percent: number) => void,
): Promise<Asset> {
  const form = new FormData();
  if (input.name) form.append('name', input.name);
  if (input.kind) form.append('kind', input.kind);
  if (input.ministryId) form.append('ministryId', input.ministryId);
  if (input.series) form.append('series', input.series);
  if (input.preacher) form.append('preacher', input.preacher);
  if (input.bibleRef) form.append('bibleRef', input.bibleRef);
  if (input.serviceDate) form.append('serviceDate', input.serviceDate);
  if (input.tags?.length) form.append('tags', input.tags.join(','));
  form.append('file', input.file, input.file.name);

  const headers = await buildAuthHeaders();
  const token = headers.get('Authorization');

  return new Promise<Asset>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', `${API_BASE_URL}/church/assets/upload`);
    if (token) request.setRequestHeader('Authorization', token);

    request.upload.addEventListener('progress', event => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });

    request.addEventListener('load', () => {
      if (request.status >= 200 && request.status < 300) {
        resolve(JSON.parse(request.responseText) as Asset);
        return;
      }
      let message = `Error al subir (${request.status})`;
      try {
        const body = JSON.parse(request.responseText) as { message?: string };
        if (body.message) message = body.message;
      } catch {
        // Non-JSON error body: keep the status-based message.
      }
      reject(new Error(message));
    });

    request.addEventListener('error', () => reject(new Error('Se perdió la conexión al subir')));
    request.addEventListener('abort', () => reject(new Error('Subida cancelada')));
    request.send(form);
  });
}

export async function updateAsset(
  id: string,
  input: Partial<Pick<Asset, 'name' | 'kind' | 'series' | 'preacher' | 'bibleRef' | 'tags' | 'serviceDate' | 'ministryId'>>,
): Promise<Asset> {
  return apiFetch<Asset>(`/church/assets/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function deleteAsset(id: string): Promise<{ ok: boolean }> {
  return apiFetch(`/church/assets/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

/** Authenticated blob URL for a thumbnail. Caller must revoke it. */
export async function loadAssetThumbnail(id: string): Promise<string | null> {
  const response = await apiFetchRaw(`/church/assets/${encodeURIComponent(id)}/thumbnail`);
  if (!response.ok) return null;
  return URL.createObjectURL(await response.blob());
}

export async function loadAssetPreview(id: string): Promise<string | null> {
  const response = await apiFetchRaw(`/church/assets/${encodeURIComponent(id)}/file`);
  if (!response.ok) return null;
  return URL.createObjectURL(await response.blob());
}

export async function downloadAsset(id: string, fileName: string): Promise<void> {
  const response = await apiFetchRaw(`/church/assets/${encodeURIComponent(id)}/file?download=1`);
  if (!response.ok) throw new Error(`No se pudo descargar (${response.status})`);
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

// --- Productions ------------------------------------------------------------

export async function fetchProductions(query: {
  status?: ProductionStatus;
  format?: ProductionFormat;
  ministryId?: string;
  assignedTo?: string;
} = {}): Promise<Production[]> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value) params.set(key, String(value));
  }
  const qs = params.toString();
  const data = await apiFetch<{ items: Production[] }>(`/church/productions${qs ? `?${qs}` : ''}`);
  return data.items;
}

export interface ProductionDetail {
  production: Production;
  comments: ProductionComment[];
  approvals: Approval[];
}

export async function fetchProduction(id: string): Promise<ProductionDetail> {
  return apiFetch<ProductionDetail>(`/church/productions/${encodeURIComponent(id)}`);
}

export async function createProduction(input: {
  title: string;
  format: ProductionFormat;
  ministryId?: string;
  summary?: string;
  serviceDate?: string;
  preacher?: string;
  bibleRef?: string;
  assignedTo?: string[];
  sourceAssetIds?: string[];
}): Promise<Production> {
  return apiFetch<Production>('/church/productions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function updateProduction(
  id: string,
  input: Partial<{
    title: string;
    ministryId: string;
    summary: string;
    script: string;
    serviceDate: string;
    preacher: string;
    bibleRef: string;
    assignedTo: string[];
    sourceAssetIds: string[];
  }>,
): Promise<Production> {
  return apiFetch<Production>(`/church/productions/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function moveProduction(
  id: string,
  status: ProductionStatus,
  comment?: string,
): Promise<Production> {
  return apiFetch<Production>(`/church/productions/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, ...(comment ? { comment } : {}) }),
  });
}

export async function deleteProduction(id: string): Promise<{ ok: boolean }> {
  return apiFetch(`/church/productions/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function addComment(productionId: string, body: string): Promise<ProductionComment> {
  return apiFetch<ProductionComment>(
    `/church/productions/${encodeURIComponent(productionId)}/comments`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    },
  );
}

export async function fetchPendingApprovals(): Promise<
  Array<{ approval: Approval; production: Production | null }>
> {
  const data = await apiFetch<{ items: Array<{ approval: Approval; production: Production | null }> }>(
    '/church/approvals',
  );
  return data.items;
}

export async function decideApproval(
  id: string,
  decision: 'aprobado' | 'cambios',
  comment?: string,
): Promise<{ approval: Approval; production: Production | null }> {
  return apiFetch(`/church/approvals/${encodeURIComponent(id)}/decide`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision, ...(comment ? { comment } : {}) }),
  });
}

// --- Publish targets & calendar --------------------------------------------

export async function fetchTargets(): Promise<{
  items: PublishTarget[];
  autoCapablePlatforms: PublishPlatform[];
}> {
  return apiFetch('/church/targets');
}

export async function createTarget(input: {
  platform: PublishPlatform;
  displayName: string;
  mode?: PublishMode;
  renderPreset?: RenderPreset;
  credentialsRef?: string;
}): Promise<PublishTarget> {
  return apiFetch<PublishTarget>('/church/targets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function updateTarget(
  id: string,
  input: Partial<{
    displayName: string;
    mode: PublishMode;
    renderPreset: RenderPreset;
    credentialsRef: string;
    isActive: boolean;
  }>,
): Promise<PublishTarget> {
  return apiFetch<PublishTarget>(`/church/targets/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function deleteTarget(id: string): Promise<{ ok: boolean }> {
  return apiFetch(`/church/targets/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function fetchCalendar(range?: {
  from?: string;
  to?: string;
}): Promise<Array<{ entry: CalendarEntry; production: Production | null }>> {
  const params = new URLSearchParams();
  if (range?.from) params.set('from', range.from);
  if (range?.to) params.set('to', range.to);
  const qs = params.toString();
  const data = await apiFetch<{
    items: Array<{ entry: CalendarEntry; production: Production | null }>;
  }>(`/church/calendar${qs ? `?${qs}` : ''}`);
  return data.items;
}

export async function scheduleEntries(input: {
  targetIds: string[];
  productionId?: string;
  liveEventId?: string;
  scheduledFor: string;
}): Promise<CalendarEntry[]> {
  const data = await apiFetch<{ items: CalendarEntry[] }>('/church/calendar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return data.items;
}

export async function updateCalendarEntry(
  id: string,
  input: { scheduledFor?: string; status?: CalendarEntry['status'] },
): Promise<CalendarEntry> {
  return apiFetch<CalendarEntry>(`/church/calendar/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function deleteCalendarEntry(id: string): Promise<{ ok: boolean }> {
  return apiFetch(`/church/calendar/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

// --- Live -------------------------------------------------------------------

export async function fetchLiveEvents(query: { status?: string; from?: string } = {}): Promise<
  LiveEvent[]
> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value) params.set(key, String(value));
  }
  const qs = params.toString();
  const data = await apiFetch<{ items: LiveEvent[] }>(`/church/live-events${qs ? `?${qs}` : ''}`);
  return data.items;
}

export async function createLiveEvent(input: {
  title: string;
  scheduledAt: string;
  targetIds?: string[];
  crew?: LiveCrewAssignment[];
  checklist?: string[];
  obsProfile?: string;
}): Promise<LiveEvent> {
  return apiFetch<LiveEvent>('/church/live-events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function updateLiveEvent(
  id: string,
  input: Partial<{
    title: string;
    scheduledAt: string;
    status: LiveEvent['status'];
    targetIds: string[];
    crew: LiveCrewAssignment[];
    obsProfile: string;
    recordingAssetId: string;
  }>,
): Promise<LiveEvent> {
  return apiFetch<LiveEvent>(`/church/live-events/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function deleteLiveEvent(id: string): Promise<{ ok: boolean }> {
  return apiFetch(`/church/live-events/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function toggleChecklistItem(
  eventId: string,
  itemId: string,
  done: boolean,
): Promise<LiveEvent> {
  return apiFetch<LiveEvent>(
    `/church/live-events/${encodeURIComponent(eventId)}/checklist/${encodeURIComponent(itemId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done }),
    },
  );
}

export async function addIncident(
  eventId: string,
  note: string,
  severity: 'info' | 'warning' | 'error' = 'info',
): Promise<LiveEvent> {
  return apiFetch<LiveEvent>(`/church/live-events/${encodeURIComponent(eventId)}/incidents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ note, severity }),
  });
}

export type { Asset, ChecklistItem, LiveEvent, Production, PublishTarget };
