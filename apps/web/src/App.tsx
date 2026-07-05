import { useCallback, useEffect, useRef, useState } from 'react';
<<<<<<< HEAD
import { ArrowLeft, Trash2 } from 'lucide-react';
=======
import { ArrowLeft } from 'lucide-react';
>>>>>>> origin/main
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import HomeView from './components/HomeView';
import ProjectsView from './components/ProjectsView';
import WorkspaceView from './components/WorkspaceView';
import LibraryView from './components/LibraryView';
import CalendarView from './components/CalendarView';
import AnalyticsView from './components/AnalyticsView';
import AutomationView from './components/AutomationView';
import AgentStudioView from './components/AgentStudioView';
import CopilotView from './components/CopilotView';
import ProjectPipelinePanel from './components/ProjectPipelinePanel';
import PipelinePanel from './components/PipelinePanel';
import ProductionView from './components/ProductionView';
import MultichannelView from './components/MultichannelView';
import TeamsView from './components/TeamsView';
import SettingsView from './components/SettingsView';
import DeleteEpisodeModal from './components/DeleteEpisodeModal';
import DemoModeBanner from './components/DemoModeBanner';
import LoginView from './components/LoginView';
import AuthMisconfiguredView from './components/AuthMisconfiguredView';
import { useAuth } from './context/AuthContext';
import { isSupabaseAuthEnabled } from './lib/supabase';

import {
<<<<<<< HEAD
=======
  INITIAL_CHANNELS,
  INITIAL_NOTIFICATIONS,
>>>>>>> origin/main
  INITIAL_SERIES,
} from './data';
import { Channel, VideoProject, Notification, TeamMember } from './types';
import type { EpisodeDetail, EpisodeSummary } from '@creator-ai-studio/shared';
import {
  EPISODE_STATUS_PROGRESS,
  EPISODE_TO_PROJECT_STATUS,
} from '@creator-ai-studio/shared';
import {
  createEpisode,
<<<<<<< HEAD
  deleteEpisode,
=======
>>>>>>> origin/main
  fetchAuthStatus,
  fetchChannels,
  fetchEpisodeDetail,
  fetchEpisodes,
  updateEpisode,
  updateEpisodeProjectStatus,
  type AuthStatus,
} from './api';
import {
  filterProjectsBySection,
  shouldOpenCalendar,
  workspaceTabForProject,
  type DashboardSection,
  type WorkspaceTab,
} from './lib/dashboardNavigation';

function episodeToProject(episode: EpisodeSummary, content?: EpisodeDetail['content']): VideoProject {
  const c = content;
  return {
    id: episode.id,
    title: episode.title,
    series: c?.series ?? 'Reflexiones',
    status: EPISODE_TO_PROJECT_STATUS[episode.status] ?? 'Ideas',
    progress: EPISODE_STATUS_PROGRESS[episode.status] ?? 10,
    duration: c?.duration ?? '00:00',
    outline: c?.outline ?? [],
    script: c?.script ?? '',
    scenes: c?.scenes ?? [],
    seoTitles: c?.seoTitles ?? [],
    seoDescription: c?.seoDescription ?? '',
    seoTags: c?.seoTags ?? [],
    thumbnailUrl: c?.thumbnailUrl,
    audioUrl: c?.audioUrl,
    videoUrl: c?.videoUrl,
    scheduledAt: c?.scheduledAt,
  };
}

interface AppProps {
  initialView?: string;
}

export function App({ initialView = 'home' }: AppProps = {}) {
  const { authEnabled, loading, session } = useAuth();
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [authStatusLoading, setAuthStatusLoading] = useState(true);
  const [currentView, setCurrentView] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('view') ?? initialView;
  });
