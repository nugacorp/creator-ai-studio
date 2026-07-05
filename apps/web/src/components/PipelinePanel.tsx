import { useCallback, useEffect, useState } from 'react';
import {
  Clapperboard,
  CloudUpload,
  Loader2,
  Play,
  CheckCircle2,
  HardDrive,
  ExternalLink,
  Package,
  ShieldAlert,
  Download,
} from 'lucide-react';
import {
  authorizePublish,
  buildPublishPackage,
  confirmPublish,
  downloadEpisodeFile,
  fetchEpisodeAssets,
  fetchStorageStats,
  runSafePipeline,
  fetchJob,
  type EpisodeAssetsResponse,
  type PipelineMode,
  type PublishChecklistItem,
  type StorageStats,
} from '../api';

interface PipelinePanelProps {
  episodeId: string;
  episodeTitle: string;
  onPipelineComplete?: () => void;
}

const STEP_LABELS: Record<string, string> = {
  script: 'Guion IA',
  storyboard: 'Storyboard / escenas',
  scene_images: 'Imágenes de escenas',
  seo: 'Metadatos SEO',
  tts: 'Narración',
  thumbnail: 'Miniatura',
  render: 'Render de video',
  shorts: 'Short vertical',
  publish_package: 'Paquete de publicación',
  review: 'Listo para revisión',
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
  const [checklist, setChecklist] = useState<PublishChecklistItem[] | null>(null);
  const [publishReady, setPublishReady] = useState(false);
  const [assets, setAssets] = useState<EpisodeAssetsResponse | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const loadAssets = useCallback(() => {
    void fetchEpisodeAssets(episodeId)
      .then(data => {
        if (data && Array.isArray(data.files)) {
          setAssets(data);
        } else {
          setAssets(null);
        }
      })
      .catch(() => setAssets(null));
  }, [episodeId]);

  useEffect(() => {
    void fetchStorageStats()
      .then(setStorage)
      .catch(() => setStorage(null));
    loadAssets();
  }, [episodeId, loadAssets]);

  const startPipeline = async (mode: PipelineMode, label: string) => {
    setRunning(true);
    setError(null);
    setYoutubeUrl(null);
    setMessage(`Iniciando: ${label}…`);
    setProgress(5);
    try {
      const job = await runSafePipeline(episodeId, mode);
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
                ? '✓ Video subido a YouTube (privado). Revisa en Studio.'
                : '✓ Pipeline completado sin publicar en YouTube.',
            );
            onPipelineComplete?.();
            void fetchStorageStats().then(setStorage);
            loadAssets();
          }
          if (updated.status === 'failed') {
            clearInterval(poll);
            setRunning(false);
            setError(updated.error ?? 'El pipeline falló');
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

  const handlePublishPackage = async () => {
    setRunning(true);
    setError(null);
    setMessage('Generando paquete de publicación…');
    try {
      const result = await buildPublishPackage(episodeId);
      setChecklist(result.checklist);
      setPublishReady(result.ready);
      setMessage(
        result.ready
          ? '✓ Paquete listo para revisión humana.'
          : 'Paquete generado — faltan artefactos (ver checklist).',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al generar paquete');
      setMessage(null);
    } finally {
      setRunning(false);
    }
  };

  const handleAuthorizePublish = async () => {
    if (!window.confirm('¿Autorizas la subida PRIVADA a YouTube? Esta acción no se puede deshacer.')) {
      return;
    }
    setRunning(true);
    setError(null);
    setMessage('Autorizando publicación en YouTube (privado)…');
    try {
      const { job, checklist: pkgChecklist } = await authorizePublish(episodeId);
      setChecklist(pkgChecklist);
      const poll = setInterval(async () => {
        const updated = await fetchJob(job.id);
        setProgress(updated.progress);
        setMessage(`${updated.result?.step ?? updated.type} — ${updated.progress}%`);
        if (updated.status === 'completed') {
          clearInterval(poll);
          setRunning(false);
          const url = updated.result?.youtubeUrl as string | undefined;
          if (url) setYoutubeUrl(url);
          setMessage('✓ Video subido a YouTube (privado).');
          onPipelineComplete?.();
        }
        if (updated.status === 'failed') {
          clearInterval(poll);
          setRunning(false);
          setError(updated.error ?? 'Publicación falló');
          setMessage(null);
        }
      }, 2000);
    } catch (err) {
      setRunning(false);
      setError(err instanceof Error ? err.message : 'No se pudo autorizar publicación');
      setMessage(null);
    }
  };

  const handleConfirmPublish = async () => {
    setRunning(true);
    setError(null);
    setMessage('Confirmando publicación…');
    try {
      await confirmPublish(episodeId);
      setMessage('✓ Publicación confirmada.');
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
            Borrador seguro (sin YouTube) → revisión → publicación autorizada
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

      {checklist && (
        <ul className="text-[11px] space-y-1 rounded-xl border border-white/10 bg-[#0B0F14] p-3">
          {checklist.map(item => (
            <li key={item.key} className={item.ok ? 'text-emerald-400' : 'text-amber-400'}>
              {item.ok ? '✓' : '○'} {item.label}
              {item.detail ? ` — ${item.detail}` : ''}
            </li>
          ))}
        </ul>
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
        <p className="w-full text-[10px] text-slate-500 mb-1">
          Las secciones aprobadas en el workspace no se regeneran. Edita el contenido para desbloquearlas.
        </p>
        <button
          type="button"
          disabled={running}
          onClick={() => void startPipeline('production-draft', 'Producir borrador')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold"
        >
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          Producir borrador
        </button>
        <button
          type="button"
          disabled={running}
          onClick={() => void startPipeline('ready-for-review', 'Listo para revisión')}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#0B0F14] border border-white/10 hover:border-indigo-500/40 text-xs font-semibold text-slate-300"
        >
          <CheckCircle2 className="w-4 h-4 text-indigo-400" />
          Marcar listo
        </button>
        <button
          type="button"
          disabled={running}
          onClick={() => void handlePublishPackage()}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#0B0F14] border border-white/10 hover:border-amber-500/40 text-xs font-semibold text-slate-300"
        >
          <Package className="w-4 h-4 text-amber-400" />
          Preparar publicación
        </button>
        <button
          type="button"
          disabled={running || (!publishReady && !checklist)}
          onClick={() => void handleAuthorizePublish()}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-950/40 border border-rose-500/30 hover:border-rose-400/50 disabled:opacity-40 text-xs font-semibold text-rose-200"
        >
          <ShieldAlert className="w-4 h-4" />
          Publicar en YouTube (privado)
        </button>
        <button
          type="button"
          disabled={running}
          onClick={() => void handleConfirmPublish()}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#0B0F14] border border-white/10 text-xs font-semibold text-slate-400"
        >
          <CloudUpload className="w-4 h-4" />
          Ya publiqué → archivar
        </button>
      </div>

      {assets && Array.isArray(assets.files) && (
        <div className="rounded-xl border border-white/10 bg-[#0B0F14] p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-slate-200">Archivos del episodio</p>
            <button
              type="button"
              onClick={loadAssets}
              className="text-[10px] text-indigo-300 hover:text-indigo-200"
            >
              Actualizar
            </button>
          </div>
          <p className="text-[10px] text-slate-500 font-mono">
            Carpeta: {assets.workspacePath}
            {assets.storageLocation === 'local'
              ? ' (disco del servidor, no Google Drive hasta archivar)'
              : assets.drivePath
                ? ` (archivado en ${assets.drivePath})`
                : ' (archivado, fuera del disco local)'}
          </p>
          {assets.message && (
            <p className="text-[10px] text-amber-400">{assets.message}</p>
          )}
          <ul className="space-y-1">
            {assets.files.map(file => (
              <li key={file.key} className="flex items-center justify-between gap-2 text-[11px]">
                <span className={file.available ? 'text-slate-300' : 'text-slate-600'}>
                  {file.available ? '✓' : '○'} {file.label}
                  {file.filename ? ` (${file.filename})` : ''}
                </span>
                {file.available && (
                  <button
                    type="button"
                    disabled={downloading === file.key}
                    onClick={() => {
                      setDownloading(file.key);
                      void downloadEpisodeFile(episodeId, file.key)
                        .catch(() => setError('No se pudo descargar el archivo'))
                        .finally(() => setDownloading(null));
                    }}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg border border-white/10 hover:border-indigo-500/40 text-indigo-300 disabled:opacity-50"
                  >
                    <Download className="w-3 h-3" />
                    {downloading === file.key ? '…' : 'Descargar'}
                  </button>
                )}
              </li>
            ))}
          </ul>
          <p className="text-[10px] text-slate-500">
            Descarga el MP4 o la narración para editar en DaVinci, Premiere u otra app. Los archivos viven en el volumen del servidor hasta que uses «Ya publiqué → archivar» con Drive configurado.
          </p>
        </div>
      )}
    </section>
  );
}
