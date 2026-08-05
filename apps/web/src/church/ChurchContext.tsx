import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Church, ChurchMember, ChurchPermission, ChurchRole } from '@creator-ai-studio/shared';
import { ApiUnauthorizedError } from '../api';
import { fetchChurchSession, fetchMembers, fetchMinistries } from './api';
import type { Ministry } from '@creator-ai-studio/shared';

/**
 * The church session: who I am here, and what I may do.
 *
 * `can()` mirrors the API's permission matrix so the UI can hide affordances a
 * user cannot use. It is a courtesy, not a control — every one of these actions
 * is checked again server-side (AD-4).
 */

interface ChurchContextValue {
  loading: boolean;
  configured: boolean;
  church: Church | null;
  member: ChurchMember | null;
  role: ChurchRole | null;
  permissions: ChurchPermission[];
  members: ChurchMember[];
  ministries: Ministry[];
  error: string | null;
  can: (permission: ChurchPermission) => boolean;
  refresh: () => Promise<void>;
  refreshDirectory: () => Promise<void>;
  /** Display name for a user id, falling back to a short id. */
  nameOf: (userId: string | undefined) => string;
}

const ChurchStateContext = createContext<ChurchContextValue | null>(null);

export function ChurchProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [church, setChurch] = useState<Church | null>(null);
  const [member, setMember] = useState<ChurchMember | null>(null);
  const [role, setRole] = useState<ChurchRole | null>(null);
  const [permissions, setPermissions] = useState<ChurchPermission[]>([]);
  const [members, setMembers] = useState<ChurchMember[]>([]);
  const [ministries, setMinistries] = useState<Ministry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refreshDirectory = useCallback(async () => {
    try {
      const [nextMembers, nextMinistries] = await Promise.all([fetchMembers(), fetchMinistries()]);
      setMembers(nextMembers);
      setMinistries(nextMinistries);
    } catch {
      // A member without a church yet simply has no directory to show.
      setMembers([]);
      setMinistries([]);
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const session = await fetchChurchSession();
      setConfigured(session.configured);
      setChurch(session.church);
      setMember(session.member);
      setRole(session.role);
      setPermissions(session.permissions);
      if (session.church) {
        await refreshDirectory();
      } else {
        setMembers([]);
        setMinistries([]);
      }
    } catch (err) {
      if (err instanceof ApiUnauthorizedError) {
        setError(null);
      } else {
        setError(err instanceof Error ? err.message : 'No se pudo cargar tu iglesia');
      }
      setChurch(null);
      setMember(null);
      setRole(null);
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  }, [refreshDirectory]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const permissionSet = useMemo(() => new Set(permissions), [permissions]);

  const can = useCallback(
    (permission: ChurchPermission) => permissionSet.has(permission),
    [permissionSet],
  );

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const entry of members) {
      map.set(entry.userId, entry.displayName || entry.title || entry.email || 'Integrante');
    }
    return map;
  }, [members]);

  const nameOf = useCallback(
    (userId: string | undefined) => {
      if (!userId) return 'Sin asignar';
      return nameById.get(userId) ?? `Usuario ${userId.slice(0, 6)}`;
    },
    [nameById],
  );

  const value = useMemo<ChurchContextValue>(
    () => ({
      loading,
      configured,
      church,
      member,
      role,
      permissions,
      members,
      ministries,
      error,
      can,
      refresh,
      refreshDirectory,
      nameOf,
    }),
    [
      loading,
      configured,
      church,
      member,
      role,
      permissions,
      members,
      ministries,
      error,
      can,
      refresh,
      refreshDirectory,
      nameOf,
    ],
  );

  return <ChurchStateContext.Provider value={value}>{children}</ChurchStateContext.Provider>;
}

export function useChurch(): ChurchContextValue {
  const context = useContext(ChurchStateContext);
  if (!context) {
    throw new Error('useChurch debe usarse dentro de <ChurchProvider>');
  }
  return context;
}

/** Shorthand for the common `can('...')` check inside a component. */
export function useCan(permission: ChurchPermission): boolean {
  return useChurch().can(permission);
}
