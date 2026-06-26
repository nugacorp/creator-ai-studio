import React, { useState } from 'react';
import { Network, Play, Plus, Zap, ArrowRight, CheckCircle2, RefreshCw, Layers, Database, Cpu, Mail, Sparkles, Sliders } from 'lucide-react';
import { createJob, fetchJob } from '../api';

interface AutomationNode {
  id: string;
  name: string;
  type: 'trigger' | 'action' | 'condition';
  status: 'active' | 'inactive';
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface AutomationViewProps {
  episodeId?: string;
}

export default function AutomationView({ episodeId }: AutomationViewProps) {
  const [isRunningTest, setIsRunningTest] = useState(false);
  const [currentActiveNodeIndex, setCurrentActiveNodeIndex] = useState<number | null>(null);

  const [nodes, setNodes] = useState<AutomationNode[]>([
    { id: '1', name: 'Nuevo Video Renderizado', type: 'trigger', status: 'active', description: 'Se activa al exportarse el render 1080p', icon: Zap },
    { id: '2', name: 'Transcripción por Gemini', type: 'action', status: 'active', description: 'Transcribe audio a texto para subtítulos', icon: Sparkles },
    { id: '3', name: 'Agente SEO Redactor', type: 'action', status: 'active', description: 'Optimiza el título, tags y descripción', icon: Cpu },
    { id: '4', name: 'Subir a YouTube API', type: 'action', status: 'active', description: 'Publica en modo borrador al canal', icon: Database },
    { id: '5', name: 'Notificación Telegram', type: 'action', status: 'active', description: 'Envía alerta al equipo con link del video', icon: Mail }
  ]);

  const [showAddNodeModal, setShowAddNodeModal] = useState(false);
  const [newNodeName, setNewNodeName] = useState('');
  const [newNodeType, setNewNodeType] = useState<'trigger' | 'action' | 'condition'>('action');
  const [newNodeDesc, setNewNodeDesc] = useState('');

  const handleRunTest = async () => {
    setIsRunningTest(true);
    setCurrentActiveNodeIndex(0);

    if (episodeId) {
      try {
        const job = await createJob(episodeId, { type: 'render' });
        const poll = setInterval(async () => {
          const updated = await fetchJob(job.id);
          if (updated.status === 'completed' || updated.status === 'failed') {
            clearInterval(poll);
            setIsRunningTest(false);
            setCurrentActiveNodeIndex(null);
          } else {
            setCurrentActiveNodeIndex(prev =>
              prev === null ? 0 : Math.min((prev ?? 0) + 1, nodes.length - 1),
            );
          }
        }, 1500);
        return;
      } catch {
        // fall through to UI simulation
      }
    }

    const interval = setInterval(() => {
      setCurrentActiveNodeIndex(prev => {
        if (prev === null) return null;
        if (prev >= nodes.length - 1) {
          clearInterval(interval);
          setIsRunningTest(false);
          return null;
        }
        return prev + 1;
      });
    }, 1500);
  };

  const handleAddNode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNodeName.trim()) return;

    const newNode: AutomationNode = {
      id: `node_${Date.now()}`,
      name: newNodeName,
      type: newNodeType,
      status: 'active',
      description: newNodeDesc || 'Nodo de automatización personalizada',
      icon: newNodeType === 'trigger' ? Zap : newNodeType === 'condition' ? Sliders : Cpu
    };

