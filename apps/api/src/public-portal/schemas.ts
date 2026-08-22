/**
 * JSON Schemas for the public church portal endpoints (V1).
 *
 * Each endpoint returns a stable contract. The landing page must consume
 * exactly these shapes — never query PostgREST directly.
 */

const ISO_DATE_TIME = { type: 'string', minLength: 4, maxLength: 40 } as const;
const URL_OR_NULL = { type: ['string', 'null'] } as const;

export const publicLiveResponseSchema = {
  type: 'object',
  required: ['status', 'next'],
  properties: {
    status: { type: 'string', enum: ['offline', 'live', 'scheduled'] },
    title: { type: 'string', maxLength: 200 },
    watchUrl: URL_OR_NULL,
    scheduledAt: ISO_DATE_TIME,
    next: {
      type: ['object', 'null'],
      required: ['id', 'title', 'scheduledAt'],
      properties: {
        id: { type: 'string', format: 'uuid' },
        title: { type: 'string', maxLength: 200 },
        scheduledAt: ISO_DATE_TIME,
        watchUrl: URL_OR_NULL,
      },
      additionalProperties: false,
    },
  },
  additionalProperties: false,
} as const;

export const publicEventsQuerySchema = {
  type: 'object',
  properties: {
    limit: { type: 'integer', minimum: 1, maximum: 10 },
  },
  additionalProperties: false,
} as const;

export const publicEventsResponseSchema = {
  type: 'object',
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      maxItems: 10,
      items: {
        type: 'object',
        required: ['id', 'title', 'scheduledAt'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          title: { type: 'string', maxLength: 200 },
          scheduledAt: ISO_DATE_TIME,
          watchUrl: URL_OR_NULL,
        },
        additionalProperties: false,
      },
    },
  },
  additionalProperties: false,
} as const;

export const publicLatestSermonResponseSchema = {
  type: 'object',
  required: ['sermon'],
  properties: {
    sermon: {
      type: ['object', 'null'],
      required: ['id', 'title', 'publishedAt'],
      properties: {
        id: { type: 'string', format: 'uuid' },
        title: { type: 'string', maxLength: 220 },
        summary: { type: ['string', 'null'], maxLength: 1_500 },
        slug: { type: ['string', 'null'], maxLength: 80 },
        preacher: { type: ['string', 'null'], maxLength: 200 },
        bibleRef: { type: ['string', 'null'], maxLength: 200 },
        serviceDate: { type: ['string', 'null'], maxLength: 40 },
        publishedAt: ISO_DATE_TIME,
        watchUrl: URL_OR_NULL,
        coverUrl: { type: ['string', 'null'], maxLength: 800 },
      },
      additionalProperties: false,
    },
  },
  additionalProperties: false,
} as const;
