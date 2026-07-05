import { useState, useRef, useEffect } from 'react';
import {
  FileText,
  Volume2,
  Image as ImageIcon,
  Play,
  Pause,
  Layers,
  Search,
  Sparkles,
  Sliders,
  CheckSquare,
  BarChart3,
  Lightbulb,
  Music,
  Share2,
  Trash2,
  ArrowRight,
  RefreshCw,
  Clock,
  ChevronRight,
  Eye,
  Settings,
  Flame,
  AudioLines,
  Download,
  AlertCircle,
  Plus,
  Pencil,
  ListOrdered,
  Subtitles,
  CheckCircle2,
} from 'lucide-react';
import { VideoProject, Scene, ProjectStatus } from '../types';
import type { WorkspaceTab } from '../lib/dashboardNavigation';
import {
  aggregateStageStatus,
  stagesForTab,
  STAGE_STATUS_LABEL,
  STAGE_STATUS_PILL,
  validateTabForApproval,
  shouldAdvanceKanban,
} from '../lib/workspaceStages';
import { parseSrtCueTexts, formatTimelineClock } from '../lib/srtPreview';
import SceneImage from './SceneImage';
import {
  aiRewrite,
  aiSeo,
  aiTts,
  authorizePublish,
  buildPublishPackage,
  fetchElevenLabsVoices,
  fetchEpisodeDetail,
  fetchJob,
  fetchSecrets,
  generateEpisodeThumbnail,
  generateSceneImages,
  generateStoryboardFromScript,
  generateSubtitles,
  loadAuthenticatedMediaUrl,
  renderEpisodeVideo,
  resolveEpisodeMediaUrl,
  updateEpisode,
  updateStageStatus,
  type ElevenLabsVoice,
} from '../api';
import type { EpisodeStage, EpisodeStageStatus } from '@creator-ai-studio/shared';

interface WorkspaceViewProps {
  project: VideoProject;
  onUpdateProject: (updated: VideoProject) => void;
  initialTab?: WorkspaceTab;
  forcedTab?: WorkspaceTab;
  forcedTabRequest?: number;
  stageRefreshToken?: number;
  onMoveProjectStatus?: (id: string, status: ProjectStatus) => Promise<void>;
}

const WORKSPACE_TABS: { id: WorkspaceTab; label: string; icon: typeof FileText }[] = [
  { id: 'guion', label: 'Guion', icon: FileText },
  { id: 'narracion', label: 'Narración', icon: Volume2 },
  { id: 'escenas', label: 'Escenas', icon: ImageIcon },
  { id: 'subtitulos', label: 'Subtítulos', icon: Subtitles },
  { id: 'video', label: 'Video / Timeline', icon: Play },
  { id: 'thumbnail', label: 'Thumbnail', icon: Layers },
  { id: 'seo', label: 'SEO', icon: Sparkles },
  { id: 'publicacion', label: 'Publicación', icon: Clock },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
];

