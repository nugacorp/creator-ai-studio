import type { EpisodeDetail, EpisodeSummary } from '@creator-ai-studio/shared';
import { getSupabaseConfig } from './supabase.js';

/**
 * FASE 9 — Episode metadata source configuration.
 *
 * - `filesystem` (default): list/get metadata from disk only (current behavior).
 * - `supabase`: list/get summary rows from Postgres; detail still loaded from disk.
 * - `hybrid`: same as supabase but falls back to filesystem when row missing.
 */
export type EpisodeMetadataSource = 'filesystem' | 'supabase' | 'hybrid';

export function getEpisodeMetadataSource(): EpisodeMetadataSource {
  const raw = process.env.EPISODE_METADATA_SOURCE ?? 'filesystem';
  if (raw === 'supabase' || raw === 'hybrid') return raw;
  return 'filesystem';
}

function supabaseHeaders(key: string): Record<string, string> {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
}

interface SupabaseEpisodeRow {
  id: string;
  slug: string;
  title: string;
  status: string;
  workspace_path: string;
  content?: EpisodeDetail['content'];
  stages?: EpisodeDetail['stages'];
  user_id?: string | null;
  created_at: string;
  updated_at: string;
}

function rowToSummary(row: SupabaseEpisodeRow): EpisodeSummary {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    status: row.status as EpisodeSummary['status'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archiveStatus: 'local',
    ...(row.user_id ? { userId: row.user_id } : {}),
  };
}

/** List episode summaries from Supabase when configured. */
export async function listEpisodesFromSupabase(userId?: string): Promise<EpisodeSummary[] | null> {
  const config = getSupabaseConfig();
  if (!config) return null;

  const params = new URLSearchParams({
    select: 'id,slug,title,status,workspace_path,user_id,created_at,updated_at',
    order: 'updated_at.desc',
  });
  if (userId) {
    params.set('user_id', `eq.${userId}`);
  }

  try {
    const res = await fetch(`${config.url}/rest/v1/episodes?${params}`, {
      headers: supabaseHeaders(config.serviceRoleKey),
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as SupabaseEpisodeRow[];
<<<<<<< HEAD
    // Defense in depth: the service_role key bypasses RLS, so never rely solely
    // on the query-param filter. Drop any row owned by a different user.
    const safe = userId ? rows.filter(r => !r.user_id || r.user_id === userId) : rows;
    return safe.map(rowToSummary);
=======
    return rows.map(rowToSummary);
>>>>>>> origin/main
  } catch {
    return null;
  }
}

/** Fetch a single episode summary row from Supabase. */
export async function getEpisodeSummaryFromSupabase(
  id: string,
  userId?: string,
): Promise<EpisodeSummary | null> {
  const config = getSupabaseConfig();
  if (!config) return null;

  try {
    const res = await fetch(
      `${config.url}/rest/v1/episodes?id=eq.${encodeURIComponent(id)}&select=id,slug,title,status,workspace_path,user_id,created_at,updated_at`,
      { headers: supabaseHeaders(config.serviceRoleKey) },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as SupabaseEpisodeRow[];
    const row = rows[0];
    if (!row) return null;
    if (userId && row.user_id && row.user_id !== userId) return null;
    return rowToSummary(row);
  } catch {
    return null;
  }
}
