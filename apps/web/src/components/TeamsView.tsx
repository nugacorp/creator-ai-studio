import { useCallback, useEffect, useState } from 'react';
import {
  Clock,
  FolderKanban,
  Loader2,
  Mail,
  Plus,
  Trash2,
  UserCog,
  Users,
} from 'lucide-react';
import type { TeamInviteRecord, TeamMemberRecord, TeamResponse, TeamRole } from '@creator-ai-studio/shared';
import {
  fetchTeam,
  inviteTeamMember,
  removeTeamMember,
  revokeTeamInvite,
  syncTeamOwner,
  updateTeamMemberRole,
} from '../api';
import { useAuth } from '../context/AuthContext';
import InviteTeamMemberModal from './InviteTeamMemberModal';

const ROLE_LABELS: Record<TeamRole, string> = {
  owner: 'Propietario',
  editor: 'Editor',
  viewer: 'Lector',
};

const ROLE_BADGE: Record<TeamRole, string> = {
  owner: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  editor: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
  viewer: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
};

function formatLastActive(iso?: string): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 2) return 'Activo ahora';
  if (minutes < 60) return `Activo hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Activo hace ${hours} h`;
  return `Última actividad: ${date.toLocaleDateString('es-ES')}`;
}

function memberIsCurrentUser(member: TeamMemberRecord, team: TeamResponse): boolean {
  if (team.currentUserId && member.userId) {
    return member.userId === team.currentUserId;
  }
  return false;
}

export default function TeamsView() {
  const { user, profile } = useAuth();
  const [team, setTeam] = useState<TeamResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadTeam = useCallback(async () => {
    setError(null);
    try {
      let data = await fetchTeam();

      const email = user?.email ?? profile?.email ?? '';
      const displayName =
        profile?.display_name?.trim() ||
        (typeof user?.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : '') ||
        email.split('@')[0] ||
        'Propietario';

      const owner = data.members.find(m => m.role === 'owner');
      if (email && (!owner || memberIsCurrentUser(owner, data))) {
        data = await syncTeamOwner({ email, displayName });
      }

      setTeam(data);
    } catch {
      setError('No se pudo cargar el equipo');
    } finally {
      setLoading(false);
    }
  }, [user?.email, user?.user_metadata?.full_name, profile?.display_name, profile?.email]);

  useEffect(() => {
    void loadTeam();
  }, [loadTeam]);

  const handleInvite = async (input: { email: string; role: 'editor' | 'viewer' }) => {
    setSaving(true);
    setActionError(null);
    try {
      const data = await inviteTeamMember(input);
      setTeam(data);
      setInviteOpen(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo enviar la invitación');
    } finally {
      setSaving(false);
    }
  };

  const handleRoleChange = async (memberId: string, role: 'editor' | 'viewer') => {
    setActionError(null);
    try {
      const data = await updateTeamMemberRole(memberId, role);
      setTeam(data);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo actualizar el rol');
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!window.confirm('¿Eliminar este miembro del equipo?')) return;
    setActionError(null);
    try {
      const data = await removeTeamMember(memberId);
      setTeam(data);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo eliminar el miembro');
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    setActionError(null);
    try {
      const data = await revokeTeamInvite(inviteId);
      setTeam(data);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo revocar la invitación');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Cargando equipo…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-200">
        {error}
      </div>
    );
  }

  const members = team?.members ?? [];
  const invites = team?.invites ?? [];
  const canManage = team?.canManage ?? true;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex items-center justify-between bg-[#15191E] p-4.5 rounded-2xl border border-white/5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 rounded-xl text-indigo-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display font-bold text-base text-white">Miembros del Equipo</h2>
            <p className="text-[11px] text-slate-400">
              Colaboradores del estudio con acceso al workspace compartido
            </p>
          </div>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={() => setInviteOpen(true)}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Invitar Miembro</span>
          </button>
        )}
      </div>

      {actionError && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
          {actionError}
        </div>
      )}

      <div className="rounded-2xl border border-dashed border-white/10 bg-[#0B0F14]/50 p-4 flex items-start gap-3">
        <FolderKanban className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
        <div>
          <p className="text-xs font-semibold text-slate-300">Asignación de proyectos</p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            La asignación por episodio vive en Proyectos / Kanban. Aquí solo gestionas quién tiene acceso al estudio.
          </p>
        </div>
      </div>

      {members.length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-[#15191E] p-8 text-center text-sm text-slate-400">
          No hay miembros registrados. Inicia sesión para registrarte como propietario del equipo.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {members.map(member => (
            <MemberCard
              key={member.id}
              member={member}
              team={team!}
              canManage={canManage}
              onRoleChange={handleRoleChange}
              onRemove={handleRemoveMember}
            />
          ))}
        </div>
      )}

      {invites.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Mail className="w-4 h-4 text-slate-400" />
            Invitaciones pendientes
          </h3>
          <div className="space-y-2">
            {invites.map(invite => (
              <PendingInviteRow
                key={invite.id}
                invite={invite}
                canManage={canManage}
                onRevoke={handleRevokeInvite}
              />
            ))}
          </div>
        </section>
      )}

      <InviteTeamMemberModal
        open={inviteOpen}
        saving={saving}
        onClose={() => setInviteOpen(false)}
        onSubmit={handleInvite}
      />
    </div>
  );
}

