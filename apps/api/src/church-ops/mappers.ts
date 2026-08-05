/**
 * Row <-> domain mapping for the church platform.
 *
 * Postgres speaks snake_case and the shared types speak camelCase. Doing the
 * translation in one place keeps the routes free of `row.service_date` noise
 * and gives a single spot to audit when a column changes.
 */

import type {
  Approval,
  Asset,
  AssetVersion,
  CalendarEntry,
  Church,
  ChurchMember,
  LiveEvent,
  Ministry,
  Production,
  ProductionComment,
  PublishTarget,
} from '@creator-ai-studio/shared';

/** Drop `undefined` values so PATCH payloads only carry what changed. */
export function compact<T extends Record<string, unknown>>(input: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) out[key] = value;
  }
  return out as Partial<T>;
}

function optional(value: string | null | undefined): string | undefined {
  return value ?? undefined;
}

export interface ChurchRow {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  locale: string;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export function toChurch(row: ChurchRow): Church {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    timezone: row.timezone,
    locale: row.locale,
    createdByUserId: optional(row.created_by_user_id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface ChurchMemberRow {
  id: string;
  church_id: string;
  user_id: string;
  role: ChurchMember['role'];
  status: ChurchMember['status'];
  title: string | null;
  created_at: string;
  updated_at: string;
  /** Present when the query embeds `profiles(...)`. */
  profiles?: { display_name: string | null; email: string | null } | null;
}

export function toChurchMember(row: ChurchMemberRow): ChurchMember {
  return {
    id: row.id,
    churchId: row.church_id,
    userId: row.user_id,
    role: row.role,
    status: row.status,
    title: optional(row.title),
    displayName: optional(row.profiles?.display_name),
    email: optional(row.profiles?.email),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface MinistryRow {
  id: string;
  church_id: string;
  name: string;
  slug: string;
  description: string | null;
  lead_user_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function toMinistry(row: MinistryRow): Ministry {
  return {
    id: row.id,
    churchId: row.church_id,
    name: row.name,
    slug: row.slug,
    description: optional(row.description),
    leadUserId: optional(row.lead_user_id),
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface AssetRow {
  id: string;
  church_id: string;
  ministry_id: string | null;
  name: string;
  kind: Asset['kind'];
  storage_path: string;
  mime_type: string;
  size_bytes: number | string;
  thumbnail_path: string | null;
  current_version: number;
  versions: AssetVersion[] | null;
  series: string | null;
  preacher: string | null;
  bible_ref: string | null;
  tags: string[] | null;
  service_date: string | null;
  uploaded_by: string | null;
  archived_at: string | null;
  drive_id: string | null;
  created_at: string;
  updated_at: string;
}

export function toAsset(row: AssetRow): Asset {
  return {
    id: row.id,
    churchId: row.church_id,
    ministryId: optional(row.ministry_id),
    name: row.name,
    kind: row.kind,
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    // bigint arrives as a string over PostgREST.
    sizeBytes: Number(row.size_bytes ?? 0),
    thumbnailPath: optional(row.thumbnail_path),
    currentVersion: row.current_version,
    versions: row.versions ?? [],
    series: optional(row.series),
    preacher: optional(row.preacher),
    bibleRef: optional(row.bible_ref),
    tags: row.tags ?? [],
    serviceDate: optional(row.service_date),
    uploadedBy: optional(row.uploaded_by),
    archivedAt: optional(row.archived_at),
    driveId: optional(row.drive_id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface ProductionRow {
  id: string;
  church_id: string;
  ministry_id: string | null;
  title: string;
  format: Production['format'];
  status: Production['status'];
  summary: string | null;
  script: string | null;
  service_date: string | null;
  preacher: string | null;
  bible_ref: string | null;
  assigned_to: string[] | null;
  source_asset_ids: string[] | null;
  legacy_episode_id: string | null;
  created_by: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export function toProduction(row: ProductionRow): Production {
  return {
    id: row.id,
    churchId: row.church_id,
    ministryId: optional(row.ministry_id),
    title: row.title,
    format: row.format,
    status: row.status,
    summary: optional(row.summary),
    script: optional(row.script),
    serviceDate: optional(row.service_date),
    preacher: optional(row.preacher),
    bibleRef: optional(row.bible_ref),
    assignedTo: row.assigned_to ?? [],
    sourceAssetIds: row.source_asset_ids ?? [],
    legacyEpisodeId: optional(row.legacy_episode_id),
    createdBy: optional(row.created_by),
    publishedAt: optional(row.published_at),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface ProductionCommentRow {
  id: string;
  church_id: string;
  production_id: string;
  author_user_id: string | null;
  body: string;
  created_at: string;
}

export function toProductionComment(row: ProductionCommentRow): ProductionComment {
  return {
    id: row.id,
    churchId: row.church_id,
    productionId: row.production_id,
    authorUserId: optional(row.author_user_id),
    body: row.body,
    createdAt: row.created_at,
  };
}

export interface ApprovalRow {
  id: string;
  church_id: string;
  production_id: string;
  requested_by: string | null;
  decided_by: string | null;
  decision: Approval['decision'] | null;
  comment: string | null;
  created_at: string;
  decided_at: string | null;
}

export function toApproval(row: ApprovalRow): Approval {
  return {
    id: row.id,
    churchId: row.church_id,
    productionId: row.production_id,
    requestedBy: optional(row.requested_by),
    decidedBy: optional(row.decided_by),
    decision: row.decision ?? undefined,
    comment: optional(row.comment),
    createdAt: row.created_at,
    decidedAt: optional(row.decided_at),
  };
}

export interface PublishTargetRow {
  id: string;
  church_id: string;
  platform: PublishTarget['platform'];
  display_name: string;
  mode: PublishTarget['mode'];
  credentials_ref: string | null;
  render_preset: PublishTarget['renderPreset'];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function toPublishTarget(row: PublishTargetRow): PublishTarget {
  return {
    id: row.id,
    churchId: row.church_id,
    platform: row.platform,
    displayName: row.display_name,
    mode: row.mode,
    credentialsRef: optional(row.credentials_ref),
    renderPreset: row.render_preset,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface LiveEventRow {
  id: string;
  church_id: string;
  title: string;
  scheduled_at: string;
  status: LiveEvent['status'];
  target_ids: string[] | null;
  crew: LiveEvent['crew'] | null;
  checklist: LiveEvent['checklist'] | null;
  obs_profile: string | null;
  incidents: LiveEvent['incidents'] | null;
  recording_asset_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function toLiveEvent(row: LiveEventRow): LiveEvent {
  return {
    id: row.id,
    churchId: row.church_id,
    title: row.title,
    scheduledAt: row.scheduled_at,
    status: row.status,
    targetIds: row.target_ids ?? [],
    crew: row.crew ?? [],
    checklist: row.checklist ?? [],
    obsProfile: optional(row.obs_profile),
    incidents: row.incidents ?? [],
    recordingAssetId: optional(row.recording_asset_id),
    createdBy: optional(row.created_by),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface CalendarEntryRow {
  id: string;
  church_id: string;
  production_id: string | null;
  live_event_id: string | null;
  target_id: string;
  scheduled_for: string;
  status: CalendarEntry['status'];
  attempts: number;
  last_error: string | null;
  external_url: string | null;
  published_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function toCalendarEntry(row: CalendarEntryRow): CalendarEntry {
  return {
    id: row.id,
    churchId: row.church_id,
    productionId: optional(row.production_id),
    liveEventId: optional(row.live_event_id),
    targetId: row.target_id,
    scheduledFor: row.scheduled_for,
    status: row.status,
    attempts: row.attempts,
    lastError: optional(row.last_error),
    externalUrl: optional(row.external_url),
    publishedAt: optional(row.published_at),
    createdBy: optional(row.created_by),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
