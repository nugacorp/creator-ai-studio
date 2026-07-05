import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Factory,
  HardDrive,
  Loader2,
  PlayCircle,
  RefreshCw,
} from 'lucide-react';
import type { JobStatus, JobType, ProductionJob } from '@creator-ai-studio/shared';
import { fetchProductionJobs, fetchStorageStats, type StorageStats } from '../api';
import type { VideoProject } from '../types';

const POLL_MS = 5000;

const JOB_TYPE_LABELS: Record<JobType, string> = {
  script: 'Guion IA',
  seo: 'Metadatos SEO',
  tts: 'Narración TTS',
  render: 'Render de video',
  thumbnail: 'Miniatura',
  shorts: 'Short vertical',
  publish: 'Publicación YouTube',
  publish_package: 'Paquete de publicación',
  archive: 'Archivo',
  pipeline: 'Pipeline completo',
  agent: 'Agente IA',
};

const STATUS_LABELS: Record<JobStatus, string> = {
  pending: 'En cola',
  active: 'Ejecutando',
  completed: 'Completado',
  failed: 'Fallido',
};

const STATUS_PILL: Record<JobStatus, string> = {
  pending: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
  active: 'border-indigo-500/20 bg-indigo-500/10 text-indigo-300',
  completed: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
  failed: 'border-rose-500/20 bg-rose-500/10 text-rose-300',
};

