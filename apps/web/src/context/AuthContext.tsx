import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { getSupabaseClient, isSupabaseAuthEnabled } from '../lib/supabase';
import { fetchUserProfile, saveUserProfile, type UserProfile } from '../lib/profile';
import { setApiAccessToken, setOnUnauthorized } from '../api';

interface AuthContextValue {
  authEnabled: boolean;
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  profileLoading: boolean;
  refreshProfile: () => Promise<void>;
  updateProfile: (
    patch: Pick<UserProfile, 'display_name' | 'avatar_url'>,
  ) => Promise<{ error?: string }>;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const authEnabled = isSupabaseAuthEnabled();
  const supabase = getSupabaseClient();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(authEnabled);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const refreshProfile = useCallback(async () => {
    const userId = session?.user?.id;
    if (!authEnabled || !userId) {
      setProfile(null);
      return;
    }
    setProfileLoading(true);
    try {
      const row = await fetchUserProfile(userId);
      setProfile(row);
    } catch {
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  }, [authEnabled, session?.user?.id]);

  useEffect(() => {
    if (!authEnabled || !supabase) {
      setApiAccessToken(null);
      setOnUnauthorized(null);
      setProfile(null);
      setLoading(false);
      return;
    }

    let active = true;

    const syncToken = (nextSession: Session | null) => {
      setApiAccessToken(nextSession?.access_token ?? null);
    };

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      syncToken(data.session);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      syncToken(nextSession);
      setLoading(false);
      if (!nextSession) {
        setProfile(null);
      }
    });

    setOnUnauthorized(() => {
      void supabase.auth.refreshSession().then(({ data, error }) => {
        if (error || !data.session) {
          void supabase.auth.signOut();
        } else {
          setSession(data.session);
          syncToken(data.session);
        }
      });
    });

    return () => {
      active = false;
      setOnUnauthorized(null);
      subscription.subscription.unsubscribe();
    };
  }, [authEnabled, supabase]);

  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      if (!supabase) return { error: 'Auth no configurado' };
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return error ? { error: error.message } : {};
    },
    [supabase],
  );

  const signUp = useCallback(
    async (email: string, password: string) => {
      if (!supabase) return { error: 'Auth no configurado' };
      const { error } = await supabase.auth.signUp({ email, password });
      return error ? { error: error.message } : {};
    },
    [supabase],
  );

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setProfile(null);
  }, [supabase]);

  const updateProfile = useCallback(
    async (patch: Pick<UserProfile, 'display_name' | 'avatar_url'>) => {
      const userId = session?.user?.id;
      if (!userId) return { error: 'Sin sesión activa' };

      const result = await saveUserProfile(userId, session?.user?.email ?? null, patch);
      if (!result.error) {
        setProfile(prev =>
          prev
            ? { ...prev, ...patch }
            : {
                id: userId,
                email: session?.user?.email ?? null,
                display_name: patch.display_name,
                avatar_url: patch.avatar_url,
              },
        );
      }
      return result;
    },
    [session?.user?.email, session?.user?.id],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      authEnabled,
      loading,
      session,
      user: session?.user ?? null,
      profile,
      profileLoading,
      refreshProfile,
      updateProfile,
      signIn,
      signUp,
      signOut,
    }),
    [
      authEnabled,
      loading,
      session,
      profile,
      profileLoading,
      refreshProfile,
      updateProfile,
      signIn,
      signUp,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}

export type { UserProfile };
