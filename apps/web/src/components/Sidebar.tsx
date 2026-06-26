import type { ReactElement } from 'react';
import {
  BarChart3,
  FolderKanban,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import type { View } from '../types';

interface NavItem {
  id: View;
  label: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'episodes', label: 'Episodes', icon: FolderKanban },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings },
];

interface SidebarProps {
  currentView: View;
  onSelect: (view: View) => void;
}

export function Sidebar({ currentView, onSelect }: SidebarProps): ReactElement {
  return (
    <aside className="sticky top-0 z-40 hidden h-screen w-64 shrink-0 flex-col border-r border-white/5 bg-[#0B0F14] lg:flex">
      <div className="flex h-16 items-center gap-2.5 border-b border-white/5 px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-lg font-black tracking-wider text-white shadow-lg shadow-indigo-500/20">
          C
        </div>
        <div>
          <span className="block font-display text-base font-bold tracking-tight text-white">
            Creator AI Studio
          </span>
          <span className="block font-mono text-[10px] font-medium tracking-widest text-slate-500">
            CREATOR OS
          </span>
        </div>
      </div>

      <nav aria-label="Main navigation" className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onSelect(item.id)}
              className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'border border-white/10 bg-white/5 font-semibold text-white'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Icon
                className={`h-[18px] w-[18px] transition-colors ${
                  isActive
                    ? 'text-indigo-400'
                    : 'text-slate-400 group-hover:text-indigo-400'
                }`}
              />
              <span>{item.label}</span>
              {isActive ? (
                <span className="ml-auto block h-1.5 w-1.5 rounded-full bg-indigo-500" />
              ) : null}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-white/5 bg-[#15191E] p-4 text-xs text-slate-400">
        <div className="mb-1 flex items-center justify-between font-mono">
          <span>SYSTEM OK</span>
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
        </div>
        <p className="font-mono text-[10px] leading-relaxed text-slate-500">
          Local API · no external calls
        </p>
      </div>
    </aside>
  );
}
