import { ExternalLink, Layers, Link2, Youtube } from 'lucide-react';
import type { Channel } from '../types';
import ChannelAvatar from './ChannelAvatar';

interface MultichannelViewProps {
  channels: Channel[];
  youtubeConnected: boolean;
  loading: boolean;
  selectedChannelId: string | null;
  onSelectChannel: (channel: Channel) => void;
  onGoToSettings: () => void;
}

function formatSubscribers(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return count.toLocaleString();
}

export default function MultichannelView({
  channels,
  youtubeConnected,
  loading,
  selectedChannelId,
  onSelectChannel,
  onGoToSettings,
}: MultichannelViewProps) {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex items-center gap-3 bg-[#15191E] p-4.5 rounded-2xl border border-white/5">
        <div className="p-2.5 bg-indigo-500/10 rounded-xl text-indigo-400">
          <Layers className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-display font-bold text-base text-white">Consola General Multicanal</h2>
          <p className="text-[11px] text-slate-400">
            Estado del flujo y publicaciones divididos por red social
          </p>
        </div>
      </div>

      {loading ? (
        <div className="bg-[#15191E] border border-white/5 rounded-2xl p-12 text-center">
          <p className="text-sm text-slate-400">Cargando canales de YouTube…</p>
        </div>
      ) : !youtubeConnected ? (
        <div className="bg-[#15191E] border border-white/5 rounded-2xl p-10 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-red-500/10 flex items-center justify-center">
            <Youtube className="w-7 h-7 text-red-400" />
          </div>
          <div className="space-y-2">
            <h3 className="text-base font-bold text-white">YouTube no conectado</h3>
            <p className="text-sm text-slate-400 max-w-md mx-auto">
              Conecta tu cuenta de Google con permisos de YouTube en Configuración → Integraciones
              para ver todos tus canales aquí y seleccionar en cuál trabajar.
            </p>
          </div>
          <button
            type="button"
            onClick={onGoToSettings}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-colors cursor-pointer"
          >
            <Link2 className="w-4 h-4" />
            Ir a Integraciones
          </button>
        </div>
      ) : channels.length === 0 ? (
        <div className="bg-[#15191E] border border-white/5 rounded-2xl p-10 text-center space-y-3">
          <p className="text-sm text-slate-300 font-medium">No se encontraron canales en tu cuenta</p>
          <p className="text-xs text-slate-500">
            Verifica que la cuenta de Google conectada tenga al menos un canal de YouTube.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-slate-400">
              {channels.length} canal{channels.length !== 1 ? 'es' : ''} de YouTube en tu cuenta
            </p>
            <p className="text-[10px] text-indigo-400 font-mono uppercase tracking-wide">
              Canal activo: {channels.find(c => c.id === selectedChannelId)?.name ?? 'ninguno'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {channels.map(channel => {
              const isActive = channel.id === selectedChannelId;
              return (
                <button
                  key={channel.id}
                  type="button"
                  onClick={() => onSelectChannel(channel)}
                  className={`text-left bg-[#15191E] p-4 rounded-xl border space-y-3.5 transition-all cursor-pointer ${
                    isActive
                      ? 'border-indigo-500/50 ring-1 ring-indigo-500/30'
                      : 'border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-indigo-400 font-bold uppercase">{channel.type}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                        isActive
                          ? 'bg-indigo-950 text-indigo-300'
                          : 'bg-emerald-950 text-emerald-400'
                      }`}
                    >
                      {isActive ? 'Activo' : channel.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <ChannelAvatar
                      avatar={channel.avatar}
                      name={channel.name}
                      className="w-11 h-11 rounded-full object-cover border border-white/10"
                    />
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-bold text-white truncate">{channel.name}</h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {formatSubscribers(channel.subscribers)} suscriptores
                      </p>
                    </div>
                  </div>
                  {channel.customUrl && (
                    <a
                      href={`https://youtube.com/${channel.customUrl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-indigo-400 transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                      youtube.com/{channel.customUrl}
                    </a>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