<<<<<<< HEAD
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [projects, setProjects] = useState<VideoProject[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>('');
  const [workspaceRefreshToken, setWorkspaceRefreshToken] = useState(0);
  const [projectsBoardFilter, setProjectsBoardFilter] = useState<DashboardSection | null>(null);
  const [workspaceInitialTab, setWorkspaceInitialTab] = useState<WorkspaceTab | null>(null);
  const [workspaceForcedTab, setWorkspaceForcedTab] = useState<WorkspaceTab | undefined>();
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [deleteWorkspaceTarget, setDeleteWorkspaceTarget] = useState<VideoProject | null>(null);
  const [deletingEpisode, setDeletingEpisode] = useState(false);
=======
  const [channels, setChannels] = useState<Channel[]>(INITIAL_CHANNELS);
  const [selectedChannel, setSelectedChannel] = useState<Channel>(INITIAL_CHANNELS[0]);
  const [projects, setProjects] = useState<VideoProject[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>(INITIAL_NOTIFICATIONS);
  const [activeProjectId, setActiveProjectId] = useState<string>('');
  const [workspaceRefreshToken, setWorkspaceRefreshToken] = useState(0);
  const [team, setTeam] = useState<TeamMember[]>(TEAM_MEMBERS);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
>>>>>>> origin/main
  const mainRef = useRef<HTMLElement>(null);

  const activeProject = projects.find(p => p.id === activeProjectId);
  const authRequired = authStatus?.authRequired ?? false;
  const canAccessApi =
    !authRequired || (authEnabled && Boolean(session?.access_token));

  useEffect(() => {
    let active = true;
    void fetchAuthStatus()
      .then(status => {
        if (active) setAuthStatus(status);
      })
      .catch(() => {
        if (active) {
          setAuthStatus({
            authRequired: isSupabaseAuthEnabled(),
            apiKeyAuth: false,
            supabaseAuth: isSupabaseAuthEnabled(),
          });
        }
      })
      .finally(() => {
        if (active) setAuthStatusLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const loadProjects = useCallback(async () => {
    try {
      const episodes = await fetchEpisodes();
      if (episodes.length === 0) {
        setProjects([]);
        setActiveProjectId('');
        return;
      }

      const details = await Promise.all(
        episodes.map(async ep => {
          try {
            const detail = await fetchEpisodeDetail(ep.id);
            return episodeToProject(detail, detail.content);
          } catch {
            return episodeToProject(ep);
          }
        }),
      );
      setProjects(details);
      setActiveProjectId(prev => (prev && details.some(p => p.id === prev) ? prev : details[0].id));
    } catch {
      setProjects([]);
    }
  }, []);

  const handlePipelineComplete = useCallback(async () => {
    await loadProjects();
    setWorkspaceRefreshToken(t => t + 1);
  }, [loadProjects]);

<<<<<<< HEAD
  const reloadEpisode = useCallback(async (episodeId: string) => {
    const detail = await fetchEpisodeDetail(episodeId);
    setProjects(prev =>
      prev.map(p => (p.id === episodeId ? episodeToProject(detail, detail.content) : p)),
    );
    setWorkspaceRefreshToken(t => t + 1);
  }, []);
=======
  useEffect(() => {
    if (!canAccessApi) return;
    void loadProjects();
  }, [loadProjects, canAccessApi]);

  // Make the switch into a workspace unmistakable: scroll the content area back
  // to the top whenever the selected episode's workspace opens.
  useEffect(() => {
    if (currentView === 'workspace') {
      mainRef.current?.scrollTo?.({ top: 0, behavior: 'smooth' });
    }
  }, [currentView, activeProjectId]);

  useEffect(() => {
    if (!canAccessApi) return;
    void fetchChannels()
      .then(data =>
        setChannels(
          data.map(c => ({
            id: c.id,
            name: c.name,
            status: c.status as Channel['status'],
            subscribers: c.subscribers,
            avatar: c.avatar,
            type: c.type as Channel['type'],
          })),
        ),
      )
      .catch(() => undefined);
  }, [canAccessApi]);
>>>>>>> origin/main

  useEffect(() => {
    if (!canAccessApi) return;
    void loadProjects();
  }, [loadProjects, canAccessApi]);

  // Make the switch into a workspace unmistakable: scroll the content area back
  // to the top whenever the selected episode's workspace opens.
  useEffect(() => {
    if (currentView === 'workspace') {
      mainRef.current?.scrollTo?.({ top: 0, behavior: 'smooth' });
    }
  }, [currentView, activeProjectId]);

  useEffect(() => {
    if (!canAccessApi) return;
    void fetchChannels()
      .then(data => {
        const mapped = data.map(c => ({
          id: c.id,
          name: c.name,
          status: c.status as Channel['status'],
          subscribers: c.subscribers,
          avatar: c.avatar,
          type: c.type as Channel['type'],
        }));
        setChannels(mapped);
        setSelectedChannel(prev =>
          prev && mapped.some(c => c.id === prev.id) ? prev : mapped[0] ?? null,
        );
      })
      .catch(() => {
        setChannels([]);
        setSelectedChannel(null);
      });
  }, [canAccessApi]);

  const handleContinueWorking = (projectId: string) => {
    setWorkspaceInitialTab(null);
    setActiveProjectId(projectId);
    setCurrentView('workspace');
  };

  const handleOpenWorkspace = (projectId: string, initialTab?: WorkspaceTab) => {
    setWorkspaceInitialTab(initialTab ?? null);
    setWorkspaceForcedTab(initialTab);
    setActiveProjectId(projectId);
    setCurrentView('workspace');
  };

<<<<<<< HEAD
  const handleNavigateToSection = (section: DashboardSection) => {
    if (shouldOpenCalendar(section)) {
      setProjectsBoardFilter(null);
      setWorkspaceInitialTab(null);
      setCurrentView('calendar');
      return;
    }

    const matched = filterProjectsBySection(projects, section);
    const directOpenSections: DashboardSection[] = ['con-guion', 'en-produccion', 'miniaturas-listas'];

    if (matched.length === 1 && directOpenSections.includes(section)) {
      const project = matched[0];
      setActiveProjectId(project.id);
      setWorkspaceInitialTab(workspaceTabForProject(project, section));
      setProjectsBoardFilter(null);
      setCurrentView('workspace');
      return;
    }

    setProjectsBoardFilter(section);
    setWorkspaceInitialTab(null);
    setCurrentView('projects');
  };

  const handleSetCurrentView = (view: string) => {
    if (view !== 'projects') {
      setProjectsBoardFilter(null);
    }
    if (view !== 'workspace') {
      setWorkspaceInitialTab(null);
    }
    setCurrentView(view);
  };

=======
>>>>>>> origin/main
  const handleBackToProjects = () => {
    setCurrentView('projects');
  };

  const handleUpdateProject = async (updated: VideoProject) => {
    setProjects(prev => prev.map(p => (p.id === updated.id ? updated : p)));
    try {
      await updateEpisode(updated.id, {
        title: updated.title,
        content: {
          series: updated.series,
          script: updated.script,
          outline: updated.outline,
          scenes: updated.scenes,
          seoTitles: updated.seoTitles,
          seoDescription: updated.seoDescription,
          seoTags: updated.seoTags,
          thumbnailUrl: updated.thumbnailUrl,
          audioUrl: updated.audioUrl,
          scheduledAt: updated.scheduledAt,
          duration: updated.duration,
        },
      });
    } catch {
      handleAddNotification('No se pudo guardar los cambios en el servidor', 'warning');
    }
  };

  const handleMoveProjectStatus = async (id: string, newStatus: VideoProject['status']) => {
    setProjects(prev =>
      prev.map(p => (p.id === id ? { ...p, status: newStatus } : p)),
    );
    try {
      await updateEpisodeProjectStatus(id, newStatus);
      void loadProjects();
    } catch {
      handleAddNotification('No se pudo actualizar el estado del proyecto', 'error');
    }
  };

  const handleDeleteEpisode = async (id: string) => {
    try {
      await deleteEpisode(id);
      setProjects(prev => prev.filter(p => p.id !== id));
      if (activeProjectId === id) {
        setActiveProjectId('');
        setCurrentView('projects');
      }
      handleAddNotification('Episodio eliminado permanentemente', 'success');
    } catch {
      handleAddNotification('No se pudo eliminar el episodio', 'error');
      throw new Error('delete failed');
    }
  };

  const handleAddNotification = (message: string, type: 'success' | 'info' | 'warning' | 'error' = 'info') => {
    const newNotif: Notification = {
      id: `not_${Date.now()}`,
      type,
      message,
      timestamp: 'Ahora mismo',
      read: false,
    };
    setNotifications(prev => [newNotif, ...prev]);
  };

  const handleCreateEpisode = async (title: string) => {
    try {
      const created = await createEpisode({ title });
      await loadProjects();
      setActiveProjectId(created.id);
      setCurrentView('workspace');
      handleAddNotification(`✓ Episodio "${title}" creado en el backend`, 'success');
    } catch {
      handleAddNotification('✕ No se pudo crear el episodio', 'error');
    }
  };

  const handleAddNewScript = async (title: string, scriptText: string, outline: string[]) => {
    try {
      const created = await createEpisode({ title: `Borrador: ${title}` });
      await updateEpisode(created.id, {
        content: {
          series: 'Reflexiones',
          script: scriptText,
          outline,
          scenes: [],
          seoTitles: [title],
          seoDescription: 'Generado automáticamente por Creator AI Studio',
          seoTags: ['reflexion', 'cristiana', 'fe', 'biblia'],
          duration: '07:30',
        },
      });
      await loadProjects();
      setActiveProjectId(created.id);
      setCurrentView('workspace');
      handleAddNotification(`✓ Se ha creado e importado el borrador "${title}" con éxito`, 'success');
    } catch {
      handleAddNotification('No se pudo importar el guion', 'error');
    }
  };

  if (authStatusLoading || (authEnabled && loading)) {
    return (
      <div className="min-h-screen bg-[#0B0F14] flex items-center justify-center text-sm text-[#8B949E]">
        Cargando sesión…
      </div>
    );
  }

  if (authRequired && !authEnabled) {
    return <AuthMisconfiguredView />;
  }

  if (authEnabled && !session) {
    return <LoginView />;
  }

  return (
    <div className="flex bg-[#0B0F14] text-[#E6EDF2] min-h-screen font-sans antialiased selection:bg-indigo-600/30 selection:text-indigo-300">
      <Sidebar
        currentView={currentView}
        setCurrentView={handleSetCurrentView}
        mobileOpen={mobileSidebarOpen}
        setMobileOpen={setMobileSidebarOpen}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Header
          channels={channels}
          selectedChannel={selectedChannel}
          setSelectedChannel={setSelectedChannel}
          notifications={notifications}
          setNotifications={setNotifications}
          onMenuClick={() => setMobileSidebarOpen(true)}
        />

        <main ref={mainRef} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 max-w-7xl w-full mx-auto">
          <DemoModeBanner />
          {currentView === 'home' && (
            <HomeView
              onContinueWorking={handleContinueWorking}
              onNavigateToSection={handleNavigateToSection}
              projects={projects}
              setProjects={setProjects}
              onAddNotification={handleAddNotification}
              onCreateEpisode={handleCreateEpisode}
              onAddNewScript={handleAddNewScript}
            />
          )}

          {currentView === 'projects' && (
            <ProjectsView
              projects={projects}
              setProjects={setProjects}
              onOpenWorkspace={handleOpenWorkspace}
              seriesList={INITIAL_SERIES}
              onCreateEpisode={handleCreateEpisode}
              onMoveProjectStatus={handleMoveProjectStatus}
              onDeleteEpisode={handleDeleteEpisode}
              boardFilter={projectsBoardFilter}
              onClearBoardFilter={() => setProjectsBoardFilter(null)}
            />
          )}

          {currentView === 'workspace' &&
            (activeProject ? (
              // key={id} remounts the workspace per episode so its editable state
              // always reflects the selected episode (not the previously opened one).
<<<<<<< HEAD
              <div key={`${activeProject.id}-${workspaceRefreshToken}-${workspaceInitialTab ?? 'default'}`} className="space-y-6">
=======
              <div key={`${activeProject.id}-${workspaceRefreshToken}`} className="space-y-6">
>>>>>>> origin/main
                <div className="flex flex-wrap items-center justify-between gap-3 bg-[#15191E] border border-white/5 rounded-2xl px-4 py-3">
                  <button
                    type="button"
                    onClick={handleBackToProjects}
                    className="flex items-center gap-2 text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Volver a Proyectos
                  </button>
<<<<<<< HEAD
                  <div className="flex items-center gap-2 min-w-0 flex-1 justify-center">
=======
                  <div className="flex items-center gap-2 min-w-0">
>>>>>>> origin/main
                    <span className="text-[11px] text-slate-500 font-mono uppercase tracking-wide shrink-0">
                      Workspace
                    </span>
                    <span className="text-xs font-bold text-white truncate italic">
                      &quot;{activeProject.title}&quot;
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-950/40 text-indigo-300 border border-indigo-800/20 shrink-0">
                      {activeProject.status}
                    </span>
                  </div>
<<<<<<< HEAD
                  <button
                    type="button"
                    onClick={() => setDeleteWorkspaceTarget(activeProject)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-rose-400 hover:text-rose-300 transition-colors cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Eliminar
                  </button>
=======
>>>>>>> origin/main
                </div>
                <PipelinePanel
                  episodeId={activeProject.id}
                  episodeTitle={activeProject.title}
                  onPipelineComplete={() => void handlePipelineComplete()}
                />
<<<<<<< HEAD
                <ProjectPipelinePanel
                  episodeId={activeProject.id}
                  projectStatus={activeProject.status}
                  onGoToTab={tab => setWorkspaceForcedTab(tab)}
                />
                <WorkspaceView
                  project={activeProject}
                  onUpdateProject={handleUpdateProject}
                  initialTab={workspaceInitialTab ?? undefined}
                  forcedTab={workspaceForcedTab}
                />
=======
                <ProductionStagesPanel episodeId={activeProject.id} />
                <WorkspaceView project={activeProject} onUpdateProject={handleUpdateProject} />
>>>>>>> origin/main
              </div>
            ) : (
              <div className="bg-[#15191E] border border-white/5 rounded-2xl p-8 text-center space-y-4">
                <p className="text-sm text-slate-400">No hay ningún episodio seleccionado.</p>
                <button
                  type="button"
                  onClick={handleBackToProjects}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Volver a Proyectos
                </button>
              </div>
            ))}

          {currentView === 'copilot' && <CopilotView episodeTitle={activeProject?.title} />}

          {currentView === 'library' && <LibraryView onAddNewScript={handleAddNewScript} />}

          {currentView === 'calendar' && <CalendarView />}

          {currentView === 'analytics' && <AnalyticsView />}

          {currentView === 'automation' && <AutomationView episodeId={activeProject?.id} />}

          {currentView === 'agents' && (
            <AgentStudioView onOpenProjects={() => setCurrentView('projects')} />
          )}

          {currentView === 'production' && <ProductionView projects={projects} />}

          {currentView === 'multichannel' && <MultichannelView channels={channels} />}

          {currentView === 'teams' && (
            <TeamsView
              team={team}
              onInvite={(name, role) => {
                setTeam(prev => [
                  ...prev,
                  { id: `mem_${Date.now()}`, name, role, avatar: '👤', status: 'Online' },
                ]);
              }}
            />
          )}

          {currentView === 'settings' && <SettingsView />}
        </main>
      </div>

      <DeleteEpisodeModal
        open={Boolean(deleteWorkspaceTarget)}
        title={deleteWorkspaceTarget?.title ?? ''}
        deleting={deletingEpisode}
        onConfirm={() => {
          if (!deleteWorkspaceTarget) return;
          setDeletingEpisode(true);
          void handleDeleteEpisode(deleteWorkspaceTarget.id)
            .then(() => setDeleteWorkspaceTarget(null))
            .catch(() => undefined)
            .finally(() => setDeletingEpisode(false));
        }}
        onCancel={() => {
          if (!deletingEpisode) setDeleteWorkspaceTarget(null);
        }}
      />
    </div>
  );
}