interface ProductionViewProps {
  projects: VideoProject[];
  onOpenWorkspace?: (projectId: string) => void;
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - Date.parse(iso);
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.floor(hours / 24)} d`;
}

function JobRow({
  job,
  episodeTitle,
  onOpen,
}: {
  job: ProductionJob;
  episodeTitle: string;
  onOpen?: () => void;
}) {
  return (
    <div className="bg-[#0B0F14] p-3.5 rounded-xl border border-white/5 space-y-2.5">
      <div className="flex items-start justify-between gap-2 text-xs">
        <div className="min-w-0 space-y-1">
          <button
            type="button"
            onClick={onOpen}
            disabled={!onOpen}
            className="font-bold text-white truncate block text-left hover:text-indigo-300 disabled:cursor-default disabled:hover:text-white"
          >
            {episodeTitle}
          </button>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[10px] text-slate-400">{JOB_TYPE_LABELS[job.type]}</span>
            <span
              className={`rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wide ${STATUS_PILL[job.status]}`}
            >
              {STATUS_LABELS[job.status]}
            </span>
          </div>
        </div>
        <span className="text-indigo-400 font-mono font-semibold shrink-0">{job.progress}%</span>
      </div>
      {(job.status === 'pending' || job.status === 'active') && (
        <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden p-[0.5px]">
          <div
            className={`h-full rounded-full ${job.status === 'active' ? 'bg-indigo-600' : 'bg-amber-600/70'}`}
            style={{ width: `${Math.max(job.progress, job.status === 'pending' ? 2 : 5)}%` }}
          />
        </div>
      )}
      {job.error && (
        <p className="text-[10px] text-rose-400 font-mono leading-normal line-clamp-2">{job.error}</p>
      )}
      <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono">
        <span className="truncate">{job.id.slice(0, 8)}…</span>
        <span>{formatRelativeTime(job.updatedAt)}</span>
      </div>
    </div>
  );
}

export default function ProductionView({ projects, onOpenWorkspace }: ProductionViewProps) {
  const [jobs, setJobs] = useState<ProductionJob[]>([]);
  const [summary, setSummary] = useState<Record<JobStatus, number> | null>(null);
  const [storage, setStorage] = useState<StorageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const titleByEpisodeId = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of projects) map.set(p.id, p.title);
    return map;
  }, [projects]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    setError(null);
    try {
      const [jobsRes, storageRes] = await Promise.all([
        fetchProductionJobs({ limit: 100 }),
        fetchStorageStats(),
      ]);
      setJobs(jobsRes.jobs);
      setSummary(jobsRes.summary);
      setStorage(storageRes);
    } catch {
      setError('No se pudo cargar el estado de producción');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(true), POLL_MS);
    return () => clearInterval(interval);
  }, [load]);

  const runningJobs = jobs.filter(j => j.status === 'pending' || j.status === 'active');
  const failedJobs = jobs.filter(j => j.status === 'failed').slice(0, 8);

  const resolveTitle = (episodeId: string) => titleByEpisodeId.get(episodeId) ?? `Episodio ${episodeId.slice(0, 8)}`;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex items-center justify-between gap-3 bg-[#15191E] p-4.5 rounded-2xl border border-white/5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 rounded-xl text-indigo-400">
            <Factory className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display font-bold text-base text-white">Modo Producción Focalizado</h2>
            <p className="text-[11px] text-slate-400">
              Cola de trabajos en segundo plano y estado del worker en todos los episodios
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={refreshing}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#0B0F14] px-3 py-1.5 font-mono text-[10px] font-semibold text-slate-300 hover:border-indigo-500/40 hover:text-white disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {error !== null && (
        <p
          role="alert"
          className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-300"
        >
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-[#15191E] border border-white/5 rounded-2xl p-4 space-y-1">
          <div className="flex items-center gap-2 text-amber-400">
            <Clock className="w-4 h-4" />
            <span className="text-[10px] font-mono uppercase tracking-wide">En cola</span>
          </div>
          <p className="text-2xl font-bold text-white font-mono">{summary?.pending ?? '—'}</p>
        </div>
        <div className="bg-[#15191E] border border-white/5 rounded-2xl p-4 space-y-1">
          <div className="flex items-center gap-2 text-indigo-400">
            <PlayCircle className="w-4 h-4" />
            <span className="text-[10px] font-mono uppercase tracking-wide">Ejecutando</span>
          </div>
          <p className="text-2xl font-bold text-white font-mono">{summary?.active ?? '—'}</p>
        </div>
        <div className="bg-[#15191E] border border-white/5 rounded-2xl p-4 space-y-1">
          <div className="flex items-center gap-2 text-rose-400">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-[10px] font-mono uppercase tracking-wide">Fallidos</span>
          </div>
          <p className="text-2xl font-bold text-white font-mono">{summary?.failed ?? '—'}</p>
        </div>
        <div className="bg-[#15191E] border border-white/5 rounded-2xl p-4 space-y-1">
          <div className="flex items-center gap-2 text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-[10px] font-mono uppercase tracking-wide">Completados</span>
          </div>
          <p className="text-2xl font-bold text-white font-mono">{summary?.completed ?? '—'}</p>
        </div>
      </div>

      {storage && (
        <div className="flex flex-wrap gap-3 text-[10px] font-mono text-slate-400">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/5 bg-[#15191E] px-2.5 py-1">
            <HardDrive className="w-3.5 h-3.5" />
            {storage.activeEpisodeCount}/{storage.maxActiveEpisodes} episodios activos
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 ${
              storage.ffmpegAvailable
                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                : 'border-rose-500/20 bg-rose-500/10 text-rose-300'
            }`}
          >
            FFmpeg {storage.ffmpegAvailable ? 'OK' : 'no disponible'}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 ${
              storage.piperAvailable
                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                : 'border-amber-500/20 bg-amber-500/10 text-amber-300'
            }`}
          >
            Piper TTS {storage.piperAvailable ? 'OK' : 'no disponible'}
          </span>
          {storage.diskWarning && (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-amber-300">
              Disco casi lleno
            </span>
          )}
          <span
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 ${
              storage.archiveConfigured
                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                : 'border-amber-500/20 bg-amber-500/10 text-amber-300'
            }`}
          >
            Drive {storage.archiveConfigured ? 'conectado' : 'sin configurar'}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-[#15191E] border border-white/5 rounded-3xl p-5 space-y-4">
          <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
            Operaciones en curso
          </h4>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              Cargando cola de trabajos…
            </div>
          ) : runningJobs.length === 0 ? (
            <p className="text-xs text-slate-500 italic">No hay trabajos pendientes ni en ejecución.</p>
          ) : (
            <div className="space-y-3.5">
              {runningJobs.map(job => (
                <JobRow
                  key={job.id}
                  job={job}
                  episodeTitle={resolveTitle(job.episodeId)}
                  onOpen={
                    onOpenWorkspace
                      ? () => onOpenWorkspace(job.episodeId)
                      : undefined
                  }
                />
              ))}
            </div>
          )}
        </div>

        <div className="bg-[#15191E] border border-white/5 rounded-3xl p-5 space-y-4 flex flex-col">
          <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
            Fallos recientes
          </h4>
          {loading ? (
            <p className="text-xs text-slate-500">…</p>
          ) : failedJobs.length === 0 ? (
            <p className="text-xs text-slate-500 italic">Sin fallos recientes en la cola.</p>
          ) : (
            <div className="space-y-3.5 flex-1">
              {failedJobs.map(job => (
                <JobRow
                  key={job.id}
                  job={job}
                  episodeTitle={resolveTitle(job.episodeId)}
                  onOpen={
                    onOpenWorkspace
                      ? () => onOpenWorkspace(job.episodeId)
                      : undefined
                  }
                />
              ))}
            </div>
          )}
          <p className="text-[10px] text-[#8B949E] italic leading-normal font-mono pt-2 border-t border-white/5">
            Vista operativa global · no edita contenido. Abre un episodio en Proyectos para el pipeline por etapa.
          </p>
        </div>
      </div>
    </div>
  );
}
