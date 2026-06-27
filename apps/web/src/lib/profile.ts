import { getSupabaseClient } from './supabase';

export interface UserProfile {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

export async function fetchUserProfile(userId: string): Promise<UserProfile | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, display_name, avatar_url')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function saveUserProfile(
  userId: string,
  email: string | null,
  patch: Pick<UserProfile, 'display_name' | 'avatar_url'>,
): Promise<{ error?: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { error: 'Auth no configurado' };

  const { error } = await supabase.from('profiles').upsert(
    {
      id: userId,
      email,
      display_name: patch.display_name?.trim() || null,
      avatar_url: patch.avatar_url?.trim() || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );

  return error ? { error: error.message } : {};
}
