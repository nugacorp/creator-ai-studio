import { useState, type ReactElement } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { EpisodesView } from './components/EpisodesView';
import { PlaceholderView } from './components/PlaceholderView';
import type { View } from './types';

export function App(): ReactElement {
  const [view, setView] = useState<View>('episodes');

  return (
    <div className="flex min-h-screen bg-[#0B0F14] font-sans text-[#E6EDF2] antialiased">
      <Sidebar currentView={view} onSelect={setView} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header />

        <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 overflow-y-auto p-4 md:p-6">
          {view === 'episodes' ? <EpisodesView /> : null}
          {view === 'analytics' ? (
            <PlaceholderView
              title="Analytics"
              description="Channel and production analytics"
            />
          ) : null}
          {view === 'settings' ? (
            <PlaceholderView
              title="Settings"
              description="Workspace and engine preferences"
            />
          ) : null}
        </main>
      </div>
    </div>
  );
}
