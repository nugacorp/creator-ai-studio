import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, ArrowLeft, ArrowRight, Video, Search, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { VideoProject, ProjectStatus } from '../types';
import DeleteEpisodeModal from './DeleteEpisodeModal';
import {
  filterProjectsBySection,
  highlightColumnForSection,
  DASHBOARD_SECTION_LABELS,
  type DashboardSection,
} from '../lib/dashboardNavigation';

interface ProjectsViewProps {
  projects: VideoProject[];
  setProjects: React.Dispatch<React.SetStateAction<VideoProject[]>>;
  onOpenWorkspace: (projectId: string) => void;
  seriesList: string[];
  onCreateEpisode: (title: string) => Promise<void>;
  onMoveProjectStatus?: (id: string, status: ProjectStatus) => Promise<void>;
  onDeleteEpisode?: (id: string) => Promise<void>;
  boardFilter?: DashboardSection | null;
  onClearBoardFilter?: () => void;
}

const PIPELINE_COLUMNS: ProjectStatus[] = [
  'Ideas',
  'Investigación',
  'Guion',
  'Narración IA',
  'Edición',
  'Miniatura',
  'Programado',
  'Publicado'
];

export default function ProjectsView({
  projects,
  setProjects,
  onOpenWorkspace,
  seriesList,
  onCreateEpisode,
  onMoveProjectStatus,
  onDeleteEpisode,
  boardFilter = null,
  onClearBoardFilter,
}: ProjectsViewProps) {
  const [selectedSeries, setSelectedSeries] = useState<string>('Todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  
  // New project form state
  const [newTitle, setNewTitle] = useState('');
  const [newSeries, setNewSeries] = useState(seriesList[0]);
  const [newStatus, setNewStatus] = useState<ProjectStatus>('Ideas');
  const [newDuration, setNewDuration] = useState('08:00');
  const [deleteTarget, setDeleteTarget] = useState<VideoProject | null>(null);
  const [deleting, setDeleting] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);
  const columnRefs = useRef<Partial<Record<ProjectStatus, HTMLDivElement | null>>>({});
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const highlightColumn = boardFilter ? highlightColumnForSection(boardFilter) : null;

  // Filtered projects
  const filteredProjects = projects.filter(proj => {
    const matchesSeries = selectedSeries === 'Todos' || proj.series === selectedSeries;
    const matchesSearch = proj.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesBoard = boardFilter ? filterProjectsBySection([proj], boardFilter).length > 0 : true;
    return matchesSeries && matchesSearch && matchesBoard;
  });

  const updateBoardScrollState = useCallback(() => {
    const el = boardRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < maxScroll - 4);
  }, []);

  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;

    updateBoardScrollState();
    el.addEventListener('scroll', updateBoardScrollState, { passive: true });
    const observer = new ResizeObserver(updateBoardScrollState);
    observer.observe(el);

    return () => {
      el.removeEventListener('scroll', updateBoardScrollState);
      observer.disconnect();
    };
  }, [updateBoardScrollState, filteredProjects.length]);

  useEffect(() => {
    if (!highlightColumn) return;
    const column = columnRefs.current[highlightColumn];
    if (!column) return;
    column.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [highlightColumn, boardFilter, filteredProjects.length]);

  const scrollBoard = (direction: 'left' | 'right') => {
    boardRef.current?.scrollBy({
      left: direction === 'left' ? -304 : 304,
      behavior: 'smooth',
    });
  };

  const handleMoveCard = (id: string, direction: 'left' | 'right') => {
    const project = projects.find(p => p.id === id);
    if (!project) return;

    const currentIndex = PIPELINE_COLUMNS.indexOf(project.status);
    let nextIndex = currentIndex;
    if (direction === 'left' && currentIndex > 0) {
      nextIndex--;
    } else if (direction === 'right' && currentIndex < PIPELINE_COLUMNS.length - 1) {
      nextIndex++;
    }

    const newStatus = PIPELINE_COLUMNS[nextIndex];
    const progress = Math.round(((nextIndex + 1) / PIPELINE_COLUMNS.length) * 100);

    setProjects(prev =>
      prev.map(p =>
        p.id === id ? { ...p, status: newStatus, progress: progress > 100 ? 100 : progress } : p,
      ),
    );

    if (onMoveProjectStatus && newStatus !== project.status) {
      void onMoveProjectStatus(id, newStatus);
    }
  };

  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    // Persist to the real backend (POST /episodes). The series/status/duration
    // fields remain in the form for the approved design; the backend derives
    // the episode from the title and seeds its production stages.
    await onCreateEpisode(newTitle.trim());
    setNewTitle('');
    setShowAddModal(false);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || !onDeleteEpisode) return;
    setDeleting(true);
    try {
      await onDeleteEpisode(deleteTarget.id);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {boardFilter && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-indigo-950/30 border border-indigo-500/20 rounded-2xl px-4 py-3">
          <div className="text-xs text-indigo-200">
            <span className="font-mono uppercase tracking-wide text-indigo-400/80">Filtro activo</span>
            <span className="mx-2 text-slate-500">·</span>
            <strong className="text-white">{DASHBOARD_SECTION_LABELS[boardFilter]}</strong>
            <span className="text-slate-400 ml-2">({filteredProjects.length} episodio(s))</span>
          </div>
          {onClearBoardFilter && (
            <button
              type="button"
              onClick={onClearBoardFilter}
              className="text-xs font-semibold text-indigo-300 hover:text-white px-3 py-1.5 rounded-lg border border-indigo-500/30 hover:bg-indigo-500/10 transition-colors cursor-pointer"
            >
              Ver todos
            </button>
          )}
        </div>
      )}

      {/* Top action bar */}
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center bg-[#15191E] p-4 rounded-2xl border border-white/5">
        {/* Series Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto min-w-0 pb-1 lg:pb-0">
          <button
            onClick={() => setSelectedSeries('Todos')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              selectedSeries === 'Todos'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/15'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            Todos
          </button>
          {seriesList.map(series => (
            <button
              key={series}
              onClick={() => setSelectedSeries(series)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                selectedSeries === series
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/15'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {series}
            </button>
          ))}
        </div>

        {/* Search & Add New */}
        <div className="flex items-center justify-end gap-3 shrink-0">
          <div className="relative w-full sm:w-auto">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar proyecto..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-[#0B0F14] border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 w-full sm:w-52 transition-all"
            />
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors cursor-pointer shrink-0 shadow-lg shadow-indigo-500/15 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Proyecto</span>
          </button>
        </div>
      </div>

      {/* Trello Board columns */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3 px-1">
          <p className="text-[10px] text-slate-500 hidden sm:block">
            8 etapas del pipeline — usa las flechas para ver todas las columnas
          </p>
          <div className="flex items-center gap-1.5 ml-auto">
            <button
              type="button"
              onClick={() => scrollBoard('left')}
              disabled={!canScrollLeft}
              aria-label="Ver columnas anteriores"
              className="p-2 rounded-xl bg-[#15191E] border border-white/10 text-slate-300 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => scrollBoard('right')}
              disabled={!canScrollRight}
              aria-label="Ver más columnas"
              className="p-2 rounded-xl bg-[#15191E] border border-white/10 text-slate-300 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div
          ref={boardRef}
          className="overflow-x-auto overflow-y-hidden scroll-smooth scrollbar-none overscroll-x-contain"
        >
          <div className="flex gap-4 min-w-max h-[calc(100vh-300px)]">
          {PIPELINE_COLUMNS.map(columnStatus => {
            const columnProjects = filteredProjects.filter(p => p.status === columnStatus);
            const isHighlighted = highlightColumn === columnStatus;
            return (
              <div
                key={columnStatus}
                ref={el => {
                  columnRefs.current[columnStatus] = el;
                }}
                data-column={columnStatus}
                className={`w-72 bg-[#15191E] rounded-2xl border flex flex-col h-full overflow-hidden shrink-0 transition-colors ${
                  isHighlighted ? 'border-indigo-500/50 ring-1 ring-indigo-500/20' : 'border-white/5'
                }`}
              >
                {/* Column Header */}
                <div className="p-3 bg-white/5 border-b border-white/5 flex items-center justify-between select-none shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#E6EDF2] font-mono uppercase tracking-wide">
                      {columnStatus}
                    </span>
                    <span className="px-1.5 py-0.5 rounded-md bg-[#0B0F14] border border-white/5 text-[10px] text-slate-400 font-bold font-mono">
                      {columnProjects.length}
                    </span>
                  </div>
                  <Plus
                    className="w-3.5 h-3.5 text-slate-400 hover:text-white cursor-pointer"
                    onClick={() => {
                      setNewStatus(columnStatus);
                      setShowAddModal(true);
                    }}
                  />
                </div>

                {/* Cards Container */}
                <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5 bg-[#0B0F14]/10">
                  {columnProjects.length === 0 ? (
                    <div className="border border-dashed border-white/5 rounded-xl p-6 text-center text-[11px] text-slate-500 italic">
                      Columna vacía
                    </div>
                  ) : (
                    columnProjects.map(proj => (
                      <div
                        key={proj.id}
                        className="bg-[#0B0F14] border border-white/5 hover:border-indigo-500/40 rounded-xl p-3.5 space-y-3.5 shadow-md group transition-all"
                      >
                        {/* Tags and Duration */}
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="px-1.5 py-0.5 rounded bg-indigo-950/40 text-indigo-300 font-semibold border border-indigo-800/20">
                            {proj.series}
                          </span>
                          <span className="text-slate-400 font-mono flex items-center gap-1">
                            <Video className="w-3 h-3 text-slate-400" />
                            {proj.duration}
                          </span>
                        </div>

                        {/* Title */}
                        <h4
                          onClick={() => onOpenWorkspace(proj.id)}
                          className="font-bold text-xs text-white tracking-tight cursor-pointer hover:text-indigo-400 leading-snug transition-colors line-clamp-2 italic"
                        >
                          "{proj.title}"
                        </h4>

                        {/* Progress Bar */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10px] text-slate-500">
                            <span>Progreso</span>
                            <span className="font-bold text-[#E6EDF2]">{proj.progress}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden p-[0.5px]">
                            <div
                              className="h-full bg-gradient-to-r from-indigo-500 via-indigo-400 to-purple-500 rounded-full"
                              style={{ width: `${proj.progress}%` }}
                            />
                          </div>
                        </div>

                        {proj.status === 'Publicado' ? (
                          <p className="text-[10px] text-slate-500 italic bg-white/[0.02] border border-white/5 rounded-lg px-2 py-1.5">
                            Métricas de engagement en Analytics (YouTube conectado).
                          </p>
                        ) : (
                          <p className="text-[10px] text-slate-500 italic bg-white/[0.02] border border-white/5 rounded-lg px-2 py-1.5">
                            Sin métricas — episodio aún no publicado.
                          </p>
                        )}

                        {/* Control Buttons (Move Card & Open) */}
                        <div className="flex items-center justify-between pt-1.5 border-t border-white/5">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleMoveCard(proj.id, 'left')}
                              disabled={PIPELINE_COLUMNS.indexOf(proj.status) === 0}
                              className="p-1.5 rounded-lg bg-[#0B0F14] border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                              title="Mover anterior"
                            >
                              <ArrowLeft className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleMoveCard(proj.id, 'right')}
                              disabled={PIPELINE_COLUMNS.indexOf(proj.status) === PIPELINE_COLUMNS.length - 1}
                              className="p-1.5 rounded-lg bg-[#0B0F14] border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                              title="Mover siguiente"
                            >
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </div>

                          <div className="flex items-center gap-2">
                            {onDeleteEpisode && (
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(proj)}
                                className="p-1.5 rounded-lg bg-rose-950/30 border border-rose-900/30 text-rose-400 hover:text-rose-300 hover:bg-rose-950/50 transition-colors cursor-pointer"
                                title="Eliminar episodio"
                                aria-label={`Eliminar ${proj.title}`}
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                            <button
                              onClick={() => onOpenWorkspace(proj.id)}
                              className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
                            >
                              Editar Workspace
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
          </div>
        </div>
      </div>

      {/* Add Project Modal Popup */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B0F14]/90 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[#15191E] border border-white/10 rounded-3xl p-6 shadow-2xl relative">
            <h3 className="font-display font-bold text-lg text-white mb-4">Añadir Nuevo Contenido</h3>
            
            <form onSubmit={handleAddProject} className="space-y-4">
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Título del Video</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. La historia de Daniel en el foso de los leones"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  className="w-full bg-[#0B0F14] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Serie</label>
                  <select
                    value={newSeries}
                    onChange={e => setNewSeries(e.target.value)}
                    className="w-full bg-[#0B0F14] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                  >
                    {seriesList.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Duración aprox.</label>
                  <input
                    type="text"
                    required
                    value={newDuration}
                    onChange={e => setNewDuration(e.target.value)}
                    className="w-full bg-[#0B0F14] border border-white/10 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Estado Inicial en Pipeline</label>
                <select
                  value={newStatus}
                  onChange={e => setNewStatus(e.target.value as ProjectStatus)}
                  className="w-full bg-[#0B0F14] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                >
                  {PIPELINE_COLUMNS.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-[#0B0F14] border border-white/10 text-slate-400 hover:text-white text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold"
                >
                  Crear Proyecto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <DeleteEpisodeModal
        open={Boolean(deleteTarget)}
        title={deleteTarget?.title ?? ''}
        deleting={deleting}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => {
          if (!deleting) setDeleteTarget(null);
        }}
      />
    </div>
  );
}
