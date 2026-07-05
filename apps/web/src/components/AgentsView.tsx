import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Cpu,
  Play,
  Terminal,
  Loader2,
  RefreshCw,
  FileText,
  Image as ImageIcon,
  Film,
  Volume2,
  Download,
  ExternalLink,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import type { AgentDefinition, AgentQualityGate, AgentRunRecord, EpisodeDetail } from '@creator-ai-studio/shared';
import {
  approveAgentRun,
  downloadEpisodeFile,
  fetchAgentRuns,
  fetchAgents,
  fetchEpisodeAssetObjectUrl,
  fetchEpisodeAssets,
  fetchEpisodeDetail,
  runEpisodeAgent,
  type EpisodeAssetsResponse,
} from '../api';

const AGENT_COLORS: Record<string, string> = {
  hermes: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
  researcher: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
  scriptwriter: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  doctrine_reviewer: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  editorial_reviewer: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  storyboard_designer: 'text-teal-400 bg-teal-500/10 border-teal-500/20',
  scene_asset_designer: 'text-lime-400 bg-lime-500/10 border-lime-500/20',
  narrator: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
  audio_engineer: 'text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-500/20',
  video_editor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  thumbnail_designer: 'text-pink-400 bg-pink-500/10 border-pink-500/20',
  seo_optimizer: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
  analytics_agent: 'text-lime-400 bg-lime-500/10 border-lime-500/20',
};

const AGENT_POLL_MS = 15_000;

type AgentCardStatus = 'working' | 'idle' | 'completed' | 'failed' | 'awaiting_approval';

interface AgentCard {
  id: string;
  name: string;
  role: string;
  status: AgentCardStatus;
  currentTask: string;
  progress: number;
  avatarColor: string;
  logs: string[];
  qualityGate?: AgentQualityGate;
  runId?: string;
  requiresHumanApproval?: boolean;
}

interface AgentsViewProps {
  episodeId?: string;
  episodeTitle?: string;
  /** Reload episode in parent app — receives episode id. */
  onEpisodeRefresh?: (episodeId: string) => Promise<void>;
  onOpenWorkspace?: () => void;
}

function runToStatus(run: AgentRunRecord | undefined): AgentCardStatus {
  if (!run) return 'idle';
  if (run.status === 'running') return 'working';
  if (run.status === 'awaiting_approval') return 'awaiting_approval';
  if (run.status === 'completed') return 'completed';
  if (run.status === 'failed' || run.status === 'blocked') return 'failed';
  return 'idle';
}

function formatAgentTask(def: AgentDefinition, run: AgentRunRecord | undefined): string {
  if (!run) return 'Sin ejecuciones en este episodio';
  if (run.status === 'running') return 'En ejecución…';
  const lastLog = run.logs?.at(-1);
  if (run.status === 'completed') {
    return lastLog?.includes('Completado') ? lastLog : `Completado — ${def.name}`;
  }
  if (run.status === 'awaiting_approval') {
    return `Aprobación humana requerida — ${def.name}`;
  }
  if (run.status === 'failed' || run.status === 'blocked') {
    const err = typeof run.output?.error === 'string' ? run.output.error : lastLog;
    return err ?? `Error — ${def.name}`;
  }
  return `${run.status} — ${def.name}`;
}

function mergeAgentsWithRuns(defs: AgentDefinition[], runs: AgentRunRecord[]): AgentCard[] {
  const latestByAgent = new Map<string, AgentRunRecord>();
  for (const run of runs) {
    const prev = latestByAgent.get(run.agentId);
    if (!prev || run.startedAt > prev.startedAt) {
      latestByAgent.set(run.agentId, run);
    }
  }

  return defs.map(def => {
    const run = latestByAgent.get(def.id);
    const status = runToStatus(run);
    const progress =
      status === 'completed'
        ? 100
        : status === 'working'
          ? 50
          : status === 'awaiting_approval'
            ? 85
            : 0;
    return {
      id: def.id,
      name: def.name,
      role: def.role,
      status,
      currentTask: formatAgentTask(def, run),
      progress,
      avatarColor: AGENT_COLORS[def.id] ?? 'text-slate-400 bg-slate-500/10 border-slate-500/20',
      logs: run?.logs ?? [`[${def.name}] Sin ejecuciones registradas en este episodio.`],
      qualityGate: run?.qualityGate,
      runId: run?.id,
      requiresHumanApproval: run?.handoff?.requiresHumanApproval,
    };
  });
}

