import { useCallback, useEffect, useState } from 'react';
import { Brain, Cpu, FolderKanban, Loader2, Save, Sparkles } from 'lucide-react';
import type { AgentDefinition } from '@creator-ai-studio/shared';
import { fetchAgentConfig, fetchAgents, type AgentConfigResponse } from '../api';
import { PIPELINE_STEPS } from '../lib/projectPipeline';

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
  analytics_agent: 'text-lime-400 bg-lime-500/10 border-lime-400/20',
};

function notesKey(agentId: string): string {
  return `creator-ai-agent-notes-${agentId}`;
}

interface AgentStudioViewProps {
  onOpenProjects?: () => void;
}

export default function AgentStudioView({ onOpenProjects }: AgentStudioViewProps) {
  const [agents, setAgents] = useState<AgentDefinition[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [config, setConfig] = useState<AgentConfigResponse | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customNotes, setCustomNotes] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void fetchAgents()
      .then(data => {
        setAgents(data.agents);
        setSelectedId(data.agents[0]?.id ?? null);
      })
      .catch(() => setError('No se pudo cargar la lista de agentes'))
      .finally(() => setLoadingList(false));
  }, []);

  const loadConfig = useCallback(async (agentId: string) => {
    setLoadingConfig(true);
    setError(null);
    try {
      const cfg = await fetchAgentConfig(agentId);
      setConfig(cfg);
      setCustomNotes(localStorage.getItem(notesKey(agentId)) ?? '');
    } catch {
      setError('No se pudo cargar la configuración del agente');
      setConfig(null);
    } finally {
      setLoadingConfig(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) void loadConfig(selectedId);
  }, [selectedId, loadConfig]);

  const pipelineStep = PIPELINE_STEPS.find(s => s.agentId === selectedId);

  const handleSaveNotes = () => {
    if (!selectedId) return;
    localStorage.setItem(notesKey(selectedId), customNotes);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loadingList) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-400 py-8">
        <Loader2 className="w-4 h-4 animate-spin" />
        Cargando estudio de agentes…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="bg-[#15191E] border border-white/5 rounded-2xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display font-bold text-lg text-white flex items-center gap-2">
              <Cpu className="w-5 h-5 text-indigo-400" />
              Estudio de agentes
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Configura prompts, skills y notas de cada agente. La ejecución y aprobación ocurren
              dentro de cada proyecto en el tablero Kanban.
            </p>
          </div>
          {onOpenProjects && (
            <button
              type="button"
              onClick={onOpenProjects}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 text-xs font-bold text-slate-300 hover:text-white cursor-pointer"
            >
              <FolderKanban className="w-4 h-4" />
              Ir a Proyectos
            </button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-5">
        <aside className="bg-[#15191E] border border-white/5 rounded-2xl p-3 space-y-1 max-h-[70vh] overflow-y-auto">
          {agents.map(agent => {
            const colors = AGENT_COLORS[agent.id] ?? 'text-slate-300 bg-white/5 border-white/10';
            const step = PIPELINE_STEPS.find(s => s.agentId === agent.id);
            return (
              <button
                key={agent.id}
                type="button"
                onClick={() => setSelectedId(agent.id)}
                className={`w-full text-left px-3 py-2.5 rounded-xl border transition-colors cursor-pointer ${
                  selectedId === agent.id ? colors : 'border-transparent hover:bg-white/5 text-slate-400'
                }`}
              >
                <p className="text-xs font-bold text-white">{agent.name}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{agent.role}</p>
                {step && (
                  <p className="text-[9px] text-indigo-400/80 mt-1 font-mono uppercase">
                    Kanban · {step.column}
                  </p>
                )}
              </button>
            );
          })}
        </aside>

        <main className="bg-[#15191E] border border-white/5 rounded-2xl p-5 space-y-5 min-h-[420px]">
          {error && (
            <p className="text-xs text-rose-300 border border-rose-500/30 bg-rose-950/20 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          {loadingConfig || !config ? (
            <div className="flex items-center gap-2 text-sm text-slate-400 py-12 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" />
              Cargando agente…
            </div>
          ) : (
            <>
              <div>
                <p className="text-[10px] text-indigo-300 font-mono uppercase tracking-wider">
                  {config.id}
                </p>
                <h2 className="text-base font-bold text-white mt-1">{config.name}</h2>
                <p className="text-xs text-slate-400 mt-1">{config.description}</p>
                {pipelineStep && (
                  <p className="text-[11px] text-slate-500 mt-2">
                    Etapa Kanban: <span className="text-slate-300">{pipelineStep.column}</span> —{' '}
                    {pipelineStep.description}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-white/5 bg-[#0B0F14] p-4">
                  <h3 className="text-[10px] font-mono uppercase text-slate-500 flex items-center gap-1.5">
                    <Brain className="w-3.5 h-3.5" />
                    Skills / expertise
                  </h3>
                  <ul className="mt-2 space-y-1">
                    {(config.skills ?? config.expertise).map(skill => (
                      <li key={skill} className="text-[11px] text-slate-300 flex items-start gap-1.5">
                        <Sparkles className="w-3 h-3 text-indigo-400 shrink-0 mt-0.5" />
                        {skill}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl border border-white/5 bg-[#0B0F14] p-4 space-y-2">
                  <h3 className="text-[10px] font-mono uppercase text-slate-500">Configuración</h3>
                  <dl className="text-[11px] space-y-1.5">
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-500">Estado</dt>
                      <dd className="text-slate-300 font-mono">{config.status}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-500">Etapa episodio</dt>
                      <dd className="text-slate-300 font-mono">{config.episodeStage ?? '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500 mb-1">Jobs permitidos</dt>
                      <dd className="text-slate-400 font-mono text-[10px] leading-relaxed">
                        {config.allowedJobTypes.join(', ')}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>

              <div>
                <h3 className="text-[10px] font-mono uppercase text-slate-500 mb-2">
                  System prompt (solo lectura)
                </h3>
                <pre className="text-[10px] text-slate-400 bg-[#0B0F14] border border-white/5 rounded-xl p-4 max-h-56 overflow-y-auto whitespace-pre-wrap font-mono leading-relaxed">
                  {config.systemPrompt}
                </pre>
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="text-[10px] font-mono uppercase text-slate-500">
                    Instrucciones adicionales (local)
                  </h3>
                  <button
                    type="button"
                    onClick={handleSaveNotes}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-[10px] font-bold text-white cursor-pointer"
                  >
                    <Save className="w-3 h-3" />
                    {saved ? 'Guardado' : 'Guardar'}
                  </button>
                </div>
                <textarea
                  value={customNotes}
                  onChange={e => setCustomNotes(e.target.value)}
                  rows={4}
                  placeholder="Notas para refinar el comportamiento de este agente. En el futuro, analytics alimentará mejoras automáticas."
                  className="w-full text-xs text-slate-300 bg-[#0B0F14] border border-white/10 rounded-xl p-3 resize-y focus:outline-none focus:border-indigo-500/50"
                />
                <p className="text-[10px] text-slate-600 mt-1">
                  La ejecución con estas notas y el aprendizaje desde analytics se integrarán en una
                  próxima versión.
                </p>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
