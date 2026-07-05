import type { EpisodeDetail } from '@creator-ai-studio/shared';
import { getSupabaseConfig } from './supabase.js';

/** Upsert episode row when Supabase is configured (best-effort, non-blocking). */
export async function syncEpisodeToSupabase(detail: EpisodeDetail): Promise<void> {
  const config = getSupabaseConfig();
  if (!config) return;

  try {
    await fetch(`${config.url}/rest/v1/episodes`, {
      method: 'POST',
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        id: detail.id,
        slug: detail.slug,
        title: detail.title,
        status: detail.status,
        workspace_path: detail.workspacePath,
        content: detail.content,
        stages: detail.stages,
        user_id: detail.userId ?? null,
        updated_at: detail.updatedAt,
        created_at: detail.createdAt,
      }),
    });
  } catch {
    // Filesystem remains source of truth until full migration
  }
}

/** Remove episode row when Supabase is configured (best-effort). */
export async function deleteEpisodeFromSupabase(id: string): Promise<void> {
  const config = getSupabaseConfig();
  if (!config) return;

  try {
    await fetch(`${config.url}/rest/v1/episodes?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
      },
    });
  } catch {
    // Non-blocking
  }
}