function MemberCard({
  member,
  team,
  canManage,
  onRoleChange,
  onRemove,
}: {
  member: TeamMemberRecord;
  team: TeamResponse;
  canManage: boolean;
  onRoleChange: (id: string, role: 'editor' | 'viewer') => void;
  onRemove: (id: string) => void;
}) {
  const isOwner = member.role === 'owner';
  const isSelf = memberIsCurrentUser(member, team);
  const lastActive = formatLastActive(member.lastActiveAt);

  return (
    <div className="bg-[#15191E] border border-white/5 rounded-3xl p-5 space-y-4 hover:border-indigo-500/30 transition-all shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-12 h-12 rounded-full bg-[#0B0F14] border border-white/10 flex items-center justify-center text-lg font-bold text-indigo-300 select-none shrink-0">
            {member.avatarInitial}
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-bold text-white truncate">
              {member.displayName}
              {isSelf && <span className="text-slate-500 font-normal"> (tú)</span>}
            </h4>
            <p className="text-xs text-slate-400 truncate">{member.email}</p>
          </div>
        </div>
        <span
          className={`shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-lg border ${ROLE_BADGE[member.role]}`}
        >
          {ROLE_LABELS[member.role]}
        </span>
      </div>

      <div className="space-y-2 text-xs pt-1.5 border-t border-white/5">
        {lastActive && (
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
            <Clock className="w-3 h-3" />
            <span>{lastActive}</span>
          </div>
        )}

        {canManage && !isOwner && (
          <div className="flex items-center gap-2 pt-1">
            <label className="flex items-center gap-1.5 text-[10px] text-slate-500">
              <UserCog className="w-3 h-3" />
              Rol
            </label>
            <select
              value={member.role}
              onChange={e => onRoleChange(member.id, e.target.value as 'editor' | 'viewer')}
              className="flex-1 text-xs rounded-lg bg-[#0B0F14] border border-white/10 text-white px-2 py-1.5 focus:outline-none focus:border-indigo-500/40"
            >
              <option value="editor">Editor</option>
              <option value="viewer">Lector</option>
            </select>
            <button
              type="button"
              onClick={() => onRemove(member.id)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
              aria-label="Eliminar miembro"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function PendingInviteRow({
  invite,
  canManage,
  onRevoke,
}: {
  invite: TeamInviteRecord;
  canManage: boolean;
  onRevoke: (id: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 bg-[#15191E] border border-white/5 rounded-xl px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm text-white truncate">{invite.email}</p>
        <p className="text-[10px] text-slate-500">
          {ROLE_LABELS[invite.role]} · Pendiente desde{' '}
          {new Date(invite.invitedAt).toLocaleDateString('es-ES')}
        </p>
      </div>
      {canManage && (
        <button
          type="button"
          onClick={() => onRevoke(invite.id)}
          className="shrink-0 text-[10px] font-semibold text-slate-400 hover:text-rose-300 transition-colors cursor-pointer"
        >
          Revocar
        </button>
      )}
    </div>
  );
}
