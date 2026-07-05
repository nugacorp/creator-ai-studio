import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Sparkles,
  Image as ImageIcon,
  FileText,
  Play,
  ArrowRight,
  Sliders,
  Download,
  Film,
  Mic,
  Music,
  RefreshCw,
  FolderOpen,
  Layers,
} from 'lucide-react';
import {
  aiGenerateScript,
  downloadEpisodeFile,
  fetchEpisodeAssets,
  fetchEpisodeDetail,
  fetchEpisodes,
  generateEpisodeMusic,
  fetchEpisodeAssetObjectUrl,
} from '../api';
import type { WorkspaceTab } from '../lib/dashboardNavigation';
import {
  hasScriptAsset,
  matchesLibraryFilter,
  mediaAssetCount,
  sceneImageCount,
  scriptPreview,
  type EpisodeLibraryEntry,
  type LibraryFilter,
} from '../lib/libraryAssets';
import SceneImage from './SceneImage';

interface LibraryViewProps {
  onAddNewScript: (title: string, script: string, outline: string[]) => void;
  onOpenWorkspace: (episodeId: string, initialTab?: WorkspaceTab) => void;
}

type LibraryTab = 'browse' | 'templates' | 'music';

const FILTER_OPTIONS: { id: LibraryFilter; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'scripts', label: 'Guiones' },
  { id: 'scenes', label: 'Escenas' },
  { id: 'media', label: 'Video / Audio' },
];

