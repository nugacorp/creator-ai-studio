/**
 * Queries against the public portal views.
 *
 * Uses `anonClient()` so PostgREST evaluates everything under role `anon`,
 * applying the RLS policies with `to anon` and the column-level grants.
 */

import { anonClient, isChurchDbConfigured } from '../church-ops/postgrest.js';
import type { PublicEventItem, PublicSermonItem } from '@creator-ai-studio/shared';

interface PublicLiveRow {
  id: string;
  title: string;
  scheduled_at: string;
  status: string;
  watch_url: string | null;
}

interface PublicEventRow {
  id: string;
  title: string;
  scheduled_at: string;
  status: string;
  watch_url: string | null;
}

interface PublicLatestSermonRow {
  id: string;
  title: string;
  summary: string | null;
  slug: string | null;
  preacher: string | null;
  bible_ref: string | null;
  service_date: string | null;
  published_at: string;
  watch_url: string | null;
  cover_asset_id: string | null;
}

export interface PublicLiveSnapshot {
  status: 'offline' | 'live' | 'scheduled';
  title?: string;
  watchUrl?: string | null;
  scheduledAt?: string;
  next: PublicEventItem | null;
}

export async function fetchPublicLive(): Promise<PublicLiveSnapshot> {
  if (!isChurchDbConfigured()) {
    return { status: 'offline', next: null };
  }
  try {
    const rows = await anonClient().select<PublicLiveRow>('public_live', {
      params: { limit: '1' },
    });
    const current = rows[0];
    if (!current) {
      // Buscar el siguiente programado aunque no haya uno en vivo.
      const upcoming = await fetchNextUpcomingEvent();
      if (upcoming) {
        return { status: 'scheduled', next: upcoming };
      }
      return { status: 'offline', next: null };
    }
    if (current.status === 'en_vivo') {
      return {
        status: 'live',
        title: current.title,
        watchUrl: current.watch_url,
        scheduledAt: current.scheduled_at,
        next: null,
      };
    }
    // Programado / preflight.
    return {
      status: 'scheduled',
      title: current.title,
      scheduledAt: current.scheduled_at,
      watchUrl: current.watch_url,
      next: null,
    };
  } catch {
    // Si la vista no existe todavía o RLS rechaza, devolvemos offline
    // silenciosamente. La landing debe tolerar este caso.
    return { status: 'offline', next: null };
  }
}

async function fetchNextUpcomingEvent(): Promise<PublicEventItem | null> {
  try {
    const rows = await anonClient().select<PublicEventRow>('public_events', {
      params: { limit: '1' },
    });
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      title: row.title,
      scheduledAt: row.scheduled_at,
      watchUrl: row.watch_url,
    };
  } catch {
    return null;
  }
}

export async function fetchPublicEvents(limit: number): Promise<PublicEventItem[]> {
  if (!isChurchDbConfigured()) return [];
  try {
    const rows = await anonClient().select<PublicEventRow>('public_events', {
      params: { limit: String(Math.min(Math.max(limit, 1), 10)) },
    });
    return rows.map(row => ({
      id: row.id,
      title: row.title,
      scheduledAt: row.scheduled_at,
      watchUrl: row.watch_url,
    }));
  } catch {
    return [];
  }
}

export async function fetchPublicLatestSermon(): Promise<PublicSermonItem | null> {
  if (!isChurchDbConfigured()) return null;
  try {
    const rows = await anonClient().select<PublicLatestSermonRow>('public_latest_sermons', {
      params: { limit: '1' },
    });
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      title: row.title,
      summary: row.summary,
      slug: row.slug,
      preacher: row.preacher,
      bibleRef: row.bible_ref,
      serviceDate: row.service_date,
      publishedAt: row.published_at,
      watchUrl: row.watch_url,
      coverUrl: null, // V1.1: promoción de archivos a /data/public/
    };
  } catch {
    return null;
  }
}
