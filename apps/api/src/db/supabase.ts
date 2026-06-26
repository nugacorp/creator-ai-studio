import process from 'node:process';

export interface SupabaseConfig {
  url: string;
  serviceRoleKey: string;
}

export function getSupabaseConfig(): SupabaseConfig | null {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  return { url, serviceRoleKey };
}

/** Optional Supabase health check. Returns null when not configured. */
export async function checkSupabaseConnection(): Promise<{ ok: boolean } | null> {
  const config = getSupabaseConfig();
  if (!config) return null;

  try {
    const response = await fetch(`${config.url}/rest/v1/`, {
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
      },
    });
    return { ok: response.ok };
  } catch {
    return { ok: false };
  }
}
