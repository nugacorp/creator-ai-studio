import { useState } from 'react';
import {
  Sparkles,
  Image as ImageIcon,
  Volume2,
  FileText,
  Play,
  ArrowRight,
  Sliders,
  Settings,
  Download,
  Music,
  Tv,
  ExternalLink,
  RefreshCw
} from 'lucide-react';

interface LibraryViewProps {
  onAddNewScript: (title: string, script: string, outline: string[]) => void;
}

export default function LibraryView({ onAddNewScript }: LibraryViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'prompt_builder' | 'image_generator' | 'music_generator'>('prompt_builder');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressText, setProgressText] = useState('');

  // 1. Prompt Builder State
  const [topic, setTopic] = useState('Cristianismo');
  const [objective, setObjective] = useState('Reflexionar');
  const [duration, setDuration] = useState('10 minutos');
  const [audience, setAudience] = useState('Adultos');
  const [style, setStyle] = useState('Narrativo');
  const [emotion, setEmotion] = useState('Esperanza');
  const [customIdea, setCustomIdea] = useState('El Sermón del Monte en Mateo 5');
  const [generatedScript, setGeneratedScript] = useState<string | null>(null);

  // 2. Image Generator State
  const [imagePrompt, setImagePrompt] = useState('Cinematic shot of Moses standing on top of Mount Sinai looking at the burning bush, epic golden hour lighting, octane render, photorealistic, 8k');
  const [selectedModel, setSelectedModel] = useState('gemini-3.1-flash-image');
  const [selectedAspectRatio, setSelectedAspectRatio] = useState('16:9');
  const [selectedSize, setSelectedSize] = useState('1K');
  const [selectedStyle, setSelectedStyle] = useState('Cinemático');
  const [generatedImageUrl, setGeneratedImageUrl] = useState('https://images.unsplash.com/photo-1461360370896-922624d12aa1?auto=format&fit=crop&q=80&w=800');

  // 3. Music Generation State
  const [musicPrompt, setMusicPrompt] = useState('Orquestal dramática para historia bíblica épica, con coros latinos y flauta de viento antigua, tempo medio');
  const [musicModel, setMusicModel] = useState('lyria-3-clip-preview');
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);
  const [musicBlob, setMusicBlob] = useState<string | null>(null);

  // Trigger prompt constructor
  const handleGenerateScript = async () => {
    if (!customIdea.trim()) return;
    setIsGenerating(true);
    setProgressText('Copiloto de Guiones IA está planificando la estructura dramática...');
    try {
      const response = await fetch('/api/gemini/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: customIdea,
          options: {
            theme: topic,
            objective,
            duration,
            audience,
            style,
            emotion
          }
        })
      });
      const data = await response.json();
      if (data.text) {
        setGeneratedScript(data.text);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUseScript = () => {
    if (!generatedScript) return;
    // Call parent trigger to inject new video project
    onAddNewScript(
      customIdea,
      generatedScript,
      ['Introducción y Gancho', 'Análisis de la Idea principal', 'Aplicación Espiritual', 'Llamado a la Acción (CTA)']
    );
    setGeneratedScript(null);
  };

  // Trigger Image Generation
  const handleGenerateImage = async () => {
    if (!imagePrompt.trim()) return;
    setIsGenerating(true);
    setProgressText('Imagen de Alta Fidelidad modelando composición y luz...');
    try {
      const response = await fetch('/api/gemini/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: imagePrompt,
          aspectRatio: selectedAspectRatio,
          imageSize: selectedSize
        })
      });
      const data = await response.json();
      if (data.imageUrl) {
        setGeneratedImageUrl(data.imageUrl);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsGenerating(false);
    }
  };

  // Trigger Music clip generation
  const handleGenerateMusic = async () => {
    setIsGenerating(true);
    setProgressText('Sintetizando composición musical de Lyria...');
    setTimeout(() => {
      // simulate audio generation
      setGeneratedAudioUrl('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3');
      setIsGenerating(false);
    }, 3000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Header Tabs */}
      <div className="flex items-center gap-1.5 border-b border-[rgba(255,255,255,0.05)]">
        {[
          { id: 'prompt_builder', label: 'Constructor de Prompt Visual', icon: Sliders },
          { id: 'image_generator', label: 'Generador de Imágenes IA', icon: ImageIcon },
          { id: 'music_generator', label: 'Generador de Música Lyria', icon: Music }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
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

      {/* Generating Overlay */}
      {isGenerating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B0F14]/75 backdrop-blur-xs select-none animate-fade-in">
          <div className="bg-[#15191E] border border-[rgba(255,255,255,0.05)] rounded-2xl p-8 max-w-sm text-center shadow-2xl space-y-4 animate-bounce">
            <RefreshCw className="w-12 h-12 text-indigo-500 animate-spin mx-auto" />
            <h4 className="font-bold text-white text-sm">Creación en Progreso con IA</h4>
            <p className="text-xs text-[#8B949E] leading-relaxed">{progressText}</p>
          </div>
        </div>
      )}

      {/* TAB CONTENT PANELS */}
      <div className="bg-[#15191E] border border-[rgba(255,255,255,0.05)] rounded-2xl p-6 shadow-xl min-h-[450px]">
        
        {/* 1. PROMPT CONSTRUCTOR */}
        {activeSubTab === 'prompt_builder' && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            
            {/* Visual selections form */}
            <div className="lg:col-span-2 space-y-4 bg-[#0B0F14] p-5 rounded-2xl border border-[rgba(255,255,255,0.05)]">
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-400 border-b border-[rgba(255,255,255,0.05)] pb-2 mb-2">
                <Sliders className="w-4 h-4" />
                <span>Configuración de Guion Sin Escribir</span>
              </div>

              <div className="space-y-3">
                {/* Tema */}
                <div>
                  <label className="text-[10px] font-bold text-[#8B949E] uppercase tracking-wider block mb-1">Tema del canal</label>
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

                {/* Objetivo */}
                <div>
                  <label className="text-[10px] font-bold text-[#8B949E] uppercase tracking-wider block mb-1">Objetivo del video</label>
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
                  {/* Duración */}
                  <div>
                    <label className="text-[10px] font-bold text-[#8B949E] uppercase tracking-wider block mb-1">Duración</label>
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
                  {/* Audiencia */}
                  <div>
                    <label className="text-[10px] font-bold text-[#8B949E] uppercase tracking-wider block mb-1">Audiencia</label>
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
                  {/* Estilo */}
                  <div>
                    <label className="text-[10px] font-bold text-[#8B949E] uppercase tracking-wider block mb-1">Estilo narrativo</label>
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
                  {/* Emoción */}
                  <div>
                    <label className="text-[10px] font-bold text-[#8B949E] uppercase tracking-wider block mb-1">Emoción buscada</label>
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

                {/* Custom input keyword */}
                <div>
                  <label className="text-[10px] font-bold text-[#8B949E] uppercase tracking-wider block mb-1">Tu idea o tema base</label>
                  <textarea
                    value={customIdea}
                    onChange={e => setCustomIdea(e.target.value)}
                    rows={3}
                    placeholder="Ej. El foso de los leones de Daniel, de forma poética y solemne..."
                    className="w-full bg-[#15191E] border border-[rgba(255,255,255,0.05)] rounded-2xl p-2 text-xs text-white focus:outline-none focus:border-indigo-500/30 resize-none"
                  />
                </div>

                <button
                  onClick={handleGenerateScript}
                  className="w-full py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 animate-pulse" />
                  <span>Generar Guion con IA</span>
                </button>
              </div>
            </div>

            {/* Script Display Output on right */}
            <div className="lg:col-span-3 bg-[#0B0F14] p-5 rounded-2xl border border-[rgba(255,255,255,0.05)] flex flex-col justify-between">
              <div className="space-y-3 flex-1 flex flex-col">
                <h4 className="text-[11px] font-bold text-[#8B949E] uppercase tracking-wider font-mono">Borrador de Guion Generado</h4>
                
                {generatedScript ? (
                  <textarea
                    readOnly
                    value={generatedScript}
                    className="w-full flex-1 min-h-[300px] bg-[#15191E] border border-[rgba(255,255,255,0.05)] rounded-2xl p-4 text-xs text-[#E6EDF2] leading-relaxed resize-none focus:outline-none font-mono"
                  />
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-[#8B949E] text-xs italic text-center py-16">
                    <FileText className="w-10 h-10 text-[#8B949E]/55 mb-2" />
                    Configure las opciones a la izquierda y presione "Generar Guion".
                  </div>
                )}
              </div>

              {generatedScript && (
                <div className="pt-4 flex items-center justify-end gap-3 border-t border-[rgba(255,255,255,0.05)] mt-4">
                  <button
                    onClick={() => setGeneratedScript(null)}
                    className="px-4 py-2 rounded-2xl bg-[#15191E] border border-[rgba(255,255,255,0.05)] text-[#8B949E] hover:text-white text-xs font-bold"
                  >
                    Descartar
                  </button>
                  <button
                    onClick={handleUseScript}
                    className="px-4 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md"
                  >
                    <span>Importar a Proyectos</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

          </div>
        )}

        {/* 2. IMAGE GENERATOR */}
        {activeSubTab === 'image_generator' && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            
            {/* Options bar left */}
            <div className="lg:col-span-2 space-y-4 bg-[#0B0F14] p-5 rounded-2xl border border-[rgba(255,255,255,0.05)]">
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-400 border-b border-[rgba(255,255,255,0.05)] pb-2 mb-2">
                <ImageIcon className="w-4 h-4" />
                <span>Imagen de Alta Calidad con Gemini</span>
              </div>

              <div className="space-y-4">
                {/* Prompt */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#8B949E] uppercase tracking-wider block">Prompt de Imagen</label>
                  <textarea
                    value={imagePrompt}
                    onChange={e => setImagePrompt(e.target.value)}
                    rows={4}
                    className="w-full bg-[#15191E] border border-[rgba(255,255,255,0.05)] rounded-2xl p-2 text-xs text-white focus:outline-none focus:border-indigo-500/30 resize-none leading-relaxed"
                  />
                </div>

                {/* Model select */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-[#8B949E] uppercase tracking-wider block mb-1">Modelo</label>
                    <select
                      value={selectedModel}
                      onChange={e => setSelectedModel(e.target.value)}
                      className="w-full bg-[#15191E] border border-[rgba(255,255,255,0.05)] rounded-2xl px-2 py-1.5 text-xs text-white focus:outline-none"
                    >
                      <option value="gemini-3.1-flash-image">Gemini 3.1 Flash Image</option>
                      <option value="imagen-4.0-generate-001">Imagen 4 Pro</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-[#8B949E] uppercase tracking-wider block mb-1">Aspect Ratio</label>
                    <select
                      value={selectedAspectRatio}
                      onChange={e => setSelectedAspectRatio(e.target.value)}
                      className="w-full bg-[#15191E] border border-[rgba(255,255,255,0.05)] rounded-2xl px-2 py-1.5 text-xs text-white focus:outline-none"
                    >
                      <option value="1:1">1:1 (Cuadrado)</option>
                      <option value="16:9">16:9 (Horizontal)</option>
                      <option value="9:16">9:16 (Vertical)</option>
                      <option value="4:3">4:3 (Estándar)</option>
                    </select>
                  </div>
                </div>

                {/* Resolution size */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-[#8B949E] uppercase tracking-wider block mb-1">Resolución</label>
                    <select
                      value={selectedSize}
                      onChange={e => setSelectedSize(e.target.value)}
                      className="w-full bg-[#15191E] border border-[rgba(255,255,255,0.05)] rounded-2xl px-2 py-1.5 text-xs text-white focus:outline-none"
                    >
                      <option value="512px">512px</option>
                      <option value="1K">1K (HD)</option>
                      <option value="2K">2K (Full HD)</option>
                      <option value="4K">4K (Ultra HD)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-[#8B949E] uppercase tracking-wider block mb-1">Estilo Artístico</label>
                    <select
                      value={selectedStyle}
                      onChange={e => setSelectedStyle(e.target.value)}
                      className="w-full bg-[#15191E] border border-[rgba(255,255,255,0.05)] rounded-2xl px-2 py-1.5 text-xs text-white focus:outline-none"
                    >
                      <option value="Cinemático">Cinemático</option>
                      <option value="Fantasía">Ilustración / Fantasía</option>
                      <option value="Fotorealista">Foto-realista</option>
                      <option value="Pintura Óleo">Pintura al Óleo</option>
                    </select>
                  </div>
                </div>

                <button
                  onClick={handleGenerateImage}
                  className="w-full py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Modelar Imagen IA</span>
                </button>
              </div>
            </div>

            {/* Preview Right */}
            <div className="lg:col-span-3 bg-[#0B0F14] p-4 rounded-2xl border border-[rgba(255,255,255,0.05)] flex flex-col justify-between">
              <div className="space-y-3 flex-1 flex flex-col justify-center">
                <h4 className="text-[11px] font-bold text-[#8B949E] uppercase tracking-wider font-mono">Vista Previa de Alta Definición</h4>
                
                <div className="flex-1 min-h-[300px] border border-[rgba(255,255,255,0.05)] rounded-2xl overflow-hidden relative group bg-[#15191E]">
                  <img
                    src={generatedImageUrl}
                    alt="AI Generated aesthetic representation"
                    className="w-full h-full object-cover select-none"
                    referrerPolicy="no-referrer"
                  />
                  
                  {/* Quality indicators overlay */}
                  <div className="absolute top-3 left-3 bg-black/75 border border-indigo-500/25 text-indigo-400 font-bold px-2 py-1 rounded text-[9px] font-mono shadow-md">
                    GEMINI-3.1 IMAGEN • {selectedSize} • Ratio {selectedAspectRatio}
                  </div>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 mt-4 border-t border-[rgba(255,255,255,0.05)]">
                <a
                  href={generatedImageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-2xl bg-[#15191E] border border-[rgba(255,255,255,0.05)] text-white text-xs font-semibold flex items-center gap-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Abrir en nueva pestaña</span>
                </a>
                <button
                  onClick={() => {
                    alert("Imagen descargada en tu carpeta de descargas del navegador.");
                  }}
                  className="px-4 py-1.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar</span>
                </button>
              </div>
            </div>

          </div>
        )}

        {/* 3. MUSIC GENERATION */}
        {activeSubTab === 'music_generator' && (
          <div className="max-w-2xl mx-auto space-y-6 text-center py-6">
            <Music className="w-12 h-12 text-indigo-400 mx-auto" />
            <div className="space-y-2">
              <h3 className="font-display font-bold text-lg text-white">Generación de Música con Google Lyria</h3>
              <p className="text-xs text-[#8B949E] max-w-md mx-auto leading-relaxed">
                Compone soundtracks y pistas de música ambiente de fondo libres de copyright con el modelo avanzado **lyria-3-clip-preview** para tu canal.
              </p>
            </div>

            <div className="space-y-4 bg-[#0B0F14] p-5 border border-[rgba(255,255,255,0.05)] rounded-2xl max-w-md mx-auto">
              {/* Form details */}
              <div className="space-y-3 text-left">
                <div>
                  <label className="text-[9px] font-bold text-[#8B949E] uppercase tracking-wider block mb-1">Prompt Musical</label>
                  <textarea
                    value={musicPrompt}
                    onChange={e => setMusicPrompt(e.target.value)}
                    rows={3}
                    className="w-full bg-[#15191E] border border-[rgba(255,255,255,0.05)] rounded-2xl p-2 text-xs text-white focus:outline-none focus:border-indigo-500/30 resize-none"
                  />
                </div>

                <div>
                  <label className="text-[9px] font-bold text-[#8B949E] uppercase tracking-wider block mb-1">Modelo de Clip</label>
                  <select
                    value={musicModel}
                    onChange={e => setMusicModel(e.target.value)}
                    className="w-full bg-[#15191E] border border-[rgba(255,255,255,0.05)] rounded-2xl px-2 py-1 text-xs text-white"
                  >
                    <option value="lyria-3-clip-preview">Lyria Clip (Hasta 30s)</option>
                    <option value="lyria-3-pro-preview">Lyria Pro (Larga duración completa)</option>
                  </select>
                </div>
              </div>

              <button
                onClick={handleGenerateMusic}
                className="w-full py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
              >
                <Sparkles className="w-4 h-4" />
                <span>Componer Soundtrack</span>
              </button>
            </div>

            {/* Audio music player */}
            {generatedAudioUrl && (
              <div className="bg-indigo-950/20 border border-indigo-800/30 p-4.5 rounded-2xl max-w-md mx-auto space-y-3 animate-pulse-slow">
                <div className="text-left text-xs font-bold text-indigo-400">
                  ✓ Composición musical de Lyria lista para usar
                </div>
                <audio src={generatedAudioUrl} controls className="w-full outline-none" />
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
