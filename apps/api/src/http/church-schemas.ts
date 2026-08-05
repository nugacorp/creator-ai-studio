/**
 * JSON Schemas for the church platform routes.
 *
 * Fastify validates against these before a handler runs, so route code can
 * trust shapes and only worry about authorization and business rules.
 */

const UUID = { type: 'string', format: 'uuid' } as const;
const SHORT = { type: 'string', maxLength: 300 } as const;
const MEDIUM = { type: 'string', maxLength: 5_000 } as const;
const LONG = { type: 'string', maxLength: 200_000 } as const;
const ISO_DATE = { type: 'string', maxLength: 40 } as const;

const ROLE = { type: 'string', enum: ['admin', 'lider', 'productor', 'disenador', 'voluntario'] } as const;
const ASSET_KIND = { type: 'string', enum: ['video', 'audio', 'image', 'document', 'template'] } as const;
const PRODUCTION_FORMAT = {
  type: 'string',
  enum: ['sermon', 'clip', 'reel', 'anuncio', 'testimonio', 'devocional'],
} as const;
const PRODUCTION_STATUS = {
  type: 'string',
  enum: ['idea', 'grabacion', 'edicion', 'revision', 'aprobado', 'publicado'],
} as const;
const PLATFORM = {
  type: 'string',
  enum: ['youtube', 'facebook', 'instagram', 'tiktok', 'x'],
} as const;
const RENDER_PRESET = {
  type: 'string',
  enum: ['16:9-1080p', '9:16-1080x1920', '1:1-1080'],
} as const;
const TAGS = { type: 'array', maxItems: 30, items: { type: 'string', maxLength: 60 } } as const;
const UUID_LIST = { type: 'array', maxItems: 100, items: UUID } as const;

export const createChurchBody = {
  type: 'object',
  required: ['name'],
  properties: {
    name: { type: 'string', minLength: 2, maxLength: 160 },
    slug: { type: 'string', maxLength: 80, pattern: '^[a-z0-9-]+$' },
    timezone: SHORT,
    locale: SHORT,
  },
  additionalProperties: false,
} as const;

export const updateChurchBody = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 2, maxLength: 160 },
    timezone: SHORT,
    locale: SHORT,
  },
  additionalProperties: false,
} as const;

export const createMinistryBody = {
  type: 'object',
  required: ['name'],
  properties: {
    churchId: UUID,
    name: { type: 'string', minLength: 2, maxLength: 120 },
    slug: { type: 'string', maxLength: 80, pattern: '^[a-z0-9-]+$' },
    description: MEDIUM,
    leadUserId: UUID,
  },
  additionalProperties: false,
} as const;

export const updateMinistryBody = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 2, maxLength: 120 },
    description: MEDIUM,
    leadUserId: UUID,
    isActive: { type: 'boolean' },
  },
  additionalProperties: false,
} as const;

export const upsertMemberBody = {
  type: 'object',
  required: ['userId', 'role'],
  properties: {
    churchId: UUID,
    userId: UUID,
    role: ROLE,
    title: SHORT,
    status: { type: 'string', enum: ['active', 'invited', 'suspended'] },
  },
  additionalProperties: false,
} as const;

export const updateMemberBody = {
  type: 'object',
  properties: {
    role: ROLE,
    title: SHORT,
    status: { type: 'string', enum: ['active', 'invited', 'suspended'] },
  },
  additionalProperties: false,
} as const;

export const createAssetMetadataBody = {
  type: 'object',
  properties: {
    churchId: UUID,
    ministryId: UUID,
    name: { type: 'string', maxLength: 220 },
    kind: ASSET_KIND,
    series: SHORT,
    preacher: SHORT,
    bibleRef: SHORT,
    tags: TAGS,
    serviceDate: ISO_DATE,
  },
  additionalProperties: false,
} as const;

export const updateAssetBody = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 220 },
    kind: ASSET_KIND,
    ministryId: UUID,
    series: SHORT,
    preacher: SHORT,
    bibleRef: SHORT,
    tags: TAGS,
    serviceDate: ISO_DATE,
  },
  additionalProperties: false,
} as const;

export const createProductionBody = {
  type: 'object',
  required: ['title', 'format'],
  properties: {
    churchId: UUID,
    ministryId: UUID,
    title: { type: 'string', minLength: 1, maxLength: 220 },
    format: PRODUCTION_FORMAT,
    summary: MEDIUM,
    serviceDate: ISO_DATE,
    preacher: SHORT,
    bibleRef: SHORT,
    assignedTo: UUID_LIST,
    sourceAssetIds: UUID_LIST,
    legacyEpisodeId: SHORT,
  },
  additionalProperties: false,
} as const;

