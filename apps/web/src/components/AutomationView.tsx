import React, { useState } from 'react';
import { Network, Plus, Zap, ArrowRight, Layers, Database, Cpu, Mail, Sparkles } from 'lucide-react';

interface AutomationNode {
  id: string;
  name: string;
  type: 'trigger' | 'action' | 'condition';
  status: 'active' | 'inactive';
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

export default function AutomationView() {
  const [nodes] = useState<AutomationNode[]>([
    { id: '1', name: 'Nuevo Video Renderizado', type: 'trigger', status: 'active', description: 'Se activa al exportarse el render 1080p', icon: Zap },
    { id: '2', name: 'Transcripción por Gemini', type: 'action', status: 'active', description: 'Transcribe audio a texto para subtítulos', icon: Sparkles },
    { id: '3', name: 'Agente SEO Redactor', type: 'action', status: 'active', description: 'Optimiza el título, tags y descripción', icon: Cpu },
    { id: '4', name: 'Subir a YouTube API', type: 'action', status: 'active', description: 'Publica en modo borrador al canal', icon: Database },
    { id: '5', name: 'Notificación Telegram', type: 'action', status: 'active', description: 'Envía alerta al equipo con link del video', icon: Mail },
  ]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">

      {/* Automation Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#15191E] p-4.5 rounded-2xl border border-[rgba(255,255,255,0.05)]">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 rounded-2xl text-indigo-400">
            <Network className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-display font-bold text-base text-white">Flujos de Automatización</h2>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Próximamente
              </span>
            </div>
            <p className="text-[11px] text-[#8B949E]">
              Vista previa del canvas visual — la ejecución de flujos aún no está conectada al backend
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled
            title="La ejecución de flujos estará disponible en una versión futura"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-2xl bg-[rgba(255,255,255,0.05)] text-slate-500 text-xs font-semibold cursor-not-allowed border border-[#30363d] opacity-50"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Ejecutar flujo</span>
          </button>

          <button
            type="button"
            disabled
            title="La edición de nodos estará disponible en una versión futura"
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-2xl bg-indigo-600/40 text-indigo-300/60 text-xs font-bold cursor-not-allowed opacity-50"
          >
            <Plus className="w-4 h-4" />
            <span>Añadir nodo</span>
          </button>
        </div>
      </div>

      <p className="text-xs text-slate-400 rounded-xl border border-white/5 bg-[#15191E]/80 px-4 py-3 leading-relaxed">
        Esta sección muestra el diseño previsto para automatizaciones estilo n8n. Usa el{' '}
        <strong className="text-slate-300">pipeline del workspace</strong> y{' '}
        <strong className="text-slate-300">Estudio agentes</strong> para producción real hoy.
      </p>

      {/* Visual Canvas Nodes row (read-only preview) */}
      <div className="bg-[#0B0F14] border border-[rgba(255,255,255,0.05)] rounded-2xl p-8 overflow-x-auto min-h-[400px] flex items-center justify-center relative select-none opacity-80">
        <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:16px_16px] opacity-35" />

        <div className="flex flex-col lg:flex-row items-center gap-12 relative z-10 min-w-[900px] py-10 justify-center">
          {nodes.map((node, index) => {
            const Icon = node.icon;

            return (
              <div key={node.id} className="flex flex-col lg:flex-row items-center gap-12 shrink-0">
                <div className="w-56 bg-[#15191E] border border-[rgba(255,255,255,0.05)] rounded-2xl p-4.5 space-y-3.5 shadow-xl">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`p-2 rounded-2xl border ${
                        node.type === 'trigger'
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

                  <p className="text-[10px] text-[#8B949E] leading-relaxed">{node.description}</p>

                  <div className="pt-2 flex items-center justify-between border-t border-[rgba(255,255,255,0.05)]/60 text-[9px] font-mono">
                    <span className="text-[#8B949E]">Estado:</span>
                    <span className="text-slate-500">VISTA PREVIA</span>
                  </div>
                </div>

                {index < nodes.length - 1 && (
                  <ArrowRight className="w-6 h-6 text-[rgba(255,255,255,0.05)] shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
