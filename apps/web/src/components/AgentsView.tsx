import { useCallback, useEffect, useState } from 'react';
import { Cpu, Play, Terminal, Loader2 } from 'lucide-react';
import type { AgentDefinition, AgentRunRecord } from '@creator-ai-studio/shared';
import { fetchAgentRuns, fetchAgents, runEpisodeAgent } from '../api';

const AGENT_COLORS: Record<string, string> = {
  hermes: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
  researcher: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
  scriptwriter: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  doctrine_reviewer: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  editorial_reviewer: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  narrator: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
  audio_engineer: 'text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-500/20',
  video_editor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  thumbnail_designer: 'text-pink-400 bg-pink-500/10 border-pink-500/20',
  seo_optimizer: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
  analytics_agent: 'text-lime-400 bg-lime-500/10 border-lime-500/20',
};

interface AgentCard {
  id: string;
  name: string;
  role: string;
  status: 'working' | 'idle' | 'paused' | 'failed';
  currentTask: string;
  progress: number;
  avatarColor: string;
  logs: string[];
}

interface AgentsViewProps {
  episodeId?: string;
}

function runToStatus(run: AgentRunRecord | undefined): AgentCard['status'] {
  if (!run) return 'idle';
  if (run.status === 'running') return 'working';
  if (run.status === 'failed' || run.status === 'blocked') return 'failed';
  return 'idle';
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
      run?.status === 'completed' ? 100 : run?.status === 'running' ? 50 : run?.status === 'failed' ? 0 : 0;
    return {
      id: def.id,
      name: def.name,
      role: def.role,
      status,
      currentTask: run
        ? `${run.status} — ${def.description.slice(0, 80)}…`
        : def.description.slice(0, 100),
      progress,
      avatarColor: AGENT_COLORS[def.id] ?? 'text-slate-400 bg-slate-500/10 border-slate-500/20',
      logs: run?.logs ?? [`[${def.name}] Sin ejecuciones registradas en este episodio.`],
    };
  });
}

export default function AgentsView({ episodeId }: AgentsViewProps) {
  const [definitions, setDefinitions] = useState<AgentDefinition[]>([]);
  const [agents, setAgents] = useState<AgentCard[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('hermes');
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { agents: defs } = await fetchAgents();
      setDefinitions(defs);
      let runs: AgentRunRecord[] = [];
      if (episodeId) {
        const data = await fetchAgentRuns(episodeId);
        runs = data.runs;
      }
      const cards = mergeAgentsWithRuns(defs, runs);
      setAgents(cards);
      if (!cards.some(c => c.id === selectedAgentId) && cards[0]) {
        setSelectedAgentId(cards[0].id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando agentes');
    } finally {
      setLoading(false);
    }
  }, [episodeId, selectedAgentId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const selectedAgent = agents.find(a => a.id === selectedAgentId) ?? agents[0];

  const handleRunAgent = async (agentId: string, autoEnqueuePlan = false) => {
    if (!episodeId) {
      setError('Selecciona un episodio en el workspace para ejecutar agentes.');
      return;
    }
    setRunning(agentId);
    setError(null);
    try {
      await runEpisodeAgent(episodeId, agentId, { autoEnqueuePlan });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo encolar el agente');
    } finally {
      setRunning(null);
    }
  };

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
              Orquestador: <span className="text-rose-300 font-semibold">Hermes</span> en el VPS — coordina el equipo de producción
            </p>
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
            onClick={() => void refresh()}
            className="px-3 py-1.5 rounded-2xl border border-white/10 text-xs text-slate-300 hover:text-white"
          >
            Actualizar
          </button>
        </div>
      </div>

      {!episodeId && (
        <p className="text-xs text-amber-400/90 rounded-xl border border-amber-500/20 bg-amber-950/20 px-3 py-2">
          Abre el workspace de un episodio para ejecutar agentes y ver logs reales persistidos en el servidor.
        </p>
      )}

      {error && (
        <p className="text-xs text-rose-300 rounded-xl border border-rose-500/30 bg-rose-950/20 px-3 py-2">{error}</p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3.5">
          <h4 className="text-[11px] font-bold text-[#8B949E] uppercase tracking-wider font-mono">
            Equipo ({definitions.length} agentes)
          </h4>

          <div className="space-y-3">
            {agents.map(ag => {
              const isWorking = ag.status === 'working';
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
                            isWorking ? 'bg-emerald-400 animate-ping' : ag.status === 'failed' ? 'bg-rose-400' : 'bg-[#8B949E]'
                          }`}
                        />
                      </div>
                      <p className="text-[10px] text-[#8B949E]">{ag.role}</p>
                    </div>
                  </div>

                  <div className="flex-1 max-w-xs text-left">
                    <span className="text-[9px] font-mono text-[#8B949E] uppercase block">Estado:</span>
                    <span className="text-[10px] text-[#E6EDF2] font-semibold line-clamp-2">{ag.currentTask}</span>
                  </div>

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
            Logs persistidos en <code className="text-indigo-300">00-control/agent-runs.json</code> del episodio.
          </p>
        </div>
      </div>
    </div>
  );
}