export const updateProductionBody = {
  type: 'object',
  properties: {
    title: { type: 'string', minLength: 1, maxLength: 220 },
    ministryId: UUID,
    summary: MEDIUM,
    script: LONG,
    serviceDate: ISO_DATE,
    preacher: SHORT,
    bibleRef: SHORT,
    assignedTo: UUID_LIST,
    sourceAssetIds: UUID_LIST,
  },
  additionalProperties: false,
} as const;

export const updateProductionStatusBody = {
  type: 'object',
  required: ['status'],
  properties: {
    status: PRODUCTION_STATUS,
    comment: MEDIUM,
  },
  additionalProperties: false,
} as const;

export const createCommentBody = {
  type: 'object',
  required: ['body'],
  properties: {
    body: { type: 'string', minLength: 1, maxLength: 4_000 },
  },
  additionalProperties: false,
} as const;

export const decideApprovalBody = {
  type: 'object',
  required: ['decision'],
  properties: {
    decision: { type: 'string', enum: ['aprobado', 'cambios'] },
    comment: MEDIUM,
  },
  additionalProperties: false,
} as const;

export const createPublishTargetBody = {
  type: 'object',
  required: ['platform', 'displayName'],
  properties: {
    churchId: UUID,
    platform: PLATFORM,
    displayName: { type: 'string', minLength: 1, maxLength: 160 },
    mode: { type: 'string', enum: ['auto', 'assisted'] },
    credentialsRef: SHORT,
    renderPreset: RENDER_PRESET,
  },
  additionalProperties: false,
} as const;

export const updatePublishTargetBody = {
  type: 'object',
  properties: {
    displayName: { type: 'string', minLength: 1, maxLength: 160 },
    mode: { type: 'string', enum: ['auto', 'assisted'] },
    credentialsRef: SHORT,
    renderPreset: RENDER_PRESET,
    isActive: { type: 'boolean' },
  },
  additionalProperties: false,
} as const;

export const scheduleEntryBody = {
  type: 'object',
  required: ['targetIds', 'scheduledFor'],
  properties: {
    churchId: UUID,
    targetIds: { type: 'array', minItems: 1, maxItems: 10, items: UUID },
    productionId: UUID,
    liveEventId: UUID,
    scheduledFor: { type: 'string', minLength: 4, maxLength: 40 },
  },
  additionalProperties: false,
} as const;

export const updateCalendarEntryBody = {
  type: 'object',
  properties: {
    scheduledFor: { type: 'string', minLength: 4, maxLength: 40 },
    status: { type: 'string', enum: ['programado', 'publicando', 'publicado', 'fallido'] },
  },
  additionalProperties: false,
} as const;

export const createLiveEventBody = {
  type: 'object',
  required: ['title', 'scheduledAt'],
  properties: {
    churchId: UUID,
    title: { type: 'string', minLength: 1, maxLength: 200 },
    scheduledAt: { type: 'string', minLength: 4, maxLength: 40 },
    targetIds: UUID_LIST,
    crew: {
      type: 'array',
      maxItems: 20,
      items: {
        type: 'object',
        required: ['userId', 'role'],
        properties: {
          userId: UUID,
          role: { type: 'string', enum: ['switcher', 'audio', 'camara', 'chat', 'grafica'] },
        },
        additionalProperties: false,
      },
    },
    checklist: { type: 'array', maxItems: 40, items: { type: 'string', maxLength: 200 } },
    obsProfile: SHORT,
  },
  additionalProperties: false,
} as const;

export const updateLiveEventBody = {
  type: 'object',
  properties: {
    title: { type: 'string', minLength: 1, maxLength: 200 },
    scheduledAt: { type: 'string', minLength: 4, maxLength: 40 },
    status: { type: 'string', enum: ['planeado', 'preflight', 'en_vivo', 'finalizado'] },
    targetIds: UUID_LIST,
    obsProfile: SHORT,
    recordingAssetId: UUID,
    crew: createLiveEventBody.properties.crew,
  },
  additionalProperties: false,
} as const;

export const toggleChecklistItemBody = {
  type: 'object',
  required: ['done'],
  properties: {
    done: { type: 'boolean' },
  },
  additionalProperties: false,
} as const;

export const addIncidentBody = {
  type: 'object',
  required: ['note'],
  properties: {
    note: { type: 'string', minLength: 1, maxLength: 1_000 },
    severity: { type: 'string', enum: ['info', 'warning', 'error'] },
  },
  additionalProperties: false,
} as const;
