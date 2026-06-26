import React, { useState } from 'react';
import { Bell, ChevronDown, Check, RefreshCw, AlertTriangle, Sparkles, Wifi, Menu } from 'lucide-react';
import { Channel, Notification } from '../types';

interface HeaderProps {
  channels: Channel[];
  selectedChannel: Channel;
  setSelectedChannel: (channel: Channel) => void;
  notifications: Notification[];
  setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
  onMenuClick?: () => void;
}

export default function Header({
  channels,
  selectedChannel,
  setSelectedChannel,
  notifications,
  setNotifications,
  onMenuClick
}: HeaderProps) {
  const [showChannelsDropdown, setShowChannelsDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return <span className="text-emerald-400 font-bold mr-2">✓</span>;
      case 'error':
        return <AlertTriangle className="w-4 h-4 text-rose-400 mr-2 shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-400 mr-2 shrink-0" />;
      default:
        return <Sparkles className="w-4 h-4 text-violet-400 mr-2 shrink-0" />;
    }
  };

  return (
    <header className="h-16 border-b border-white/5 bg-[#0B0F14] px-4 md:px-6 flex items-center justify-between sticky top-0 z-40 select-none">
      {/* Channel selector and Menu Button */}
      <div className="flex items-center gap-3">
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-xl bg-[#15191E] border border-white/10 text-[#E6EDF2] hover:border-indigo-500/50 transition-all cursor-pointer flex items-center justify-center shrink-0"
            title="Abrir menú"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div className="relative">
          <button
            id="channel-selector-btn"
            onClick={() => setShowChannelsDropdown(!showChannelsDropdown)}
            className="flex items-center gap-2 md:gap-3 px-3 py-1.5 rounded-xl bg-[#15191E] border border-white/10 hover:border-indigo-500/50 transition-all text-sm font-medium text-[#E6EDF2]"
          >
            <span className="text-lg md:text-xl shrink-0">{selectedChannel.avatar}</span>
            <span className="truncate max-w-[100px] sm:max-w-[180px] md:max-w-none">{selectedChannel.name}</span>
            <span className="hidden sm:inline text-xs px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 font-semibold border border-indigo-800/40">
              {selectedChannel.type}
            </span>
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${showChannelsDropdown ? 'rotate-180' : ''}`} />
          </button>

        {showChannelsDropdown && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowChannelsDropdown(false)} />
            <div className="absolute left-0 mt-2 w-64 bg-[#15191E] border border-white/10 rounded-xl shadow-2xl p-1.5 z-20 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Tus Canales y Proyectos
              </div>
              <div className="space-y-1 mt-1">
                {channels.map(chan => (
                  <button
                    id={`channel-btn-${chan.id}`}
                    key={chan.id}
                    onClick={() => {
                      setSelectedChannel(chan);
                      setShowChannelsDropdown(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                      selectedChannel.id === chan.id
                        ? 'bg-indigo-950/40 text-indigo-300 border border-indigo-800/30'
                        : 'text-[#E6EDF2] hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg">{chan.avatar}</span>
                      <div className="text-left">
                        <div className="font-medium">{chan.name}</div>
                        <div className="text-xs text-slate-400">
                          {chan.subscribers.toLocaleString()} suscriptores
                        </div>
                      </div>
                    </div>
                    {selectedChannel.id === chan.id && <Check className="w-4 h-4 text-indigo-400" />}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
        </div>
      </div>

      {/* Right side controls */}
      <div className="flex items-center gap-4">
        {/* Sync Indicator */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-950/20 border border-emerald-900/30 text-emerald-400 text-xs font-medium">
          <Wifi className="w-3.5 h-3.5 animate-pulse" />
          <span>Creator OS Activo y Conectado</span>
        </div>

        {/* Notifications */}
        <div className="relative">
          <button
            id="notifications-bell-btn"
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 rounded-lg bg-[#15191E] border border-white/10 text-slate-400 hover:text-white hover:border-white/20 transition-all relative"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-indigo-600 rounded-full text-[10px] font-bold text-white flex items-center justify-center border-2 border-[#0B0F14] animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowNotifications(false)} />
              <div className="fixed sm:absolute top-16 sm:top-auto left-4 right-4 sm:left-auto sm:right-0 mt-2 sm:w-96 bg-[#15191E] border border-white/10 rounded-xl shadow-2xl z-20 animate-in fade-in slide-in-from-top-2 duration-150 overflow-hidden">
                <div className="px-4 py-3 border-b border-white/5 bg-white/5 flex items-center justify-between">
                  <div className="font-medium text-sm text-[#E6EDF2]">Notificaciones de Producción</div>
                  <div className="flex items-center gap-3">
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllAsRead}
                        className="text-xs text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
                      >
                        Marcar leído
                      </button>
                    )}
                    <button
                      onClick={clearNotifications}
                      className="text-xs text-rose-400 hover:text-rose-300 font-medium cursor-pointer"
                    >
                      Limpiar
                    </button>
                  </div>
                </div>

                <div className="max-h-[350px] overflow-y-auto divide-y divide-white/5">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-sm">
                      <Check className="w-8 h-8 mx-auto mb-2 text-emerald-500/50" />
                      No hay notificaciones pendientes.
                    </div>
                  ) : (
                    notifications.map(notif => (
                      <div
                        key={notif.id}
                        className={`p-3.5 transition-colors flex items-start gap-1 ${
                          notif.read ? 'bg-transparent text-slate-400' : 'bg-indigo-950/10 text-[#E6EDF2]'
                        }`}
                      >
                        {getIcon(notif.type)}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-normal leading-relaxed break-words">{notif.message}</p>
                          <span className="text-[10px] text-slate-500 mt-1 block">{notif.timestamp}</span>
                        </div>
                        {!notif.read && (
                          <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full shrink-0 mt-1.5" />
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* User profile info */}
        <div className="flex items-center gap-2.5 pl-2 border-l border-white/5">
          <div className="text-right hidden md:block">
            <div className="text-sm font-medium text-[#E6EDF2]">Ramiro OS</div>
            <div className="text-[10px] text-indigo-400 font-semibold tracking-wide uppercase">Plan Enterprise</div>
          </div>
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center font-bold text-sm text-white border border-white/10">
            R
          </div>
        </div>
      </div>
    </header>
  );
}
