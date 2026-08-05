/**
 * Church digital team domain — shared contracts.
 *
 * Source of truth for the permission matrix defined in
 * docs/03-product/PLAN_TECNICO_PLATAFORMA_IGLESIA.md §4. The API enforces it
 * (`apps/api/src/auth/rbac.ts`) and the web app mirrors it to hide affordances.
 * Hiding a button is not security; the API check is the primary defense.
 */

/** The five operational roles. Deliberately few — the team is five people. */
export const CHURCH_ROLES = ['admin', 'lider', 'productor', 'disenador', 'voluntario'] as const;

export type ChurchRole = (typeof CHURCH_ROLES)[number];

export function isChurchRole(value: unknown): value is ChurchRole {
  return typeof value === 'string' && (CHURCH_ROLES as readonly string[]).includes(value);
}

/** Human labels used across the UI (Spanish, matching the team's vocabulary). */
export const CHURCH_ROLE_LABELS: Record<ChurchRole, string> = {
  admin: 'Administrador',
  lider: 'Líder',
  productor: 'Productor',
  disenador: 'Diseñador',
  voluntario: 'Voluntario',
};

export const CHURCH_ROLE_DESCRIPTIONS: Record<ChurchRole, string> = {
  admin: 'Control total, incluidas credenciales y borrado definitivo.',
  lider: 'Aprueba y publica. Ve todo, no toca credenciales.',
  productor: 'Crea y edita producciones, sube material y lanza renders.',
  disenador: 'Sube y edita imágenes, miniaturas y artes.',
  voluntario: 'Ve el trabajo del equipo, comenta y sube material crudo.',
};

/** Legacy workspace roles (`team.json`) mapped onto the church model. */
export const LEGACY_TEAM_ROLE_TO_CHURCH_ROLE = {
  owner: 'admin',
  editor: 'productor',
  viewer: 'voluntario',
} as const satisfies Record<string, ChurchRole>;

/**
 * Every permission the API can require. One row of §4's matrix each.
 * Names are `<recurso>.<acción>` so a route reads like a sentence.
 */
export const CHURCH_PERMISSIONS = [
  'library.view',
  'asset.upload',
  'asset.delete',
  'production.create',
  'production.edit_script',
  'production.upload_art',
  'production.render',
  'production.approve',
  'production.publish',
  'live.control',
  'team.manage',
  'credentials.manage',
  'comment.write',
] as const;

export type ChurchPermission = (typeof CHURCH_PERMISSIONS)[number];

export function isChurchPermission(value: unknown): value is ChurchPermission {
  return typeof value === 'string' && (CHURCH_PERMISSIONS as readonly string[]).includes(value);
}

/**
 * The permission matrix, transcribed from §4 of the plan.
 * Changing a cell here changes the API's behavior — there is no second copy.
 */
export const CHURCH_PERMISSION_MATRIX: Record<ChurchPermission, readonly ChurchRole[]> = {
  'library.view': ['admin', 'lider', 'productor', 'disenador', 'voluntario'],
  'asset.upload': ['admin', 'lider', 'productor', 'disenador', 'voluntario'],
  'asset.delete': ['admin'],
  'production.create': ['admin', 'lider', 'productor'],
  'production.edit_script': ['admin', 'lider', 'productor'],
  'production.upload_art': ['admin', 'lider', 'productor', 'disenador'],
  'production.render': ['admin', 'lider', 'productor'],
  'production.approve': ['admin', 'lider'],
  'production.publish': ['admin', 'lider'],
  'live.control': ['admin', 'lider', 'productor'],
  'team.manage': ['admin'],
  'credentials.manage': ['admin'],
  'comment.write': ['admin', 'lider', 'productor', 'disenador', 'voluntario'],
};

/** Whether `role` satisfies `permission`. The single decision function. */
export function roleCan(role: ChurchRole | undefined | null, permission: ChurchPermission): boolean {
  if (!role) return false;
  return CHURCH_PERMISSION_MATRIX[permission].includes(role);
}

