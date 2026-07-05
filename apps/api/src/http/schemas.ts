/**
 * JSON Schemas (Fastify/Ajv) for mutating routes.
 * Centralized so route files stay readable and limits stay consistent.
 */

const TEXT_SHORT = { type: 'string', maxLength: 300 } as const;
const TEXT_MEDIUM = { type: 'string', maxLength: 5_000 } as const;
const TEXT_LONG = { type: 'string', maxLength: 100_000 } as const;

export const createEpisodeBody = {
  type: 'object',
  required: ['title'],
  properties: {
    title: { type: 'string', minLength: 1, maxLength: 200 },
    channelId: TEXT_SHORT,
  },
  additionalProperties: false,
} as const;

export const createIdeaBody = {
  type: 'object',
  required: ['rawIdea'],
  properties: {
    rawIdea: { type: 'string', minLength: 1, maxLength: 500 },
    audience: { type: 'string', maxLength: 200 },
    passage: { type: 'string', maxLength: 300 },
    channelId: TEXT_SHORT,
  },
  additionalProperties: false,
} as const;

export const updateEpisodeBody = {
  type: 'object',
  properties: {
    title: { type: 'string', minLength: 1, maxLength: 200 },
    status: TEXT_SHORT,
    content: { type: 'object' },
  },
  additionalProperties: false,
} as const;

export const updateEpisodeStatusBody = {
  type: 'object',
  required: ['projectStatus'],
  properties: {
    projectStatus: TEXT_SHORT,
  },
  additionalProperties: false,
} as const;

export const updateStageBody = {
  type: 'object',
  required: ['status'],
  properties: {
    status: TEXT_SHORT,
  },
  additionalProperties: false,
} as const;

const agentOverrideFields = {
  customNotes: TEXT_MEDIUM,
  extraSkills: {
    type: 'array',
    maxItems: 50,
    items: { type: 'string', maxLength: 200 },
  },
  promptAppend: TEXT_MEDIUM,
} as const;

export const settingsBody = {
  type: 'object',
  properties: {
    ttsSampleRate: TEXT_SHORT,
    ttsAccent: TEXT_SHORT,
    aiProviderDefault: { type: 'string', enum: ['gemini', 'openai', 'claude', 'demo'] },
    // Must match the shared TtsProvider union ('elevenlabs' | 'piper' | 'gemini');
    // the SettingsView exposes a "Gemini (experimental)" option and dropping it
    // here would 400 a valid settings save.
    ttsProvider: { type: 'string', enum: ['elevenlabs', 'piper', 'gemini'] },
    autoArchiveOnPublish: { type: 'boolean' },
    maxActiveEpisodes: { type: 'integer', minimum: 1, maximum: 50 },
    diskWarningThresholdGb: { type: 'number', minimum: 1, maximum: 10_000 },
    agentOverrides: { type: 'object', additionalProperties: true },
    activeChannelId: TEXT_SHORT,
    channelProfiles: { type: 'object', additionalProperties: true },
  },
  additionalProperties: false,
} as const;

export const agentOverrideBody = {
  type: 'object',
  properties: agentOverrideFields,
  additionalProperties: false,
} as const;

export const channelBody = {
  type: 'object',
  required: ['name', 'type'],
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 200 },
    type: { type: 'string', minLength: 1, maxLength: 100 },
    status: TEXT_SHORT,
    subscribers: { type: 'integer', minimum: 0 },
    avatar: TEXT_MEDIUM,
  },
  additionalProperties: false,
} as const;

export const channelPatchBody = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 200 },
    type: { type: 'string', minLength: 1, maxLength: 100 },
    status: TEXT_SHORT,
    subscribers: { type: 'integer', minimum: 0 },
    avatar: TEXT_MEDIUM,
  },
  additionalProperties: false,
} as const;

export const syncTeamOwnerBody = {
  type: 'object',
  required: ['email', 'displayName'],
  properties: {
    email: { type: 'string', minLength: 3, maxLength: 320 },
    displayName: { type: 'string', minLength: 1, maxLength: 200 },
  },
  additionalProperties: false,
} as const;

export const createTeamInviteBody = {
  type: 'object',
  required: ['email', 'role'],
  properties: {
    email: { type: 'string', minLength: 3, maxLength: 320 },
    role: { type: 'string', enum: ['editor', 'viewer'] },
  },
  additionalProperties: false,
} as const;

export const updateTeamMemberBody = {
  type: 'object',
  required: ['role'],
  properties: {
    role: { type: 'string', enum: ['editor', 'viewer'] },
  },
  additionalProperties: false,
} as const;

export const createJobBody = {
  type: 'object',
  required: ['type'],
  properties: {
    type: TEXT_SHORT,
    payload: { type: 'object' },
  },
  additionalProperties: false,
} as const;

export const patchJobBody = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['pending', 'active', 'completed', 'failed'] },
    progress: { type: 'number', minimum: 0, maximum: 100 },
    result: { type: 'object' },
    error: TEXT_MEDIUM,
  },
  additionalProperties: false,
} as const;

/** Superset of fields accepted across all AI endpoints, with size caps. */
export const aiBody = {
  type: 'object',
  properties: {
    message: TEXT_LONG,
    messages: {
      type: 'array',
      maxItems: 100,
      items: {
        type: 'object',
        required: ['role', 'content'],
        properties: {
          role: { type: 'string', enum: ['user', 'assistant', 'system'] },
          content: TEXT_LONG,
        },
        additionalProperties: false,
      },
    },
    prompt: TEXT_LONG,
    options: { type: 'object' },
    script: TEXT_LONG,
    instruction: TEXT_MEDIUM,
    aspectRatio: TEXT_SHORT,
    imageSize: TEXT_SHORT,
    style: TEXT_SHORT,
    provider: TEXT_SHORT,
    text: TEXT_LONG,
    voice: TEXT_SHORT,
    title: TEXT_SHORT,
  },
  additionalProperties: false,
} as const;

export const episodeIdParams = {
  type: 'object',
  required: ['id'],
  properties: {
    id: { type: 'string', minLength: 1, maxLength: 100 },
  },
} as const;
