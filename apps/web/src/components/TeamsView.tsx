import { Plus, Users } from 'lucide-react';
import type { TeamMember } from '../types';

interface TeamsViewProps {
  team: TeamMember[];
  onInvite: (name: string, role: string) => void;
}

export default function TeamsView({ team, onInvite }: TeamsViewProps) {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex items-center justify-between bg-[#15191E] p-4.5 rounded-2xl border border-white/5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 rounded-xl text-indigo-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display font-bold text-base text-white">Miembros del Equipo</h2>
            <p className="text-[11px] text-slate-400">Gestiona colaboradores y asigna tareas de producción</p>
          </div>
        </div>

        <button
          onClick={() => {
            const name = prompt('Nombre del colaborador:');
            if (!name) return;
            const role = prompt('Rol del colaborador:');
            if (!role) return;
            onInvite(name, role);
          }}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Invitar Miembro</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {team.map(member => (
          <div key={member.id} className="bg-[#15191E] border border-white/5 rounded-3xl p-5 space-y-4 hover:border-indigo-500/30 transition-all shadow-md">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-full bg-[#0B0F14] border border-white/10 flex items-center justify-center text-xl select-none">
                {member.avatar}
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">{member.name}</h4>
                <p className="text-xs text-slate-400">{member.role}</p>
              </div>
            </div>

            <div className="space-y-1 text-xs pt-1.5 border-t border-white/5 font-mono">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-slate-500">Conexión:</span>
                <span className={member.status === 'Online' ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                  {member.status}
                </span>
              </div>
              {member.activeProject && (
                <div className="flex flex-col gap-0.5 pt-1">
                  <span className="text-slate-500 text-[10px]">Proyecto asignado:</span>
                  <span className="text-white font-sans text-xs truncate">&quot;{member.activeProject}&quot;</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