function previewUrlsEqual(
  a: { thumbnail?: string; video?: string; audio?: string },
  b: { thumbnail?: string; video?: string; audio?: string },
): boolean {
  return a.thumbnail === b.thumbnail && a.video === b.video && a.audio === b.audio;
}

export default function AgentsView({
  episodeId,
  episodeTitle,
  onEpisodeRefresh,
  onOpenWorkspace,
}: AgentsViewProps) {
  const [definitions, setDefinitions] = useState<AgentDefinition[]>([]);
  const [agents, setAgents] = useState<AgentCard[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('hermes');
  const [loading, setLoading] = useState(true);
  const [loadingPreviews, setLoadingPreviews] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [approving, setApproving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [episode, setEpisode] = useState<EpisodeDetail | null>(null);
  const [assets, setAssets] = useState<EpisodeAssetsResponse | null>(null);
  const [previewUrls, setPreviewUrls] = useState<{
    thumbnail?: string;
    video?: string;
    audio?: string;
  }>({});
  const previewUrlsRef = useRef(previewUrls);
  const definitionsRef = useRef<AgentDefinition[]>([]);
  const onEpisodeRefreshRef = useRef(onEpisodeRefresh);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  onEpisodeRefreshRef.current = onEpisodeRefresh;

  const revokePreviewUrls = useCallback((urls: typeof previewUrls) => {
    for (const url of Object.values(urls)) {
      if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
    }
  }, []);

  const applyPreviewUrls = useCallback(
    (next: typeof previewUrls) => {
      if (previewUrlsEqual(previewUrlsRef.current, next)) return;
      revokePreviewUrls(previewUrlsRef.current);
      previewUrlsRef.current = next;
      setPreviewUrls(next);
    },
    [revokePreviewUrls],
  );

  const loadPreviews = useCallback(
    async (id: string, detail: EpisodeDetail, assetList: EpisodeAssetsResponse | null) => {
      const audioPlaying = audioRef.current && !audioRef.current.paused;
      const videoPlaying = videoRef.current && !videoRef.current.paused;

      const next: typeof previewUrls = { ...previewUrlsRef.current };
      const thumbFile = assetList?.files.find(f => f.key === 'thumbnail' && f.available);
      const videoFile = assetList?.files.find(f => f.key === 'video' && f.available);
      const audioFile = assetList?.files.find(f => f.key === 'audio' && f.available);

      if (!videoPlaying) {
        if (videoFile) {
          next.video = (await fetchEpisodeAssetObjectUrl(id, 'video')) ?? undefined;
        } else {
          next.video = undefined;
        }
      }

      if (!audioPlaying) {
        if (audioFile) {
          next.audio = (await fetchEpisodeAssetObjectUrl(id, 'audio')) ?? undefined;
        } else if (detail.content.audioUrl) {
          next.audio = detail.content.audioUrl;
        } else {
          next.audio = undefined;
        }
      }

      if (thumbFile) {
        next.thumbnail = (await fetchEpisodeAssetObjectUrl(id, 'thumbnail')) ?? undefined;
      } else if (detail.content.thumbnailUrl) {
        next.thumbnail = detail.content.thumbnailUrl;
      } else {
        next.thumbnail = undefined;
      }

      applyPreviewUrls(next);
    },
    [applyPreviewUrls],
  );

  const refreshAgentRuns = useCallback(
    async (defs: AgentDefinition[]) => {
      if (!episodeId) return;
      const runsData = await fetchAgentRuns(episodeId);
      const cards = mergeAgentsWithRuns(defs, runsData.runs);
      setAgents(cards);
      setSelectedAgentId(prev => (cards.some(c => c.id === prev) ? prev : (cards[0]?.id ?? 'hermes')));
      setLastRefreshedAt(
        new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      );
      return cards;
    },
    [episodeId],
  );

  const loadEpisodeBundle = useCallback(
    async (opts?: { includePreviews?: boolean }) => {
      if (!episodeId) return;
      if (opts?.includePreviews) setLoadingPreviews(true);
      try {
        const [detail, assetsData] = await Promise.all([
          fetchEpisodeDetail(episodeId),
          fetchEpisodeAssets(episodeId).catch(() => null),
        ]);
        setEpisode(detail);
        setAssets(assetsData);
        if (opts?.includePreviews) {
          await loadPreviews(episodeId, detail, assetsData);
        }
      } finally {
        setLoadingPreviews(false);
      }
    },
    [episodeId, loadPreviews],
  );

  const refresh = useCallback(
    async (opts?: { silent?: boolean; agentsOnly?: boolean; syncParent?: boolean }) => {
      const silent = opts?.silent ?? false;
      const agentsOnly = opts?.agentsOnly ?? false;
      if (!silent) setRefreshing(true);
      setError(null);
      try {
        let defs = definitionsRef.current;
        if (defs.length === 0) {
          const res = await fetchAgents();
          defs = res.agents;
          definitionsRef.current = defs;
          setDefinitions(defs);
        }

        if (episodeId) {
          if (agentsOnly) {
            await refreshAgentRuns(defs);
          } else {
            await refreshAgentRuns(defs);
            await loadEpisodeBundle({ includePreviews: true });
            if (opts?.syncParent && onEpisodeRefreshRef.current) {
              await onEpisodeRefreshRef.current(episodeId);
            }
          }
        } else {
          setEpisode(null);
          setAssets(null);
          revokePreviewUrls(previewUrlsRef.current);
          previewUrlsRef.current = {};
          setPreviewUrls({});
          setAgents(mergeAgentsWithRuns(defs, []));
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error cargando agentes');
      } finally {
        setLoading(false);
        if (!silent) setRefreshing(false);
      }
    },
    [episodeId, refreshAgentRuns, loadEpisodeBundle, revokePreviewUrls],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const { agents: defs } = await fetchAgents();
        if (cancelled) return;
        definitionsRef.current = defs;
        setDefinitions(defs);
        if (episodeId) {
          await refreshAgentRuns(defs);
          if (cancelled) return;
          setLoading(false);
          await loadEpisodeBundle({ includePreviews: true });
        } else {
          setAgents(mergeAgentsWithRuns(defs, []));
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Error cargando agentes');
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [episodeId, refreshAgentRuns, loadEpisodeBundle]);

  useEffect(() => {
    return () => revokePreviewUrls(previewUrlsRef.current);
  }, [revokePreviewUrls]);

  useEffect(() => {
    if (!episodeId) return;
    const hasActive = agents.some(a => a.status === 'working');
    if (!hasActive) return;
    const timer = window.setInterval(() => {
      void refresh({ silent: true, agentsOnly: true });
    }, AGENT_POLL_MS);
    return () => window.clearInterval(timer);
  }, [episodeId, agents, refresh]);

  const selectedAgent = agents.find(a => a.id === selectedAgentId) ?? agents[0];

  const handleApproveRun = async (runId: string) => {
    if (!episodeId) return;
    setApproving(runId);
    setError(null);
    try {
      await approveAgentRun(episodeId, runId);
      await refresh({ silent: true, syncParent: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo aprobar el agente');
    } finally {
      setApproving(null);
    }
  };

  const handleRunAgent = async (agentId: string, autoEnqueuePlan = false) => {
    if (!episodeId) {
      setError('Selecciona un episodio en el workspace para ejecutar agentes.');
      return;
    }
    setRunning(agentId);
    setError(null);
    try {
      await runEpisodeAgent(episodeId, agentId, { autoEnqueuePlan });
      await refresh({ silent: true, agentsOnly: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo encolar el agente');
    } finally {
      setRunning(null);
    }
  };

  const scriptText = episode?.content.script?.trim() ?? '';
  const scriptWords = scriptText ? scriptText.split(/\s+/).filter(Boolean).length : 0;

  if (loading && agents.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400 text-sm gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        Cargando agentes…
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#15191E] p-4.5 rounded-2xl border border-[rgba(255,255,255,0.05)]">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 rounded-2xl text-indigo-400">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display font-bold text-base text-white">Agentes especializados (API real)</h2>
            <p className="text-[11px] text-[#8B949E]">
              Orquestador: <span className="text-rose-300 font-semibold">Hermes</span> en el VPS
              {episodeTitle ? (
                <>
                  {' '}
                  · Episodio: <span className="text-white">{episodeTitle}</span>
                </>
              ) : null}
            </p>
            {lastRefreshedAt && (
              <p className="text-[10px] text-slate-500 font-mono mt-0.5">Actualizado {lastRefreshedAt}</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!episodeId || running !== null}
            onClick={() => void handleRunAgent('hermes', true)}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-2xl bg-rose-700 hover:bg-rose-600 disabled:opacity-50 text-white text-xs font-bold transition-colors cursor-pointer"
          >
            {running === 'hermes' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Hermes: orquestar episodio
          </button>
          <button
            type="button"
            disabled={refreshing}
            onClick={() => void refresh({ syncParent: true })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border border-white/10 text-xs text-slate-300 hover:text-white disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Actualizando…' : 'Actualizar'}
          </button>
        </div>
      </div>

      {!episodeId && (
        <p className="text-xs text-amber-400/90 rounded-xl border border-amber-500/20 bg-amber-950/20 px-3 py-2">
          Abre el workspace de un episodio (Proyectos → Abrir proyecto) para ejecutar agentes y ver guion, miniatura y
          video generados.
        </p>
      )}

      {error && (
        <p className="text-xs text-rose-300 rounded-xl border border-rose-500/30 bg-rose-950/20 px-3 py-2">{error}</p>
      )}

      {episodeId && episode && (
        <div className="bg-[#15191E] border border-[rgba(255,255,255,0.05)] rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
              Producción del episodio
              {loadingPreviews ? (
                <span className="ml-2 text-[10px] text-slate-500 font-normal normal-case">cargando previews…</span>
              ) : null}
            </h3>
            {onOpenWorkspace && (
              <button
                type="button"
                onClick={onOpenWorkspace}
                className="flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300 font-bold cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Abrir workspace completo
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="rounded-xl border border-white/5 bg-[#0B0F14] p-3 space-y-2">
              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase">
                <FileText className="w-3.5 h-3.5 text-amber-400" />
                Guion
              </div>
              {scriptText ? (
                <>
                  <p className="text-[10px] text-slate-300 line-clamp-6 leading-relaxed whitespace-pre-wrap">
                    {scriptText.slice(0, 600)}
                    {scriptText.length > 600 ? '…' : ''}
                  </p>
                  <p className="text-[9px] text-slate-500 font-mono">{scriptWords} palabras</p>
                  <button
                    type="button"
                    onClick={() => void downloadEpisodeFile(episodeId, 'script')}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                  >
                    <Download className="w-3 h-3" /> Descargar guion
                  </button>
                </>
              ) : (
                <p className="text-[10px] text-slate-500 italic">Pendiente — ejecuta Investigador o Guionista</p>
              )}
            </div>

            <div className="rounded-xl border border-white/5 bg-[#0B0F14] p-3 space-y-2">
              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase">
                <ImageIcon className="w-3.5 h-3.5 text-pink-400" />
                Miniatura
              </div>
              {previewUrls.thumbnail ? (
                <img
                  src={previewUrls.thumbnail}
                  alt="Miniatura del episodio"
                  className="w-full aspect-video object-cover rounded-lg border border-white/10"
                />
              ) : (
                <p className="text-[10px] text-slate-500 italic py-8 text-center">Sin miniatura aún</p>
              )}
            </div>

            <div className="rounded-xl border border-white/5 bg-[#0B0F14] p-3 space-y-2">
              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase">
                <Volume2 className="w-3.5 h-3.5 text-violet-400" />
                Narración
              </div>
              {previewUrls.audio ? (
                <audio ref={audioRef} controls src={previewUrls.audio} className="w-full h-8" />
              ) : (
                <p className="text-[10px] text-slate-500 italic py-4">Sin audio — job TTS pendiente</p>
              )}
            </div>

            <div className="rounded-xl border border-white/5 bg-[#0B0F14] p-3 space-y-2">
              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase">
                <Film className="w-3.5 h-3.5 text-emerald-400" />
                Video
              </div>
              {previewUrls.video ? (
                <video
                  ref={videoRef}
                  controls
                  src={previewUrls.video}
                  className="w-full aspect-video rounded-lg border border-white/10"
                />
              ) : (
                <p className="text-[10px] text-slate-500 italic py-8 text-center">Sin render — ejecuta pipeline video</p>
              )}
            </div>
          </div>

          {assets && assets.files.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {assets.files
                .filter(f => f.available && f.key !== 'content')
                .map(f => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => void downloadEpisodeFile(episodeId, f.key)}
                    className="text-[10px] px-2 py-1 rounded-lg border border-white/10 text-slate-400 hover:text-white cursor-pointer"
                  >
                    ↓ {f.label}
                  </button>
                ))}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3.5">
          <h4 className="text-[11px] font-bold text-[#8B949E] uppercase tracking-wider font-mono">
            Equipo ({definitions.length} agentes)
          </h4>

          <div className="space-y-3">
            {agents.map(ag => {
              const isWorking = ag.status === 'working';
              const isCompleted = ag.status === 'completed';
              const isAwaiting = ag.status === 'awaiting_approval';
              const isSelected = selectedAgentId === ag.id;

              return (
                <div
                  key={ag.id}
                  onClick={() => setSelectedAgentId(ag.id)}
                  className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-950/20 border-indigo-500'
                      : 'bg-[#15191E] border-[rgba(255,255,255,0.05)] hover:border-[#30363D]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-2xl border flex items-center justify-center font-bold text-sm shrink-0 ${ag.avatarColor}`}
                    >
                      {ag.name.substring(0, 2)}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs font-bold text-white">{ag.name}</h4>
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isWorking
                              ? 'bg-emerald-400 animate-ping'
                              : isCompleted
                                ? 'bg-emerald-500'
                                : isAwaiting
                                  ? 'bg-amber-400 animate-pulse'
                                : ag.status === 'failed'
                                  ? 'bg-rose-400'
                                  : 'bg-[#8B949E]'
                          }`}
                        />
                      </div>
                      <p className="text-[10px] text-[#8B949E]">{ag.role}</p>
                    </div>
                  </div>

                  <div className="flex-1 max-w-xs text-left space-y-1">
                    <span className="text-[9px] font-mono text-[#8B949E] uppercase block">Estado:</span>
                    <span className="text-[10px] text-[#E6EDF2] font-semibold line-clamp-2">{ag.currentTask}</span>
                    {ag.qualityGate && (
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {ag.qualityGate.checks.map(check => (
                          <span
                            key={check.key}
                            title={check.detail ?? check.label}
                            className={`inline-flex items-center gap-0.5 text-[8px] px-1.5 py-0.5 rounded border ${
                              check.ok
                                ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
                                : 'border-rose-500/30 text-rose-400 bg-rose-500/10'
                            }`}
                          >
                            {check.ok ? <CheckCircle2 className="w-2.5 h-2.5" /> : <XCircle className="w-2.5 h-2.5" />}
                            {check.label}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {isAwaiting && ag.runId && (
                      <button
                        type="button"
                        disabled={approving !== null}
                        onClick={e => {
                          e.stopPropagation();
                          void handleApproveRun(ag.runId!);
                        }}
                        className="px-2 py-1 rounded-lg bg-amber-600/80 hover:bg-amber-500 text-[9px] font-bold text-white cursor-pointer disabled:opacity-50"
                      >
                        {approving === ag.runId ? '…' : 'Aprobar'}
                      </button>
                    )}
                    <button
                    type="button"
                    disabled={!episodeId || running !== null}
                    onClick={e => {
                      e.stopPropagation();
                      void handleRunAgent(ag.id);
                    }}
                    className="p-2 rounded bg-[#0B0F14] hover:bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.05)] text-[#8B949E] hover:text-white transition-colors cursor-pointer disabled:opacity-40"
                    title="Encolar agente"
                  >
                    {running === ag.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Play className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                  </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-[#15191E] border border-[rgba(255,255,255,0.05)] rounded-2xl p-5 flex flex-col h-[400px] lg:h-auto shadow-lg">
          <div className="space-y-3 flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.05)] pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-bold text-white font-mono uppercase tracking-wider">
                  Logs: {selectedAgent?.name ?? '—'}
                </span>
              </div>
            </div>

            <div className="flex-1 bg-[#0B0F14] rounded-2xl p-4 overflow-y-auto space-y-2.5 font-mono text-[10px] leading-relaxed text-[#8B949E] border border-[rgba(255,255,255,0.05)]/60">
              {selectedAgent?.qualityGate && (
                <div className="mb-3 p-2 rounded-lg border border-white/5 bg-[#15191E] space-y-1">
                  <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase text-slate-400">
                    <AlertCircle className="w-3 h-3" />
                    Puerta de calidad — {selectedAgent.qualityGate.passed ? 'aprobada' : 'fallida'}
                  </div>
                  {selectedAgent.qualityGate.checks.map(check => (
                    <div key={check.key} className="flex items-center gap-1.5 text-[9px]">
                      {check.ok ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                      ) : (
                        <XCircle className="w-3 h-3 text-rose-400 shrink-0" />
                      )}
                      <span>{check.label}</span>
                      {check.detail ? <span className="text-slate-500">({check.detail})</span> : null}
                    </div>
                  ))}
                </div>
              )}
              {!selectedAgent || selectedAgent.logs.length === 0 ? (
                <div className="text-center italic py-16 text-[#8B949E]/60">Sin registros</div>
              ) : (
                selectedAgent.logs.map((log, index) => (
                  <div key={index} className="border-l border-[rgba(255,255,255,0.05)] pl-2">
                    <span className="text-indigo-400/80 mr-1.5">❯</span>
                    <span>{log}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <p className="text-[9px] text-[#8B949E] pt-3 font-mono leading-normal shrink-0">
            Logs en <code className="text-indigo-300">00-control/agent-runs.json</code>
          </p>
        </div>
      </div>
    </div>
  );
}
