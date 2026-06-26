import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, CheckCircle2, Clock, Volume2, Image as ImageIcon, Calendar, ArrowRight, Activity, Sparkles, Plus, Zap, X, FileText, Sliders, RefreshCw } from 'lucide-react';
import { VideoProject, ProjectStatus } from '../types';

interface HomeViewProps {
  onContinueWorking: (projectId: string) => void;
  projects: VideoProject[];
  setProjects: React.Dispatch<React.SetStateAction<VideoProject[]>>;
  onAddNotification: (message: string, type: 'success' | 'info' | 'warning' | 'error') => void;
  onCreateEpisode?: (title: string) => Promise<void>;
}

export default function HomeView({ onContinueWorking, projects, setProjects, onAddNotification, onCreateEpisode }: HomeViewProps) {
  const continueProject =
    projects.find(p => p.id === 'ansiedad_biblia' && p.progress < 100) ??
    projects.find(p => p.progress < 100) ??
    projects[0];

  const [isOpen, setIsOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<'new-project' | 'ai-script' | 'generate-thumbnail' | null>(null);

  // New project state
  const [newProjTitle, setNewProjTitle] = useState('');
  const [newProjSeries, setNewProjSeries] = useState('Reflexiones');
  const [newProjDuration, setNewProjDuration] = useState('05:00');
  const [newProjStatus, setNewProjStatus] = useState<ProjectStatus>('Ideas');

  // AI Script state
  const [aiScriptPrompt, setAiScriptPrompt] = useState('');
  const [aiScriptTheme, setAiScriptTheme] = useState('Reflexiones');
  const [aiScriptStyle, setAiScriptStyle] = useState('Narrativo');
  const [aiScriptEmotion, setAiScriptEmotion] = useState('Esperanza');
  const [aiScriptAudience, setAiScriptAudience] = useState('Adultos');
  const [aiScriptDuration, setAiScriptDuration] = useState('5 minutos');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiLogs, setAiLogs] = useState<string[]>([]);

  // Generate Thumbnail state
  const [thumbPrompt, setThumbPrompt] = useState('');
  const [thumbAspect, setThumbAspect] = useState('16:9');
  const [thumbTargetProj, setThumbTargetProj] = useState(projects[0]?.id || '');
  const [thumbGenerating, setThumbGenerating] = useState(false);
  const [generatedThumbUrl, setGeneratedThumbUrl] = useState('');

  const SERIES_OPTIONS = ['Reflexiones', 'Historias Bíblicas', 'Finanzas & Fe', 'Estudio Bíblico', 'Motivación'];
  const PIPELINE_COLUMNS: ProjectStatus[] = ['Ideas', 'Investigación', 'Guion', 'Narración IA', 'Edición', 'Miniatura', 'Programado', 'Publicado'];

  // Handlers for quick actions
  const handleNewProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjTitle.trim()) return;

    if (onCreateEpisode) {
      await onCreateEpisode(newProjTitle.trim());
      setNewProjTitle('');
      setActiveModal(null);
      return;
    }

    const newId = `proj_${Date.now()}`;
    const newProj: VideoProject = {
      id: newId,
      title: newProjTitle,
      series: newProjSeries,
      status: newProjStatus,
      progress: Math.round(((PIPELINE_COLUMNS.indexOf(newProjStatus) + 1) / PIPELINE_COLUMNS.length) * 100),
      duration: newProjDuration,
      outline: ['Introducción', 'Desarrollo Principal', 'Conclusión'],
      script: 'Escribe tu guion aquí...',
      scenes: [],
      seoTitles: [`La asombrosa historia de ${newProjTitle}`],
      seoDescription: 'Generado con Creator AI Studio',
      seoTags: [newProjTitle.toLowerCase(), 'reflexion', 'cristiana'],
      thumbnailUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=400'
    };

    setProjects(prev => [newProj, ...prev]);
    onAddNotification(`✓ Proyecto "${newProjTitle}" creado con éxito en "${newProjStatus}"`, 'success');
    
    setNewProjTitle('');
    setActiveModal(null);
  };

  const handleAIScriptGen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiScriptPrompt.trim()) return;

    setAiGenerating(true);
    setAiLogs(['Conectando con el motor Gemini 3.5...']);

    const interval = setInterval(() => {
      setAiLogs(prev => {
        if (prev.length === 1) return [...prev, 'Analizando tema y referencias clave...'];
        if (prev.length === 2) return [...prev, 'Estructurando ganchos dramáticos y secciones...'];
        if (prev.length === 3) return [...prev, 'Generando narrativa en voz en off y marcas de escena...'];
        return prev;
      });
    }, 1200);

    try {
      const response = await fetch('/api/gemini/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: aiScriptPrompt,
          options: {
            theme: aiScriptTheme,
            style: aiScriptStyle,
            emotion: aiScriptEmotion,
            audience: aiScriptAudience,
            duration: aiScriptDuration,
            objective: 'Inspirar y Reflexionar'
          }
        })
      });

      const data = await response.json();
      clearInterval(interval);
      setAiLogs(prev => [...prev, '✓ Compilación de guion finalizada.']);

      const newId = `proj_${Date.now()}`;
      const title = `AI: ${aiScriptPrompt.substring(0, 30)}${aiScriptPrompt.length > 30 ? '...' : ''}`;
      
      const newProj: VideoProject = {
        id: newId,
        title,
        series: aiScriptTheme,
        status: 'Guion',
        progress: 35,
        duration: '05:00',
        outline: ['Gancho emocional', 'Desglose del Mensaje', 'Llamado a la Acción'],
        script: data.text || 'Guion fallido',
        scenes: [
          {
            id: `sc_init_${Date.now()}`,
            text: 'Plano cinematográfico introductorio con atmósfera solemne.',
            imageUrl: 'https://images.unsplash.com/photo-1518020382113-a7e8fc38eac9?auto=format&fit=crop&q=80&w=400',
            voiceoverPrompt: 'Tono inspirador de gancho.',
            musicTrack: 'Peaceful Ambient Piano',
            duration: 6,
            transition: 'Fade'
          }
        ],
        seoTitles: [title],
        seoDescription: 'Generado automáticamente por Creator AI Studio',
        seoTags: [aiScriptTheme.toLowerCase(), 'gemini', 'reflexion'],
        thumbnailUrl: 'https://images.unsplash.com/photo-1499209974431-9dddcece7f88?auto=format&fit=crop&q=80&w=400'
      };

      setProjects(prev => [newProj, ...prev]);
      onAddNotification(`✓ Guion de IA "${title}" generado y cargado con éxito`, 'success');
      
      setTimeout(() => {
        setAiScriptPrompt('');
        setAiGenerating(false);
        setActiveModal(null);
      }, 800);

    } catch (err) {
      clearInterval(interval);
      console.error(err);
      setAiLogs(prev => [...prev, '❌ Error al conectar con el servidor Gemini.']);
      onAddNotification('Ocurrió un error al generar el guion', 'error');
      setAiGenerating(false);
    }
  };

  const handleGenerateThumbnail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!thumbPrompt.trim() || !thumbTargetProj) return;

    setThumbGenerating(true);
    setGeneratedThumbUrl('');

    try {
      const response = await fetch('/api/gemini/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: thumbPrompt,
          aspectRatio: thumbAspect,
          imageSize: '1K'
        })
      });

      const data = await response.json();
      if (data.imageUrl) {
        setGeneratedThumbUrl(data.imageUrl);
        
        setProjects(prev =>
          prev.map(p => {
            if (p.id === thumbTargetProj) {
              return {
                ...p,
                thumbnailUrl: data.imageUrl,
                status: p.status === 'Ideas' || p.status === 'Investigación' ? p.status : 'Miniatura'
              };
            }
            return p;
          })
        );

        onAddNotification(`✓ Miniatura generada y aplicada con éxito al proyecto`, 'success');
      } else {
        throw new Error('Image generation failed');
      }
    } catch (err) {
      console.error(err);
      onAddNotification('Error al generar la miniatura', 'error');
    } finally {
      setThumbGenerating(false);
    }
  };

  const stats = [
    { label: 'Videos pendientes', count: '2', icon: Play, color: 'text-sky-400 bg-sky-500/10' },
    { label: 'Shorts pendientes', count: '6', icon: Sparkles, color: 'text-indigo-400 bg-indigo-500/10' },
    { label: 'Voz IA generándose', count: '1', icon: Volume2, color: 'text-amber-400 bg-amber-500/10' },
    { label: 'Miniaturas listas', count: '3', icon: ImageIcon, color: 'text-emerald-400 bg-emerald-500/10' },
    { label: 'Publicación programada', count: '1', icon: Calendar, color: 'text-indigo-400 bg-indigo-500/10' }
  ];

  const recentActivity = [
    { text: 'Miniatura creada', desc: 'Para "¿Qué dice la Biblia sobre la ansiedad?"', time: 'Hace 5 min', done: true },
    { text: 'Voz terminada', desc: 'Narración de Kore (24kHz) generada con éxito', time: 'Hace 15 min', done: true },
    { text: 'Guion aprobado', desc: 'Estructura emocional validada por Ramiro', time: 'Hace 1 hora', done: true },
    { text: 'Video exportado', desc: 'Moisés renderizado en 1080p con subtítulos', time: 'Hace 4 horas', done: true },
    { text: 'Publicado en YouTube', desc: 'Proverbios 3 ya está activo en tu canal principal', time: 'Hace 12 horas', done: true }
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Greeting Banner */}
      <div className="bg-[#15191E] p-8 rounded-3xl border border-white/5 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-6 opacity-10">
          <Sparkles className="w-48 h-48 text-indigo-500" />
        </div>
        
        <div className="relative z-10 space-y-2">
          <div className="text-xs text-indigo-400 font-bold uppercase tracking-wider font-mono">Panel del Creador</div>
          <h1 className="font-display font-bold text-3xl text-white tracking-tight">Buenos días, Ramiro</h1>
          <p className="text-sm text-slate-400 max-w-2xl">
            Tu pipeline hoy está corriendo eficientemente. Los agentes de inteligencia artificial han avanzado en las transcripciones, renderizados y análisis de miniaturas.
          </p>
        </div>
      </div>

      {/* Stats Counter List */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div
              key={idx}
              className="bg-[#15191E] border border-white/5 rounded-2xl p-4.5 space-y-3 shadow-md hover:border-indigo-500/30 transition-all group"
            >
              <div className="flex items-center justify-between">
                <div className={`p-2 rounded-lg ${stat.color} group-hover:scale-105 transition-transform duration-150`}>
                  <Icon className="w-4 h-4" />
                </div>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <div className="text-2xl font-bold font-display text-white">{stat.count}</div>
                <div className="text-xs text-slate-400 leading-normal font-medium mt-0.5">{stat.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Grid: Continue Working & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Continue Working Card */}
        <div className="lg:col-span-2 bg-[#15191E] border border-white/10 rounded-3xl p-6 flex flex-col justify-between shadow-lg relative overflow-hidden">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-widest text-indigo-400 font-mono">CONTINUAR TRABAJANDO</span>
              <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5 bg-[#0B0F14] px-2.5 py-1 rounded-full border border-white/5">
                <Clock className="w-3 h-3 text-amber-400" /> Modificado hoy
              </span>
            </div>

            {continueProject ? (
              <>
                <div className="space-y-2 mt-4">
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded bg-indigo-950/40 text-indigo-300 border border-indigo-800/20">
                    {continueProject.series}
                  </span>
                  <h2 className="font-display font-bold text-2xl text-white tracking-tight hover:text-indigo-400 transition-colors italic">
                    &quot;{continueProject.title}&quot;
                  </h2>
                </div>

                <div className="pt-4 space-y-2.5">
                  <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                    <span className="flex items-center gap-1.5">
                      Estado actual:{' '}
                      <strong className="text-indigo-400 font-semibold">{continueProject.status}</strong>
                    </span>
                    <span className="font-semibold text-white font-mono">{continueProject.progress}%</span>
                  </div>
                  <div className="w-full h-2 bg-[#0B0F14] rounded-full overflow-hidden p-[1px] border border-white/5">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 via-indigo-400 to-purple-500 rounded-full transition-all duration-500"
                      style={{ width: `${continueProject.progress}%` }}
                    />
                  </div>
                </div>
              </>
            ) : (
              <p className="mt-4 text-sm text-slate-400">
                No hay proyectos activos. Usa el botón flotante para crear el primero.
              </p>
            )}
          </div>

          <div className="pt-8 flex items-center justify-between">
            <div className="text-xs text-slate-400">
              Completa la <strong className="text-white">Edición</strong> y diseña la{' '}
              <strong className="text-white">Miniatura</strong> final con un solo click.
            </div>
            {continueProject && (
              <button
                id="open-project-btn"
                onClick={() => onContinueWorking(continueProject.id)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-500/20 active:scale-98 transition-all cursor-pointer"
              >
                <span>Abrir proyecto</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Recent Activity List */}
        <div className="bg-[#15191E]/50 border border-white/5 rounded-3xl p-6 space-y-4 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-white font-mono">Actividad Reciente</span>
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            </div>

            <div className="space-y-4 mt-4 overflow-y-auto max-h-[280px] pr-1">
              {recentActivity.map((act, idx) => (
                <div key={idx} className="flex gap-3 text-xs leading-relaxed group">
                  <div className="flex flex-col items-center">
                    <div className="w-5 h-5 rounded-full bg-emerald-950/30 border border-emerald-900/40 text-emerald-400 font-bold flex items-center justify-center text-[10px] shrink-0 group-hover:bg-emerald-900/30 transition-colors">
                      ✓
                    </div>
                    {idx < recentActivity.length - 1 && (
                      <div className="w-[1px] bg-white/5 flex-1 my-1" />
                    )}
                  </div>
                  <div>
                    <div className="font-bold text-white group-hover:text-indigo-400 transition-colors">{act.text}</div>
                    <div className="text-slate-400 mt-0.5 leading-relaxed">{act.desc}</div>
                    <span className="text-[10px] text-indigo-400/80 mt-0.5 block font-mono">{act.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Floating Quick Actions FAB */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3 font-sans">
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 15, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 15, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="bg-[#15191E] border border-white/10 rounded-2xl p-3 w-56 shadow-2xl flex flex-col gap-1"
            >
              <div className="text-[10px] font-bold text-slate-500 px-2 py-1 uppercase tracking-widest font-mono border-b border-white/5 mb-1.5">
                Acciones Rápidas
              </div>
              
              <button
                onClick={() => {
                  setActiveModal('new-project');
                  setIsOpen(false);
                }}
                className="flex items-center gap-3 w-full p-2.5 rounded-xl hover:bg-white/5 text-xs font-semibold text-white transition-all text-left cursor-pointer group"
              >
                <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 group-hover:scale-105 transition-transform shrink-0">
                  <Plus className="w-4 h-4" />
                </div>
                <span>Nuevo Proyecto</span>
              </button>

              <button
                onClick={() => {
                  setActiveModal('ai-script');
                  setIsOpen(false);
                }}
                className="flex items-center gap-3 w-full p-2.5 rounded-xl hover:bg-white/5 text-xs font-semibold text-white transition-all text-left cursor-pointer group"
              >
                <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 group-hover:scale-105 transition-transform shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <span>AI Script Gen</span>
              </button>

              <button
                onClick={() => {
                  setActiveModal('generate-thumbnail');
                  setIsOpen(false);
                }}
                className="flex items-center gap-3 w-full p-2.5 rounded-xl hover:bg-white/5 text-xs font-semibold text-white transition-all text-left cursor-pointer group"
              >
                <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 group-hover:scale-105 transition-transform shrink-0">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <span>Generar Miniatura</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Toggle FAB */}
        <button
          id="quick-actions-fab"
          onClick={() => setIsOpen(!isOpen)}
          className="w-12 h-12 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center shadow-xl hover:shadow-indigo-500/25 active:scale-95 transition-all cursor-pointer relative group overflow-hidden"
        >
          <motion.div
            animate={{ rotate: isOpen ? 135 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <Zap className="w-5 h-5 fill-white/10" />
          </motion.div>
        </button>
      </div>

      {/* Floating Actions Modals/Overlays */}
      {/* 1. New Project Modal */}
      {activeModal === 'new-project' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B0F14]/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[#15191E] border border-white/10 rounded-3xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setActiveModal(null)}
              className="absolute right-4 top-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400">
                <Plus className="w-5 h-5" />
              </div>
              <h3 className="font-display font-bold text-lg text-white">Nuevo Proyecto</h3>
            </div>

            <form onSubmit={handleNewProjectSubmit} className="space-y-4">
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Título del Video</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. La sabiduría de Salomón hoy"
                  value={newProjTitle}
                  onChange={e => setNewProjTitle(e.target.value)}
                  className="w-full bg-[#0B0F14] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Serie</label>
                  <select
                    value={newProjSeries}
                    onChange={e => setNewProjSeries(e.target.value)}
                    className="w-full bg-[#0B0F14] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500/50"
                  >
                    {SERIES_OPTIONS.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Duración aprox.</label>
                  <input
                    type="text"
                    required
                    placeholder="08:00"
                    value={newProjDuration}
                    onChange={e => setNewProjDuration(e.target.value)}
                    className="w-full bg-[#0B0F14] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Estado Inicial en Pipeline</label>
                <select
                  value={newProjStatus}
                  onChange={e => setNewProjStatus(e.target.value as ProjectStatus)}
                  className="w-full bg-[#0B0F14] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500/50"
                >
                  {PIPELINE_COLUMNS.map(col => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 rounded-xl bg-[#0B0F14] border border-white/10 text-slate-400 hover:text-white text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-950/20 active:scale-98 cursor-pointer"
                >
                  Crear Proyecto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. AI Script Gen Modal */}
      {activeModal === 'ai-script' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B0F14]/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-[#15191E] border border-white/10 rounded-3xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setActiveModal(null)}
              disabled={aiGenerating}
              className="absolute right-4 top-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <h3 className="font-display font-bold text-lg text-white">AI Script Gen (Gemini 3.5)</h3>
            </div>

            {!aiGenerating && (
              <form onSubmit={handleAIScriptGen} className="space-y-4">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">¿Sobre qué tema quieres escribir el guion?</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Ej. El Salmo 23 y cómo encontrar paz mental en el caos del día a día..."
                    value={aiScriptPrompt}
                    onChange={e => setAiScriptPrompt(e.target.value)}
                    className="w-full bg-[#0B0F14] border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500/50 resize-none font-sans"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Serie / Categoría</label>
                    <select
                      value={aiScriptTheme}
                      onChange={e => setAiScriptTheme(e.target.value)}
                      className="w-full bg-[#0B0F14] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500/50"
                    >
                      {SERIES_OPTIONS.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Estilo Narrativo</label>
                    <select
                      value={aiScriptStyle}
                      onChange={e => setAiScriptStyle(e.target.value)}
                      className="w-full bg-[#0B0F14] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500/50"
                    >
                      <option value="Narrativo">Narrativo</option>
                      <option value="Épico & Solemne">Épico & Solemne</option>
                      <option value="Poético">Poético</option>
                      <option value="Dinámico (Shorts/TikTok)">Dinámico (Shorts/TikTok)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Emoción Guía</label>
                    <select
                      value={aiScriptEmotion}
                      onChange={e => setAiScriptEmotion(e.target.value)}
                      className="w-full bg-[#0B0F14] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500/50"
                    >
                      <option value="Esperanza">Esperanza</option>
                      <option value="Fe">Fe</option>
                      <option value="Sabiduría">Sabiduría</option>
                      <option value="Asombro">Asombro</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Audiencia</label>
                    <select
                      value={aiScriptAudience}
                      onChange={e => setAiScriptAudience(e.target.value)}
                      className="w-full bg-[#0B0F14] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500/50"
                    >
                      <option value="Adultos">Adultos</option>
                      <option value="Jóvenes">Jóvenes</option>
                      <option value="Público General">Público General</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Duración</label>
                    <select
                      value={aiScriptDuration}
                      onChange={e => setAiScriptDuration(e.target.value)}
                      className="w-full bg-[#0B0F14] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500/50"
                    >
                      <option value="3 minutos">3 minutos</option>
                      <option value="5 minutos">5 minutos</option>
                      <option value="10 minutos">10 minutos</option>
                    </select>
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-end gap-3 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    className="px-4 py-2 rounded-xl bg-[#0B0F14] border border-white/10 text-slate-400 hover:text-white text-xs font-semibold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-950/20 active:scale-98 cursor-pointer flex items-center gap-1.5"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Generar Guion</span>
                  </button>
                </div>
              </form>
            )}

            {aiGenerating && (
              <div className="py-8 text-center space-y-6">
                <div className="relative w-16 h-16 mx-auto animate-spin">
                  <RefreshCw className="w-16 h-16 text-indigo-500" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">Generando guion estructurado...</h4>
                  <p className="text-xs text-indigo-400 mt-1 font-medium font-mono">Gemini 3.5 Active Engine</p>
                </div>

                {/* Log console stream */}
                <div className="w-full bg-[#0B0F14] border border-white/5 rounded-2xl p-4 text-left font-mono text-[10px] text-slate-400 space-y-2 max-h-[160px] overflow-y-auto">
                  {aiLogs.map((log, idx) => (
                    <div key={idx} className="flex gap-2">
                      <span className="text-indigo-500 select-none">&gt;</span>
                      <span>{log}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. Generate Thumbnail Modal */}
      {activeModal === 'generate-thumbnail' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B0F14]/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-[#15191E] border border-white/10 rounded-3xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setActiveModal(null)}
              disabled={thumbGenerating}
              className="absolute right-4 top-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400">
                <ImageIcon className="w-5 h-5" />
              </div>
              <h3 className="font-display font-bold text-lg text-white">Generador de Miniaturas (Gemini Image)</h3>
            </div>

            {!thumbGenerating && !generatedThumbUrl && (
              <form onSubmit={handleGenerateThumbnail} className="space-y-4">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Asignar a este Proyecto</label>
                  <select
                    value={thumbTargetProj}
                    onChange={e => setThumbTargetProj(e.target.value)}
                    className="w-full bg-[#0B0F14] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500/50"
                  >
                    <option value="">-- Seleccionar proyecto --</option>
                    {projects.map(proj => (
                      <option key={proj.id} value={proj.id}>"{proj.title}"</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Describir la imagen / Estilo visual</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Ej. An old biblical prophet praying on top of a mountain, golden cinematic light, highly detailed oil painting style..."
                    value={thumbPrompt}
                    onChange={e => setThumbPrompt(e.target.value)}
                    className="w-full bg-[#0B0F14] border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500/50 resize-none font-sans"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Aspect Ratio (Formato)</label>
                  <select
                    value={thumbAspect}
                    onChange={e => setThumbAspect(e.target.value)}
                    className="w-full bg-[#0B0F14] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500/50"
                  >
                    <option value="16:9">16:9 (Horizontal - YouTube)</option>
                    <option value="9:16">9:16 (Vertical - Shorts/TikTok)</option>
                    <option value="1:1">1:1 (Cuadrado)</option>
                  </select>
                </div>

                <div className="pt-4 flex items-center justify-end gap-3 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    className="px-4 py-2 rounded-xl bg-[#0B0F14] border border-white/10 text-slate-400 hover:text-white text-xs font-semibold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={!thumbTargetProj}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-950/20 active:scale-98 cursor-pointer flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ImageIcon className="w-4 h-4" />
                    <span>Generar Miniatura</span>
                  </button>
                </div>
              </form>
            )}

            {thumbGenerating && (
              <div className="py-8 text-center space-y-6">
                <div className="relative w-16 h-16 mx-auto animate-spin">
                  <RefreshCw className="w-16 h-16 text-indigo-500" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">Creando ilustración fotorrealista...</h4>
                  <p className="text-xs text-indigo-400 mt-1 font-medium font-mono">Gemini-3.1-Flash-Image Synthesis</p>
                </div>
                <div className="w-full bg-indigo-950/20 p-4 rounded-xl border border-indigo-900/10 text-[11px] text-slate-400 italic">
                  "Generando: {thumbPrompt}"
                </div>
              </div>
            )}

            {!thumbGenerating && generatedThumbUrl && (
              <div className="space-y-4">
                <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-black aspect-video flex items-center justify-center">
                  <img
                    src={generatedThumbUrl}
                    alt="Miniatura Generada"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>

                <div className="bg-[#0B0F14] border border-white/5 rounded-2xl p-4 text-center">
                  <p className="text-xs text-slate-400 leading-normal">
                    ¡Tu miniatura se ha generado con éxito y se ha aplicado al proyecto seleccionado!
                  </p>
                </div>

                <div className="pt-4 flex justify-end gap-3 border-t border-white/5">
                  <button
                    onClick={() => {
                      setThumbPrompt('');
                      setGeneratedThumbUrl('');
                    }}
                    className="px-4 py-2 rounded-xl bg-[#0B0F14] border border-white/10 text-slate-400 hover:text-white text-xs font-semibold cursor-pointer"
                  >
                    Generar Otra
                  </button>
                  <button
                    onClick={() => {
                      setThumbPrompt('');
                      setGeneratedThumbUrl('');
                      setActiveModal(null);
                    }}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer"
                  >
                    Listo
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
