import React, { useMemo, useState } from 'react';
import { Play, Clock, Volume2, Image as ImageIcon, Calendar, ArrowRight, Activity, Sparkles, Plus, X } from 'lucide-react';
import { VideoProject } from '../types';
import { useAuth } from '../context/AuthContext';
import { getTimeGreeting, resolveDisplayName } from '../lib/greeting';
import type { DashboardSection } from '../lib/dashboardNavigation';

interface HomeViewProps {
  onContinueWorking: (projectId: string) => void;
  onNavigateToSection: (section: DashboardSection) => void;
  onGoToProjects: () => void;
  projects: VideoProject[];
  onCreateEpisode: (title: string) => Promise<void>;
  activeChannel?: import('../types').Channel | null;
  onGoToChannelPicker?: () => void;
}

export default function HomeView({
  onContinueWorking,
  onNavigateToSection,
  onGoToProjects,
  projects,
  onCreateEpisode,
  activeChannel = null,
  onGoToChannelPicker,
}: HomeViewProps) {
  const { user, profile } = useAuth();
  const greetingName = resolveDisplayName({
    displayName: profile?.display_name,
    email: user?.email,
    fallback: 'Ramiro',
  });
  const greeting = `${getTimeGreeting()}, ${greetingName}`;

  const continueProject =
    projects.find(p => p.progress < 100) ?? projects[0];

  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [newProjTitle, setNewProjTitle] = useState('');

  const handleNewProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjTitle.trim()) return;

    await onCreateEpisode(newProjTitle.trim());
    setNewProjTitle('');
    setShowNewProjectModal(false);
  };

  const stats = useMemo(() => {
    const inProgress = projects.filter(p => p.progress > 0 && p.progress < 100).length;
    const withThumbnail = projects.filter(p => p.thumbnailUrl && p.status !== 'Ideas').length;
    const scheduled = projects.filter(p => p.status === 'Programado').length;
    const published = projects.filter(p => p.status === 'Publicado').length;
    const withScript = projects.filter(p => p.script && p.script.length > 20).length;

    return [
      {
        section: 'episodios-activos' as DashboardSection,
        label: 'Episodios activos',
        hint: 'Ver pipeline de proyectos',
        count: String(inProgress || projects.length),
        icon: Play,
        color: 'text-sky-400 bg-sky-500/10',
      },
      {
        section: 'con-guion' as DashboardSection,
        label: 'Con guion',
        hint: 'Abrir guiones en workspace',
        count: String(withScript),
        icon: Sparkles,
        color: 'text-indigo-400 bg-indigo-500/10',
      },
      {
        section: 'en-produccion' as DashboardSection,
        label: 'En producción',
        hint: 'Narración, edición y render',
        count: String(inProgress),
        icon: Volume2,
        color: 'text-amber-400 bg-amber-500/10',
      },
      {
        section: 'miniaturas-listas' as DashboardSection,
        label: 'Miniaturas listas',
        hint: 'Ver miniaturas del pipeline',
        count: String(withThumbnail),
        icon: ImageIcon,
        color: 'text-emerald-400 bg-emerald-500/10',
      },
      {
        section: (published > 0 ? 'publicados' : 'programados') as DashboardSection,
        label: published > 0 ? 'Publicados' : 'Programados',
        hint: published > 0 ? 'Episodios ya publicados' : 'Calendario de publicaciones',
        count: String(published > 0 ? published : scheduled),
        icon: Calendar,
        color: 'text-indigo-400 bg-indigo-500/10',
      },
    ];
  }, [projects]);

  const recentActivity = useMemo(() => {
    return projects.slice(0, 5).map(p => ({
      id: p.id,
      text: p.status,
      desc: p.title,
      time: 'Reciente',
      done: p.status === 'Publicado',
    }));
  }, [projects]);

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Greeting Banner */}
      <div className="bg-[#15191E] p-8 rounded-3xl border border-white/5 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-6 opacity-10">
          <Sparkles className="w-48 h-48 text-indigo-500" />
        </div>

        <div className="relative z-10 space-y-4">
          <div className="space-y-2">
            <div className="text-xs text-indigo-400 font-bold uppercase tracking-wider font-mono">Panel del Creador</div>
            <h1 className="font-display font-bold text-3xl text-white tracking-tight">{greeting}</h1>
            <p className="text-sm text-slate-400 max-w-2xl">
              {activeChannel ? (
                <>
                  Canal activo: <strong className="text-white">{activeChannel.name}</strong>
                  {projects.length > 0
                    ? ` — ${projects.length} proyecto(s) en este canal.`
                    : ' — aún no hay proyectos; crea uno en Ideas o con Nuevo proyecto.'}
                </>
              ) : projects.length > 0 ? (
                `Tienes ${projects.length} episodio(s) en el pipeline. Continúa donde lo dejaste o crea uno nuevo.`
              ) : (
                'Crea tu primer episodio y ejecuta el pipeline completo hasta YouTube desde el workspace.'
              )}
            </p>
            {!activeChannel && onGoToChannelPicker && (
              <button
                type="button"
                onClick={onGoToChannelPicker}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer"
              >
                Seleccionar canal de YouTube en la cabecera →
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-3 pt-1">
            <button
              id="new-project-btn"
              type="button"
              onClick={() => setShowNewProjectModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-500/20 active:scale-98 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Nuevo proyecto
            </button>
            {continueProject ? (
              <button
                id="open-project-btn"
                type="button"
                onClick={() => onContinueWorking(continueProject.id)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0B0F14] border border-white/10 text-slate-200 font-semibold text-sm hover:border-indigo-500/40 hover:text-white transition-all cursor-pointer"
              >
                <span>Abrir proyecto</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                id="open-project-btn"
                type="button"
                onClick={onGoToProjects}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0B0F14] border border-white/10 text-slate-200 font-semibold text-sm hover:border-indigo-500/40 hover:text-white transition-all cursor-pointer"
              >
                <span>Ver proyectos</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stats Counter List — each card navigates to the relevant section */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {stats.map(stat => {
          const Icon = stat.icon;
          return (
            <button
              key={stat.section}
              type="button"
              id={`dashboard-stat-${stat.section}`}
              onClick={() => onNavigateToSection(stat.section)}
              title={stat.hint}
              aria-label={`${stat.label}: ${stat.count}. ${stat.hint}`}
              className="text-left bg-[#15191E] border border-white/5 rounded-2xl p-4.5 space-y-3 shadow-md hover:border-indigo-500/40 hover:bg-[#181d24] hover:shadow-indigo-500/10 transition-all group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
            >
              <div className="flex items-center justify-between">
                <div className={`p-2 rounded-lg ${stat.color} group-hover:scale-105 transition-transform duration-150`}>
                  <Icon className="w-4 h-4" />
                </div>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all" />
              </div>
              <div>
                <div className="text-2xl font-bold font-display text-white">{stat.count}</div>
                <div className="text-xs text-slate-400 leading-normal font-medium mt-0.5 group-hover:text-slate-300">
                  {stat.label}
                </div>
                <div className="text-[10px] text-slate-500 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {stat.hint}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Grid: Continue Working & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Continue Working Card */}
        <div className="lg:col-span-2 bg-[#15191E] border border-white/10 rounded-3xl p-6 flex flex-col justify-between shadow-lg relative overflow-hidden">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-widest text-indigo-400 font-mono">CONTINUAR TRABAJANDO</span>
              <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5 bg-[#0B0F14] px-2.5 py-1 rounded-full border border-white/5">
                <Clock className="w-3 h-3 text-amber-400" /> Modificado hoy
              </span>
            </div>

            {continueProject ? (
              <>
                <div className="space-y-2 mt-4">
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded bg-indigo-950/40 text-indigo-300 border border-indigo-800/20">
                    {continueProject.series}
                  </span>
                  <h2 className="font-display font-bold text-2xl text-white tracking-tight hover:text-indigo-400 transition-colors italic">
                    &quot;{continueProject.title}&quot;
                  </h2>
                </div>

                <div className="pt-4 space-y-2.5">
                  <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                    <span className="flex items-center gap-1.5">
                      Estado actual:{' '}
                      <strong className="text-indigo-400 font-semibold">{continueProject.status}</strong>
                    </span>
                    <span className="font-semibold text-white font-mono">{continueProject.progress}%</span>
                  </div>
                  <div className="w-full h-2 bg-[#0B0F14] rounded-full overflow-hidden p-[1px] border border-white/5">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 via-indigo-400 to-purple-500 rounded-full transition-all duration-500"
                      style={{ width: `${continueProject.progress}%` }}
                    />
                  </div>
                </div>
              </>
            ) : (
              <p className="mt-4 text-sm text-slate-400">
                No hay proyectos activos. Crea uno nuevo para empezar el pipeline en el workspace.
              </p>
            )}
          </div>

          <div className="pt-8 flex items-center justify-between">
            <div className="text-xs text-slate-400">
              Guion, narración, miniatura y publicación viven en el{' '}
              <strong className="text-white">workspace</strong> de cada episodio.
            </div>
            {continueProject && (
              <button
                type="button"
                onClick={() => onContinueWorking(continueProject.id)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-500/20 active:scale-98 transition-all cursor-pointer"
              >
                <span>Abrir proyecto</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Recent Activity List */}
        <div className="bg-[#15191E]/50 border border-white/5 rounded-3xl p-6 space-y-4 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-white font-mono">Actividad Reciente</span>
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            </div>

            <div className="space-y-4 mt-4 overflow-y-auto max-h-[280px] pr-1">
              {recentActivity.length === 0 ? (
                <p className="text-xs text-slate-500 italic">Sin actividad reciente.</p>
              ) : (
                recentActivity.map((act, idx) => (
                  <button
                    key={act.id}
                    type="button"
                    onClick={() => onContinueWorking(act.id)}
                    className="w-full flex gap-3 text-xs leading-relaxed group text-left cursor-pointer rounded-xl p-1 -m-1 hover:bg-white/[0.03] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50"
                    aria-label={`Abrir ${act.desc}`}
                  >
                    <div className="flex flex-col items-center">
                      <div className="w-5 h-5 rounded-full bg-emerald-950/30 border border-emerald-900/40 text-emerald-400 font-bold flex items-center justify-center text-[10px] shrink-0 group-hover:bg-emerald-900/30 transition-colors">
                        {act.done ? '✓' : '→'}
                      </div>
                      {idx < recentActivity.length - 1 && (
                        <div className="w-[1px] bg-white/5 flex-1 my-1" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-white group-hover:text-indigo-400 transition-colors">{act.text}</div>
                      <div className="text-slate-400 mt-0.5 leading-relaxed truncate">{act.desc}</div>
                      <span className="text-[10px] text-indigo-400/80 mt-0.5 block font-mono">{act.time}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* New Project Modal */}
      {showNewProjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B0F14]/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[#15191E] border border-white/10 rounded-3xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setShowNewProjectModal(false)}
              className="absolute right-4 top-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400">
                <Plus className="w-5 h-5" />
              </div>
              <h3 className="font-display font-bold text-lg text-white">Nuevo Proyecto</h3>
            </div>

            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Se creará un episodio en el backend y se abrirá el workspace para guion, narración, miniatura y más.
            </p>

            <form onSubmit={handleNewProjectSubmit} className="space-y-4">
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Título del episodio</label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="Ej. La sabiduría de Salomón hoy"
                  value={newProjTitle}
                  onChange={e => setNewProjTitle(e.target.value)}
                  className="w-full bg-[#0B0F14] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500/50"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setShowNewProjectModal(false)}
                  className="px-4 py-2 rounded-xl bg-[#0B0F14] border border-white/10 text-slate-400 hover:text-white text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-950/20 active:scale-98 cursor-pointer"
                >
                  Crear y abrir workspace
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
