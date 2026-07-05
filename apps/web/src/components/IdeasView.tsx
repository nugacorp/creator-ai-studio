import { useCallback, useEffect, useState } from 'react';
import {
  Lightbulb,
  Sparkles,
  Check,
  X,
  Loader2,
  Plus,
  Trash2,
  ArrowRight,
  Archive,
} from 'lucide-react';
import type { EpisodeIdea, IdeaProposal } from '@creator-ai-studio/shared';
import {
  approveIdeaProposal,
  brainstormIdea,
  createIdea,
  deleteIdea,
  discardIdeaProposal,
  fetchIdeas,
} from '../api';

interface IdeasViewProps {
  activeChannelId?: string | null;
  activeChannelName?: string | null;
  onOpenWorkspace: (episodeId: string) => void;
  onProjectsRefresh?: () => void;
}

type IdeaTab = 'activas' | 'aprobadas' | 'descartadas';

function statusLabel(status: EpisodeIdea['status']): string {
  switch (status) {
    case 'draft':
      return 'Borrador';
    case 'brainstormed':
      return 'Con propuestas';
    case 'approved':
      return 'Aprobada';
    case 'discarded':
      return 'Descartada';
    default:
      return status;
  }
}

function filterIdeasByTab(ideas: EpisodeIdea[], tab: IdeaTab): EpisodeIdea[] {
  switch (tab) {
    case 'activas':
      return ideas.filter(i => i.status === 'draft' || i.status === 'brainstormed');
    case 'aprobadas':
      return ideas.filter(i => i.status === 'approved');
    case 'descartadas':
      return ideas.filter(i => i.status === 'discarded');
    default:
      return ideas;
  }
}