/** All permissions granted to a role — used to ship a compact set to the web app. */
export function permissionsForRole(role: ChurchRole): ChurchPermission[] {
  return CHURCH_PERMISSIONS.filter(permission => roleCan(role, permission));
}

// ---------------------------------------------------------------------------
// Entities
// ---------------------------------------------------------------------------

export interface Church {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  locale: string;
  createdByUserId?: string;
  createdAt: string;
  updatedAt: string;
}

export const CHURCH_MEMBER_STATUSES = ['active', 'invited', 'suspended'] as const;
export type ChurchMemberStatus = (typeof CHURCH_MEMBER_STATUSES)[number];

export interface ChurchMember {
  id: string;
  churchId: string;
  userId: string;
  role: ChurchRole;
  status: ChurchMemberStatus;
  displayName?: string;
  email?: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Ministry {
  id: string;
  churchId: string;
  name: string;
  slug: string;
  description?: string;
  leadUserId?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// --- Assets (DAM) ----------------------------------------------------------

export const ASSET_KINDS = ['video', 'audio', 'image', 'document', 'template'] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];

export function isAssetKind(value: unknown): value is AssetKind {
  return typeof value === 'string' && (ASSET_KINDS as readonly string[]).includes(value);
}

export interface AssetVersion {
  version: number;
  storagePath: string;
  sizeBytes: number;
  mimeType: string;
  originalFileName: string;
  uploadedBy?: string;
  uploadedAt: string;
}

export interface Asset {
  id: string;
  churchId: string;
  ministryId?: string;
  name: string;
  kind: AssetKind;
  /** Relative to the data volume — never an absolute host path. */
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  thumbnailPath?: string;
  currentVersion: number;
  versions: AssetVersion[];
  series?: string;
  preacher?: string;
  bibleRef?: string;
  tags: string[];
  serviceDate?: string;
  uploadedBy?: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  driveId?: string;
}

// --- Productions -----------------------------------------------------------

export const PRODUCTION_FORMATS = [
  'sermon',
  'clip',
  'reel',
  'anuncio',
  'testimonio',
  'devocional',
] as const;
export type ProductionFormat = (typeof PRODUCTION_FORMATS)[number];

export function isProductionFormat(value: unknown): value is ProductionFormat {
  return typeof value === 'string' && (PRODUCTION_FORMATS as readonly string[]).includes(value);
}

export const PRODUCTION_STATUSES = [
  'idea',
  'grabacion',
  'edicion',
  'revision',
  'aprobado',
  'publicado',
] as const;
export type ProductionStatus = (typeof PRODUCTION_STATUSES)[number];

export function isProductionStatus(value: unknown): value is ProductionStatus {
  return typeof value === 'string' && (PRODUCTION_STATUSES as readonly string[]).includes(value);
}

export const PRODUCTION_STATUS_LABELS: Record<ProductionStatus, string> = {
  idea: 'Idea',
  grabacion: 'Grabación',
  edicion: 'Edición',
  revision: 'Revisión',
  aprobado: 'Aprobado',
  publicado: 'Publicado',
};

export const PRODUCTION_FORMAT_LABELS: Record<ProductionFormat, string> = {
  sermon: 'Sermón',
  clip: 'Clip',
  reel: 'Reel',
  anuncio: 'Anuncio',
  testimonio: 'Testimonio',
  devocional: 'Devocional',
};

/**
 * Allowed status moves. `aprobado` is only reachable through `revision`, which
 * is what stops a productor from publishing without a líder's approval.
 */
export const PRODUCTION_STATUS_FLOW: Record<ProductionStatus, readonly ProductionStatus[]> = {
  idea: ['grabacion'],
  grabacion: ['idea', 'edicion'],
  edicion: ['grabacion', 'revision'],
  revision: ['edicion', 'aprobado'],
  aprobado: ['revision', 'publicado'],
  publicado: [],
};

export function canTransitionProduction(from: ProductionStatus, to: ProductionStatus): boolean {
  return PRODUCTION_STATUS_FLOW[from].includes(to);
}

/**
 * Status changes that need a permission beyond `production.edit_script`.
 * Entering `aprobado` is an approval; entering `publicado` is a publication.
 */
export const PRODUCTION_STATUS_PERMISSION: Partial<Record<ProductionStatus, ChurchPermission>> = {
  aprobado: 'production.approve',
  publicado: 'production.publish',
};

/** Stages preloaded per format — a reel does not need a research stage. */
export const PRODUCTION_FORMAT_STAGES: Record<ProductionFormat, readonly ProductionStatus[]> = {
  sermon: ['idea', 'grabacion', 'edicion', 'revision', 'aprobado', 'publicado'],
  clip: ['idea', 'edicion', 'revision', 'aprobado', 'publicado'],
  reel: ['idea', 'edicion', 'aprobado', 'publicado'],
  anuncio: ['idea', 'edicion', 'revision', 'aprobado', 'publicado'],
  testimonio: ['idea', 'grabacion', 'edicion', 'revision', 'aprobado', 'publicado'],
  devocional: ['idea', 'grabacion', 'edicion', 'aprobado', 'publicado'],
};

export interface Production {
  id: string;
  churchId: string;
  ministryId?: string;
  title: string;
  format: ProductionFormat;
  status: ProductionStatus;
  summary?: string;
  script?: string;
  serviceDate?: string;
  preacher?: string;
  bibleRef?: string;
  assignedTo: string[];
  sourceAssetIds: string[];
  legacyEpisodeId?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

export const APPROVAL_DECISIONS = ['aprobado', 'cambios'] as const;
export type ApprovalDecision = (typeof APPROVAL_DECISIONS)[number];

export interface Approval {
  id: string;
  churchId: string;
  productionId: string;
  requestedBy?: string;
  decidedBy?: string;
  decision?: ApprovalDecision;
  comment?: string;
  createdAt: string;
  decidedAt?: string;
}

export interface ProductionComment {
  id: string;
  churchId: string;
  productionId: string;
  authorUserId?: string;
  body: string;
  createdAt: string;
}

// --- Publishing ------------------------------------------------------------

export const PUBLISH_PLATFORMS = ['youtube', 'facebook', 'instagram', 'tiktok', 'x'] as const;
export type PublishPlatform = (typeof PUBLISH_PLATFORMS)[number];

export function isPublishPlatform(value: unknown): value is PublishPlatform {
  return typeof value === 'string' && (PUBLISH_PLATFORMS as readonly string[]).includes(value);
}

/**
 * `auto` publishes through an API. `assisted` builds the ready-to-post package
 * and notifies a human — the honest mode for Instagram and TikTok (see AD-3).
 */
export type PublishMode = 'auto' | 'assisted';

/** Platforms that can genuinely publish unattended today. */
export const AUTO_CAPABLE_PLATFORMS: readonly PublishPlatform[] = ['youtube', 'facebook'];

export const RENDER_PRESETS = ['16:9-1080p', '9:16-1080x1920', '1:1-1080'] as const;
export type RenderPreset = (typeof RENDER_PRESETS)[number];

export const PLATFORM_DEFAULT_PRESET: Record<PublishPlatform, RenderPreset> = {
  youtube: '16:9-1080p',
  facebook: '16:9-1080p',
  instagram: '1:1-1080',
  tiktok: '9:16-1080x1920',
  x: '16:9-1080p',
};

export interface PublishTarget {
  id: string;
  churchId: string;
  platform: PublishPlatform;
  displayName: string;
  mode: PublishMode;
  credentialsRef?: string;
  renderPreset: RenderPreset;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const CALENDAR_ENTRY_STATUSES = [
  'programado',
  'publicando',
  'publicado',
  'fallido',
] as const;
export type CalendarEntryStatus = (typeof CALENDAR_ENTRY_STATUSES)[number];

export interface CalendarEntry {
  id: string;
  churchId: string;
  productionId?: string;
  liveEventId?: string;
  targetId: string;
  /** Instant in UTC; the UI renders it in the church's timezone. */
  scheduledFor: string;
  status: CalendarEntryStatus;
  attempts: number;
  lastError?: string;
  externalUrl?: string;
  publishedAt?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

// --- Live ------------------------------------------------------------------

export const LIVE_EVENT_STATUSES = ['planeado', 'preflight', 'en_vivo', 'finalizado'] as const;
export type LiveEventStatus = (typeof LIVE_EVENT_STATUSES)[number];

export const LIVE_CREW_ROLES = ['switcher', 'audio', 'camara', 'chat', 'grafica'] as const;
export type LiveCrewRole = (typeof LIVE_CREW_ROLES)[number];

export const LIVE_CREW_ROLE_LABELS: Record<LiveCrewRole, string> = {
  switcher: 'Switcher',
  audio: 'Audio',
  camara: 'Cámara',
  chat: 'Chat',
  grafica: 'Gráfica',
};

export interface LiveCrewAssignment {
  userId: string;
  role: LiveCrewRole;
}

export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
  checkedBy?: string;
  checkedAt?: string;
}

export interface LiveIncident {
  id: string;
  at: string;
  severity: 'info' | 'warning' | 'error';
  note: string;
  reportedBy?: string;
}

export interface LiveEvent {
  id: string;
  churchId: string;
  title: string;
  scheduledAt: string;
  status: LiveEventStatus;
  targetIds: string[];
  crew: LiveCrewAssignment[];
  checklist: ChecklistItem[];
  obsProfile?: string;
  incidents: LiveIncident[];
  recordingAssetId?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

/** Default preflight checklist seeded on every new live event. */
export const DEFAULT_PREFLIGHT_CHECKLIST: readonly string[] = [
  'Cámaras encendidas y encuadradas',
  'Audio de consola llegando a OBS',
  'Escena de bienvenida cargada',
  'Letra / gráficas del día cargadas',
  'Conexión a internet verificada',
  'Grabación local activada',
];

// --- Inputs ----------------------------------------------------------------

export interface CreateAssetInput {
  churchId: string;
  ministryId?: string;
  name: string;
  kind: AssetKind;
  series?: string;
  preacher?: string;
  bibleRef?: string;
  tags?: string[];
  serviceDate?: string;
}

export interface UpdateAssetInput {
  name?: string;
  kind?: AssetKind;
  ministryId?: string;
  series?: string;
  preacher?: string;
  bibleRef?: string;
  tags?: string[];
  serviceDate?: string;
}

export interface AssetSearchFilters {
  churchId?: string;
  ministryId?: string;
  kind?: AssetKind;
  series?: string;
  preacher?: string;
  bibleRef?: string;
  tag?: string;
  from?: string;
  to?: string;
  search?: string;
  limit?: number;
}

export interface CreateProductionInput {
  churchId: string;
  ministryId?: string;
  title: string;
  format: ProductionFormat;
  summary?: string;
  serviceDate?: string;
  preacher?: string;
  bibleRef?: string;
  assignedTo?: string[];
  sourceAssetIds?: string[];
  legacyEpisodeId?: string;
}

export interface UpdateProductionInput {
  title?: string;
  ministryId?: string;
  summary?: string;
  script?: string;
  serviceDate?: string;
  preacher?: string;
  bibleRef?: string;
  assignedTo?: string[];
  sourceAssetIds?: string[];
}

export interface CreateLiveEventInput {
  churchId: string;
  title: string;
  scheduledAt: string;
  targetIds?: string[];
  crew?: LiveCrewAssignment[];
  checklist?: string[];
  obsProfile?: string;
}

export interface CreatePublishTargetInput {
  churchId: string;
  platform: PublishPlatform;
  displayName: string;
  mode?: PublishMode;
  credentialsRef?: string;
  renderPreset?: RenderPreset;
}

export interface ScheduleCalendarEntryInput {
  churchId: string;
  targetIds: string[];
  productionId?: string;
  liveEventId?: string;
  scheduledFor: string;
}

/** What `GET /api/church/me` returns — the web app's authorization source. */
export interface ChurchSession {
  church: Church | null;
  member: ChurchMember | null;
  role: ChurchRole | null;
  permissions: ChurchPermission[];
  memberships: Array<{ church: Church; role: ChurchRole }>;
}