export default function WorkspaceView({
  project,
  onUpdateProject,
  initialTab,
  forcedTab,
  forcedTabRequest = 0,
  stageRefreshToken = 0,
  onMoveProjectStatus,
}: WorkspaceViewProps) {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(initialTab ?? 'guion');
  const [stageStatuses, setStageStatuses] = useState<Map<EpisodeStage, EpisodeStageStatus>>(
    new Map(),
  );
  const [approvingTab, setApprovingTab] = useState<WorkspaceTab | null>(null);
  
  // General status
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Script State
  const [scriptText, setScriptText] = useState(project.script);
  const [outline, setOutline] = useState<string[]>(project.outline);
  const [selectedOutlineIndex, setSelectedOutlineIndex] = useState(0);
  const [editingOutlineIndex, setEditingOutlineIndex] = useState<number | null>(null);
  const [editingOutlineText, setEditingOutlineText] = useState('');
  const scriptEditorRef = useRef<HTMLTextAreaElement | null>(null);

  // Audio State (Narracion)
  const [selectedVoice, setSelectedVoice] = useState('JBFqnCBsd6RMkjVDRZzb');
  const [elevenVoices, setElevenVoices] = useState<ElevenLabsVoice[]>([]);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [audioPlaybackUrl, setAudioPlaybackUrl] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Escenas State
  const [scenes, setScenes] = useState<Scene[]>(project.scenes);

  // Publicación State
  const defaultScheduleDate = () => {
    if (project.scheduledAt) {
      const d = new Date(project.scheduledAt);
      if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
    const next = new Date();
    next.setDate(next.getDate() + 1);
    return next.toISOString().slice(0, 10);
  };
  const defaultScheduleTime = () => {
    if (project.scheduledAt) {
      const d = new Date(project.scheduledAt);
      if (!Number.isNaN(d.getTime())) {
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      }
    }
    return '18:00';
  };
  const [scheduleDate, setScheduleDate] = useState(defaultScheduleDate);
  const [scheduleTime, setScheduleTime] = useState(defaultScheduleTime);
  const [youtubeConnected, setYoutubeConnected] = useState<boolean | null>(null);
  const [schedulingPublish, setSchedulingPublish] = useState(false);
  const [isGeneratingScenes, setIsGeneratingScenes] = useState(false);
  const [generatingSceneId, setGeneratingSceneId] = useState<string | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(project.scenes[0]?.id || null);

  // Thumbnail State
  const [thumbnailText, setThumbnailText] = useState(project.title);
  const [showGlow, setShowGlow] = useState(true);
  const [showShadow, setShowShadow] = useState(true);
  const [thumbnailUrl, setThumbnailUrl] = useState(project.thumbnailUrl || '');
  const [thumbnailResolution, setThumbnailResolution] = useState('1K (Full HD)');

  const [videoSourceUrl, setVideoSourceUrl] = useState(project.videoUrl || '');
  const [videoPlaybackUrl, setVideoPlaybackUrl] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [renderStatusMessage, setRenderStatusMessage] = useState<string | null>(null);
  const [previewSceneIndex, setPreviewSceneIndex] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // SEO State
  const [seoTitles, setSeoTitles] = useState<string[]>(project.seoTitles);
  const [seoDescription, setSeoDescription] = useState(project.seoDescription);
  const [seoTags, setSeoTags] = useState<string[]>(project.seoTags);

  // Subtitles state
  const [subtitlesSrt, setSubtitlesSrt] = useState(project.subtitlesSrt ?? '');

  // Timeline playback state (Video Tab)
  const [timelineProgress, setTimelineProgress] = useState(0);
  const [isPlayingTimeline, setIsPlayingTimeline] = useState(false);

  useEffect(() => {
    setScriptText(project.script);
    setOutline(project.outline);
    setScenes(project.scenes);
    setThumbnailUrl(project.thumbnailUrl || '');
    setSeoTitles(project.seoTitles);
    setSeoDescription(project.seoDescription);
    setSeoTags(project.seoTags);
    setSubtitlesSrt(project.subtitlesSrt ?? '');
    if (project.audioUrl) setAudioBase64(project.audioUrl);
    if (project.videoUrl) setVideoSourceUrl(project.videoUrl);
    if (project.scheduledAt) {
      const d = new Date(project.scheduledAt);
      if (!Number.isNaN(d.getTime())) {
        setScheduleDate(d.toISOString().slice(0, 10));
        setScheduleTime(
          `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
        );
      }
    }
    if (initialTab) setActiveTab(initialTab);
  }, [
    project.id,
    project.script,
    project.outline,
    project.scenes,
    project.thumbnailUrl,
    project.audioUrl,
    project.videoUrl,
    project.seoTitles,
    project.seoDescription,
    project.seoTags,
    project.subtitlesSrt,
    project.scheduledAt,
    initialTab,
  ]);

  useEffect(() => {
    void fetchSecrets()
      .then(secrets => {
        const yt = secrets.items.find(item => item.provider === 'youtube');
        setYoutubeConnected(Boolean(yt?.configured));
      })
      .catch(() => setYoutubeConnected(false));
  }, []);

  useEffect(() => {
    if (forcedTab !== undefined) setActiveTab(forcedTab);
  }, [forcedTab, forcedTabRequest]);

  useEffect(() => {
    audioRef.current = null;
    setIsPlayingAudio(false);

    if (!audioBase64 || audioBase64 === 'demo_active') {
      setAudioPlaybackUrl(null);
      return;
    }

    if (audioBase64.startsWith('data:') || audioBase64.startsWith('blob:')) {
      setAudioPlaybackUrl(audioBase64);
      return;
    }

    const resolved = resolveEpisodeMediaUrl(project.id, audioBase64);
    if (resolved?.startsWith('/')) {
      let objectUrl: string | null = null;
      let cancelled = false;
      void loadAuthenticatedMediaUrl(resolved)
        .then(url => {
          if (cancelled) {
            if (url.startsWith('blob:')) URL.revokeObjectURL(url);
            return;
          }
          objectUrl = url;
          setAudioPlaybackUrl(url);
        })
        .catch(() => {
          if (!cancelled) setAudioPlaybackUrl(null);
        });
      return () => {
        cancelled = true;
        if (objectUrl?.startsWith('blob:')) URL.revokeObjectURL(objectUrl);
      };
    }

    setAudioPlaybackUrl(`data:audio/wav;base64,${audioBase64}`);
  }, [audioBase64, project.id]);

  useEffect(() => {
    if (!videoSourceUrl?.trim()) {
      setVideoPlaybackUrl(null);
      return;
    }
    if (videoSourceUrl.startsWith('blob:')) {
      setVideoPlaybackUrl(videoSourceUrl);
      return;
    }
    const resolved = resolveEpisodeMediaUrl(project.id, videoSourceUrl);
    if (!resolved?.startsWith('/')) {
      setVideoPlaybackUrl(resolved);
      return;
    }
    let objectUrl: string | null = null;
    let cancelled = false;
    void loadAuthenticatedMediaUrl(resolved)
      .then(url => {
        if (cancelled) {
          if (url.startsWith('blob:')) URL.revokeObjectURL(url);
          return;
        }
        objectUrl = url;
        setVideoPlaybackUrl(url);
      })
      .catch(() => {
        if (!cancelled) setVideoPlaybackUrl(null);
      });
    return () => {
      cancelled = true;
      if (objectUrl?.startsWith('blob:')) URL.revokeObjectURL(objectUrl);
    };
  }, [videoSourceUrl, project.id]);

  const subtitleCueTexts = parseSrtCueTexts(subtitlesSrt, Math.max(scenes.length, 12));
  const totalSceneDuration =
    scenes.reduce((sum, s) => sum + (s.duration || 0), 0) || scenes.length * 8;
  const primaryMusicTrack =
    scenes.find(s => s.musicTrack?.trim())?.musicTrack ?? 'Sin pista de música definida';
  const hasNarrationTrack = Boolean(audioPlaybackUrl && audioBase64 !== 'demo_active');
  const previewDuration = videoDuration > 0 ? videoDuration : totalSceneDuration;
  const activeSubtitlePreview =
    subtitleCueTexts[previewSceneIndex] ??
    subtitleCueTexts[0] ??
    (scriptText.trim() ? scriptText.slice(0, 80) : project.title);

  useEffect(() => {
    void fetchSecrets()
      .then(res => {
        const yt = res.items.find(item => item.provider === 'youtube');
        setYoutubeConnected(Boolean(yt?.configured));
      })
      .catch(() => setYoutubeConnected(false));
  }, []);

  useEffect(() => {
    if (!isPlayingTimeline || videoPlaybackUrl) return;
    const interval = window.setInterval(() => {
      const total = totalSceneDuration || 1;
      setVideoCurrentTime(prev => {
        const next = prev + 0.25;
        if (next >= total) {
          setIsPlayingTimeline(false);
          setPreviewSceneIndex(0);
          setTimelineProgress(0);
          return 0;
        }
        setTimelineProgress((next / total) * 100);
        let acc = 0;
        for (let i = 0; i < scenes.length; i++) {
          acc += scenes[i]?.duration || 8;
          if (next < acc) {
            setPreviewSceneIndex(i);
            break;
          }
        }
        return next;
      });
    }, 250);
    return () => window.clearInterval(interval);
  }, [isPlayingTimeline, videoPlaybackUrl, scenes, totalSceneDuration]);

  useEffect(() => {
    let active = true;
    void fetchEpisodeDetail(project.id)
      .then(detail => {
        if (!active) return;
        const map = new Map<EpisodeStage, EpisodeStageStatus>();
        for (const s of detail.stages) map.set(s.stage, s.status);
        setStageStatuses(map);
        if (detail.content.subtitlesSrt) setSubtitlesSrt(detail.content.subtitlesSrt);
        if (detail.content.thumbnailUrl) setThumbnailUrl(detail.content.thumbnailUrl);
        if (detail.content.videoUrl) setVideoSourceUrl(detail.content.videoUrl);
      })
      .catch(() => {
        // non-blocking — badges fall back to pending
      });
    return () => {
      active = false;
    };
  }, [project.id, stageRefreshToken]);

  // Sync state changes back to parent
  const persistProject = (patch: Partial<VideoProject> = {}) => {
    onUpdateProject({
      ...project,
      script: scriptText,
      outline,
      scenes,
      thumbnailUrl,
      seoTitles,
      seoDescription,
      seoTags,
      subtitlesSrt,
      videoUrl: videoSourceUrl,
      ...patch,
    });
  };

  const handleApproveSection = async (tab: WorkspaceTab = activeTab) => {
    const stages = stagesForTab(tab);
    const validation = validateTabForApproval(tab, project, {
      subtitlesSrt,
      audioReady: Boolean(audioBase64 && audioBase64 !== 'demo_active'),
    });
    if (!validation.ok) {
      triggerFeedback('error', validation.message ?? 'Completa el contenido antes de aprobar.');
      return;
    }

    persistProject();
    setApprovingTab(tab);
    try {
      for (const stage of stages) {
        await updateStageStatus(project.id, stage, 'completed');
        setStageStatuses(prev => new Map(prev).set(stage, 'completed'));
      }
      const advance = shouldAdvanceKanban(tab, project.status);
      if (advance && onMoveProjectStatus) {
        await onMoveProjectStatus(project.id, advance);
      }
      triggerFeedback(
        'success',
        advance
          ? `✓ Sección aprobada — proyecto avanzado a «${advance}»`
          : `✓ Sección aprobada — el pipeline no regenerará esta etapa hasta que edites el contenido`,
      );
    } catch (err) {
      console.error(err);
      triggerFeedback('error', 'No se pudo aprobar la sección');
    } finally {
      setApprovingTab(null);
    }
  };

  const handleSaveChanges = () => {
    persistProject();
    triggerFeedback('success', '✓ Cambios guardados — etapas dependientes se marcarán pendientes en el servidor');
  };

  const jumpToOutlineInScript = (index: number) => {
    setSelectedOutlineIndex(index);
    const item = outline[index]?.trim();
    if (!item || !scriptEditorRef.current) return;
    const needle = item.replace(/^\d+\.\s*/, '').slice(0, 24);
    const pos = scriptText.toLowerCase().indexOf(needle.toLowerCase());
    if (pos >= 0) {
      scriptEditorRef.current.focus();
      scriptEditorRef.current.setSelectionRange(pos, Math.min(pos + needle.length, scriptText.length));
      scriptEditorRef.current.scrollTop =
        (pos / Math.max(scriptText.length, 1)) * scriptEditorRef.current.scrollHeight;
    }
  };

  const startEditOutline = (index: number) => {
    setEditingOutlineIndex(index);
    setEditingOutlineText(outline[index] ?? '');
  };

  const commitOutlineEdit = () => {
    if (editingOutlineIndex === null) return;
    const next = [...outline];
    next[editingOutlineIndex] = editingOutlineText.trim() || `Punto ${editingOutlineIndex + 1}`;
    setOutline(next);
    setEditingOutlineIndex(null);
    setEditingOutlineText('');
  };

  const addOutlinePoint = () => {
    setOutline(prev => [...prev, `Punto ${prev.length + 1}`]);
    setSelectedOutlineIndex(outline.length);
  };

  const removeOutlinePoint = (index: number) => {
    if (outline.length <= 1) return;
    setOutline(prev => prev.filter((_, i) => i !== index));
    setSelectedOutlineIndex(Math.max(0, index - 1));
    if (editingOutlineIndex === index) setEditingOutlineIndex(null);
  };

  const syncOutlineFromScript = () => {
    const headers = scriptText
      .split(/\n/)
      .map(line => line.trim())
      .filter(line => /^\*\*.+\*\*$/.test(line) || /^\*\*\[/.test(line))
      .map(line => line.replace(/^\*\*|\*\*$/g, '').trim())
      .slice(0, 12);
    if (headers.length === 0) {
      triggerFeedback('error', 'No se encontraron encabezados ** en el guion para sincronizar');
      return;
    }
    setOutline(headers);
    triggerFeedback('success', `✓ Outline actualizado (${headers.length} puntos desde el guion)`);
  };

  const hasPublishedAssets =
    Boolean(project.videoUrl) ||
    stageStatuses.get('video') === 'completed' ||
    stageStatuses.get('subtitles') === 'completed';

  const renderSectionFooter = (tab: WorkspaceTab) => {
    const status = aggregateStageStatus(stagesForTab(tab), stageStatuses);
    const validation = validateTabForApproval(tab, project, {
      subtitlesSrt,
      audioReady: Boolean(audioBase64 && audioBase64 !== 'demo_active'),
    });
    const isApproving = approvingTab === tab;

    return (
      <div className="mt-6 pt-4 border-t border-[rgba(255,255,255,0.05)] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-[#8B949E] uppercase tracking-wider font-mono">
            Estado de la sección
          </span>
          <span
            className={`rounded-full border px-2.5 py-0.5 text-[10px] font-mono uppercase ${STAGE_STATUS_PILL[status]}`}
          >
            {STAGE_STATUS_LABEL[status]}
          </span>
          {status === 'completed' && (
            <span className="text-[10px] text-slate-500">
              Puedes seguir editando; al guardar se invalidarán etapas dependientes.
            </span>
          )}
        </div>
        <button
          type="button"
          disabled={isApproving || !validation.ok}
          title={validation.ok ? undefined : validation.message}
          onClick={() => void handleApproveSection(tab)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/50 disabled:opacity-40 text-emerald-300 border border-emerald-800/40 text-xs font-bold transition-all cursor-pointer"
        >
          {isApproving ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : status === 'completed' ? (
            <CheckCircle2 className="w-3.5 h-3.5" />
          ) : null}
          {status === 'completed' ? 'Re-aprobar sección' : 'Aprobar sección'}
        </button>
      </div>
    );
  };

  const triggerFeedback = (type: 'success' | 'error', text: string) => {
    setFeedbackMsg({ type, text });
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  const toggleTimelinePlayback = () => {
    if (videoPlaybackUrl && videoRef.current) {
      if (isPlayingTimeline) {
        videoRef.current.pause();
        setIsPlayingTimeline(false);
      } else {
        void videoRef.current.play().then(() => setIsPlayingTimeline(true)).catch(() => {
          triggerFeedback('error', 'No se pudo reproducir el video');
        });
      }
      return;
    }
    if (audioPlaybackUrl) {
      if (!audioRef.current) {
        audioRef.current = new Audio(audioPlaybackUrl);
        audioRef.current.onended = () => {
          setIsPlayingAudio(false);
          setIsPlayingTimeline(false);
        };
      } else if (audioRef.current.src !== audioPlaybackUrl) {
        audioRef.current.src = audioPlaybackUrl;
      }
      if (isPlayingTimeline || isPlayingAudio) {
        audioRef.current.pause();
        setIsPlayingAudio(false);
        setIsPlayingTimeline(false);
      } else {
        void audioRef.current.play().then(() => {
          setIsPlayingAudio(true);
          setIsPlayingTimeline(true);
        }).catch(() => {
          triggerFeedback('error', 'No se pudo reproducir la narración');
        });
      }
      return;
    }
    triggerFeedback('error', 'Genera narración o exporta el video para previsualizar');
  };

  const handleConfirmSchedule = async () => {
    if (!scheduleDate || !scheduleTime) {
      triggerFeedback('error', 'Selecciona fecha y hora de publicación.');
      return;
    }
    const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}:00`).toISOString();
    if (new Date(scheduledAt).getTime() <= Date.now()) {
      triggerFeedback('error', 'La fecha de publicación debe ser en el futuro.');
      return;
    }

    setSchedulingPublish(true);
    try {
      await updateEpisode(project.id, { content: { scheduledAt } });
      onUpdateProject({ ...project, scheduledAt, status: 'Programado' });

      if (youtubeConnected !== true) {
        triggerFeedback(
          'error',
          'Fecha guardada, pero YouTube no está conectado. Ve a Configuración → Integraciones → YouTube OAuth.',
        );
        return;
      }

      const pkg = await buildPublishPackage(project.id);
      if (!pkg.ready) {
        const missing = pkg.checklist
          .filter(item => !item.ok)
          .map(item => item.label)
          .join(', ');
        triggerFeedback(
          'error',
          `Fecha guardada. Completa el paquete de publicación antes de subir a YouTube: ${missing}`,
        );
        return;
      }

      const confirmed = window.confirm(
        `¿Subir el video a YouTube (privado) y programarlo para ${scheduleDate} ${scheduleTime}?`,
      );
      if (!confirmed) {
        triggerFeedback('success', '✓ Fecha de publicación guardada (sin subir a YouTube).');
        return;
      }

      const { job } = await authorizePublish(project.id, { scheduledAt });
      triggerFeedback('success', 'Subiendo y programando en YouTube…');

      await new Promise<void>((resolve, reject) => {
        const poll = window.setInterval(async () => {
          try {
            const updatedJob = await fetchJob(job.id);
            if (updatedJob.status === 'completed') {
              window.clearInterval(poll);
              const url = updatedJob.result?.youtubeUrl as string | undefined;
              triggerFeedback(
                'success',
                url
                  ? `✓ Video programado en YouTube: ${url}`
                  : '✓ Video programado en YouTube.',
              );
              resolve();
            } else if (updatedJob.status === 'failed') {
              window.clearInterval(poll);
              reject(new Error(updatedJob.error ?? 'Publicación falló'));
            }
          } catch (err) {
            window.clearInterval(poll);
            reject(err instanceof Error ? err : new Error('Publicación falló'));
          }
        }, 2000);
      });
    } catch (err) {
      triggerFeedback(
        'error',
        err instanceof Error ? err.message : 'Error al programar publicación',
      );
    } finally {
      setSchedulingPublish(false);
    }
  };

  const persistScenes = (nextScenes: Scene[]) => {
    setScenes(nextScenes);
    onUpdateProject({ ...project, scenes: nextScenes, script: scriptText });
  };

  const handleGenerateScenesFromScript = async () => {
    if (!scriptText.trim()) {
      triggerFeedback('error', 'Escribe o genera un guion en la pestaña Guion primero.');
      return;
    }
    setIsGeneratingScenes(true);
    try {
      const data = await generateStoryboardFromScript(project.id);
      persistScenes(data.scenes);
      if (data.scenes[0]) setSelectedSceneId(data.scenes[0].id);
      triggerFeedback('success', `✓ ${data.scenes.length} escenas generadas desde el guion`);
    } catch (err) {
      console.error(err);
      triggerFeedback('error', 'No se pudieron extraer escenas — revisa el formato del guion');
    } finally {
      setIsGeneratingScenes(false);
    }
  };

  const handleGenerateAllSceneImages = async () => {
    if (scenes.length === 0) {
      triggerFeedback('error', 'Genera escenas primero desde el guion.');
      return;
    }
    setIsProcessing(true);
    let generated = 0;
    try {
      for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i]!;
        setProcessingMessage(`Generando imagen ${i + 1} de ${scenes.length}…`);
        const data = await generateSceneImages(project.id, [scene.id], {
          force: true,
          skipLlmRefine: true,
        });
        persistScenes(data.scenes);
        if (data.generated > 0) generated += data.generated;
      }
      triggerFeedback('success', `✓ ${generated} imagen(es) generada(s)`);
    } catch (err) {
      console.error(err);
      triggerFeedback(
        'error',
        generated > 0
          ? `Se generaron ${generated} imagen(es) antes del error — puedes reintentar las restantes`
          : 'Error generando imágenes — revisa API de imagen en Configuración',
      );
    } finally {
      setIsProcessing(false);
      setProcessingMessage('');
    }
  };

  // 1. AI Rewrite for Scripts (Notion style suggestions)
  const handleAIRewrite = async (instruction: string) => {
    setIsProcessing(true);
    setProcessingMessage('Copiloto IA está reescribiendo tu guion...');
    try {
      const data = await aiRewrite(scriptText, instruction);
      if (data.text) {
        setScriptText(data.text);
        triggerFeedback('success', '✓ Guion reescrito por IA');
      }
    } catch (err) {
      console.error(err);
      triggerFeedback('error', 'Error al comunicar con la IA');
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    void fetchElevenLabsVoices()
      .then(setElevenVoices)
      .catch(() => setElevenVoices([]));
  }, []);

  // 2. TTS Voiceover Generation (ElevenLabs / Piper / Gemini via CAS API)
  const handleGenerateVoice = async () => {
    setIsProcessing(true);
    setProcessingMessage('Generando narración desde Creator AI Studio…');
    try {
      const data = await aiTts(scriptText, selectedVoice, project.id);

      if (data.audioUrl) {
        setAudioBase64(data.audioUrl);
        triggerFeedback(
          'success',
          data.isDemo
            ? 'Modo demo — configura ElevenLabs en Configuración'
            : `✓ Voz generada (${data.provider ?? 'CAS'}) y guardada en el episodio`,
        );
      } else if (data.audio) {
        setAudioBase64(data.audio);
        triggerFeedback('success', '✓ Audio generado');
      } else if (data.isDemo) {
        triggerFeedback('success', 'Modo demo: usa el narrador del navegador');
        setAudioBase64('demo_active');
      }
    } catch {
      triggerFeedback('error', 'Error generando voz — revisa Configuración → ElevenLabs');
    } finally {
      setIsProcessing(false);
    }
  };

  const togglePlayVoice = () => {
    if (audioBase64 === 'demo_active') {
      if (isPlayingAudio) {
        window.speechSynthesis.cancel();
        setIsPlayingAudio(false);
      } else {
        const utterance = new SpeechSynthesisUtterance(scriptText);
        utterance.lang = 'es-ES';
        utterance.onend = () => setIsPlayingAudio(false);
        window.speechSynthesis.speak(utterance);
        setIsPlayingAudio(true);
      }
      return;
    }

    if (!audioRef.current && audioPlaybackUrl) {
      audioRef.current = new Audio(audioPlaybackUrl);
      audioRef.current.onended = () => setIsPlayingAudio(false);
    }

    if (audioRef.current && audioRef.current.src !== audioPlaybackUrl && audioPlaybackUrl) {
      audioRef.current.src = audioPlaybackUrl;
    }

    if (audioRef.current) {
      if (isPlayingAudio) {
        audioRef.current.pause();
        setIsPlayingAudio(false);
      } else {
        audioRef.current.play();
        setIsPlayingAudio(true);
      }
    }
  };

  // 3. AI Scene Image generation
  const handleGenerateSceneImage = async (sceneId: string) => {
    setGeneratingSceneId(sceneId);
    setProcessingMessage('IA está modelando y generando la toma visual...');
    try {
      const data = await generateSceneImages(project.id, [sceneId], { force: true });
      persistScenes(data.scenes);
      triggerFeedback('success', '✓ Imagen generada para la escena');
    } catch (err) {
      console.error(err);
      triggerFeedback('error', 'Error generando imagen — revisa Gemini/OpenAI en Configuración');
    } finally {
      setGeneratingSceneId(null);
      setProcessingMessage('');
    }
  };

  // 4. AI SEO Generation
  const handleGenerateSEO = async () => {
    setIsProcessing(true);
    setProcessingMessage('Especialista SEO IA está analizando palabras clave...');
    try {
      const data = await aiSeo(project.title, scriptText);
      const titles = data.titles?.filter(Boolean) ?? [];
      const description = data.description?.trim() ?? '';
      const tags = data.tags?.filter(Boolean) ?? [];
      if (titles.length === 0 || !description) {
        triggerFeedback('error', 'La IA no devolvió metadatos SEO válidos');
        return;
      }
      setSeoTitles(titles);
      setSeoDescription(description);
      setSeoTags(tags);
      persistProject({ seoTitles: titles, seoDescription: description, seoTags: tags });
      triggerFeedback('success', '✓ SEO optimizado por el Agente Especialista IA');
    } catch (err) {
      console.error(err);
      triggerFeedback('error', 'Error al optimizar SEO');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGenerateSubtitles = async () => {
    setIsProcessing(true);
    setProcessingMessage('Generando subtítulos desde escenas y guion…');
    try {
      const data = await generateSubtitles(project.id);
      if (data.subtitlesSrt) {
        setSubtitlesSrt(data.subtitlesSrt);
        persistProject({ subtitlesSrt: data.subtitlesSrt });
        triggerFeedback(
          'success',
          data.skipped ? 'Subtítulos ya existentes — revisa y aprueba' : '✓ Subtítulos SRT generados',
        );
      }
    } catch (err) {
      console.error(err);
      triggerFeedback('error', 'No se pudieron generar subtítulos');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRenderVideo = async () => {
    setIsProcessing(true);
    setProcessingMessage(
      `Renderizando video con ${scenes.length} escena(s) y narración sincronizada…`,
    );
    try {
      const data = await renderEpisodeVideo(project.id, { force: true });
      if (!data.ok) {
        triggerFeedback('error', data.message || 'No se pudo renderizar el video');
        return;
      }
      const videoUrl = data.videoUrl ?? `/api/episodes/${project.id}/files/video`;
      setVideoSourceUrl(videoUrl);
      persistProject({ videoUrl });
      setRenderStatusMessage(data.message);
      triggerFeedback(
        'success',
        data.skipped ? 'Video ya existente — usa forzar si cambiaste escenas' : `✓ ${data.message}`,
      );
    } catch (err) {
      console.error(err);
      triggerFeedback('error', 'Error al exportar video — revisa narración e imágenes de escenas');
    } finally {
      setIsProcessing(false);
      setProcessingMessage('');
    }
  };

  const handleGenerateThumbnailBackground = async () => {
    setIsProcessing(true);
    setProcessingMessage('Generando y guardando miniatura en el episodio…');
    try {
      const data = await generateEpisodeThumbnail(project.id, {
        force: true,
        prompt: `High quality YouTube thumbnail background 16:9 for: ${thumbnailText}. Cinematic biblical, dramatic lighting, no text in image.`,
      });
      if (data.imageUrl) {
        setThumbnailUrl(data.imageUrl);
        persistProject({ thumbnailUrl: data.imageUrl });
        triggerFeedback(
          'success',
          data.skipped ? 'Miniatura existente en servidor' : '✓ Miniatura guardada — persiste al refrescar',
        );
      }
    } catch (err) {
      console.error(err);
      triggerFeedback('error', 'Error generando miniatura — revisa Gemini/OpenAI en Configuración');
    } finally {
      setIsProcessing(false);
      setProcessingMessage('');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Workspace Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#15191E] p-4 rounded-xl border border-[rgba(255,255,255,0.05)]">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/40">
              {project.series}
            </span>
            <span className="text-xs text-[#8B949E] font-mono">DURACIÓN: {project.duration}</span>
          </div>
          <h2 className="font-display font-bold text-xl text-white">"{project.title}"</h2>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveChanges}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-indigo-950/20 active:scale-98 cursor-pointer"
          >
            Guardar Cambios
          </button>
        </div>
      </div>

      {/* Tabs list */}
      <div
        id="workspace-tabs"
        data-workspace-tabs
        className="flex items-center gap-1 border-b border-[rgba(255,255,255,0.05)] overflow-x-auto pb-1 scrollbar-none scroll-mt-4"
      >
        {WORKSPACE_TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const tabStatus = aggregateStageStatus(stagesForTab(tab.id), stageStatuses);
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-semibold transition-all border-b-2 whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'border-indigo-500 bg-indigo-950/20 text-indigo-300'
                  : 'border-transparent text-[#8B949E] hover:text-[#E6EDF2] hover:bg-[#15191E]/40'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              <span
                className={`text-[8px] font-mono uppercase px-1.5 py-0.5 rounded border ${STAGE_STATUS_PILL[tabStatus]}`}
              >
                {STAGE_STATUS_LABEL[tabStatus]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Processing Animation Overlay */}
      {isProcessing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B0F14]/75 backdrop-blur-xs select-none">
          <div className="bg-[#15191E] border border-[rgba(255,255,255,0.05)] rounded-2xl p-8 max-w-sm text-center shadow-2xl space-y-4 animate-bounce">
            <RefreshCw className="w-12 h-12 text-indigo-500 animate-spin mx-auto" />
            <h4 className="font-bold text-white text-sm">Procesando Inteligencia Artificial</h4>
            <p className="text-xs text-[#8B949E] leading-relaxed">{processingMessage}</p>
          </div>
        </div>
      )}

      {/* Alert / Feedback message banner */}
      {feedbackMsg && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2.5 ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-950/30 border-emerald-800/40 text-emerald-400'
              : 'bg-rose-950/30 border-rose-800/40 text-rose-400'
          }`}
        >
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* TAB CONTENT PANELS */}
      <div className="bg-[#15191E] border border-[rgba(255,255,255,0.05)] rounded-2xl p-6 shadow-xl min-h-[450px]">
        
        {/* 1. GUION PANEL */}
        {activeTab === 'guion' && (
          <div className="space-y-6">
            {hasPublishedAssets && (
              <div className="rounded-xl border border-amber-500/25 bg-amber-950/15 px-4 py-3 space-y-2">
                <p className="text-xs font-bold text-amber-200 flex items-center gap-2">
                  <ListOrdered className="w-4 h-4" />
                  Re-generar video con tus cambios
                </p>
                <ol className="text-[11px] text-amber-100/80 space-y-1 list-decimal list-inside leading-relaxed">
                  <li>Edita el <strong>outline</strong> y el <strong>guion</strong> → <strong>Guardar Cambios</strong></li>
                  <li>
                    <strong>Escenas</strong> → storyboard / generar imágenes faltantes (escenas 5, 6, etc.)
                  </li>
                  <li>
                    <strong>Subtítulos</strong> → Generar subtítulos
                  </li>
                  <li>
                    <strong>Video</strong> → Exportar Video Final (incluye todas las escenas)
                  </li>
                  <li>Aprobar cada sección que hayas modificado</li>
                </ol>
              </div>
            )}

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            
            {/* Left: Outline */}
            <div className="space-y-4 lg:col-span-1">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-[11px] font-bold text-[#8B949E] uppercase tracking-wider font-mono">
                  Outline del Contenido
                </h4>
                <button
                  type="button"
                  onClick={syncOutlineFromScript}
                  className="text-[9px] font-bold text-indigo-400 hover:text-indigo-300 cursor-pointer"
                  title="Extraer puntos desde encabezados ** del guion"
                >
                  Sincronizar
                </button>
              </div>
              <div className="space-y-1 bg-[#0B0F14] border border-[rgba(255,255,255,0.05)] rounded-xl p-2 max-h-[350px] overflow-y-auto">
                {outline.length === 0 ? (
                  <p className="text-[10px] text-slate-500 px-2 py-3 text-center italic">
                    Sin outline — usa Sincronizar o Añadir punto
                  </p>
                ) : (
                  outline.map((item, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center gap-1 rounded-xl transition-colors ${
                        selectedOutlineIndex === idx
                          ? 'bg-indigo-950/40'
                          : 'hover:bg-[#15191E]'
                      }`}
                    >
                      {editingOutlineIndex === idx ? (
                        <input
                          value={editingOutlineText}
                          onChange={e => setEditingOutlineText(e.target.value)}
                          onBlur={commitOutlineEdit}
                          onKeyDown={e => {
                            if (e.key === 'Enter') commitOutlineEdit();
                            if (e.key === 'Escape') setEditingOutlineIndex(null);
                          }}
                          className="flex-1 mx-1 my-1 px-2 py-1.5 text-xs bg-[#15191E] border border-indigo-500/40 rounded-lg text-white"
                          autoFocus
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => jumpToOutlineInScript(idx)}
                          className={`flex-1 flex items-center gap-2.5 px-2 py-2 text-xs font-medium text-left cursor-pointer min-w-0 ${
                            selectedOutlineIndex === idx
                              ? 'text-indigo-300 font-semibold'
                              : 'text-[#8B949E] hover:text-[#E6EDF2]'
                          }`}
                        >
                          <span className="w-5 h-5 rounded bg-[rgba(255,255,255,0.05)] text-[10px] font-mono flex items-center justify-center text-white shrink-0">
                            {idx + 1}
                          </span>
                          <span className="truncate" title={item}>
                            {item}
                          </span>
                        </button>
                      )}
                      {editingOutlineIndex !== idx && (
                        <>
                          <button
                            type="button"
                            onClick={() => startEditOutline(idx)}
                            className="p-1.5 text-slate-500 hover:text-indigo-300 cursor-pointer shrink-0"
                            aria-label={`Editar punto ${idx + 1}`}
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeOutlinePoint(idx)}
                            disabled={outline.length <= 1}
                            className="p-1.5 text-slate-500 hover:text-rose-400 disabled:opacity-30 cursor-pointer shrink-0"
                            aria-label={`Eliminar punto ${idx + 1}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
              <button
                type="button"
                onClick={addOutlinePoint}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-white/10 text-[10px] font-bold text-slate-400 hover:text-white hover:border-indigo-500/30 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Añadir punto al outline
              </button>
              <p className="text-[9px] text-slate-600 leading-relaxed px-1">
                Clic en un punto para localizarlo en el guion. Lápiz para editar el título del punto.
              </p>
            </div>

            {/* Center: Notion style script editor */}
            <div className="space-y-3 lg:col-span-2">
              <h4 className="text-[11px] font-bold text-[#8B949E] uppercase tracking-wider font-mono">Editor de Guiones tipo Notion</h4>
              <div className="relative">
                <textarea
                  ref={scriptEditorRef}
                  value={scriptText}
                  onChange={e => setScriptText(e.target.value)}
                  className="w-full h-[350px] bg-[#0B0F14] border border-[rgba(255,255,255,0.05)] rounded-xl p-5 text-sm text-[#E6EDF2] leading-relaxed focus:outline-none focus:border-indigo-500/40 resize-none font-sans"
                  placeholder="Comienza a redactar tu guion bíblico..."
                />
                <div className="absolute bottom-3 right-3 text-[10px] text-[#8B949E] font-mono bg-[#0B0F14]/90 px-2.5 py-1 rounded border border-[rgba(255,255,255,0.05)]">
                  {scriptText.split(/\s+/).filter(Boolean).length} palabras
                </div>
              </div>
            </div>

            {/* Right: AI suggestions panel */}
            <div className="space-y-4 lg:col-span-1">
              <h4 className="text-[11px] font-bold text-[#8B949E] uppercase tracking-wider font-mono">Sugerencias del Copiloto</h4>
              <div className="space-y-2 bg-[#0B0F14] border border-[rgba(255,255,255,0.05)] rounded-xl p-3">
                <div className="flex items-center gap-2 text-xs font-bold text-indigo-400 mb-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Reescritura Rápida con IA</span>
                </div>

                {[
                  { label: 'Hazlo más emocional', desc: 'Añade ganchos emotivos y pausas dramáticas', prompt: 'haz el texto más emocional y conmovedor' },
                  { label: 'Reduce duración (Shorts)', desc: 'Optimiza la duración para formatos cortos de 1 min', prompt: 'reduce la duración significativamente para shorts' },
                  { label: 'Agrega referencias bíblicas', desc: 'Inserta versículos del Antiguo/Nuevo testamento', prompt: 'agrega dos versículos bíblicos relevantes para sustentar el guion' },
                  { label: 'Genera CTA impactante', desc: 'Invita a suscribirse, comentar y dar me gusta', prompt: 'agrega un potente llamado a la acción al final para retener la audiencia' },
                  { label: 'Cambia a tono Épico', desc: 'Aumenta el dramatismo del vocabulario', prompt: 'cambia el tono a uno épico, narrativo, grandioso y solemne' }
                ].map((act, i) => (
                  <button
                    key={i}
                    onClick={() => handleAIRewrite(act.prompt)}
                    className="w-full text-left p-2 rounded-xl bg-[#15191E] border border-[rgba(255,255,255,0.05)] hover:border-indigo-500/40 hover:bg-indigo-950/10 transition-all cursor-pointer group"
                  >
                    <div className="text-xs font-bold text-white group-hover:text-indigo-300">{act.label}</div>
                    <div className="text-[10px] text-[#8B949E] mt-0.5 leading-normal">{act.desc}</div>
                  </button>
                ))}
              </div>
            </div>

          </div>
          </div>
        )}
        {activeTab === 'guion' && renderSectionFooter('guion')}

        {/* 2. NARRACION PANEL */}
        {activeTab === 'narracion' && (
          <div className="max-w-2xl mx-auto space-y-6 text-center py-6">
            <Volume2 className="w-12 h-12 text-indigo-500 mx-auto" />
            <div className="space-y-2">
              <h3 className="font-display font-bold text-lg text-white">Narración de Voz con Inteligencia Artificial</h3>
              <p className="text-xs text-[#8B949E] max-w-md mx-auto leading-relaxed">
                La voz se genera desde esta app usando tu proveedor configurado (ElevenLabs recomendado).
                Pega tu API key una sola vez en Configuración — no necesitas abrir ElevenLabs cada vez.
              </p>
            </div>

            {/* Voice select controls */}
            <div className="bg-[#0B0F14] border border-[rgba(255,255,255,0.05)] rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 max-w-md mx-auto">
              <div className="text-left w-full sm:w-auto">
                <label className="text-[10px] font-bold text-[#8B949E] uppercase tracking-wider block mb-1">Elegir Narrador</label>
                <select
                  value={selectedVoice}
                  onChange={e => setSelectedVoice(e.target.value)}
                  className="bg-[#15191E] border border-[rgba(255,255,255,0.05)] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none w-full"
                >
                  {elevenVoices.length > 0 ? (
                    elevenVoices.map(v => (
                      <option key={v.voiceId} value={v.voiceId}>
                        {v.name}
                        {v.category ? ` (${v.category})` : ''}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="JBFqnCBsd6RMkjVDRZzb">George (ElevenLabs — por defecto)</option>
                    </>
                  )}
                </select>
              </div>

              <button
                onClick={handleGenerateVoice}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all cursor-pointer shadow-md shadow-indigo-950/20"
              >
                <Sparkles className="w-4 h-4" />
                <span>Generar Voz IA</span>
              </button>
            </div>

            {/* Audio player */}
            {audioBase64 && (
              <div className="bg-[#0D2418] border border-emerald-900/40 p-4 rounded-xl max-w-md mx-auto space-y-3.5 animate-pulse-slow">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                    <AudioLines className="w-4 h-4 animate-bounce" />
                    <span>
                      {audioPlaybackUrl
                        ? `✓ Voz narrada generada con éxito (${selectedVoice})`
                        : 'Cargando audio…'}
                    </span>
                  </div>
                </div>

                {audioPlaybackUrl && (
                <div className="flex items-center gap-4">
                  <button
                    onClick={togglePlayVoice}
                    className="p-3 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black shadow-md transition-all active:scale-95 cursor-pointer"
                  >
                    {isPlayingAudio ? <Pause className="w-5 h-5 fill-black" /> : <Play className="w-5 h-5 fill-black pl-0.5" />}
                  </button>
                  <div className="flex-1 text-left">
                    <div className="text-[11px] font-bold text-white font-mono uppercase tracking-wider">Audio_Off_Fidelidad.wav</div>
                    <div className="text-[10px] text-emerald-300/80 mt-0.5">Hz: 24000 (PCM 16-bit) • Haz click para reproducir</div>
                  </div>
                </div>
                )}
              </div>
            )}
          </div>
        )}
        {activeTab === 'narracion' && renderSectionFooter('narracion')}

        {/* 3. ESCENAS PANEL */}
        {activeTab === 'escenas' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-[rgba(255,255,255,0.05)]">
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-white">Guía Visual de Escenas (Storyboard)</h4>
                <p className="text-[11px] text-[#8B949E]">
                  Planifica cada toma. Puedes añadir el texto descriptivo y dejar que la IA cree la miniatura artística de previsualización.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleGenerateScenesFromScript()}
                  disabled={isGeneratingScenes || !scriptText.trim()}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isGeneratingScenes ? 'Generando…' : 'Desde guion'}</span>
                </button>
                {scenes.length > 0 && (
                  <button
                    type="button"
                    onClick={() => void handleGenerateAllSceneImages()}
                    disabled={isProcessing}
                    className="px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>Imágenes IA (todas)</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    const newSc: Scene = {
                      id: `sc_${Date.now()}`,
                      text: 'Escribe el concepto visual de esta escena...',
                      imageUrl: '',
                      voiceoverPrompt: '',
                      musicTrack: 'Peaceful Ambient Piano',
                      duration: 5,
                      transition: 'Fade',
                    };
                    setScenes(prev => [...prev, newSc]);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-[rgba(255,255,255,0.05)] hover:bg-[#30363D] text-[#E6EDF2] text-xs font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Añadir Escena</span>
                </button>
              </div>
            </div>

            {scenes.length === 0 ? (
              <div className="text-center py-12 text-[#8B949E] text-xs space-y-4">
                <AlertCircle className="w-8 h-8 text-[#8B949E]/50 mx-auto" />
                <p className="italic">No hay escenas en este episodio.</p>
                {scriptText.trim() ? (
                  <button
                    type="button"
                    onClick={() => void handleGenerateScenesFromScript()}
                    disabled={isGeneratingScenes}
                    className="mx-auto flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                  >
                    <Sparkles className="w-4 h-4" />
                    Generar escenas desde el guion ({scriptText.includes('**[') ? 'detectado formato screenplay' : 'por párrafos'})
                  </button>
                ) : (
                  <p className="text-[10px]">Primero escribe un guion en la pestaña Guion, o añade escenas manualmente.</p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {scenes.map((scene, index) => (
                  <div
                    key={scene.id}
                    className={`bg-[#0B0F14] border rounded-xl overflow-hidden shadow-md flex flex-col justify-between transition-all ${
                      selectedSceneId === scene.id ? 'border-indigo-500 shadow-indigo-950/20' : 'border-[rgba(255,255,255,0.05)]'
                    }`}
                  >
                    {/* Visual Preview */}
                    <div className="relative h-40 bg-[#15191E] group">
                      <SceneImage
                        src={scene.imageUrl}
                        alt={`Escena ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/80 text-[10px] font-bold font-mono text-white">
                        ESCENA {index + 1}
                      </div>

                      {/* Hover Overlay Generate Button */}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-150">
                        <button
                          onClick={() => void handleGenerateSceneImage(scene.id)}
                          disabled={generatingSceneId === scene.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold cursor-pointer disabled:opacity-60"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>{generatingSceneId === scene.id ? 'Generando…' : 'Generar Imagen IA'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Scene Text & Settings */}
                    <div className="p-4 space-y-3.5">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-[#8B949E] uppercase tracking-widest font-mono">Concepto de la toma</label>
                        <textarea
                          value={scene.text}
                          onChange={e => {
                            const val = e.target.value;
                            setScenes(prev => prev.map(sc => (sc.id === scene.id ? { ...sc, text: val } : sc)));
                          }}
                          rows={2}
                          className="w-full bg-[#15191E] border border-[rgba(255,255,255,0.05)] rounded-xl p-2 text-xs text-[#E6EDF2] focus:outline-none focus:border-indigo-500/30 resize-none leading-relaxed"
                          placeholder="Describe lo que se debe mostrar en pantalla..."
                        />
                      </div>

                      {/* Scene Properties */}
                      <div className="grid grid-cols-2 gap-3 text-[10px]">
                        <div>
                          <label className="text-[#8B949E] block mb-0.5">Duración (seg)</label>
                          <input
                            type="number"
                            value={scene.duration}
                            onChange={e => {
                              const val = parseInt(e.target.value) || 5;
                              setScenes(prev => prev.map(sc => (sc.id === scene.id ? { ...sc, duration: val } : sc)));
                            }}
                            className="w-full bg-[#15191E] border border-[rgba(255,255,255,0.05)] rounded-xl px-2.5 py-1 text-white font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[#8B949E] block mb-0.5">Transición</label>
                          <select
                            value={scene.transition}
                            onChange={e => {
                              const val = e.target.value;
                              setScenes(prev => prev.map(sc => (sc.id === scene.id ? { ...sc, transition: val } : sc)));
                            }}
                            className="w-full bg-[#15191E] border border-[rgba(255,255,255,0.05)] rounded-xl px-2 py-1 text-white"
                          >
                            <option value="Fade">Fade</option>
                            <option value="Dissolve">Dissolve</option>
                            <option value="Whip Cut">Whip Cut</option>
                            <option value="Crossfade">Crossfade</option>
                            <option value="Ninguno">Ninguno</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Delete trigger */}
                    <div className="px-4 py-2 border-t border-[rgba(255,255,255,0.05)]/60 flex items-center justify-between bg-[#0B0F14]/45">
                      <span className="text-[10px] text-[#8B949E] italic">Transition: {scene.transition}</span>
                      <button
                        onClick={() => {
                          const nextScenes = scenes.filter(sc => sc.id !== scene.id);
                          persistScenes(nextScenes);
                          if (selectedSceneId === scene.id) {
                            setSelectedSceneId(nextScenes[0]?.id ?? null);
                          }
                          triggerFeedback('success', '✓ Escena removida');
                        }}
                        className="p-1 rounded text-[#8B949E] hover:text-rose-400 hover:bg-rose-950/20 transition-colors cursor-pointer"
                        title="Borrar escena"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {activeTab === 'escenas' && renderSectionFooter('escenas')}

        {/* 3b. SUBTITULOS PANEL */}
        {activeTab === 'subtitulos' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-[rgba(255,255,255,0.05)]">
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-white">Subtítulos (SRT)</h4>
                <p className="text-[11px] text-[#8B949E] max-w-xl">
                  Genera cues sincronizados desde las escenas (duración por toma) o párrafos del guion.
                  Edita el texto antes de aprobar.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleGenerateSubtitles()}
                disabled={isProcessing || (!scriptText.trim() && scenes.length === 0)}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Generar subtítulos
              </button>
            </div>
            <textarea
              value={subtitlesSrt}
              onChange={e => setSubtitlesSrt(e.target.value)}
              className="w-full h-80 bg-[#0B0F14] border border-[rgba(255,255,255,0.05)] rounded-xl p-4 text-xs text-[#E6EDF2] leading-relaxed focus:outline-none focus:border-indigo-500/40 resize-none font-mono"
              placeholder="1&#10;00:00:00,000 --> 00:00:05,000&#10;Primera línea de subtítulo…"
            />
            {subtitlesSrt.trim() && (
              <p className="text-[10px] text-slate-500 font-mono">
                {subtitlesSrt.split(/\n\n+/).filter(Boolean).length} cue(s) · formato SRT
              </p>
            )}
          </div>
        )}
        {activeTab === 'subtitulos' && renderSectionFooter('subtitulos')}

        {/* 4. VIDEO TAB */}
        {activeTab === 'video' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Top View: Video Preview Stage */}
              <div className="lg:col-span-2 bg-[#0B0F14] border border-[rgba(255,255,255,0.05)] rounded-2xl overflow-hidden aspect-video flex flex-col justify-between relative group">
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 z-10 pointer-events-none" />

                <div className="absolute inset-0 flex items-center justify-center bg-zinc-950">
                  <div className="relative w-full h-full">
                    {videoPlaybackUrl ? (
                      <video
                        ref={videoRef}
                        src={videoPlaybackUrl}
                        className="w-full h-full object-contain bg-black"
                        playsInline
                        onTimeUpdate={e => {
                          const el = e.currentTarget;
                          setVideoCurrentTime(el.currentTime);
                          setTimelineProgress(el.duration ? (el.currentTime / el.duration) * 100 : 0);
                        }}
                        onLoadedMetadata={e => setVideoDuration(e.currentTarget.duration)}
                        onEnded={() => setIsPlayingTimeline(false)}
                        onPause={() => setIsPlayingTimeline(false)}
                        onPlay={() => setIsPlayingTimeline(true)}
                      />
                    ) : (
                      <SceneImage
                        src={scenes[previewSceneIndex]?.imageUrl || scenes[0]?.imageUrl || thumbnailUrl}
                        alt={`Preview escena ${previewSceneIndex + 1}`}
                        className="w-full h-full object-cover opacity-90"
                      />
                    )}

                    {activeSubtitlePreview && (
                      <div className="absolute bottom-16 left-1/2 -translate-x-1/2 text-center w-full max-w-xl z-20 px-4 pointer-events-none">
                        <div className="bg-black/75 border border-yellow-500/30 text-yellow-400 font-bold px-4 py-2 rounded-xl text-xs sm:text-sm tracking-wide shadow-xl font-display leading-relaxed">
                          {activeSubtitlePreview}
                        </div>
                      </div>
                    )}

                    <div className="absolute bottom-4 left-4 right-4 z-20 flex items-center gap-3 text-[10px] font-mono text-[#8B949E] pointer-events-none">
                      <span>{formatTimelineClock(videoCurrentTime)}</span>
                      <div className="flex-1 h-1.5 bg-[rgba(255,255,255,0.05)] rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${timelineProgress}%` }} />
                      </div>
                      <span>{formatTimelineClock(previewDuration)}</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 z-10 flex items-center justify-between text-xs text-white pointer-events-none">
                  <span className="flex items-center gap-1.5 bg-black/60 px-2.5 py-1 rounded-full border border-[rgba(255,255,255,0.05)]">
                    <span className={`w-1.5 h-1.5 rounded-full ${videoPlaybackUrl ? 'bg-emerald-500' : 'bg-amber-500'} ${isPlayingTimeline ? 'animate-ping' : ''}`} />
                    {videoPlaybackUrl ? 'VIDEO RENDERIZADO' : 'PREVIEW ESCENAS + AUDIO'}
                  </span>
                  <span className="bg-black/60 px-2 py-0.5 rounded font-mono font-bold text-indigo-400">1080p</span>
                </div>

                <div className="p-4 z-10 self-center">
                  <button
                    type="button"
                    onClick={toggleTimelinePlayback}
                    className="p-5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-2xl transition-all scale-100 hover:scale-105 active:scale-95 cursor-pointer"
                  >
                    {isPlayingTimeline ? <Pause className="w-6 h-6 fill-white" /> : <Play className="w-6 h-6 fill-white pl-0.5" />}
                  </button>
                </div>

                <div className="p-4 z-10 text-xs text-[#8B949E] self-start font-medium bg-black/40 backdrop-blur-xs rounded-tr-xl pointer-events-none">
                  {scenes.length} escena(s) · {subtitleCueTexts.length} cue(s) de subtítulos
                </div>
              </div>

              {/* Sidebar Info: Render queue */}
              <div className="bg-[#0B0F14] border border-[rgba(255,255,255,0.05)] rounded-2xl p-5 space-y-4">
                <h4 className="text-[11px] font-bold text-[#8B949E] uppercase tracking-wider font-mono">Consola de Renderizado</h4>
                <div className="space-y-4">
                  <div className="bg-[#15191E] p-3.5 rounded-xl border border-[rgba(255,255,255,0.05)] space-y-2">
                    <div className="text-xs font-bold text-white">Último render</div>
                    <p className="text-[10px] text-[#8B949E] leading-normal">
                      {renderStatusMessage ??
                        (videoPlaybackUrl
                          ? 'Video exportado en el servidor — reproducción desde archivos del episodio.'
                          : `Pendiente: ${scenes.length} escena(s), narración ${hasNarrationTrack ? 'lista' : 'faltante'}, subtítulos ${subtitleCueTexts.length > 0 ? 'listos' : 'opcionales'}.`)}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-[#8B949E]">
                      <span>Pistas listas</span>
                      <span>{hasNarrationTrack && scenes.length > 0 ? 'Sí' : 'Incompleto'}</span>
                    </div>
                    <div className="w-full h-1.5 bg-[#15191E] rounded-full overflow-hidden p-[0.5px]">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all"
                        style={{
                          width: `${Math.round(((hasNarrationTrack ? 1 : 0) + (scenes.length > 0 ? 1 : 0) + (subtitleCueTexts.length > 0 ? 1 : 0)) / 3 * 100)}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-[#8B949E]">
                      <span>Resolución del render</span>
                      <span className="font-bold text-white font-mono">1080p (1920x1080)</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isProcessing || scenes.length === 0}
                    onClick={() => void handleRenderVideo()}
                    className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
                  >
                    Exportar Video Final ({scenes.length} escenas)
                  </button>
                </div>
              </div>

            </div>

            {/* Bottom View: CapCut-style Timeline tracks */}
            <div className="bg-[#0B0F14] border border-[rgba(255,255,255,0.05)] rounded-xl p-4.5 space-y-3 overflow-x-auto">
              <div className="text-xs font-bold text-white font-mono flex items-center gap-1.5 border-b border-[rgba(255,255,255,0.05)] pb-2">
                <Sliders className="w-4 h-4 text-indigo-400" />
                <span>Pistas de Línea de Tiempo (Estilo CapCut)</span>
              </div>

              <div className="space-y-2.5 min-w-[700px]">
                {/* 1. Track: Narración */}
                <div className="flex items-center gap-4">
                  <div className="w-24 text-[10px] font-bold text-[#8B949E] uppercase tracking-wider font-mono flex items-center gap-1 shrink-0">
                    <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                    <span>Narración</span>
                  </div>
                  <div className="flex-1 h-9 bg-amber-950/20 border border-amber-900/30 rounded-xl p-1.5 flex items-center relative overflow-hidden">
                    <div
                      className={`absolute inset-y-0 left-0 rounded-md border flex items-center px-2.5 ${
                        hasNarrationTrack
                          ? 'bg-amber-600/35 border-amber-500/40 w-4/5'
                          : 'bg-amber-900/20 border-amber-800/30 w-1/3'
                      }`}
                    >
                      <span className="text-[10px] font-bold text-amber-200 truncate">
                        {hasNarrationTrack ? 'Narración del episodio (MP3)' : 'Sin narración — pestaña Narración'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. Track: Video/Imágenes */}
                <div className="flex items-center gap-4">
                  <div className="w-24 text-[10px] font-bold text-[#8B949E] uppercase tracking-wider font-mono flex items-center gap-1 shrink-0">
                    <ImageIcon className="w-3.5 h-3.5 text-sky-400" />
                    <span>Imágenes</span>
                  </div>
                  <div className="flex-1 h-9 bg-sky-950/10 border border-sky-900/20 rounded-xl p-1 flex gap-1 relative overflow-hidden">
                    {(scenes.length > 0 ? scenes : [{ id: 'empty', duration: 0 } as Scene]).map(
                      (scene, idx) => (
                        <div
                          key={scene.id ?? idx}
                          className="flex-1 min-w-0 bg-sky-600/35 rounded border border-sky-500/30 flex items-center justify-between px-2 text-[9px] text-sky-200"
                        >
                          <span className="truncate">
                            {scenes.length > 0 ? `Toma ${idx + 1}` : 'Añade escenas'}
                          </span>
                          <span>{scene.duration ? `${scene.duration}s` : '—'}</span>
                        </div>
                      ),
                    )}
                  </div>
                </div>

                {/* 3. Track: Subtítulos */}
                <div className="flex items-center gap-4">
                  <div className="w-24 text-[10px] font-bold text-[#8B949E] uppercase tracking-wider font-mono flex items-center gap-1 shrink-0">
                    <FileText className="w-3.5 h-3.5 text-yellow-400" />
                    <span>Subtítulos</span>
                  </div>
                  <div className="flex-1 h-9 bg-yellow-950/10 border border-yellow-900/20 rounded-xl p-1 flex gap-1 relative overflow-hidden">
                    {subtitleCueTexts.length > 0 ? (
                      subtitleCueTexts.map((cue, idx) => (
                        <div
                          key={`${idx}-${cue.slice(0, 12)}`}
                          className="flex-1 min-w-0 bg-yellow-600/20 rounded border border-yellow-500/30 flex items-center px-2 text-[8px] text-yellow-200"
                        >
                          <span className="truncate">&quot;{cue}&quot;</span>
                        </div>
                      ))
                    ) : (
                      <div className="flex-1 bg-yellow-900/20 rounded border border-yellow-800/30 flex items-center px-2 text-[8px] text-yellow-300/70">
                        Genera subtítulos en la pestaña Subtítulos
                      </div>
                    )}
                  </div>
                </div>

                {/* 4. Track: Música */}
                <div className="flex items-center gap-4">
                  <div className="w-24 text-[10px] font-bold text-[#8B949E] uppercase tracking-wider font-mono flex items-center gap-1 shrink-0">
                    <Music className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Música</span>
                  </div>
                  <div className="flex-1 h-9 bg-emerald-950/20 border border-emerald-900/30 rounded-xl p-1.5 flex items-center relative overflow-hidden">
                    <div className="absolute inset-y-0 left-0 bg-emerald-600/25 rounded-md border border-emerald-500/30 w-[95%] flex items-center px-2.5">
                      <span className="text-[10px] font-bold text-emerald-300 truncate">{primaryMusicTrack}</span>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}
        {activeTab === 'video' && renderSectionFooter('video')}

        {/* 5. THUMBNAIL TAB */}
        {activeTab === 'thumbnail' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Canva Preview Card */}
              <div className="lg:col-span-2 bg-[#0B0F14] border border-[rgba(255,255,255,0.05)] rounded-2xl p-6 flex flex-col items-center justify-center relative overflow-hidden">
                <div className="w-full max-w-lg aspect-video rounded-xl overflow-hidden relative shadow-2xl border border-[rgba(255,255,255,0.05)] bg-[#15191E]">
                  {/* Background Image */}
                  <SceneImage
                    src={thumbnailUrl}
                    alt="Thumbnail background"
                    className="w-full h-full object-cover select-none"
                  />

                  {/* High Contrast Vignette overlay */}
                  <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-transparent to-transparent select-none" />

                  {/* Glow layer simulation */}
                  {showGlow && (
                    <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-amber-500/30 rounded-full blur-2xl select-none animate-pulse" />
                  )}

                  {/* Title overlay text layer */}
                  <div className="absolute inset-0 flex flex-col justify-end p-6 max-w-[70%] select-none">
                    <h3
                      className={`font-display font-black text-2xl text-white tracking-tight uppercase leading-none ${
                        showShadow ? 'drop-shadow-[0_4px_6px_rgba(0,0,0,0.9)]' : ''
                      }`}
                    >
                      {thumbnailText}
                    </h3>
                    <div className="mt-2.5 flex items-center gap-1.5">
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-600 text-white">
                        REFLEXIÓN CRISTIANA
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 text-xs text-[#8B949E] text-center font-medium">
                  Resolución actual de exportación: <strong className="text-white font-mono">{thumbnailResolution}</strong>
                </div>
              </div>

              {/* Canva Editor Controls */}
              <div className="bg-[#0B0F14] border border-[rgba(255,255,255,0.05)] rounded-2xl p-5 space-y-4">
                <h4 className="text-[11px] font-bold text-[#8B949E] uppercase tracking-wider font-mono">Editor de Miniatura</h4>
                
                <div className="space-y-4">
                  {/* Title text editor */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-[#8B949E] uppercase tracking-wider block">Texto Principal</label>
                    <input
                      type="text"
                      value={thumbnailText}
                      onChange={e => setThumbnailText(e.target.value)}
                      className="w-full bg-[#15191E] border border-[rgba(255,255,255,0.05)] rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                      placeholder="Ej. LA VERDAD DE LA PAZ"
                    />
                  </div>

                  {/* Layers triggers */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-[#8B949E] uppercase tracking-wider block">Capas Visuales</label>
                    <div className="space-y-1.5 bg-[#15191E] p-2.5 rounded-xl border border-[rgba(255,255,255,0.05)]">
                      <div className="flex items-center justify-between text-xs font-semibold text-white">
                        <span>Texto Principal</span>
                        <input type="checkbox" checked={true} disabled className="accent-indigo-500" />
                      </div>
                      <div className="flex items-center justify-between text-xs font-semibold text-white">
                        <span>Glow Amarillo Trasero</span>
                        <input
                          type="checkbox"
                          checked={showGlow}
                          onChange={e => setShowGlow(e.target.checked)}
                          className="accent-indigo-500"
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs font-semibold text-white">
                        <span>Sombra de Contraste (Drop Shadow)</span>
                        <input
                          type="checkbox"
                          checked={showShadow}
                          onChange={e => setShowShadow(e.target.checked)}
                          className="accent-indigo-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* AI Tools */}
                  <div className="space-y-2 pt-2 border-t border-[rgba(255,255,255,0.05)]/60">
                    <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest font-mono flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> Herramientas IA
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled
                        title="Próximamente"
                        className="py-2 px-2.5 rounded-xl bg-[#15191E] border border-[rgba(255,255,255,0.05)] text-[10px] font-bold text-slate-500 cursor-not-allowed text-center"
                      >
                        Remover Fondo (próximamente)
                      </button>
                      <button
                        type="button"
                        disabled
                        title="Próximamente"
                        className="py-2 px-2.5 rounded-xl bg-[#15191E] border border-[rgba(255,255,255,0.05)] text-[10px] font-bold text-slate-500 cursor-not-allowed text-center"
                      >
                        Upscale 4K (próximamente)
                      </button>
                    </div>
                  </div>

                  {/* Image Generation */}
                  <div className="pt-2">
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => void handleGenerateThumbnailBackground()}
                      className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
                    >
                      Generar Nuevo Fondo IA
                    </button>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}
        {activeTab === 'thumbnail' && renderSectionFooter('thumbnail')}

        {/* 6. SEO TAB */}
        {activeTab === 'seo' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-[rgba(255,255,255,0.05)]">
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-white">Agente SEO Especialista IA</h4>
                <p className="text-[11px] text-[#8B949E]">
                  Analiza el guion del video y genera títulos con alto CTR, descripciones ricas en palabras clave y tags altamente relevantes.
                </p>
              </div>
              <button
                onClick={handleGenerateSEO}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Optimizar con IA</span>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Left Column: Title proposals */}
              <div className="space-y-4">
                <h4 className="text-[11px] font-bold text-[#8B949E] uppercase tracking-wider font-mono">Alternativas de Título Sugeridas</h4>
                <div className="space-y-2.5">
                  {seoTitles.map((t, idx) => (
                    <div key={idx} className="bg-[#0B0F14] p-3 rounded-xl border border-[rgba(255,255,255,0.05)] space-y-1.5 relative group">
                      <div className="text-[10px] font-mono text-indigo-400 font-bold">PROPUESTA {idx + 1}</div>
                      <p className="text-xs text-white font-bold tracking-tight">"{t}"</p>
                      <button
                        onClick={() => {
                          onUpdateProject({ ...project, title: t });
                          triggerFeedback('success', '✓ Título de proyecto actualizado');
                        }}
                        className="absolute right-3 top-3 px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[9px] font-bold opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      >
                        Elegir
                      </button>
                    </div>
                  ))}
                </div>

                <div className="space-y-1.5 pt-2">
                  <h4 className="text-[11px] font-bold text-[#8B949E] uppercase tracking-wider font-mono">Palabras Clave / Tags ({seoTags.length})</h4>
                  <div className="flex flex-wrap gap-1.5 bg-[#0B0F14] p-3.5 rounded-xl border border-[rgba(255,255,255,0.05)]">
                    {seoTags.map((tag, idx) => (
                      <span key={idx} className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#15191E] border border-[rgba(255,255,255,0.05)] text-[#8B949E]">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column: Descriptions */}
              <div className="space-y-2">
                <h4 className="text-[11px] font-bold text-[#8B949E] uppercase tracking-wider font-mono">Descripción de Video Completa (Rich Text)</h4>
                <textarea
                  value={seoDescription}
                  onChange={e => setSeoDescription(e.target.value)}
                  className="w-full h-80 bg-[#0B0F14] border border-[rgba(255,255,255,0.05)] rounded-xl p-4 text-xs text-[#E6EDF2] leading-relaxed focus:outline-none focus:border-indigo-500/40 resize-none font-mono"
                  placeholder="Escribe la descripción de tu video..."
                />
              </div>

            </div>
          </div>
        )}
        {activeTab === 'seo' && renderSectionFooter('seo')}

        {/* 7. PUBLICACION TAB */}
        {activeTab === 'publicacion' && (
          <div className="max-w-xl mx-auto space-y-6 py-4">
            <div className="text-center space-y-2">
              <Clock className="w-10 h-10 text-indigo-500 mx-auto" />
              <h3 className="font-display font-bold text-lg text-white">Programación de Publicación Multicanal</h3>
              <p className="text-xs text-[#8B949E] leading-relaxed max-w-sm mx-auto">
                Define la fecha de lanzamiento. Una vez el video se compile, se distribuirá automáticamente en tus redes sociales elegidas.
              </p>
            </div>

            <div className="bg-[#0B0F14] border border-[rgba(255,255,255,0.05)] rounded-xl p-5 space-y-4">
              {youtubeConnected === true ? (
                <p className="text-xs text-emerald-400">YouTube OAuth conectado — la subida usará tu cuenta configurada.</p>
              ) : youtubeConnected === false ? (
                <p className="text-xs text-amber-400">
                  YouTube no conectado. Conecta OAuth en Configuración → Integraciones para subir o programar.
                </p>
              ) : null}

              {project.scheduledAt && (
                <p className="text-xs text-slate-400">
                  Programado: {new Date(project.scheduledAt).toLocaleString('es-ES')}
                </p>
              )}

              {/* Distribution checklist */}
              <div className="space-y-2.5">
                <label className="text-[10px] font-bold text-[#8B949E] uppercase tracking-wider block">Redes sociales elegidas</label>
                
                {[
                  { name: 'YouTube (Canal Cristiano)', id: 'ch_yt', active: true },
                  { name: 'TikTok (Recortes de shorts automáticos)', id: 'ch_tk', active: true },
                  { name: 'Facebook (Página de Reflexiones)', id: 'ch_fb', active: false },
                  { name: 'Instagram (Reels de alta interacción)', id: 'ch_ig', active: false }
                ].map(item => (
                  <div key={item.id} className="flex items-center justify-between p-2.5 rounded-xl bg-[#15191E] border border-[rgba(255,255,255,0.05)]">
                    <span className="text-xs text-white font-medium">{item.name}</span>
                    <input type="checkbox" defaultChecked={item.active} className="accent-indigo-500 w-4 h-4 cursor-pointer" />
                  </div>
                ))}
              </div>

              {/* Time inputs */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-[#8B949E] uppercase tracking-wider block mb-1">Fecha de publicación</label>
                  <input
                    type="date"
                    value={scheduleDate}
                    onChange={e => setScheduleDate(e.target.value)}
                    className="w-full bg-[#15191E] border border-[rgba(255,255,255,0.05)] rounded-xl p-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[#8B949E] uppercase tracking-wider block mb-1">Hora (Horeb Local)</label>
                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={e => setScheduleTime(e.target.value)}
                    className="w-full bg-[#15191E] border border-[rgba(255,255,255,0.05)] rounded-xl p-2 text-xs text-white"
                  />
                </div>
              </div>

              <button
                type="button"
                disabled={schedulingPublish || isProcessing}
                onClick={() => void handleConfirmSchedule()}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
              >
                {schedulingPublish ? 'Programando…' : 'Confirmar Programación del Video'}
              </button>
            </div>
          </div>
        )}
        {activeTab === 'publicacion' && renderSectionFooter('publicacion')}

        {/* 8. ANALYTICS TAB */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <h4 className="text-sm font-bold text-white">Métricas del episodio</h4>

            {project.status === 'Publicado' ? (
              <div className="rounded-xl border border-white/10 bg-[#0B0F14] p-6 space-y-3 text-center">
                <p className="text-sm text-slate-300">
                  Las métricas por video están en la vista global de Analytics cuando YouTube OAuth está
                  conectado.
                </p>
                <p className="text-xs text-slate-500">
                  Ejecuta el agente <strong className="text-slate-400">analytics_agent</strong> para un
                  informe de rendimiento de este episodio.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-white/10 bg-[#0B0F14]/50 p-8 text-center space-y-2">
                <p className="text-sm text-slate-400 font-medium">Sin métricas todavía</p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                  Este episodio está en <strong className="text-slate-400">{project.status}</strong>. Las
                  visualizaciones y engagement aparecerán después de publicar en YouTube.
                </p>
              </div>
            )}
          </div>
        )}
        {activeTab === 'analytics' && renderSectionFooter('analytics')}

      </div>
    </div>
  );
}
