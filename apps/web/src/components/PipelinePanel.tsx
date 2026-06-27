import { useEffect, useState } from 'react';
import { Clapperboard, CloudUpload, Loader2, Play, CheckCircle2, HardDrive, ExternalLink } from 'lucide-react';
import {
  confirmPublish,
  fetchStorageStats,
  runEpisodePipeline,
  fetchJob,
  type StorageStats,
} from '../api';

interface PipelinePanelProps {
  episodeId: string;
  episodeTitle: string;
  onPipelineComplete?: () => void;
}

const STEP_LABELS: Record<string, string> = {
  script: 'Guion IA',
  seo: 'Metadatos SEO',
  tts: 'Narración',
  thumbnail: 'Miniatura',
  render: 'Render de video',
  shorts: 'Short vertical',
  publish: 'Subida a YouTube',
  confirm: 'Confirmar publicación',
};

export default function PipelinePanel({
  episodeId,
  episodeTitle,
  onPipelineComplete,
}: PipelinePanelProps) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [storage, setStorage] = useState<StorageStats | null>(null);

  useEffect(() => {
    void fetchStorageStats()
      .then(setStorage)
      .catch(() => setStorage(null));
  }, []);

  const handleFullPipeline = async () => {
    setRunning(true);
    setError(null);
    setYoutubeUrl(null);
    setMessage('Iniciando producción completa…');
    setProgress(5);
    try {
      const job = await runEpisodePipeline(episodeId);
      const poll = setInterval(async () => {
        try {
          const updated = await fetchJob(job.id);
          setProgress(updated.progress);
          const step =
            (updated.result?.step as string | undefined) ??
            STEP_LABELS[(updated.result?.stepKey as string | undefined) ?? ''] ??
            updated.type;
          setMessage(`${step} — ${updated.progress}%`);

          if (updated.status === 'completed') {
            clearInterval(poll);
            setRunning(false);
            const url = updated.result?.youtubeUrl as string | undefined;
            if (url) setYoutubeUrl(url);
            setMessage(
              url
                ? '✓ Video subido a YouTube (privado). Revisa en Studio y confirma visibilidad.'
                : '✓ Pipeline completado.',
            );
            onPipelineComplete?.();
            void fetchStorageStats().then(setStorage);
          }
          if (updated.status === 'failed') {
            clearInterval(poll);
            setRunning(false);
            const errMsg = updated.error ?? 'El pipeline falló';
            setError(errMsg);
            setMessage(null);
          }
        } catch {
          clearInterval(poll);
          setRunning(false);
          setError('Error al consultar el progreso del job');
          setMessage(null);
        }
      }, 2000);
    } catch (err) {
      setRunning(false);
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo iniciar el pipeline. ¿Hay otro episodio activo en el VPS?',
      );
    }
  };

  const handleConfirmPublish = async () => {
    setRunning(true);
    setError(null);
    setMessage('Confirmando publicación…');
    try {
      await confirmPublish(episodeId);
      setMessage(
        '✓ Publicación confirmada. Si autoArchiveOnPublish está activo en Configuración, el workspace se archivará en Drive.',
      );
      void fetchStorageStats().then(setStorage);
    } catch {
      setError('Error al confirmar publicación');
      setMessage(null);
    } finally {
      setRunning(false);
    }
  };

  return (
    <section className="bg-[#15191E] border border-white/5 rounded-3xl p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-400">
          <Clapperboard className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-display font-bold text-base text-white">Producción automática</h2>
          <p className="text-[11px] text-slate-400">
            Guion → SEO → voz → miniatura → video → short → YouTube (privado) → confirmar
          </p>
        </div>
      </div>

      <p className="text-xs text-slate-300">
        Episodio: <span className="text-white font-medium">{episodeTitle}</span>
      </p>

      {storage && (
        <div className="flex flex-wrap gap-3 text-[10px] font-mono text-slate-400">
          <span className="flex items-center gap-1">
            <HardDrive className="w-3 h-3" />
            Activos: {storage.activeEpisodeCount}/{storage.maxActiveEpisodes}
          </span>
          {storage.diskWarning && (
            <span className="text-amber-400">⚠ Disco casi lleno — archiva episodios publicados</span>
          )}
          {!storage.archiveConfigured && (
            <span className="text-amber-400">Drive: configura RCLONE_REMOTE en el servidor</span>
          )}
        </div>
      )}

      {message && (
        <p className="text-xs rounded-xl border border-white/10 bg-[#0B0F14] px-3 py-2 text-slate-300">
          {message}
        </p>
      )}

      {error && (
        <p className="text-xs rounded-xl border border-rose-500/30 bg-rose-950/20 px-3 py-2 text-rose-300">
          {error}
        </p>
      )}

      {youtubeUrl && (
        <a
          href={youtubeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-xs text-emerald-400 hover:text-emerald-300"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Ver video en YouTube
        </a>
      )}

      {running && (
        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={running}
          onClick={() => void handleFullPipeline()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold"
        >
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          Producir video completo
        </button>
        <button
          type="button"
          disabled={running}
          onClick={() => void handleConfirmPublish()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0B0F14] border border-white/10 hover:border-emerald-500/40 text-xs font-semibold text-slate-300"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          Ya publiqué en redes → archivar
        </button>
        <span className="flex items-center gap-1 text-[10px] text-slate-500 self-center">
          <CloudUpload className="w-3 h-3" />
          Requiere OAuth YouTube conectado en Configuración
        </span>
      </div>
    </section>
  );
}
