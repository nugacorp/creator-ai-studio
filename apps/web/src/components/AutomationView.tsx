import React, { useState } from 'react';
import {
  Archive,
  ArrowRight,
  CheckCircle2,
  Cpu,
  Database,
  Layers,
  Loader2,
  Mail,
  Network,
  Plus,
  PackageCheck,
  PlayCircle,
  Sparkles,
  Zap,
} from 'lucide-react';
import { archiveEpisode, buildPublishPackage, runSafePipeline } from '../api';

interface AutomationNode {
  id: string;
  name: string;
  type: 'trigger' | 'action' | 'condition';
  status: 'active' | 'inactive';
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface AutomationViewProps {
  activeEpisodeId?: string | null;
}

type ActionKey = 'pipeline' | 'package' | 'archive';

interface ActionFeedback {
  kind: ActionKey | null;
  loading: boolean;
  success: boolean;
  message: string;
}

export default function AutomationView({ activeEpisodeId }: AutomationViewProps) {
  const [nodes] = useState<AutomationNode[]>([
    { id: '1', name: 'Nuevo Video Renderizado', type: 'trigger', status: 'active', description: 'Se activa al exportarse el render 1080p', icon: Zap },
    { id: '2', name: 'Transcripción por Gemini', type: 'action', status: 'active', description: 'Transcribe audio a texto para subtítulos', icon: Sparkles },
    { id: '3', name: 'Agente SEO Redactor', type: 'action', status: 'active', description: 'Optimiza el título, tags y descripción', icon: Cpu },
    { id: '4', name: 'Subir a YouTube API', type: 'action', status: 'active', description: 'Publica en modo borrador al canal', icon: Database },
    { id: '5', name: 'Notificación Telegram', type: 'action', status: 'active', description: 'Envía alerta al equipo con link del video', icon: Mail },
  ]);
  const [feedback, setFeedback] = useState<ActionFeedback>({
    kind: null,
    loading: false,
    success: false,
    message: '',
  });

  const canRunActions = Boolean(activeEpisodeId);

  const runAction = async (kind: ActionKey, action: () => Promise<unknown>) => {
    if (!activeEpisodeId) {
      setFeedback({
        kind,
        loading: false,
        success: false,
        message: 'Selecciona un episodio activo desde Proyectos para ejecutar acciones.',
      });
      return;
    }

    setFeedback({ kind, loading: true, success: false, message: 'Ejecutando…' });
    try {
      const result = await action();
      if (kind === 'pipeline') {
        setFeedback({
          kind,
          loading: false,
          success: true,
          message: `Pipeline seguro lanzado para el episodio ${activeEpisodeId.slice(0, 8)}…`,
        });
      } else if (kind === 'package') {
        const payload = result as { ready?: boolean; metadataPath?: string; checklistPath?: string };
        setFeedback({
          kind,
          loading: false,
          success: Boolean(payload.ready),
          message: payload.ready
            ? `Paquete listo: ${payload.metadataPath ?? 'metadata'}`
            : 'El paquete aún no está listo. Revisa la checklist de publicación.',
        });
      } else {
        const payload = result as { ok?: boolean; message?: string };
        setFeedback({
          kind,
          loading: false,
          success: Boolean(payload.ok),
          message: payload.message ?? 'Operación de archivado completada.',
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo completar la acción.';
      setFeedback({ kind, loading: false, success: false, message });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#15191E] p-4.5 rounded-2xl border border-[rgba(255,255,255,0.05)]">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 rounded-2xl text-indigo-400">
            <Network className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-display font-bold text-base text-white">Flujos de Automatización</h2>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Activo
              </span>
            </div>
            <p className="text-[11px] text-[#8B949E]">
              Lanza el pipeline seguro, genera el paquete de publicación y archiva al Drive desde el episodio activo.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void runAction('pipeline', () => runSafePipeline(activeEpisodeId!))}
            disabled={!canRunActions || feedback.loading}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-2xl bg-indigo-600/90 text-white text-xs font-semibold border border-indigo-500/30 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {feedback.kind === 'pipeline' && feedback.loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlayCircle className="w-3.5 h-3.5" />}
            <span>Ejecutar pipeline</span>
          </button>

          <button
            type="button"
            disabled
            title="La edición de nodos estará disponible en una versión futura"
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-2xl bg-[rgba(255,255,255,0.05)] text-slate-500 text-xs font-bold cursor-not-allowed opacity-60"
          >
            <Plus className="w-4 h-4" />
            <span>Añadir nodo</span>
          </button>
        </div>
      </div>

      {feedback.message && (
        <div
          className={`rounded-xl border px-3 py-2 text-xs flex items-start gap-2 ${feedback.success ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200' : 'border-amber-500/20 bg-amber-500/10 text-amber-200'}`}
        >
          {feedback.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <Layers className="w-4 h-4 shrink-0" />}
          <span>{feedback.message}</span>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <button
          type="button"
          onClick={() => void runAction('pipeline', () => runSafePipeline(activeEpisodeId!))}
          disabled={!canRunActions || feedback.loading}
          className="rounded-2xl border border-white/5 bg-[#15191E] p-4 text-left text-sm text-slate-300 hover:border-indigo-500/30 hover:bg-[#1b2128] disabled:opacity-50"
        >
          <div className="mb-2 flex items-center gap-2 text-indigo-300">
            <PlayCircle className="w-4 h-4" />
            <span className="font-semibold">Pipeline seguro</span>
          </div>
          <p className="text-[11px] text-slate-500">Inicia el pipeline sin publicar en YouTube; ideal para revisar contenido antes de salir a producción.</p>
        </button>

        <button
          type="button"
          onClick={() => void runAction('package', () => buildPublishPackage(activeEpisodeId!))}
          disabled={!canRunActions || feedback.loading}
          className="rounded-2xl border border-white/5 bg-[#15191E] p-4 text-left text-sm text-slate-300 hover:border-indigo-500/30 hover:bg-[#1b2128] disabled:opacity-50"
        >
          <div className="mb-2 flex items-center gap-2 text-amber-300">
            <PackageCheck className="w-4 h-4" />
            <span className="font-semibold">Paquete de publicación</span>
          </div>
          <p className="text-[11px] text-slate-500">Genera la checklist y los artefactos de publicación del episodio activo.</p>
        </button>

        <button
          type="button"
          onClick={() => void runAction('archive', () => archiveEpisode(activeEpisodeId!))}
          disabled={!canRunActions || feedback.loading}
          className="rounded-2xl border border-white/5 bg-[#15191E] p-4 text-left text-sm text-slate-300 hover:border-indigo-500/30 hover:bg-[#1b2128] disabled:opacity-50"
        >
          <div className="mb-2 flex items-center gap-2 text-emerald-300">
            <Archive className="w-4 h-4" />
            <span className="font-semibold">Archivar a Drive</span>
          </div>
          <p className="text-[11px] text-slate-500">Mueve el workspace a Drive cuando el archivado está configurado en el servidor.</p>
        </button>
      </div>

      <p className="text-xs text-slate-400 rounded-xl border border-white/5 bg-[#15191E]/80 px-4 py-3 leading-relaxed">
        Esta vista ya conecta el diseño previsto con el motor real del backend: usa el{' '}
        <strong className="text-slate-300">pipeline del workspace</strong> y{' '}
        <strong className="text-slate-300">Estudio agentes</strong> para producción real hoy.
      </p>

      <div className="bg-[#0B0F14] border border-[rgba(255,255,255,0.05)] rounded-2xl p-8 overflow-x-auto min-h-[25rem] flex items-center justify-center relative select-none opacity-80">
        <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:16px_16px] opacity-35" />

        <div className="flex flex-col lg:flex-row items-center gap-12 relative z-10 min-w-[56rem] py-10 justify-center">
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
