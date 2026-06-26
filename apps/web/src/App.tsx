import { useCallback, useEffect, useState } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import HomeView from './components/HomeView';
import ProjectsView from './components/ProjectsView';
import WorkspaceView from './components/WorkspaceView';
import LibraryView from './components/LibraryView';
import CalendarView from './components/CalendarView';
import AnalyticsView from './components/AnalyticsView';
import AutomationView from './components/AutomationView';
import AgentsView from './components/AgentsView';
import CopilotView from './components/CopilotView';
import ProductionStagesPanel from './components/ProductionStagesPanel';
import ProductionView from './components/ProductionView';
import MultichannelView from './components/MultichannelView';
import TeamsView from './components/TeamsView';
import SettingsView from './components/SettingsView';
import DemoModeBanner from './components/DemoModeBanner';

import {
  INITIAL_CHANNELS,
  INITIAL_NOTIFICATIONS,
  INITIAL_PROJECTS,
  INITIAL_SERIES,
  TEAM_MEMBERS,
} from './data';
import { Channel, VideoProject, Notification, TeamMember } from './types';
import type { EpisodeDetail, EpisodeSummary } from '@creator-ai-studio/shared';
import {
  EPISODE_STATUS_PROGRESS,
  EPISODE_TO_PROJECT_STATUS,
} from '@creator-ai-studio/shared';
import {
  createEpisode,
  fetchChannels,
  fetchEpisodeDetail,
  fetchEpisodes,
  updateEpisode,
  updateEpisodeProjectStatus,
} from './api';

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
    scheduledAt: c?.scheduledAt,
  };
}

interface AppProps {
  initialView?: string;
}

export function App({ initialView = 'home' }: AppProps = {}) {
  const [currentView, setCurrentView] = useState<string>(initialView);
  const [channels, setChannels] = useState<Channel[]>(INITIAL_CHANNELS);
  const [selectedChannel, setSelectedChannel] = useState<Channel>(INITIAL_CHANNELS[0]);
  const [projects, setProjects] = useState<VideoProject[]>(INITIAL_PROJECTS);
  const [notifications, setNotifications] = useState<Notification[]>(INITIAL_NOTIFICATIONS);
  const [activeProjectId, setActiveProjectId] = useState<string>('ansiedad_biblia');
  const [team, setTeam] = useState<TeamMember[]>(TEAM_MEMBERS);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const activeProject = projects.find(p => p.id === activeProjectId) || projects[0];

  const loadProjects = useCallback(async () => {
    try {
      const episodes = await fetchEpisodes();
      if (episodes.length === 0) {
        setProjects(INITIAL_PROJECTS);
        setActiveProjectId(prev =>
          INITIAL_PROJECTS.some(p => p.id === prev) ? prev : 'ansiedad_biblia',
        );
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
      setActiveProjectId(prev =>
        details.some(p => p.id === prev) ? prev : details[0].id,
      );
    } catch {
      setProjects(INITIAL_PROJECTS);
      setActiveProjectId(prev =>
        INITIAL_PROJECTS.some(p => p.id === prev) ? prev : 'ansiedad_biblia',
      );
    }
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  useEffect(() => {
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
  }, []);

  const handleContinueWorking = (projectId: string) => {
    setActiveProjectId(projectId);
    setCurrentView('workspace');
  };

  const handleOpenWorkspace = (projectId: string) => {
    setActiveProjectId(projectId);
    setCurrentView('workspace');
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

  return (
    <div className="flex bg-[#0B0F14] text-[#E6EDF2] min-h-screen font-sans antialiased selection:bg-indigo-600/30 selection:text-indigo-300">
      <Sidebar
        currentView={currentView}
        setCurrentView={setCurrentView}
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

        <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 max-w-7xl w-full mx-auto">
          <DemoModeBanner />
          {currentView === 'home' && (
            <HomeView
              onContinueWorking={handleContinueWorking}
              projects={projects}
              setProjects={setProjects}
              onAddNotification={handleAddNotification}
              onCreateEpisode={handleCreateEpisode}
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
            />
          )}

          {currentView === 'workspace' && activeProject && (
            <div className="space-y-6">
              <ProductionStagesPanel episodeId={activeProject.id} />
              <WorkspaceView project={activeProject} onUpdateProject={handleUpdateProject} />
            </div>
          )}

          {currentView === 'copilot' && <CopilotView episodeTitle={activeProject?.title} />}

          {currentView === 'library' && <LibraryView onAddNewScript={handleAddNewScript} />}

          {currentView === 'calendar' && <CalendarView />}

          {currentView === 'analytics' && <AnalyticsView />}

          {currentView === 'automation' && <AutomationView episodeId={activeProject?.id} />}

          {currentView === 'agents' && <AgentsView episodeId={activeProject?.id} />}

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
    </div>
  );
}
