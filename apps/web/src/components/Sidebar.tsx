import {
  Home,
  FolderKanban,
  FileVideo,
  Bot,
  Library,
  Calendar,
  BarChart3,
  Network,
  Users2,
  Settings,
  Cpu,
  Factory,
  Layers,
  X
} from 'lucide-react';

interface SidebarProps {
  currentView: string;
  setCurrentView: (view: string) => void;
  mobileOpen?: boolean;
  setMobileOpen?: (open: boolean) => void;
}

export default function Sidebar({ currentView, setCurrentView, mobileOpen = false, setMobileOpen }: SidebarProps) {
  const menuItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'projects', label: 'Proyectos', icon: FolderKanban },
    { id: 'workspace', label: 'Contenido', icon: FileVideo },
    { id: 'copilot', label: 'IA Copilot', icon: Bot },
    { id: 'library', label: 'Biblioteca IA', icon: Library },
    { id: 'calendar', label: 'Publicaciones', icon: Calendar },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'automation', label: 'Automatización', icon: Network },
    { id: 'agents', label: 'Agentes IA', icon: Cpu },
    { id: 'production', label: 'Modo Producción', icon: Factory },
    { id: 'multichannel', label: 'Modo Multicanal', icon: Layers },
    { id: 'teams', label: 'Equipos', icon: Users2 },
    { id: 'settings', label: 'Configuración', icon: Settings }
  ];

  return (
    <>
      {/* Mobile Dark Overlay Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-[#0B0F14]/80 backdrop-blur-sm z-45 lg:hidden transition-opacity duration-300"
          onClick={() => setMobileOpen?.(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 border-r border-white/5 bg-[#0B0F14] flex flex-col h-screen lg:sticky top-0 select-none shrink-0 transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Logo & Close Button */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-black text-white text-lg tracking-wider shadow-lg shadow-indigo-500/20">
              C
            </div>
            <div>
              <span className="font-display font-bold text-base tracking-tight text-white block">Creator AI Studio</span>
              <span className="text-[10px] text-slate-500 tracking-widest font-mono font-medium block">CREATOR OS v2.1</span>
            </div>
          </div>

          {/* Mobile Close Icon */}
          {setMobileOpen && (
            <button
              onClick={() => setMobileOpen(false)}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
              title="Cerrar menú"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Menu items */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {menuItems.map(item => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                id={`sidebar-item-${item.id}`}
                key={item.id}
                onClick={() => {
                  setCurrentView(item.id);
                  if (setMobileOpen) {
                    setMobileOpen(false); // Close mobile drawer when clicking a navigation item
                  }
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group cursor-pointer ${
                  isActive
                    ? 'bg-white/5 text-white font-semibold border border-white/10'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon
                  className={`w-4.5 h-4.5 transition-transform group-hover:scale-105 duration-150 ${
                    isActive ? 'text-indigo-400' : 'text-slate-400 group-hover:text-indigo-400'
                  }`}
                />
                <span>{item.label}</span>
                {isActive && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500 block" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer info */}
        <div className="p-4 border-t border-white/5 bg-[#15191E] text-xs text-slate-400">
          <div className="flex items-center justify-between font-mono mb-1">
            <span>SISTEMA OK</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <p className="text-[10px] leading-relaxed text-indigo-400">Gemini 3.5 Active Grounding</p>
        </div>
      </aside>
    </>
  );
}
