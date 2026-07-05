import { Sliders } from 'lucide-react';
import type { VideoProject } from '../types';

interface ProductionViewProps {
  projects: VideoProject[];
}

export default function ProductionView({ projects }: ProductionViewProps) {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex items-center gap-3 bg-[#15191E] p-4.5 rounded-2xl border border-white/5">
        <div className="p-2.5 bg-indigo-500/10 rounded-xl text-indigo-400">
          <Sliders className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-display font-bold text-base text-white">Modo Producción Focalizado</h2>
          <p className="text-[11px] text-slate-400">Optimizado para monitorear renderizados masivos e importaciones críticas</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-[#15191E] border border-white/5 rounded-3xl p-5 space-y-4">
          <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Exportaciones Activas</h4>
          <div className="space-y-3.5">
            {projects.slice(0, 3).map(proj => (
              <div key={proj.id} className="bg-[#0B0F14] p-3.5 rounded-xl border border-white/5 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white">&quot;{proj.title}&quot;</span>
                  <span className="text-indigo-400 font-mono font-semibold">{proj.progress}%</span>
                </div>
                <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden p-[0.5px]">
                  <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${proj.progress}%` }} />
                </div>
                <div className="flex justify-between items-center text-[10px] text-slate-400">
                  <span>Estilo: {proj.series}</span>
                  <span>Format: 1080p Cine</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#15191E] border border-white/5 rounded-3xl p-5 space-y-4 flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">En producción</h4>
            <div className="space-y-3.5 mt-4">
              {projects.filter(p => p.status !== 'Publicado' && p.progress < 100).length === 0 ? (
                <p className="text-xs text-slate-500 italic">No hay episodios activos en el pipeline.</p>
              ) : (
                projects
                  .filter(p => p.status !== 'Publicado' && p.progress < 100)
                  .slice(0, 5)
                  .map(proj => (
                    <div
                      key={proj.id}
                      className="flex items-center gap-3 p-2.5 rounded-xl bg-[#0B0F14] border border-white/5"
                    >
                      <span className="text-xs text-[#E6EDF2] font-medium truncate">
                        {proj.title} — {proj.status} ({proj.progress}%)
                      </span>
                    </div>
                  ))
              )}
            </div>
          </div>
          <p className="text-[10px] text-[#8B949E] italic leading-normal font-mono pt-4">
            Datos del pipeline real. Abre un proyecto para continuar la producción.
          </p>
        </div>
      </div>
    </div>
  );
}