function ProposalCard({
  proposal,
  ideaId,
  ideaApproved,
  onApprove,
  onDiscard,
  busy,
}: {
  proposal: IdeaProposal;
  ideaId: string;
  ideaApproved: boolean;
  onApprove: (ideaId: string, proposalId: string) => void;
  onDiscard: (ideaId: string, proposalId: string) => void;
  busy: string | null;
}) {
  const isDiscarded = proposal.status === 'discarded';
  const isApproved = proposal.status === 'approved';
  const actionKey = `${ideaId}:${proposal.id}`;

  return (
    <article
      className={`rounded-2xl border p-4 space-y-3 transition-all ${
        isDiscarded
          ? 'border-white/5 bg-[#0B0F14]/40 opacity-60'
          : isApproved
            ? 'border-emerald-500/30 bg-emerald-950/20'
            : 'border-white/10 bg-[#0B0F14] hover:border-indigo-500/30'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <h4 className="text-sm font-bold text-white leading-snug italic">&quot;{proposal.title}&quot;</h4>
        {isApproved && (
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded-lg border border-emerald-800/30">
            Aprobada
          </span>
        )}
        {isDiscarded && (
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-slate-500 bg-white/5 px-2 py-0.5 rounded-lg">
            Descartada
          </span>
        )}
      </div>

      <ul className="space-y-1.5">
        {proposal.points.map((point, idx) => (
          <li key={idx} className="text-xs text-slate-400 flex gap-2">
            <span className="text-indigo-400 font-mono shrink-0">{idx + 1}.</span>
            <span>{point}</span>
          </li>
        ))}
      </ul>

      {!ideaApproved && proposal.status === 'pending' && (
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => onApprove(ideaId, proposal.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-[11px] font-bold transition-colors cursor-pointer"
          >
            {busy === actionKey ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Check className="w-3.5 h-3.5" />
            )}
            Aprobar
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => onDiscard(ideaId, proposal.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#15191E] border border-white/10 hover:border-rose-500/30 text-slate-300 hover:text-rose-300 disabled:opacity-50 text-[11px] font-semibold transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            Descartar
          </button>
        </div>
      )}
    </article>
  );
}

export default function IdeasView({
  activeChannelId = null,
  activeChannelName = null,
  onOpenWorkspace,
  onProjectsRefresh,
}: IdeasViewProps) {
  const [ideas, setIdeas] = useState<EpisodeIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<IdeaTab>('activas');
  const [rawIdea, setRawIdea] = useState('');
  const [audience, setAudience] = useState('');
  const [passage, setPassage] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadIdeas = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchIdeas(activeChannelId ? { channelId: activeChannelId } : undefined);
      setIdeas(list);
      setSelectedId(prev => (prev && list.some(i => i.id === prev) ? prev : list[0]?.id ?? null));
    } catch {
      setError('No se pudieron cargar las ideas');
    } finally {
      setLoading(false);
    }
  }, [activeChannelId]);

  useEffect(() => {
    void loadIdeas();
  }, [loadIdeas]);

  const filtered = filterIdeasByTab(ideas, tab);
  const selected = ideas.find(i => i.id === selectedId) ?? filtered[0] ?? null;

  useEffect(() => {
    if (selected && !filtered.some(i => i.id === selected.id)) {
      setSelectedId(filtered[0]?.id ?? null);
    }
  }, [filtered, selected]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawIdea.trim()) return;
    setBusy('create');
    setError(null);
    try {
      const created = await createIdea({
        rawIdea: rawIdea.trim(),
        audience: audience.trim() || undefined,
        passage: passage.trim() || undefined,
        ...(activeChannelId ? { channelId: activeChannelId } : {}),
      });
      setIdeas(prev => [created, ...prev]);
      setSelectedId(created.id);
      setTab('activas');
      setRawIdea('');
      setAudience('');
      setPassage('');
    } catch {
      setError('No se pudo guardar la idea');
    } finally {
      setBusy(null);
    }
  };

  const handleBrainstorm = async (ideaId: string) => {
    setBusy(`brainstorm:${ideaId}`);
    setError(null);
    try {
      const result = await brainstormIdea(ideaId);
      setIdeas(prev => prev.map(i => (i.id === ideaId ? result.idea : i)));
    } catch {
      setError('No se pudieron generar propuestas con IA');
    } finally {
      setBusy(null);
    }
  };

  const handleApprove = async (ideaId: string, proposalId: string) => {
    setBusy(`${ideaId}:${proposalId}`);
    setError(null);
    try {
      const result = await approveIdeaProposal(ideaId, proposalId);
      setIdeas(prev => prev.map(i => (i.id === ideaId ? result.idea : i)));
      setTab('aprobadas');
      onProjectsRefresh?.();
    } catch {
      setError('No se pudo aprobar la propuesta. ¿Hay espacio para un episodio activo?');
    } finally {
      setBusy(null);
    }
  };

  const handleDiscard = async (ideaId: string, proposalId: string) => {
    setBusy(`${ideaId}:${proposalId}`);
    setError(null);
    try {
      const result = await discardIdeaProposal(ideaId, proposalId);
      setIdeas(prev => prev.map(i => (i.id === ideaId ? result.idea : i)));
    } catch {
      setError('No se pudo descartar la propuesta');
    } finally {
      setBusy(null);
    }
  };

  const handleDeleteIdea = async (ideaId: string) => {
    setBusy(`delete:${ideaId}`);
    setError(null);
    try {
      await deleteIdea(ideaId);
      setIdeas(prev => prev.filter(i => i.id !== ideaId));
      setSelectedId(null);
    } catch {
      setError('No se pudo eliminar la idea');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <header className="bg-[#15191E] border border-white/5 rounded-2xl p-5 md:p-6">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
            <Lightbulb className="w-5 h-5 text-amber-400" />
          </div>
          <div className="space-y-1 min-w-0">
            <h1 className="font-display font-bold text-xl text-white tracking-tight">
              Espacio de Ideas
            </h1>
            <p className="text-sm text-slate-400 leading-relaxed max-w-2xl">
              Planta una idea en una frase, deja que la IA proponga títulos y ángulos, aprueba la
              ganadora y lanza la producción con el investigador y el resto de agentes.
              {activeChannelName && (
                <>
                  {' '}
                  Trabajando para <strong className="text-indigo-300">{activeChannelName}</strong>.
                </>
              )}
            </p>
          </div>
        </div>
      </header>

      {!activeChannelId && (
        <p className="text-xs rounded-xl border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-amber-200">
          Selecciona un canal en la cabecera para etiquetar nuevas ideas con ese canal.
        </p>
      )}

      {activeChannelId && !loading && filtered.length === 0 && tab === 'activas' && (
        <p className="text-xs rounded-xl border border-white/10 bg-[#15191E] px-4 py-3 text-slate-400">
          Aún no hay ideas para {activeChannelName ?? 'este canal'} — escribe una abajo para empezar.
        </p>
      )}

      {error && (
        <div className="text-xs text-rose-300 bg-rose-950/30 border border-rose-900/30 rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
        <aside className="space-y-4">
          <form
            onSubmit={handleCreate}
            className="bg-[#15191E] border border-white/5 rounded-2xl p-4 space-y-3"
          >
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Nueva idea
            </h2>
            <div>
              <label className="text-[11px] text-slate-500 block mb-1">Tu idea en una frase</label>
              <textarea
                required
                rows={3}
                value={rawIdea}
                onChange={e => setRawIdea(e.target.value)}
                placeholder="Ej. La fe de Rut en tiempos de crisis"
                className="w-full bg-[#0B0F14] border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 resize-none"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-500 block mb-1">Audiencia (opcional)</label>
              <input
                type="text"
                value={audience}
                onChange={e => setAudience(e.target.value)}
                placeholder="Jóvenes adultos, familias…"
                className="w-full bg-[#0B0F14] border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-500 block mb-1">Pasaje (opcional)</label>
              <input
                type="text"
                value={passage}
                onChange={e => setPassage(e.target.value)}
                placeholder="Rut 1:16-17"
                className="w-full bg-[#0B0F14] border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"
              />
            </div>
            <button
              type="submit"
              disabled={busy === 'create'}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold transition-colors cursor-pointer"
            >
              {busy === 'create' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Guardar idea
            </button>
          </form>

          <div className="bg-[#15191E] border border-white/5 rounded-2xl overflow-hidden">
            <div className="flex border-b border-white/5">
              {(
                [
                  ['activas', 'Activas'],
                  ['aprobadas', 'Aprobadas'],
                  ['descartadas', 'Descartadas'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={`flex-1 px-2 py-2.5 text-[10px] font-bold uppercase tracking-wide transition-colors cursor-pointer ${
                    tab === key
                      ? 'text-indigo-300 bg-indigo-950/30'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="max-h-80 overflow-y-auto p-2 space-y-1">
              {loading ? (
                <p className="text-xs text-slate-500 p-3 text-center">Cargando…</p>
              ) : filtered.length === 0 ? (
                <p className="text-xs text-slate-500 p-3 text-center italic">Sin ideas en esta pestaña</p>
              ) : (
                filtered.map(idea => (
                  <button
                    key={idea.id}
                    type="button"
                    onClick={() => setSelectedId(idea.id)}
                    className={`w-full text-left rounded-xl px-3 py-2.5 transition-colors cursor-pointer ${
                      selected?.id === idea.id
                        ? 'bg-indigo-950/40 border border-indigo-500/30'
                        : 'hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    <p className="text-xs font-semibold text-white line-clamp-2">{idea.rawIdea}</p>
                    <p className="text-[10px] text-slate-500 mt-1">{statusLabel(idea.status)}</p>
                  </button>
                ))
              )}
            </div>
          </div>
        </aside>

        <section className="bg-[#15191E] border border-white/5 rounded-2xl p-5 md:p-6 min-h-[420px]">
          {!selected ? (
            <div className="h-full flex flex-col items-center justify-center text-center gap-3 py-16">
              <Archive className="w-10 h-10 text-slate-600" />
              <p className="text-sm text-slate-400">Selecciona una idea o crea una nueva</p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <span className="text-[10px] font-mono uppercase tracking-wide text-indigo-400/80">
                    {statusLabel(selected.status)}
                  </span>
                  <h2 className="text-lg font-bold text-white leading-snug">{selected.rawIdea}</h2>
                  {(selected.audience || selected.passage) && (
                    <p className="text-xs text-slate-500">
                      {[selected.audience && `Audiencia: ${selected.audience}`, selected.passage && `Pasaje: ${selected.passage}`]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {selected.status !== 'approved' && (
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void handleDeleteIdea(selected.id)}
                      className="p-2 rounded-xl border border-white/10 text-slate-400 hover:text-rose-400 hover:border-rose-500/30 transition-colors cursor-pointer"
                      title="Eliminar idea"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  {selected.status !== 'approved' && (
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void handleBrainstorm(selected.id)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold transition-colors cursor-pointer"
                    >
                      {busy === `brainstorm:${selected.id}` ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4" />
                      )}
                      Generar propuestas con IA
                    </button>
                  )}
                </div>
              </div>

              {selected.status === 'approved' && selected.episodeId && (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-emerald-300">Producción iniciada</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      El investigador está encolado. Hermes y el resto del pipeline continúan desde
                      el workspace.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenWorkspace(selected.episodeId!)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    Abrir workspace
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {selected.proposals.length === 0 ? (
                <div className="border border-dashed border-white/10 rounded-2xl p-10 text-center">
                  <Sparkles className="w-8 h-8 text-indigo-400/50 mx-auto mb-3" />
                  <p className="text-sm text-slate-400">
                    Pulsa &quot;Generar propuestas con IA&quot; para ver títulos y ángulos
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Propuestas ({selected.proposals.filter(p => p.status === 'pending').length} pendientes)
                  </h3>
                  <div className="grid gap-3 md:grid-cols-2">
                    {selected.proposals.map(proposal => (
                      <ProposalCard
                        key={proposal.id}
                        proposal={proposal}
                        ideaId={selected.id}
                        ideaApproved={selected.status === 'approved'}
                        onApprove={handleApprove}
                        onDiscard={handleDiscard}
                        busy={busy}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
