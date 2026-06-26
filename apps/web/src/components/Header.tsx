import type { ReactElement } from 'react';
import { Sparkles } from 'lucide-react';

export function Header(): ReactElement {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-white/5 bg-[#0B0F14]/80 px-4 py-3 backdrop-blur md:px-6">
      <div>
        <h1 className="font-display text-lg font-bold tracking-tight text-white">
          Creator AI Studio
        </h1>
        <p className="text-[11px] text-slate-400 md:text-xs">
          YouTube Christian Bible Channel Production System
        </p>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-white/5 bg-[#15191E] px-3 py-1.5 text-[11px] font-medium text-slate-300">
        <Sparkles className="h-4 w-4 text-indigo-400" />
        <span className="hidden sm:inline">Local production console</span>
      </div>
    </header>
  );
}
