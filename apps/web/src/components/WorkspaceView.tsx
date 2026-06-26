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
  Plus
} from 'lucide-react';
import { VideoProject, Scene } from '../types';

interface WorkspaceViewProps {
  project: VideoProject;
  onUpdateProject: (updated: VideoProject) => void;
}

export default function WorkspaceView({ project, onUpdateProject }: WorkspaceViewProps) {
  const [activeTab, setActiveTab] = useState<'guion' | 'narracion' | 'escenas' | 'video' | 'thumbnail' | 'seo' | 'publicacion' | 'analytics'>('guion');
  
  // General status
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Script State
  const [scriptText, setScriptText] = useState(project.script);
  const [outline, setOutline] = useState<string[]>(project.outline);
  const [selectedOutlineIndex, setSelectedOutlineIndex] = useState(0);

  // Audio State (Narracion)
  const [selectedVoice, setSelectedVoice] = useState('Kore');
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Escenas State
  const [scenes, setScenes] = useState<Scene[]>(project.scenes);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(project.scenes[0]?.id || null);

  // Thumbnail State
  const [thumbnailText, setThumbnailText] = useState(project.title);
  const [showGlow, setShowGlow] = useState(true);
  const [showShadow, setShowShadow] = useState(true);
  const [thumbnailUrl, setThumbnailUrl] = useState(project.thumbnailUrl || 'https://images.unsplash.com/photo-1499209974431-9dddcece7f88?auto=format&fit=crop&q=80&w=600');
  const [thumbnailResolution, setThumbnailResolution] = useState('1K (Full HD)');

  // SEO State
  const [seoTitles, setSeoTitles] = useState<string[]>(project.seoTitles);
  const [seoDescription, setSeoDescription] = useState(project.seoDescription);
  const [seoTags, setSeoTags] = useState<string[]>(project.seoTags);

  // Timeline playback state (Video Tab)
  const [timelineProgress, setTimelineProgress] = useState(0);
  const [isPlayingTimeline, setIsPlayingTimeline] = useState(false);
  const timelineIntervalRef = useRef<any>(null);

  // Sync state changes back to parent
  const handleSaveChanges = () => {
    onUpdateProject({
      ...project,
      script: scriptText,
      outline,
      scenes,
      thumbnailUrl,
      seoTitles,
      seoDescription,
      seoTags
    });
    triggerFeedback('success', '✓ Cambios guardados con éxito');
  };

  const triggerFeedback = (type: 'success' | 'error', text: string) => {
    setFeedbackMsg({ type, text });
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  // 1. AI Rewrite for Scripts (Notion style suggestions)
  const handleAIRewrite = async (instruction: string) => {
    setIsProcessing(true);
    setProcessingMessage('Copiloto IA está reescribiendo tu guion...');
    try {
      const response = await fetch('/api/gemini/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script: scriptText, instruction }),
      });
      const data = await response.json();
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

  // 2. TTS Voiceover Generation
  const handleGenerateVoice = async () => {
    setIsProcessing(true);
    setProcessingMessage('Sintetizando voz en off con Gemini TTS...');
    try {
      const response = await fetch('/api/gemini/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: scriptText, voice: selectedVoice }),
      });
      const data = await response.json();
      
      if (data.audio) {
        setAudioBase64(data.audio);
        triggerFeedback('success', '✓ Audio generado correctamente con Gemini API');
      } else if (data.isDemo) {
        // Fallback: Use client Speech Synthesis
        triggerFeedback('success', '✓ Modo Demo: Iniciando narrador de voz nativo en tu navegador');
        // Synthesize natively for premium effect
        const utterance = new SpeechSynthesisUtterance(scriptText.substring(0, 400));
        utterance.lang = 'es-ES';
        // Mocking audio source
        setAudioBase64('demo_active');
      }
    } catch (err) {
      console.error(err);
      triggerFeedback('error', 'Error generando voz');
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

    if (!audioRef.current && audioBase64) {
      const audioUrl = `data:audio/wav;base64,${audioBase64}`;
      audioRef.current = new Audio(audioUrl);
      audioRef.current.onended = () => setIsPlayingAudio(false);
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
  const handleGenerateSceneImage = async (sceneId: string, textDescription: string) => {
    setIsProcessing(true);
    setProcessingMessage('IA está modelando y generando la toma visual...');
    try {
      const response = await fetch('/api/gemini/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: textDescription, aspectRatio: '16:9' }),
      });
      const data = await response.json();
      if (data.imageUrl) {
        setScenes(prev =>
          prev.map(sc => (sc.id === sceneId ? { ...sc, imageUrl: data.imageUrl } : sc))
        );
        triggerFeedback('success', '✓ Imagen generada por IA para la escena');
      }
    } catch (err) {
      console.error(err);
      triggerFeedback('error', 'Error generando imagen');
    } finally {
      setIsProcessing(false);
    }
  };

  // 4. AI SEO Generation
  const handleGenerateSEO = async () => {
    setIsProcessing(true);
    setProcessingMessage('Especialista SEO IA está analizando palabras clave...');
    try {
      const response = await fetch('/api/gemini/seo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: project.title, script: scriptText }),
      });
      const data = await response.json();
      if (data.titles && data.description) {
        setSeoTitles(data.titles);
        setSeoDescription(data.description);
        setSeoTags(data.tags);
        triggerFeedback('success', '✓ SEO optimizado por el Agente Especialista IA');
      }
    } catch (err) {
      console.error(err);
      triggerFeedback('error', 'Error al optimizar SEO');
    } finally {
      setIsProcessing(false);
    }
  };

  // Thumbnail tools
  const handleRemoveBackground = () => {
    setIsProcessing(true);
    setProcessingMessage('Removiendo fondo del personaje con IA...');
    setTimeout(() => {
      // simulate removing background by changing the Unsplash ID to a cut-out PNG-like landscape
      setThumbnailUrl('https://images.unsplash.com/photo-1518020382113-a7e8fc38eac9?auto=format&fit=crop&q=80&w=600');
      setIsProcessing(false);
      triggerFeedback('success', '✓ Fondo removido con éxito');
    }, 2000);
  };

  const handleUpscaleThumbnail = () => {
    setIsProcessing(true);
    setProcessingMessage('Upscaling imagen a 4K Super Resolution...');
    setTimeout(() => {
      setThumbnailResolution('4K Ultra HD (3840x2160)');
      setIsProcessing(false);
      triggerFeedback('success', '✓ Miniatura escalada a 4K con ultra-definición');
    }, 2500);
  };

  // Playback simulation for video timeline
  useEffect(() => {
    if (isPlayingTimeline) {
      timelineIntervalRef.current = setInterval(() => {
        setTimelineProgress(prev => {
          if (prev >= 100) {
            setIsPlayingTimeline(false);
            clearInterval(timelineIntervalRef.current);
            return 0;
          }
          return prev + 2;
        });
      }, 250);
    } else {
      if (timelineIntervalRef.current) {
        clearInterval(timelineIntervalRef.current);
      }
    }

    return () => {
      if (timelineIntervalRef.current) {
        clearInterval(timelineIntervalRef.current);
      }
    };
  }, [isPlayingTimeline]);

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
      <div className="flex items-center gap-1 border-b border-[rgba(255,255,255,0.05)] overflow-x-auto pb-1 scrollbar-none">
        {[
          { id: 'guion', label: 'Guion', icon: FileText },
          { id: 'narracion', label: 'Narración', icon: Volume2 },
          { id: 'escenas', label: 'Escenas', icon: ImageIcon },
          { id: 'video', label: 'Video / Timeline', icon: Play },
          { id: 'thumbnail', label: 'Thumbnail', icon: Layers },
          { id: 'seo', label: 'SEO', icon: Sparkles },
          { id: 'publicacion', label: 'Publicación', icon: Clock },
          { id: 'analytics', label: 'Analytics', icon: BarChart3 }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-semibold transition-all border-b-2 whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'border-indigo-500 bg-indigo-950/20 text-indigo-300'
                  : 'border-transparent text-[#8B949E] hover:text-[#E6EDF2] hover:bg-[#15191E]/40'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
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
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            
            {/* Left: Outline */}
            <div className="space-y-4 lg:col-span-1">
              <h4 className="text-[11px] font-bold text-[#8B949E] uppercase tracking-wider font-mono">Outline del Contenido</h4>
              <div className="space-y-1 bg-[#0B0F14] border border-[rgba(255,255,255,0.05)] rounded-xl p-2 max-h-[350px] overflow-y-auto">
                {outline.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedOutlineIndex(idx)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-left transition-colors ${
                      selectedOutlineIndex === idx
                        ? 'bg-indigo-950/40 text-indigo-300 font-semibold'
                        : 'text-[#8B949E] hover:text-[#E6EDF2] hover:bg-[#15191E]'
                    }`}
                  >
                    <span className="w-5 h-5 rounded bg-[rgba(255,255,255,0.05)] text-[10px] font-mono flex items-center justify-center text-white shrink-0">
                      {idx + 1}
                    </span>
                    <span className="truncate">{item}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Center: Notion style script editor */}
            <div className="space-y-3 lg:col-span-2">
              <h4 className="text-[11px] font-bold text-[#8B949E] uppercase tracking-wider font-mono">Editor de Guiones tipo Notion</h4>
              <div className="relative">
                <textarea
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
        )}

        {/* 2. NARRACION PANEL */}
        {activeTab === 'narracion' && (
          <div className="max-w-2xl mx-auto space-y-6 text-center py-6">
            <Volume2 className="w-12 h-12 text-indigo-500 mx-auto" />
            <div className="space-y-2">
              <h3 className="font-display font-bold text-lg text-white">Narración de Voz con Inteligencia Artificial</h3>
              <p className="text-xs text-[#8B949E] max-w-md mx-auto leading-relaxed">
                Nuestros agentes de voz utilizan el modelo **gemini-3.1-flash-tts-preview** para sintetizar audio natural de alta fidelidad, con respiraciones y entonación humana.
              </p>
            </div>

            {/* Voice select controls */}
            <div className="bg-[#0B0F14] border border-[rgba(255,255,255,0.05)] rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 max-w-md mx-auto">
              <div className="text-left w-full sm:w-auto">
                <label className="text-[10px] font-bold text-[#8B949E] uppercase tracking-wider block mb-1">Elegir Narrador</label>
                <select
                  value={selectedVoice}
                  onChange={e => setSelectedVoice(e.target.value)}
                  className="bg-[#15191E] border border-[rgba(255,255,255,0.05)] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
                >
                  <option value="Kore">Kore (Voz Bíblica - Profunda y Solemne)</option>
                  <option value="Zephyr">Zephyr (Voz Narrativa - Amigable y Fluida)</option>
                  <option value="Puck">Puck (Voz Rápida - Dinámica para Shorts)</option>
                  <option value="Fenrir">Fenrir (Voz de Suspenso - Misteriosa)</option>
                  <option value="Charon">Charon (Voz Clásica - Neutral)</option>
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
                    <span>✓ Voz narrada generada con éxito ({selectedVoice})</span>
                  </div>
                </div>

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
              </div>
            )}
          </div>
        )}

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
              <button
                onClick={() => {
                  const newSc: Scene = {
                    id: `sc_${Date.now()}`,
                    text: 'Escribe el concepto visual de esta escena...',
                    imageUrl: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?auto=format&fit=crop&q=80&w=400',
                    voiceoverPrompt: 'Sugerencia de voz',
                    musicTrack: 'Peaceful Ambient Piano',
                    duration: 5,
                    transition: 'Fade'
                  };
                  setScenes(prev => [...prev, newSc]);
                }}
                className="px-3 py-1.5 rounded-xl bg-[rgba(255,255,255,0.05)] hover:bg-[#30363D] text-[#E6EDF2] text-xs font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Añadir Escena</span>
              </button>
            </div>

            {scenes.length === 0 ? (
              <div className="text-center py-12 text-[#8B949E] text-xs italic space-y-2">
                <AlertCircle className="w-8 h-8 text-[#8B949E]/50 mx-auto" />
                <p>No hay escenas configuradas en este proyecto.</p>
                <p className="text-[10px]">Utiliza el botón de arriba para crear una escena.</p>
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
                      <img
                        src={scene.imageUrl}
                        alt={`Escena ${index + 1}`}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/80 text-[10px] font-bold font-mono text-white">
                        ESCENA {index + 1}
                      </div>

                      {/* Hover Overlay Generate Button */}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-150">
                        <button
                          onClick={() => handleGenerateSceneImage(scene.id, scene.text)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Generar Imagen IA</span>
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
                          setScenes(prev => prev.filter(sc => sc.id !== scene.id));
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

        {/* 4. VIDEO TAB */}
        {activeTab === 'video' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Top View: Video Preview Stage */}
              <div className="lg:col-span-2 bg-[#0B0F14] border border-[rgba(255,255,255,0.05)] rounded-2xl overflow-hidden aspect-video flex flex-col justify-between relative group">
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 z-10" />
                
                {/* Simulated playback visual */}
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-950">
                  <div className="relative w-full h-full">
                    {/* Background slide */}
                    <img
                      src={scenes[0]?.imageUrl || thumbnailUrl}
                      alt="Preview frame"
                      className="w-full h-full object-cover opacity-85"
                      referrerPolicy="no-referrer"
                    />
                    
                    {/* Animated visual overlays representing subtitles and music waveforms */}
                    <div className="absolute bottom-16 left-1/2 -translate-x-1/2 text-center w-full max-w-xl z-20 px-4">
                      <div className="bg-black/75 border border-yellow-500/30 text-yellow-400 font-bold px-4 py-2 rounded-xl text-xs sm:text-sm tracking-wide shadow-xl font-display leading-relaxed">
                        {isPlayingTimeline
                          ? '"Confía, y entrega tu carga hoy al Creador del Universo..."'
                          : '"¿Qué dice realmente la Biblia sobre la ansiedad?"'}
                      </div>
                    </div>

                    {/* Progress slider bar inside video player */}
                    <div className="absolute bottom-4 left-4 right-4 z-20 flex items-center gap-3 text-[10px] font-mono text-[#8B949E]">
                      <span>00:{isPlayingTimeline ? '05' : '00'}</span>
                      <div className="flex-1 h-1.5 bg-[rgba(255,255,255,0.05)] rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${timelineProgress}%` }} />
                      </div>
                      <span>00:{project.duration.split(':')[1]}</span>
                    </div>
                  </div>
                </div>

                {/* Status elements */}
                <div className="p-4 z-10 flex items-center justify-between text-xs text-white">
                  <span className="flex items-center gap-1.5 bg-black/60 px-2.5 py-1 rounded-full border border-[rgba(255,255,255,0.05)]">
                    <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-ping" /> PREVISUALIZACIÓN ACTIVA
                  </span>
                  <span className="bg-black/60 px-2 py-0.5 rounded font-mono font-bold text-indigo-400">1080p CINE</span>
                </div>

                <div className="p-4 z-10 self-center">
                  <button
                    onClick={() => setIsPlayingTimeline(!isPlayingTimeline)}
                    className="p-5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-2xl transition-all scale-100 hover:scale-105 active:scale-95 cursor-pointer"
                  >
                    {isPlayingTimeline ? <Pause className="w-6 h-6 fill-white" /> : <Play className="w-6 h-6 fill-white pl-0.5" />}
                  </button>
                </div>

                <div className="p-4 z-10 text-xs text-[#8B949E] self-start font-medium bg-black/40 backdrop-blur-xs rounded-tr-xl">
                  {scenes.length} Escenas en Storyboard cargadas
                </div>
              </div>

              {/* Sidebar Info: Render queue */}
              <div className="bg-[#0B0F14] border border-[rgba(255,255,255,0.05)] rounded-2xl p-5 space-y-4">
                <h4 className="text-[11px] font-bold text-[#8B949E] uppercase tracking-wider font-mono">Consola de Renderizado</h4>
                <div className="space-y-4">
                  <div className="bg-[#15191E] p-3.5 rounded-xl border border-[rgba(255,255,255,0.05)] space-y-2">
                    <div className="text-xs font-bold text-white">Último Render</div>
                    <p className="text-[10px] text-[#8B949E] leading-normal">
                      Sincronización automatizada por el **Agente Editor**. Los subtítulos se acoplan automáticamente usando estilos dinámicos de CapCut.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-[#8B949E]">
                      <span>Compilación de pistas</span>
                      <span>Sincronizado</span>
                    </div>
                    <div className="w-full h-1.5 bg-[#15191E] rounded-full overflow-hidden p-[0.5px]">
                      <div className="h-full bg-emerald-500 rounded-full w-[100%]" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-[#8B949E]">
                      <span>Resolución del render</span>
                      <span className="font-bold text-white font-mono">1080p (1920x1080)</span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setIsProcessing(true);
                      setProcessingMessage('Compilando pistas, voces y música de fondo para generar render final...');
                      setTimeout(() => {
                        setIsProcessing(false);
                        triggerFeedback('success', '✓ Render finalizado y guardado en biblioteca local');
                      }, 3000);
                    }}
                    className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
                  >
                    Exportar Video Final
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
                    <div className="absolute inset-y-0 left-0 bg-amber-600/35 rounded-md border border-amber-500/40 w-4/5 flex items-center px-2.5">
                      <span className="text-[10px] font-bold text-amber-200">VOZ_KORE_ESPAÑOL.wav (Sincronizado)</span>
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
                    <div className="w-1/3 bg-sky-600/35 rounded border border-sky-500/30 flex items-center justify-between px-2 text-[9px] text-sky-200">
                      <span>Toma 1: Ansiedad</span>
                      <span>5s</span>
                    </div>
                    <div className="w-1/3 bg-sky-600/35 rounded border border-sky-500/30 flex items-center justify-between px-2 text-[9px] text-sky-200">
                      <span>Toma 2: Biblia</span>
                      <span>7s</span>
                    </div>
                    <div className="w-1/4 bg-sky-600/35 rounded border border-sky-500/30 flex items-center justify-between px-2 text-[9px] text-sky-200">
                      <span>Toma 3: Flores</span>
                      <span>5s</span>
                    </div>
                  </div>
                </div>

                {/* 3. Track: Subtítulos */}
                <div className="flex items-center gap-4">
                  <div className="w-24 text-[10px] font-bold text-[#8B949E] uppercase tracking-wider font-mono flex items-center gap-1 shrink-0">
                    <FileText className="w-3.5 h-3.5 text-yellow-400" />
                    <span>Subtítulos</span>
                  </div>
                  <div className="flex-1 h-9 bg-yellow-950/10 border border-yellow-900/20 rounded-xl p-1 flex gap-1 relative overflow-hidden">
                    <div className="w-1/4 bg-yellow-600/20 rounded border border-yellow-500/30 flex items-center px-2 text-[8px] text-yellow-200">
                      <span>"¿Te has sentido abrumado...?"</span>
                    </div>
                    <div className="w-1/4 bg-yellow-600/20 rounded border border-yellow-500/30 flex items-center px-2 text-[8px] text-yellow-200">
                      <span>"Filipenses nos da la clave..."</span>
                    </div>
                    <div className="w-1/4 bg-yellow-600/20 rounded border border-yellow-500/30 flex items-center px-2 text-[8px] text-yellow-200">
                      <span>"Jesús abordó esto..."</span>
                    </div>
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
                      <span className="text-[10px] font-bold text-emerald-300">Peaceful Ambient Piano Loop (Faded Out 15%)</span>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

        {/* 5. THUMBNAIL TAB */}
        {activeTab === 'thumbnail' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Canva Preview Card */}
              <div className="lg:col-span-2 bg-[#0B0F14] border border-[rgba(255,255,255,0.05)] rounded-2xl p-6 flex flex-col items-center justify-center relative overflow-hidden">
                <div className="w-full max-w-lg aspect-video rounded-xl overflow-hidden relative shadow-2xl border border-[rgba(255,255,255,0.05)] bg-[#15191E]">
                  {/* Background Image */}
                  <img
                    src={thumbnailUrl}
                    alt="Thumbnail background"
                    className="w-full h-full object-cover select-none"
                    referrerPolicy="no-referrer"
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
                        onClick={handleRemoveBackground}
                        className="py-2 px-2.5 rounded-xl bg-[#15191E] hover:bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.05)] text-[10px] font-bold text-white transition-all cursor-pointer text-center"
                      >
                        Remover Fondo
                      </button>
                      <button
                        onClick={handleUpscaleThumbnail}
                        className="py-2 px-2.5 rounded-xl bg-[#15191E] hover:bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.05)] text-[10px] font-bold text-white transition-all cursor-pointer text-center"
                      >
                        Upscale a 4K
                      </button>
                    </div>
                  </div>

                  {/* Image Generation */}
                  <div className="pt-2">
                    <button
                      onClick={async () => {
                        setIsProcessing(true);
                        setProcessingMessage('Iniciando generador de miniaturas conceptuales con IA...');
                        try {
                          const response = await fetch('/api/gemini/generate-image', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ prompt: `high quality background for video thumbnail about: ${thumbnailText}, highly artistic, beautiful lightning, trending on artstation`, aspectRatio: '16:9' })
                          });
                          const data = await response.json();
                          if (data.imageUrl) {
                            setThumbnailUrl(data.imageUrl);
                            triggerFeedback('success', '✓ Miniatura cargada por IA');
                          }
                        } catch (e) {
                          triggerFeedback('error', 'Error generando miniatura');
                        } finally {
                          setIsProcessing(false);
                        }
                      }}
                      className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
                    >
                      Generar Nuevo Fondo IA
                    </button>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

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
                    defaultValue="2026-06-29"
                    className="w-full bg-[#15191E] border border-[rgba(255,255,255,0.05)] rounded-xl p-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[#8B949E] uppercase tracking-wider block mb-1">Hora (Horeb Local)</label>
                  <input
                    type="time"
                    defaultValue="18:00"
                    className="w-full bg-[#15191E] border border-[rgba(255,255,255,0.05)] rounded-xl p-2 text-xs text-white"
                  />
                </div>
              </div>

              <button
                onClick={() => {
                  triggerFeedback('success', '✓ Distribución del video programada para el 29 de Junio');
                }}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
              >
                Confirmar Programación del Video
              </button>
            </div>
          </div>
        )}

        {/* 8. ANALYTICS TAB */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <h4 className="text-sm font-bold text-white">Métricas de Retención Clave</h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-[#0B0F14] p-4 rounded-xl border border-[rgba(255,255,255,0.05)]">
                <div className="text-[10px] text-[#8B949E] uppercase tracking-wider font-mono">Views Estimadas</div>
                <div className="text-2xl font-bold text-white font-display mt-1">45,200</div>
                <div className="text-[10px] text-emerald-400 font-semibold mt-1">✓ Superior al promedio habitual (+15%)</div>
              </div>
              <div className="bg-[#0B0F14] p-4 rounded-xl border border-[rgba(255,255,255,0.05)]">
                <div className="text-[10px] text-[#8B949E] uppercase tracking-wider font-mono">Tiempo de Retención Promedio</div>
                <div className="text-2xl font-bold text-white font-display mt-1">5m 12s</div>
                <div className="text-[10px] text-[#8B949E] mt-1">De un video de 8:45 (59.4%)</div>
              </div>
              <div className="bg-[#0B0F14] p-4 rounded-xl border border-[rgba(255,255,255,0.05)]">
                <div className="text-[10px] text-[#8B949E] uppercase tracking-wider font-mono">CTR de Miniatura</div>
                <div className="text-2xl font-bold text-white font-display mt-1">5.8%</div>
                <div className="text-[10px] text-amber-400 font-semibold mt-1">⚡ Sugerencia de optimización disponible</div>
              </div>
            </div>

            <div className="bg-[#0B0F14] p-4 rounded-xl border border-[rgba(255,255,255,0.05)] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">Gráfica de Retención (%)</span>
                <span className="text-[10px] text-[#8B949E]">Curva típica de video reflexivo</span>
              </div>
              
              {/* Simple stylized visual representation of a chart since we can save token sizes */}
              <div className="h-32 flex items-end gap-1.5 pt-4">
                {[100, 85, 76, 70, 68, 65, 62, 59, 58, 55, 52, 50, 48, 45, 42, 40].map((val, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                    <div
                      className="w-full bg-gradient-to-t from-indigo-600/40 to-indigo-500 rounded-t-sm"
                      style={{ height: `${val}%` }}
                    />
                    <span className="text-[8px] text-[#8B949E] font-mono">{idx + 1}m</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
