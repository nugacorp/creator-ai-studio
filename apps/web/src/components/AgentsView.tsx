import { useState, useEffect } from 'react';
import { Cpu, Play, Pause, Plus, Terminal, RefreshCw, CheckCircle2, UserCheck, Code, Sparkles } from 'lucide-react';
import { fetchEpisodeDetail } from '../api';
import { EPISODE_STAGES } from '@creator-ai-studio/shared';

interface Agent {
  id: string;
  name: string;
  role: string;
  status: 'working' | 'idle' | 'paused';
  currentTask: string;
  progress: number;
  avatarColor: string;
  logs: string[];
}

const STAGE_AGENTS: Record<string, { name: string; role: string; color: string }> = {
  research: { name: 'Researcher Sofia', role: 'Investigación', color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
  script: { name: 'Writer Marcus', role: 'Guionista IA', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  audio: { name: 'Narrator Elena', role: 'Narración TTS', color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
  video: { name: 'Editor Alex', role: 'Editor de Video', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  seo: { name: 'SEO Agent', role: 'Optimización SEO', color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
};

interface AgentsViewProps {
  episodeId?: string;
}

export default function AgentsView({ episodeId }: AgentsViewProps) {
  const [agents, setAgents] = useState<Agent[]>([
    {
      id: '1',
      name: 'Director James',
      role: 'Director de Producción',
      status: 'working',
      currentTask: 'Planificando el ritmo narrativo para "La Ansiedad"',
      progress: 45,
      avatarColor: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
      logs: [
        '[Director James] Analizando la retención media de los últimos videos...',
        '[Director James] Estructurando ganchos dramáticos para los primeros 30 segundos.',
        '[Director James] Generando instrucciones para el Guionista IA.'
      ]
    },
    {
      id: '2',
      name: 'Researcher Sofia',
      role: 'Especialista en Investigación',
      status: 'idle',
      currentTask: 'A la espera de nuevas directrices de temas',
      progress: 100,
      avatarColor: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
      logs: [
        '[Researcher Sofia] Búsqueda finalizada: Versículos sobre la angustia en Proverbios.',
        '[Researcher Sofia] He consolidado un PDF con 12 referencias teológicas validadas.'
      ]
    },
    {
      id: '3',
      name: 'Scriptwriter Mark',
      role: 'Redactor Creativo',
      status: 'working',
      currentTask: 'Reescribiendo párrafos emocionales',
      progress: 82,
      avatarColor: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
      logs: [
        '[Scriptwriter Mark] Refinando la prosa para Filipenses 4:6.',
        '[Scriptwriter Mark] Ajustando longitud del script para no superar los 8 minutos.'
      ]
    },
    {
      id: '4',
      name: 'Narrator Kore',
      role: 'Sintetizador de Voz',
      status: 'idle',
      currentTask: 'Renderizado de pista de voz completado',
      progress: 100,
      avatarColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
      logs: [
        '[Narrator Kore] Modelo de voz profunda (24kHz) inicializado.',
        '[Narrator Kore] Sincronización labial completada.'
      ]
    },
    {
      id: '5',
      name: 'Editor Moises',
      role: 'Editor de Video Automático',
      status: 'working',
      currentTask: 'Procesando transiciones y acoplando subtítulos',
      progress: 60,
      avatarColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
      logs: [
        '[Editor Moises] Sincronizando pistas de imágenes con audio de Kore.',
        '[Editor Moises] Aplicando sombra negra a los subtítulos amarillos.'
      ]
    }
  ]);

  const [selectedAgentId, setSelectedAgentId] = useState<string>('1');
  const selectedAgent = agents.find(a => a.id === selectedAgentId) || agents[0];

  useEffect(() => {
    if (!episodeId) return;
    void fetchEpisodeDetail(episodeId).then(detail => {
      const stageAgents = EPISODE_STAGES.filter(s => STAGE_AGENTS[s]).map(stage => {
        const meta = STAGE_AGENTS[stage]!;
        const stageState = detail.stages.find(s => s.stage === stage);
        const isWorking = stageState?.status === 'in_progress';
        const isDone = stageState?.status === 'completed';
        return {
          id: stage,
          name: meta.name,
          role: meta.role,
          status: isWorking ? 'working' as const : isDone ? 'idle' as const : 'paused' as const,
          currentTask: `Etapa ${stage}: ${stageState?.status ?? 'pending'}`,
          progress: isDone ? 100 : isWorking ? 50 : 0,
          avatarColor: meta.color,
          logs: [`[${meta.name}] Estado: ${stageState?.status ?? 'pending'}`],
        };
      });
      if (stageAgents.length > 0) {
        setAgents(stageAgents);
        setSelectedAgentId(stageAgents[0].id);
      }
    });
  }, [episodeId]);

  // Dynamic logs simulator
  useEffect(() => {
    const interval = setInterval(() => {
      setAgents(prev =>
        prev.map(ag => {
          if (ag.status !== 'working') return ag;
          
          const newProgress = ag.progress >= 100 ? 0 : ag.progress + Math.floor(Math.random() * 5) + 1;
          const mockLogLines = [
            `[${ag.name}] Sincronizando metadatos con el servidor principal...`,
            `[${ag.name}] Optimizando recursos del hilo de procesamiento en segundo plano...`,
            `[${ag.name}] Realizando verificación de coherencia estructural...`,
            `[${ag.name}] Tarea en ejecución: ${ag.currentTask} (${newProgress}%)`
          ];
          const newLogLine = mockLogLines[Math.floor(Math.random() * mockLogLines.length)];

          return {
            ...ag,
            progress: newProgress,
            logs: [...ag.logs.slice(-15), newLogLine] // keep last 15 logs
          };
        })
      );
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  const handleToggleAgentStatus = (id: string) => {
    setAgents(prev =>
      prev.map(ag => {
        if (ag.id !== id) return ag;
        const nextStatus = ag.status === 'working' ? 'paused' : 'working';
        return {
          ...ag,
          status: nextStatus,
          currentTask: nextStatus === 'paused' ? 'Pausado por Ramiro' : 'Reanudando procesamiento...'
        };
      })
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Agents Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#15191E] p-4.5 rounded-2xl border border-[rgba(255,255,255,0.05)]">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 rounded-2xl text-indigo-400">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display font-bold text-base text-white">Consola de Agentes Autónomos IA</h2>
            <p className="text-[11px] text-[#8B949E]">Tus asistentes de contenido cooperando en paralelo para agilizar tu producción diaria</p>
          </div>
        </div>

        <button
          onClick={() => {
            const name = prompt('Nombre del nuevo agente:');
            if (!name) return;
            const role = prompt('Rol del agente:');
            if (!role) return;

            const newAg: Agent = {
              id: `ag_${Date.now()}`,
              name,
              role,
              status: 'idle',
              currentTask: 'Listo para recibir órdenes de producción',
              progress: 0,
              avatarColor: 'text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-500/20',
              logs: [`[${name}] Agente reclutado en Creator AI Studio.`]
            };
            setAgents(prev => [...prev, newAg]);
          }}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Reclutar Agente Especialista</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Agents list */}
        <div className="lg:col-span-2 space-y-3.5">
          <h4 className="text-[11px] font-bold text-[#8B949E] uppercase tracking-wider font-mono">Agentes Disponibles</h4>
          
          <div className="space-y-3">
            {agents.map(ag => {
              const isWorking = ag.status === 'working';
              const isPaused = ag.status === 'paused';
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
                  {/* Info */}
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-2xl border flex items-center justify-center font-bold text-sm shrink-0 ${ag.avatarColor}`}>
                      {ag.name.substring(0, 2)}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs font-bold text-white">{ag.name}</h4>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          isWorking ? 'bg-emerald-400 animate-ping' : isPaused ? 'bg-rose-400' : 'bg-[#8B949E]'
                        }`} />
                      </div>
                      <p className="text-[10px] text-[#8B949E]">{ag.role}</p>
                    </div>
                  </div>

                  {/* Task detail */}
                  <div className="flex-1 max-w-xs text-left">
                    <span className="text-[9px] font-mono text-[#8B949E] uppercase block">Tarea actual:</span>
                    <span className="text-[10px] text-[#E6EDF2] font-semibold line-clamp-1">
                      {ag.currentTask}
                    </span>

                    {/* Progress slider bar */}
                    {isWorking && (
                      <div className="w-full h-1 bg-[#0B0F14] rounded-full overflow-hidden mt-1 p-[0.5px]">
                        <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${ag.progress}%` }} />
                      </div>
                    )}
                  </div>

                  {/* Action status toggle */}
                  <div className="flex items-center gap-2 self-stretch sm:self-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleAgentStatus(ag.id);
                      }}
                      className="p-2 rounded bg-[#0B0F14] hover:bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.05)] text-[#8B949E] hover:text-white transition-colors cursor-pointer"
                      title={isWorking ? 'Pausar agente' : 'Iniciar agente'}
                    >
                      {isWorking ? <Pause className="w-3.5 h-3.5 text-amber-500" /> : <Play className="w-3.5 h-3.5 text-emerald-400" />}
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Console output panel */}
        <div className="bg-[#15191E] border border-[rgba(255,255,255,0.05)] rounded-2xl p-5 flex flex-col h-[400px] lg:h-auto justify-between shadow-lg">
          <div className="space-y-3 flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.05)] pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-bold text-white font-mono uppercase tracking-wider">Consola: {selectedAgent.name}</span>
              </div>
              <span className="px-2 py-0.5 bg-[#0B0F14] text-[9px] text-[#8B949E] font-mono border border-[rgba(255,255,255,0.05)] rounded">TTY-1</span>
            </div>

            {/* Log output rows */}
            <div className="flex-1 bg-[#0B0F14] rounded-2xl p-4 overflow-y-auto space-y-2.5 font-mono text-[10px] leading-relaxed text-[#8B949E] border border-[rgba(255,255,255,0.05)]/60">
              {selectedAgent.logs.length === 0 ? (
                <div className="text-center italic py-16 text-[#8B949E]/60">Sin registros disponibles</div>
              ) : (
                selectedAgent.logs.map((log, index) => (
                  <div key={index} className="hover:text-white transition-colors border-l border-[rgba(255,255,255,0.05)] pl-2">
                    <span className="text-indigo-400/80 mr-1.5">❯</span>
                    <span>{log}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <p className="text-[9px] text-[#8B949E] pt-3 font-mono leading-normal shrink-0">
            * Los agentes cooperan entre sí mediante APIs internas de Creator OS.
          </p>
        </div>

      </div>

    </div>
  );
}