    setNodes(prev => [...prev, newNode]);
    setNewNodeName('');
    setNewNodeDesc('');
    setShowAddNodeModal(false);
  };

  const handleToggleNodeStatus = (id: string) => {
    setNodes(prev =>
      prev.map(n => (n.id === id ? { ...n, status: n.status === 'active' ? 'inactive' : 'active' } : n))
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Automation Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#15191E] p-4.5 rounded-2xl border border-[rgba(255,255,255,0.05)]">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 rounded-2xl text-indigo-400">
            <Network className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display font-bold text-base text-white">Flujos de Automatización (Estilo n8n)</h2>
            <p className="text-[11px] text-[#8B949E]">Conecta gatillos, APIs y tus agentes autónomos de IA en un canvas visual</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRunTest}
            disabled={isRunningTest}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-2xl bg-[rgba(255,255,255,0.05)] hover:bg-[#30363D] disabled:opacity-35 text-white text-xs font-semibold cursor-pointer border border-[#30363d] transition-colors"
          >
            {isRunningTest ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                <span>Ejecutando Test...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 text-emerald-400" />
                <span>Ejecutar Flujo de Prueba</span>
              </>
            )}
          </button>

          <button
            onClick={() => setShowAddNodeModal(true)}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Añadir Nodo</span>
          </button>
        </div>
      </div>

      {/* Visual Canvas Nodes row */}
      <div className="bg-[#0B0F14] border border-[rgba(255,255,255,0.05)] rounded-2xl p-8 overflow-x-auto min-h-[400px] flex items-center justify-center relative select-none">
        {/* Connection Background lines layer */}
        <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:16px_16px] opacity-35" />

        <div className="flex flex-col lg:flex-row items-center gap-12 relative z-10 min-w-[900px] py-10 justify-center">
          {nodes.map((node, index) => {
            const Icon = node.icon;
            const isCurrentActive = currentActiveNodeIndex === index;
            const isPassedActive = currentActiveNodeIndex !== null && index < currentActiveNodeIndex;
            const isInactive = node.status === 'inactive';

            return (
              <div key={node.id} className="flex flex-col lg:flex-row items-center gap-12 shrink-0">
                
                {/* Node Box card layout */}
                <div
                  className={`w-56 bg-[#15191E] border rounded-2xl p-4.5 space-y-3.5 shadow-xl transition-all relative ${
                    isInactive
                      ? 'opacity-45 border-zinc-850 bg-zinc-900/10'
                      : isCurrentActive
                      ? 'border-indigo-500 ring-2 ring-indigo-500/15 shadow-indigo-950/20 animate-pulse'
                      : isPassedActive
                      ? 'border-emerald-500/50 shadow-emerald-950/5'
                      : 'border-[rgba(255,255,255,0.05)] hover:border-indigo-500/30'
                  }`}
                >
                  {/* Toggle state on node */}
                  <div className="absolute top-3.5 right-3.5">
                    <input
                      type="checkbox"
                      checked={node.status === 'active'}
                      onChange={() => handleToggleNodeStatus(node.id)}
                      className="accent-indigo-500 w-3.5 h-3.5 cursor-pointer"
                      title={node.status === 'active' ? 'Apagar nodo' : 'Encender nodo'}
                    />
                  </div>

                  {/* Header info */}
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`p-2 rounded-2xl border ${
                        isInactive
                          ? 'bg-zinc-800 border-zinc-700 text-zinc-400'
                          : node.type === 'trigger'
                          ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                          : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-[9px] font-mono font-bold uppercase tracking-widest text-[#8B949E]">
                        {node.type}
                      </div>
                      <h4 className="text-xs font-bold text-white line-clamp-1">{node.name}</h4>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-[10px] text-[#8B949E] leading-relaxed">{node.description}</p>

                  {/* Connection indicator */}
                  <div className="pt-2 flex items-center justify-between border-t border-[rgba(255,255,255,0.05)]/60 text-[9px] font-mono">
                    <span className="text-[#8B949E]">Estado:</span>
                    <span className={isInactive ? 'text-rose-400' : isCurrentActive ? 'text-indigo-400 animate-pulse' : 'text-emerald-400'}>
                      {isInactive ? 'APAGADO' : isCurrentActive ? 'PROCESANDO' : 'LISTO'}
                    </span>
                  </div>
                </div>

                {/* Connection visual arrows between nodes */}
                {index < nodes.length - 1 && (
                  <div className="relative flex items-center justify-center shrink-0">
                    <ArrowRight
                      className={`w-6 h-6 transition-colors duration-300 ${
                        isPassedActive ? 'text-emerald-500 animate-pulse' : 'text-[rgba(255,255,255,0.05)]'
                      }`}
                    />
                    {/* Visual animated flowing glowing dot */}
                    {isCurrentActive && (
                      <span className="absolute w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                    )}
                  </div>
                )}

              </div>
            );
          })}
        </div>
      </div>

      {/* Add node modal */}
      {showAddNodeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B0F14]/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-[#15191E] border border-[rgba(255,255,255,0.05)] rounded-2xl p-6 shadow-2xl relative">
            <h3 className="font-display font-bold text-lg text-white mb-4">Añadir Nuevo Nodo</h3>
            
            <form onSubmit={handleAddNode} className="space-y-4">
              <div>
                <label className="text-[11px] font-bold text-[#8B949E] uppercase tracking-wider block mb-1.5">Nombre del Nodo</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Notificar por Discord"
                  value={newNodeName}
                  onChange={e => setNewNodeName(e.target.value)}
                  className="w-full bg-[#0B0F14] border border-[rgba(255,255,255,0.05)] rounded-2xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#8B949E] uppercase tracking-wider block mb-1.5">Tipo de Nodo</label>
                <select
                  value={newNodeType}
                  onChange={e => setNewNodeType(e.target.value as any)}
                  className="w-full bg-[#0B0F14] border border-[rgba(255,255,255,0.05)] rounded-2xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                >
                  <option value="action">Acción (API, Procesamiento)</option>
                  <option value="trigger">Trigger (Gatillo / Disparador)</option>
                  <option value="condition">Condición (Si / No)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#8B949E] uppercase tracking-wider block mb-1.5">Descripción</label>
                <input
                  type="text"
                  placeholder="Ej. Envía un JSON con datos a un webhook..."
                  value={newNodeDesc}
                  onChange={e => setNewNodeDesc(e.target.value)}
                  className="w-full bg-[#0B0F14] border border-[rgba(255,255,255,0.05)] rounded-2xl px-3 py-2 text-sm text-white focus:outline-none"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-[rgba(255,255,255,0.05)]/60">
                <button
                  type="button"
                  onClick={() => setShowAddNodeModal(false)}
                  className="px-4 py-2 rounded-2xl bg-[#0B0F14] border border-[rgba(255,255,255,0.05)] text-[#8B949E] hover:text-[#E6EDF2] text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
                >
                  Insertar Nodo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
