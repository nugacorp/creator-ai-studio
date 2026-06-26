import { useEffect, useState } from 'react';
import { ListChecks } from 'lucide-react';
import type {
  EpisodeDetail,
  EpisodeStage,
  EpisodeStageStatus
} from '@creator-ai-studio/shared';
import { fetchEpisodeDetail, updateStageStatus } from '../api';

const STAGE_ACTIONS: EpisodeStageStatus[] = ['in_progress', 'completed', 'blocked'];

const STATUS_PILL: Record<EpisodeStageStatus, string> = {
  pending: 'border-slate-500/20 bg-slate-500/10 text-slate-300',
  in_progress: 'border-indigo-500/20 bg-indigo-500/10 text-indigo-300',
  completed: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
  blocked: 'border-rose-500/20 bg-rose-500/10 text-rose-300'
};

interface ProductionStagesPanelProps {
  episodeId: string;
}

/**
 * Real, backend-connected production stages for the selected episode.
 * Reads GET /episodes/:id and updates stages via PATCH /episodes/:id/stages/:stage.
 */
export default function ProductionStagesPanel({ episodeId }: ProductionStagesPanelProps) {
  const [detail, setDetail] = useState<EpisodeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetchEpisodeDetail(episodeId)
      .then(d => {
        if (active) setDetail(d);
      })
      .catch(() => {
        if (active) setError('No se pudo cargar el detalle del episodio');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [episodeId]);

  const changeStage = async (stage: EpisodeStage, status: EpisodeStageStatus) => {
    setError(null);
    try {
      setDetail(await updateStageStatus(episodeId, stage, status));
    } catch {
      setError('No se pudo actualizar la etapa');
    }
  };

  return (
    <section
      aria-label="Etapas de producción"
      className="bg-[#15191E] border border-white/5 rounded-3xl p-5 space-y-4"
    >
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-indigo-500/10 rounded-xl text-indigo-400">
          <ListChecks className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-display font-bold text-base text-white">Etapas de Producción</h2>
          <p className="text-[11px] text-slate-400">Conectado al backend · GET /episodes/:id · PATCH stages</p>
        </div>
      </div>

      {error !== null && (
        <p
          role="alert"
          className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-300"
        >
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Cargando etapas…</p>
      ) : detail === null ? (
        <p className="text-sm text-slate-400">No hay episodio seleccionado en el backend.</p>
      ) : (
        <ol className="space-y-2">
          {detail.stages.map(stage => (
            <li
              key={stage.stage}
              className="flex flex-col gap-2 rounded-2xl border border-white/5 bg-[#0B0F14] p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="flex items-center gap-2 text-sm text-[#E6EDF2]">
                <span className="font-medium font-mono">{stage.stage}</span>
                <span
                  className={`rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wide ${STATUS_PILL[stage.status]}`}
                >
                  {stage.status}
                </span>
              </span>
              <div className="flex flex-wrap gap-1.5">
                {STAGE_ACTIONS.map(action => (
                  <button
                    key={action}
                    type="button"
                    disabled={stage.status === action}
                    onClick={() => {
                      void changeStage(stage.stage, action);
                    }}
                    className="rounded-lg border border-white/10 bg-[#15191E] px-2.5 py-1 font-mono text-[10px] font-semibold text-slate-300 transition-colors hover:border-indigo-500/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {action}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