export default function LibraryView({ onAddNewScript, onOpenWorkspace }: LibraryViewProps) {
  const [activeTab, setActiveTab] = useState<LibraryTab>('browse');
  const [filter, setFilter] = useState<LibraryFilter>('all');
  const [entries, setEntries] = useState<EpisodeLibraryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [progressText, setProgressText] = useState('');

  const [topic, setTopic] = useState('Cristianismo');
  const [objective, setObjective] = useState('Reflexionar');
  const [duration, setDuration] = useState('10 minutos');
  const [audience, setAudience] = useState('Adultos');
  const [style, setStyle] = useState('Narrativo');
  const [emotion, setEmotion] = useState('Esperanza');
  const [customIdea, setCustomIdea] = useState('El Sermón del Monte en Mateo 5');
  const [generatedScript, setGeneratedScript] = useState<string | null>(null);

  const [musicPrompt, setMusicPrompt] = useState(
    'Orquestal dramática para historia bíblica épica, con coros latinos y flauta de viento antigua, tempo medio, instrumental sin voces',
  );
  const [musicModel, setMusicModel] = useState<'lyria-3-clip-preview' | 'lyria-3-pro-preview'>(
    'lyria-3-clip-preview',
  );
  const [musicEpisodeId, setMusicEpisodeId] = useState('');
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);
  const [musicLabel, setMusicLabel] = useState<string | null>(null);
  const [musicError, setMusicError] = useState<string | null>(null);
  const [musicSkipped, setMusicSkipped] = useState(false);

  useEffect(() => {
    if (!musicEpisodeId && entries.length > 0) {
      setMusicEpisodeId(entries[0]!.episode.id);
    }
  }, [entries, musicEpisodeId]);

  useEffect(() => {
    return () => {
      if (generatedAudioUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(generatedAudioUrl);
      }
    };
  }, [generatedAudioUrl]);

  const handleGenerateMusic = async () => {
    if (!musicPrompt.trim()) return;
    setIsGenerating(true);
    setProgressText('Sintetizando composición musical de Lyria...');
    setMusicError(null);
    setMusicSkipped(false);
    try {
      if (musicEpisodeId) {
        const data = await generateEpisodeMusic(musicEpisodeId, {
          prompt: musicPrompt,
          model: musicModel,
        });
        setMusicLabel(data.label);
        setMusicSkipped(Boolean(data.skipped));
        const previewUrl = await fetchEpisodeAssetObjectUrl(musicEpisodeId, 'music');
        if (previewUrl) {
          if (generatedAudioUrl?.startsWith('blob:')) URL.revokeObjectURL(generatedAudioUrl);
          setGeneratedAudioUrl(previewUrl);
        }
        await loadLibrary();
      }
    } catch (e) {
      setMusicError(e instanceof Error ? e.message : 'Error al generar música');
      console.error(e);
    } finally {
      setIsGenerating(false);
      setProgressText('');
    }
  };

  const loadLibrary = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const episodes = await fetchEpisodes();
      const loaded = await Promise.all(
        episodes.map(async episode => {
          const [assets, detail] = await Promise.all([
            fetchEpisodeAssets(episode.id).catch(() => ({
              episodeId: episode.id,
              workspacePath: episode.slug,
              storageLocation: 'local' as const,
              files: [],
              sceneImages: [],
            })),
            fetchEpisodeDetail(episode.id).catch(() => null),
          ]);
          return { episode, assets, detail };
        }),
      );
      setEntries(loaded);
    } catch {
      setLoadError('No se pudieron cargar los activos del proyecto.');
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLibrary();
  }, [loadLibrary]);

  const filteredEntries = useMemo(
    () => entries.filter(entry => matchesLibraryFilter(entry, filter)),
    [entries, filter],
  );

  const stats = useMemo(
    () => ({
      episodes: entries.length,
      scripts: entries.filter(hasScriptAsset).length,
      sceneImages: entries.reduce((sum, e) => sum + sceneImageCount(e), 0),
      media: entries.reduce((sum, e) => sum + mediaAssetCount(e), 0),
    }),
    [entries],
  );

  const handleDownload = async (episodeId: string, assetKey: string) => {
    const key = `${episodeId}:${assetKey}`;
    setDownloading(key);
    try {
      await downloadEpisodeFile(episodeId, assetKey);
    } catch {
      // silent — user can retry
    } finally {
      setDownloading(null);
    }
  };

  const handleGenerateScript = async () => {
    if (!customIdea.trim()) return;
    setIsGenerating(true);
    setProgressText('Copiloto de Guiones IA está planificando la estructura dramática...');
    try {
      const data = await aiGenerateScript(customIdea, {
        theme: topic,
        objective,
        duration,
        audience,
        style,
        emotion,
      });
      if (data.text) setGeneratedScript(data.text);
    } catch (e) {
      console.error(e);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUseScript = () => {
    if (!generatedScript) return;
    onAddNewScript(
      customIdea,
      generatedScript,
      ['Introducción y Gancho', 'Análisis de la Idea principal', 'Aplicación Espiritual', 'Llamado a la Acción (CTA)'],
    );
    setGeneratedScript(null);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-display font-bold text-white">Biblioteca IA</h2>
          <p className="text-xs text-[#8B949E] mt-1 max-w-xl">
            Activos centralizados de tus episodios: guiones, imágenes de escenas (04-assets), miniaturas, audio y video.
            Las imágenes se reutilizan desde Escenas — no se regeneran si ya existen.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadLibrary()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#15191E] border border-white/10 text-xs font-semibold text-[#8B949E] hover:text-white cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      <div className="flex items-center gap-1.5 border-b border-[rgba(255,255,255,0.05)]">
        {[
          { id: 'browse' as const, label: 'Explorar activos', icon: FolderOpen },
          { id: 'templates' as const, label: 'Plantillas de guion', icon: Sliders },
          { id: 'music' as const, label: 'Generador Lyria', icon: Music },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-semibold border-b-2 whitespace-nowrap cursor-pointer transition-all ${
                isActive
                  ? 'border-indigo-500 bg-indigo-950/20 text-indigo-300'
                  : 'border-transparent text-[#8B949E] hover:text-[#E6EDF2] hover:bg-[#15191E]/45'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {isGenerating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B0F14]/75 backdrop-blur-xs select-none">
          <div className="bg-[#15191E] border border-[rgba(255,255,255,0.05)] rounded-2xl p-8 max-w-sm text-center shadow-2xl space-y-4">
            <RefreshCw className="w-12 h-12 text-indigo-500 animate-spin mx-auto" />
            <h4 className="font-bold text-white text-sm">Creación en Progreso con IA</h4>
            <p className="text-xs text-[#8B949E] leading-relaxed">{progressText}</p>
          </div>
        </div>
      )}

      <div className="bg-[#15191E] border border-[rgba(255,255,255,0.05)] rounded-2xl p-6 shadow-xl min-h-[450px]">
        {activeTab === 'browse' ? (
          <div className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Episodios', value: stats.episodes, icon: Layers },
                { label: 'Con guion', value: stats.scripts, icon: FileText },
                { label: 'Imágenes de escena', value: stats.sceneImages, icon: ImageIcon },
                { label: 'Archivos media', value: stats.media, icon: Film },
              ].map(item => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="bg-[#0B0F14] border border-white/5 rounded-xl p-3 flex items-center gap-3"
                  >
                    <Icon className="w-4 h-4 text-indigo-400 shrink-0" />
                    <div>
                      <p className="text-[10px] text-[#8B949E] uppercase tracking-wider">{item.label}</p>
                      <p className="text-lg font-bold text-white">{item.value}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-2">
              {FILTER_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setFilter(opt.id)}
                  className={`px-3 py-1 rounded-full text-[10px] font-bold border cursor-pointer transition-colors ${
                    filter === opt.id
                      ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300'
                      : 'bg-[#0B0F14] border-white/10 text-[#8B949E] hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="py-16 text-center text-xs text-[#8B949E]">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                Cargando biblioteca…
              </div>
            ) : loadError ? (
              <div className="py-12 text-center text-xs text-rose-400">{loadError}</div>
            ) : filteredEntries.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#8B949E] space-y-2">
                <FolderOpen className="w-10 h-10 mx-auto opacity-40" />
                <p>No hay activos que coincidan con este filtro.</p>
                <p className="text-[10px]">Crea un episodio en Proyectos para empezar a acumular guiones e imágenes.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredEntries.map(entry => (
                  <EpisodeAssetCard
                    key={entry.episode.id}
                    entry={entry}
                    expanded={expandedId === entry.episode.id}
                    onToggle={() =>
                      setExpandedId(prev => (prev === entry.episode.id ? null : entry.episode.id))
                    }
                    onOpenWorkspace={onOpenWorkspace}
                    onDownload={handleDownload}
                    downloading={downloading}
                  />
                ))}
              </div>
            )}
          </div>
        ) : activeTab === 'music' ? (
          <MusicGeneratorPanel
            entries={entries}
            musicPrompt={musicPrompt}
            setMusicPrompt={setMusicPrompt}
            musicModel={musicModel}
            setMusicModel={setMusicModel}
            musicEpisodeId={musicEpisodeId}
            setMusicEpisodeId={setMusicEpisodeId}
            generatedAudioUrl={generatedAudioUrl}
            musicLabel={musicLabel}
            musicError={musicError}
            musicSkipped={musicSkipped}
            onGenerate={() => void handleGenerateMusic()}
            onOpenWorkspace={onOpenWorkspace}
          />
        ) : (
          <ScriptTemplatePanel
            topic={topic}
            setTopic={setTopic}
            objective={objective}
            setObjective={setObjective}
            duration={duration}
            setDuration={setDuration}
            audience={audience}
            setAudience={setAudience}
            style={style}
            setStyle={setStyle}
            emotion={emotion}
            setEmotion={setEmotion}
            customIdea={customIdea}
            setCustomIdea={setCustomIdea}
            generatedScript={generatedScript}
            setGeneratedScript={setGeneratedScript}
            onGenerate={handleGenerateScript}
            onUseScript={handleUseScript}
          />
        )}
      </div>
    </div>
  );
}

function EpisodeAssetCard({
  entry,
  expanded,
  onToggle,
  onOpenWorkspace,
  onDownload,
  downloading,
}: {
  entry: EpisodeLibraryEntry;
  expanded: boolean;
  onToggle: () => void;
  onOpenWorkspace: (episodeId: string, initialTab?: WorkspaceTab) => void;
  onDownload: (episodeId: string, assetKey: string) => void;
  downloading: string | null;
}) {
  const { episode, assets } = entry;
  const scenes = assets.sceneImages ?? [];
  const availableScenes = scenes.filter(s => s.available);
  const mediaFiles = assets.files.filter(
    f => ['video', 'short', 'thumbnail', 'audio', 'music'].includes(f.key) && f.available,
  );
  const hasScript = hasScriptAsset(entry);
  const preview = scriptPreview(entry);

  return (
    <div className="bg-[#0B0F14] border border-white/5 rounded-xl overflow-hidden">
      <div className="w-full flex items-center justify-between gap-3 px-4 py-3">
        <button
          type="button"
          onClick={onToggle}
          className="flex-1 min-w-0 text-left hover:opacity-90 cursor-pointer"
        >
          <p className="text-sm font-semibold text-white truncate">{episode.title}</p>
          <p className="text-[10px] text-[#8B949E] mt-0.5">
            {hasScript ? 'Guion' : 'Sin guion'}
            {' · '}
            {availableScenes.length}/{scenes.length || entry.detail?.content.scenes.length || 0} imágenes
            {' · '}
            {mediaFiles.length} media
          </p>
        </button>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onOpenWorkspace(episode.id, 'escenas')}
            className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold cursor-pointer"
          >
            Usar en proyecto
          </button>
          <button
            type="button"
            onClick={onToggle}
            className="text-[#8B949E] text-xs px-1 cursor-pointer"
            aria-label={expanded ? 'Contraer' : 'Expandir'}
          >
            {expanded ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {expanded ? (
        <div className="px-4 pb-4 space-y-4 border-t border-white/5 pt-4">
          {hasScript ? (
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  Guion
                </h4>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenWorkspace(episode.id, 'guion')}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer"
                  >
                    Abrir guion
                  </button>
                  <button
                    type="button"
                    onClick={() => void onDownload(episode.id, 'script')}
                    disabled={downloading === `${episode.id}:script`}
                    className="text-[10px] text-[#8B949E] hover:text-white font-semibold cursor-pointer disabled:opacity-50"
                  >
                    <Download className="w-3 h-3 inline" /> Descargar
                  </button>
                </div>
              </div>
              {preview ? (
                <p className="text-xs text-[#8B949E] leading-relaxed bg-[#15191E] rounded-lg p-3 font-mono whitespace-pre-wrap">
                  {preview}
                </p>
              ) : null}
            </section>
          ) : null}

          {scenes.length > 0 ? (
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5" />
                  Imágenes de escena (04-assets)
                </h4>
                <button
                  type="button"
                  onClick={() => onOpenWorkspace(episode.id, 'escenas')}
                  className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer"
                >
                  Editar en Escenas
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                {scenes.map(scene => (
                  <div
                    key={scene.sceneId}
                    className="rounded-lg overflow-hidden border border-white/5 bg-[#15191E]"
                  >
                    <div className="h-24 relative">
                      {scene.available && scene.imageUrl ? (
                        <SceneImage
                          src={scene.imageUrl}
                          alt={scene.label}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[9px] text-[#8B949E] px-2 text-center">
                          Pendiente — genera en Escenas
                        </div>
                      )}
                      <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/70 text-[8px] font-mono text-white">
                        {scene.filename}
                      </span>
                    </div>
                    {scene.text ? (
                      <p className="text-[9px] text-[#8B949E] p-1.5 line-clamp-2">{scene.text}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {mediaFiles.length > 0 ? (
            <section className="space-y-2">
              <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                <Film className="w-3.5 h-3.5" />
                Media producido
              </h4>
              <div className="flex flex-wrap gap-2">
                {mediaFiles.map(file => {
                  const Icon =
                    file.key === 'audio'
                      ? Mic
                      : file.key === 'music'
                        ? Music
                        : file.key === 'thumbnail'
                          ? ImageIcon
                          : Play;
                  const workspaceTab: WorkspaceTab =
                    file.key === 'thumbnail'
                      ? 'thumbnail'
                      : file.key === 'audio'
                        ? 'narracion'
                        : file.key === 'music'
                          ? 'video'
                          : 'video';
                  return (
                    <div
                      key={file.key}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#15191E] border border-white/5 text-xs"
                    >
                      <Icon className="w-3.5 h-3.5 text-indigo-400" />
                      <span className="text-[#E6EDF2]">{file.label}</span>
                      <button
                        type="button"
                        onClick={() => onOpenWorkspace(episode.id, workspaceTab)}
                        className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer"
                      >
                        Abrir
                      </button>
                      <button
                        type="button"
                        onClick={() => void onDownload(episode.id, file.key)}
                        disabled={downloading === `${episode.id}:${file.key}`}
                        className="text-[10px] text-[#8B949E] hover:text-white cursor-pointer disabled:opacity-50"
                      >
                        <Download className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          {assets.storageLocation === 'remote' && assets.message ? (
            <p className="text-[10px] text-amber-400/90">{assets.message}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function MusicGeneratorPanel({
  entries,
  musicPrompt,
  setMusicPrompt,
  musicModel,
  setMusicModel,
  musicEpisodeId,
  setMusicEpisodeId,
  generatedAudioUrl,
  musicLabel,
  musicError,
  musicSkipped,
  onGenerate,
  onOpenWorkspace,
}: {
  entries: EpisodeLibraryEntry[];
  musicPrompt: string;
  setMusicPrompt: (v: string) => void;
  musicModel: 'lyria-3-clip-preview' | 'lyria-3-pro-preview';
  setMusicModel: (v: 'lyria-3-clip-preview' | 'lyria-3-pro-preview') => void;
  musicEpisodeId: string;
  setMusicEpisodeId: (v: string) => void;
  generatedAudioUrl: string | null;
  musicLabel: string | null;
  musicError: string | null;
  musicSkipped: boolean;
  onGenerate: () => void;
  onOpenWorkspace: (episodeId: string, initialTab?: WorkspaceTab) => void;
}) {
  return (
    <div className="max-w-2xl mx-auto space-y-6 text-center py-6">
      <Music className="w-12 h-12 text-indigo-400 mx-auto" />
      <div className="space-y-2">
        <h3 className="font-display font-bold text-lg text-white">Generación de Música con Google Lyria</h3>
        <p className="text-xs text-[#8B949E] max-w-md mx-auto leading-relaxed">
          Compone soundtracks ambiente con lyria-3-clip-preview (30s) o lyria-3-pro-preview. Se guarda en
          05-audio/background-music.mp3 y se asigna a las escenas del episodio.
        </p>
      </div>

      <div className="space-y-4 bg-[#0B0F14] p-5 border border-[rgba(255,255,255,0.05)] rounded-2xl max-w-md mx-auto text-left">
        <div>
          <label className="text-[9px] font-bold text-[#8B949E] uppercase tracking-wider block mb-1">
            Episodio destino
          </label>
          <select
            value={musicEpisodeId}
            onChange={e => setMusicEpisodeId(e.target.value)}
            className="w-full bg-[#15191E] border border-[rgba(255,255,255,0.05)] rounded-2xl px-2 py-1.5 text-xs text-white"
          >
            <option value="">Selecciona un episodio…</option>
            {entries.map(e => (
              <option key={e.episode.id} value={e.episode.id}>
                {e.episode.title}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[9px] font-bold text-[#8B949E] uppercase tracking-wider block mb-1">
            Prompt musical
          </label>
          <textarea
            value={musicPrompt}
            onChange={e => setMusicPrompt(e.target.value)}
            rows={3}
            className="w-full bg-[#15191E] border border-[rgba(255,255,255,0.05)] rounded-2xl p-2 text-xs text-white focus:outline-none focus:border-indigo-500/30 resize-none"
          />
        </div>

        <div>
          <label className="text-[9px] font-bold text-[#8B949E] uppercase tracking-wider block mb-1">
            Modelo Lyria
          </label>
          <select
            value={musicModel}
            onChange={e =>
              setMusicModel(e.target.value as 'lyria-3-clip-preview' | 'lyria-3-pro-preview')
            }
            className="w-full bg-[#15191E] border border-[rgba(255,255,255,0.05)] rounded-2xl px-2 py-1.5 text-xs text-white"
          >
            <option value="lyria-3-clip-preview">Lyria Clip (30s)</option>
            <option value="lyria-3-pro-preview">Lyria Pro (canción completa)</option>
          </select>
        </div>

        {musicError ? <p className="text-[10px] text-rose-400">{musicError}</p> : null}

        <button
          type="button"
          disabled={!musicEpisodeId}
          onClick={onGenerate}
          className="w-full py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
        >
          <Sparkles className="w-4 h-4" />
          <span>Componer Soundtrack</span>
        </button>
      </div>

      {generatedAudioUrl ? (
        <div className="bg-indigo-950/20 border border-indigo-800/30 p-4.5 rounded-2xl max-w-md mx-auto space-y-3">
          <div className="text-left text-xs font-bold text-indigo-400">
            {musicSkipped
              ? '✓ Pista existente reutilizada (prompt similar)'
              : '✓ Composición musical de Lyria lista'}
          </div>
          {musicLabel ? (
            <p className="text-[10px] text-left text-[#8B949E] truncate">{musicLabel}</p>
          ) : null}
          <audio src={generatedAudioUrl} controls className="w-full outline-none" />
          {musicEpisodeId ? (
            <button
              type="button"
              onClick={() => onOpenWorkspace(musicEpisodeId, 'video')}
              className="w-full py-2 rounded-2xl border border-indigo-500/30 text-indigo-300 text-xs font-bold cursor-pointer hover:bg-indigo-950/30"
            >
              Abrir timeline de video del episodio
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ScriptTemplatePanel({
  topic,
  setTopic,
  objective,
  setObjective,
  duration,
  setDuration,
  audience,
  setAudience,
  style,
  setStyle,
  emotion,
  setEmotion,
  customIdea,
  setCustomIdea,
  generatedScript,
  setGeneratedScript,
  onGenerate,
  onUseScript,
}: {
  topic: string;
  setTopic: (v: string) => void;
  objective: string;
  setObjective: (v: string) => void;
  duration: string;
  setDuration: (v: string) => void;
  audience: string;
  setAudience: (v: string) => void;
  style: string;
  setStyle: (v: string) => void;
  emotion: string;
  setEmotion: (v: string) => void;
  customIdea: string;
  setCustomIdea: (v: string) => void;
  generatedScript: string | null;
  setGeneratedScript: (v: string | null) => void;
  onGenerate: () => void;
  onUseScript: () => void;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      <div className="lg:col-span-2 space-y-4 bg-[#0B0F14] p-5 rounded-2xl border border-[rgba(255,255,255,0.05)]">
        <div className="flex items-center gap-2 text-xs font-bold text-indigo-400 border-b border-[rgba(255,255,255,0.05)] pb-2 mb-2">
          <Sliders className="w-4 h-4" />
          <span>Plantilla de guion con IA</span>
        </div>
        <p className="text-[10px] text-[#8B949E] leading-relaxed">
          Genera borradores de guion para importar a un episodio nuevo. Las imágenes se crean y reutilizan
          desde la pestaña Escenas del workspace — no desde aquí.
        </p>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-bold text-[#8B949E] uppercase tracking-wider block mb-1">
              Tema del canal
            </label>
            <select
              value={topic}
              onChange={e => setTopic(e.target.value)}
              className="w-full bg-[#15191E] border border-[rgba(255,255,255,0.05)] rounded-2xl px-3 py-1.5 text-xs text-white"
            >
              <option value="Cristianismo">Cristianismo y Espiritualidad</option>
              <option value="Finanzas">Finanzas y Crecimiento Económico</option>
              <option value="Inteligencia Artificial">IA y Tecnología Moderna</option>
              <option value="Historia universal">Historias Históricas del Mundo</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-[#8B949E] uppercase tracking-wider block mb-1">
              Objetivo del video
            </label>
            <select
              value={objective}
              onChange={e => setObjective(e.target.value)}
              className="w-full bg-[#15191E] border border-[rgba(255,255,255,0.05)] rounded-2xl px-3 py-1.5 text-xs text-white"
            >
              <option value="Reflexionar">Reflexionar profundamente</option>
              <option value="Entretener">Entretener al espectador</option>
              <option value="Informar">Informar con datos rigurosos</option>
              <option value="Persuadir">Vender / Persuadir conversión</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-[#8B949E] uppercase tracking-wider block mb-1">
                Duración
              </label>
              <select
                value={duration}
                onChange={e => setDuration(e.target.value)}
                className="w-full bg-[#15191E] border border-[rgba(255,255,255,0.05)] rounded-2xl px-2.5 py-1.5 text-xs text-white"
              >
                <option value="1 minuto">1 min (Shorts)</option>
                <option value="5 minutos">5 min (Breve)</option>
                <option value="10 minutos">10 min (Medio)</option>
                <option value="20 minutos">20 min (Documental)</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-[#8B949E] uppercase tracking-wider block mb-1">
                Audiencia
              </label>
              <select
                value={audience}
                onChange={e => setAudience(e.target.value)}
                className="w-full bg-[#15191E] border border-[rgba(255,255,255,0.05)] rounded-2xl px-2.5 py-1.5 text-xs text-white"
              >
                <option value="Adultos">Adultos y Jóvenes</option>
                <option value="Niños">Niños / Infantil</option>
                <option value="General">Público General</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-[#8B949E] uppercase tracking-wider block mb-1">
                Estilo narrativo
              </label>
              <select
                value={style}
                onChange={e => setStyle(e.target.value)}
                className="w-full bg-[#15191E] border border-[rgba(255,255,255,0.05)] rounded-2xl px-2.5 py-1.5 text-xs text-white"
              >
                <option value="Narrativo">Narrativo con voz en off</option>
                <option value="Cinematográfico">Cinemático con transiciones</option>
                <option value="Dinámico">Dinámico con textos rápidos</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-[#8B949E] uppercase tracking-wider block mb-1">
                Emoción buscada
              </label>
              <select
                value={emotion}
                onChange={e => setEmotion(e.target.value)}
                className="w-full bg-[#15191E] border border-[rgba(255,255,255,0.05)] rounded-2xl px-2.5 py-1.5 text-xs text-white"
              >
                <option value="Esperanza">Esperanza y Paz</option>
                <option value="Misterio">Misterio y Curiosidad</option>
                <option value="Motivación">Motivación y Acción</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-[#8B949E] uppercase tracking-wider block mb-1">
              Tu idea o tema base
            </label>
            <textarea
              value={customIdea}
              onChange={e => setCustomIdea(e.target.value)}
              rows={3}
              placeholder="Ej. El foso de los leones de Daniel..."
              className="w-full bg-[#15191E] border border-[rgba(255,255,255,0.05)] rounded-2xl p-2 text-xs text-white focus:outline-none focus:border-indigo-500/30 resize-none"
            />
          </div>

          <button
            type="button"
            onClick={onGenerate}
            className="w-full py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 animate-pulse" />
            <span>Generar Guion con IA</span>
          </button>
        </div>
      </div>

      <div className="lg:col-span-3 bg-[#0B0F14] p-5 rounded-2xl border border-[rgba(255,255,255,0.05)] flex flex-col justify-between">
        <div className="space-y-3 flex-1 flex flex-col">
          <h4 className="text-[11px] font-bold text-[#8B949E] uppercase tracking-wider font-mono">
            Borrador de Guion Generado
          </h4>

          {generatedScript ? (
            <textarea
              readOnly
              value={generatedScript}
              className="w-full flex-1 min-h-[300px] bg-[#15191E] border border-[rgba(255,255,255,0.05)] rounded-2xl p-4 text-xs text-[#E6EDF2] leading-relaxed resize-none focus:outline-none font-mono"
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-[#8B949E] text-xs italic text-center py-16">
              <FileText className="w-10 h-10 text-[#8B949E]/55 mb-2" />
              Configure las opciones y presione &quot;Generar Guion&quot;.
            </div>
          )}
        </div>

        {generatedScript ? (
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-[rgba(255,255,255,0.05)] mt-4">
            <button
              type="button"
              onClick={() => setGeneratedScript(null)}
              className="px-4 py-2 rounded-2xl bg-[#15191E] border border-[rgba(255,255,255,0.05)] text-[#8B949E] hover:text-white text-xs font-bold cursor-pointer"
            >
              Descartar
            </button>
            <button
              type="button"
              onClick={onUseScript}
              className="px-4 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer"
            >
              <span>Importar a Proyectos</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
