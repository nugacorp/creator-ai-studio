import React, { useEffect, useState } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, MapPin, Video, Sparkles, Clock, AlertCircle } from 'lucide-react';
import { fetchCalendarEvents } from '../api';

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  channel: string;
  status: 'published' | 'scheduled' | 'draft';
}

export default function CalendarView() {
  const [monthOffset, setMonthOffset] = useState(0);
  const baseDate = new Date(2026, 5 + monthOffset, 1);
  const currentMonth = baseDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

  const [events, setEvents] = useState<CalendarEvent[]>([]);

  useEffect(() => {
    void fetchCalendarEvents()
      .then(apiEvents =>
        setEvents(
          apiEvents.map(e => ({
            id: e.id,
            title: e.title,
            date: e.date,
            time: '18:00',
            channel: 'YouTube Principal',
            status: e.status as CalendarEvent['status'],
          })),
        ),
      )
      .catch(() => setEvents([]));
  }, []);

  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDate, setNewEventDate] = useState('2026-06-29');
  const [newEventTime, setNewEventTime] = useState('18:00');
  const [newEventChannel, setNewEventChannel] = useState('YouTube Principal');

  // Simple static days of June 2026 starting from Monday
  const daysInMonth = Array.from({ length: 30 }, (_, i) => i + 1);
  const startDayOffset = 0; // June 1st 2026 is Monday

  const handleAddEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventTitle.trim()) return;

    const newEv: CalendarEvent = {
      id: `ev_${Date.now()}`,
      title: newEventTitle,
      date: newEventDate,
      time: newEventTime,
      channel: newEventChannel,
      status: 'scheduled'
    };

    setEvents(prev => [...prev, newEv]);
    setNewEventTitle('');
    setShowAddEventModal(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Calendar header control */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#15191E] p-4.5 rounded-2xl border border-[rgba(255,255,255,0.05)]">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 rounded-2xl text-indigo-400">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display font-bold text-base text-white">Cronograma de Publicaciones</h2>
            <p className="text-[11px] text-[#8B949E]">Calendario de lanzamientos unificado para todas tus marcas</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-[#0B0F14] p-1 rounded-2xl border border-[rgba(255,255,255,0.05)]">
            <button
              onClick={() => setMonthOffset(m => m - 1)}
              className="p-1.5 rounded-md hover:bg-[rgba(255,255,255,0.05)] text-[#8B949E] hover:text-white transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-white font-mono px-2 capitalize">{currentMonth}</span>
            <button
              onClick={() => setMonthOffset(m => m + 1)}
              className="p-1.5 rounded-md hover:bg-[rgba(255,255,255,0.05)] text-[#8B949E] hover:text-white transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => setShowAddEventModal(true)}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Programar Lanzamiento</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Main Grid Calendar */}
        <div className="lg:col-span-3 bg-[#0B0F14] border border-[rgba(255,255,255,0.05)] rounded-2xl p-4 md:p-5 overflow-x-auto scrollbar-none">
          <div className="min-w-[650px] space-y-4">
            {/* Days labels */}
            <div className="grid grid-cols-7 text-center text-[10px] font-bold text-[#8B949E] uppercase tracking-wider border-b border-[rgba(255,255,255,0.05)] pb-2 font-mono">
              <span>Lun</span>
              <span>Mar</span>
              <span>Mié</span>
              <span>Jue</span>
              <span>Vie</span>
              <span>Sáb</span>
              <span>Dom</span>
            </div>

            {/* Grid list */}
            <div className="grid grid-cols-7 gap-2.5 min-h-[400px]">
              {daysInMonth.map(day => {
                const dateString = `2026-06-${day < 10 ? '0' + day : day}`;
                const dayEvents = events.filter(e => e.date === dateString);

                return (
                  <div
                    key={day}
                    className="bg-[#15191E]/50 border border-[rgba(255,255,255,0.05)]/60 hover:border-indigo-500/30 rounded-2xl p-2 min-h-[85px] flex flex-col justify-between transition-colors relative"
                  >
                    <span className="text-[11px] font-bold text-[#8B949E] font-mono leading-none">{day}</span>
                    
                    <div className="space-y-1 mt-1.5 flex-1 flex flex-col justify-end">
                      {dayEvents.map(ev => (
                        <div
                          key={ev.id}
                          title={ev.title}
                          className={`text-[8px] font-bold p-1 rounded border leading-none truncate ${
                            ev.status === 'published'
                              ? 'bg-emerald-950/40 border-emerald-800/30 text-emerald-300'
                              : ev.status === 'scheduled'
                              ? 'bg-indigo-950/40 border-indigo-800/30 text-indigo-300 animate-pulse-slow'
                              : 'bg-zinc-900 border-zinc-700 text-zinc-400'
                          }`}
                        >
                          {ev.title}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sidebar details */}
        <div className="bg-[#15191E] border border-[rgba(255,255,255,0.05)] rounded-2xl p-5 space-y-4">
          <h4 className="text-[11px] font-bold text-[#8B949E] uppercase tracking-wider font-mono">Próximos Estrenos</h4>
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
            {events
              .filter(e => e.status !== 'published')
              .map(ev => (
                <div
                  key={ev.id}
                  className="bg-[#0B0F14] p-3.5 rounded-2xl border border-[rgba(255,255,255,0.05)] space-y-2 hover:border-indigo-500/40 transition-colors"
                >
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-semibold text-indigo-400 font-mono">{ev.channel}</span>
                    <span className="flex items-center gap-1 text-[#8B949E] font-mono">
                      <Clock className="w-3 h-3 text-amber-500" /> {ev.time}
                    </span>
                  </div>
                  <h5 className="text-xs font-bold text-white line-clamp-1">"{ev.title}"</h5>
                  <div className="text-[9px] text-[#8B949E] flex items-center justify-between font-mono">
                    <span>Estreno: {ev.date}</span>
                    <span className="text-amber-400 font-semibold uppercase tracking-wider">Pendiente</span>
                  </div>
                </div>
              ))}
          </div>
        </div>

      </div>

      {/* Add Launch Event Modal Popup */}
      {showAddEventModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B0F14]/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[#15191E] border border-[rgba(255,255,255,0.05)] rounded-2xl p-6 shadow-2xl relative">
            <h3 className="font-display font-bold text-lg text-white mb-4">Programar Lanzamiento de Contenido</h3>
            
            <form onSubmit={handleAddEvent} className="space-y-4">
              <div>
                <label className="text-[11px] font-bold text-[#8B949E] uppercase tracking-wider block mb-1.5">Título del Video</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Promesas de paz en Proverbios"
                  value={newEventTitle}
                  onChange={e => setNewEventTitle(e.target.value)}
                  className="w-full bg-[#0B0F14] border border-[rgba(255,255,255,0.05)] rounded-2xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#8B949E] uppercase tracking-wider block mb-1.5">Red Social de Destino</label>
                <select
                  value={newEventChannel}
                  onChange={e => setNewEventChannel(e.target.value)}
                  className="w-full bg-[#0B0F14] border border-[rgba(255,255,255,0.05)] rounded-2xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                >
                  <option value="YouTube Principal">YouTube Principal</option>
                  <option value="TikTok Recortes">TikTok Recortes</option>
                  <option value="Instagram Reels">Instagram Reels</option>
                  <option value="Página Facebook">Página Facebook</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-bold text-[#8B949E] uppercase tracking-wider block mb-1.5">Fecha</label>
                  <input
                    type="date"
                    required
                    value={newEventDate}
                    onChange={e => setNewEventDate(e.target.value)}
                    className="w-full bg-[#0B0F14] border border-[rgba(255,255,255,0.05)] rounded-2xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#8B949E] uppercase tracking-wider block mb-1.5">Hora</label>
                  <input
                    type="time"
                    required
                    value={newEventTime}
                    onChange={e => setNewEventTime(e.target.value)}
                    className="w-full bg-[#0B0F14] border border-[rgba(255,255,255,0.05)] rounded-2xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-[rgba(255,255,255,0.05)]/60">
                <button
                  type="button"
                  onClick={() => setShowAddEventModal(false)}
                  className="px-4 py-2 rounded-2xl bg-[#0B0F14] border border-[rgba(255,255,255,0.05)] text-[#8B949E] hover:text-[#E6EDF2] text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
                >
                  Agendar Lanzamiento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
