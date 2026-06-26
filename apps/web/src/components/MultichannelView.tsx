import { Layers } from 'lucide-react';
import type { Channel } from '../types';

interface MultichannelViewProps {
  channels: Channel[];
}

export default function MultichannelView({ channels }: MultichannelViewProps) {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex items-center gap-3 bg-[#15191E] p-4.5 rounded-2xl border border-white/5">
        <div className="p-2.5 bg-indigo-500/10 rounded-xl text-indigo-400">
          <Layers className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-display font-bold text-base text-white">Consola General Multicanal</h2>
          <p className="text-[11px] text-slate-400">Estado del flujo y publicaciones divididos por red social</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {channels.map(channel => (
          <div key={channel.id} className="bg-[#15191E] p-4 rounded-xl border border-white/10 space-y-3.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono text-indigo-400 font-bold uppercase">{channel.type}</span>
              <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 text-[10px] font-bold font-mono">
                {channel.status}
              </span>
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">{channel.name}</h4>
              <p className="text-xs text-slate-400 mt-0.5">
                {channel.subscribers >= 1000
                  ? `${(channel.subscribers / 1000).toFixed(0)}K`
                  : channel.subscribers}{' '}
                suscriptores
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
