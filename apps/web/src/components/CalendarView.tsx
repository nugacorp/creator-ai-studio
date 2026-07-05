import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Clock } from 'lucide-react';
import { suggestNextPublishSlot, DEFAULT_PUBLISH_SCHEDULE, formatNextPublishSlot } from '@creator-ai-studio/shared';
import { fetchCalendarEvents, fetchSettings, type CalendarEvent as ApiCalendarEvent } from '../api';

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  channel: string;
  status: 'published' | 'scheduled' | 'draft';
  source?: 'local' | 'youtube';
  scheduledAt?: string;
  youtubeUrl?: string;
}

function mapApiEvent(e: ApiCalendarEvent): CalendarEvent {
  let date = e.date;
  let time = e.time || '18:00';
  if (e.scheduledAt) {
    const d = new Date(e.scheduledAt);
    if (!Number.isNaN(d.getTime())) {
      date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
  }
  return {
    id: e.id,
    title: e.title,
    date,
    time,
    channel: e.channel || 'YouTube',
    status: e.status,
    source: e.source,
    scheduledAt: e.scheduledAt,
    youtubeUrl: e.youtubeUrl,
  };
}

function eventDateTime(ev: CalendarEvent): number {
  const iso = ev.scheduledAt ?? `${ev.date}T${ev.time}:00`;
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

export default function CalendarView() {
  const [monthOffset, setMonthOffset] = useState(0);
  const today = new Date();
  const baseDate = useMemo(
    () => new Date(today.getFullYear(), today.getMonth() + monthOffset, 1),
    [today.getFullYear(), today.getMonth(), monthOffset],
  );
  const currentMonth = baseDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

  const daysInMonth = useMemo(() => {
    const year = baseDate.getFullYear();
    const month = baseDate.getMonth();
    const count = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: count }, (_, i) => i + 1);
  }, [baseDate]);

  // Monday-first offset (0 = Monday)
  const startDayOffset = useMemo(() => {
    const day = baseDate.getDay();
    return day === 0 ? 6 : day - 1;
  }, [baseDate]);

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loadError, setLoadError] = useState(false);

  const loadEvents = useCallback(() => {
    void fetchCalendarEvents()
      .then(apiEvents => {
        setEvents(apiEvents.map(mapApiEvent));
        setLoadError(false);
      })
      .catch(() => {
        setEvents([]);
        setLoadError(true);
      });
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDate, setNewEventDate] = useState(() => today.toISOString().slice(0, 10));
  const [newEventTime, setNewEventTime] = useState('18:00');
  const [newEventChannel, setNewEventChannel] = useState('YouTube Principal');
  const [slotPreviewLabel, setSlotPreviewLabel] = useState<string | null>(null);

  const dateStringForDay = (day: number) => {
    const y = baseDate.getFullYear();
    const m = String(baseDate.getMonth() + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const upcomingEvents = useMemo(
    () =>
      events
        .filter(e => e.status !== 'published')
        .sort((a, b) => eventDateTime(a) - eventDateTime(b)),
    [events],
  );

  const handleAddEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventTitle.trim()) return;

    const newEv: CalendarEvent = {
      id: `manual_${Date.now()}`,
      title: newEventTitle,
      date: newEventDate,
      time: newEventTime,
      channel: newEventChannel,
      status: 'scheduled',
      source: 'local',
      scheduledAt: new Date(`${newEventDate}T${newEventTime}:00`).toISOString(),
    };

    setEvents(prev => [...prev, newEv]);
    setNewEventTitle('');
    setShowAddEventModal(false);
  };

  const applyHabitualSlot = async (kind: 'longVideo' | 'shorts') => {
    try {
      const settings = await fetchSettings();
      const schedule = settings.publishSchedule ?? DEFAULT_PUBLISH_SCHEDULE;
      const slot = suggestNextPublishSlot(schedule, kind);
      setNewEventDate(slot.toISOString().slice(0, 10));
      setNewEventTime(
        `${String(slot.getHours()).padStart(2, '0')}:${String(slot.getMinutes()).padStart(2, '0')}`,
      );
      setSlotPreviewLabel(formatNextPublishSlot(slot, kind));
    } catch {
      setSlotPreviewLabel(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#15191E] p-4.5 rounded-2xl border border-[rgba(255,255,255,0.05)]">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 rounded-2xl text-indigo-400">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display font-bold text-base text-white">Cronograma de Publicaciones</h2>
            <p className="text-[11px] text-[#8B949E]">
              Episodios programados en el proyecto y, si YouTube OAuth está conectado, subidas programadas en tu canal
            </p>
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

      {loadError && (
        <p className="text-xs text-amber-400 px-1">
          No se pudo cargar el calendario desde la API. Mostrando solo eventos locales de esta sesión.
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

        <div className="lg:col-span-3 bg-[#0B0F14] border border-[rgba(255,255,255,0.05)] rounded-2xl p-4 md:p-5 overflow-x-auto scrollbar-none">
          <div className="min-w-[650px] space-y-4">
            <div className="grid grid-cols-7 text-center text-[10px] font-bold text-[#8B949E] uppercase tracking-wider border-b border-[rgba(255,255,255,0.05)] pb-2 font-mono">
              <span>Lun</span>
              <span>Mar</span>
              <span>Mié</span>
              <span>Jue</span>
              <span>Vie</span>
              <span>Sáb</span>
              <span>Dom</span>
            </div>

            <div className="grid grid-cols-7 gap-2.5 min-h-[400px]">
              {Array.from({ length: startDayOffset }).map((_, i) => (
                <div key={`pad-${i}`} className="min-h-[85px]" />
              ))}
              {daysInMonth.map(day => {
                const dateString = dateStringForDay(day);
                const dayEvents = events.filter(ev => ev.date === dateString);
                const isToday =
                  day === today.getDate() &&
                  baseDate.getMonth() === today.getMonth() &&
                  baseDate.getFullYear() === today.getFullYear();

                return (
                  <div
                    key={day}
                    className={`bg-[#15191E]/50 border rounded-2xl p-2 min-h-[85px] flex flex-col justify-between transition-colors relative ${
                      isToday
                        ? 'border-indigo-500/50 ring-1 ring-indigo-500/20'
                        : 'border-[rgba(255,255,255,0.05)]/60 hover:border-indigo-500/30'
                    }`}
                  >
                    <span
                      className={`text-[11px] font-bold font-mono leading-none ${
                        isToday ? 'text-indigo-300' : 'text-[#8B949E]'
                      }`}
                    >
                      {day}
                    </span>

                    <div className="space-y-1 mt-1.5 flex-1 flex flex-col justify-end">
                      {dayEvents.map(ev => (
                        <div
                          key={ev.id}
                          title={`${ev.title} · ${ev.time} · ${ev.channel}`}
                          className={`text-[8px] font-bold p-1 rounded border leading-none truncate ${
                            ev.status === 'published'
                              ? 'bg-emerald-950/40 border-emerald-800/30 text-emerald-300'
                              : ev.status === 'scheduled'
                              ? 'bg-indigo-950/40 border-indigo-800/30 text-indigo-300'
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

        <div className="bg-[#15191E] border border-[rgba(255,255,255,0.05)] rounded-2xl p-5 space-y-4">
          <h4 className="text-[11px] font-bold text-[#8B949E] uppercase tracking-wider font-mono">Próximos Estrenos</h4>
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
            {upcomingEvents.length === 0 ? (
              <p className="text-xs text-[#8B949E]">
                Sin estrenos programados. Usa la pestaña Publicación en un episodio o conecta YouTube OAuth.
              </p>
            ) : (
              upcomingEvents.map(ev => (
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
                  <h5 className="text-xs font-bold text-white line-clamp-2">{ev.title}</h5>
                  <div className="text-[9px] text-[#8B949E] flex items-center justify-between font-mono">
                    <span>Estreno: {ev.date}</span>
                    <span className="text-amber-400 font-semibold uppercase tracking-wider">
                      {ev.source === 'youtube' ? 'YouTube' : 'Programado'}
                    </span>
                  </div>
                  {ev.youtubeUrl && (
                    <a
                      href={ev.youtubeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[9px] text-indigo-400 hover:text-indigo-300 truncate block"
                    >
                      Ver en YouTube
                    </a>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {showAddEventModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B0F14]/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[#15191E] border border-[rgba(255,255,255,0.05)] rounded-2xl p-6 shadow-2xl relative">
            <h3 className="font-display font-bold text-lg text-white mb-1">Programar Lanzamiento de Contenido</h3>
            <p className="text-[11px] text-[#8B949E] mb-4">
              Para vincular un episodio del proyecto, usa la pestaña Publicación en el workspace. Aquí puedes anotar un recordatorio local.
            </p>

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

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void applyHabitualSlot('longVideo')}
                  className="px-3 py-1.5 rounded-xl border border-indigo-500/30 text-[10px] font-bold text-indigo-300 hover:bg-indigo-500/10"
                >
                  Usar horario habitual (largo)
                </button>
                <button
                  type="button"
                  onClick={() => void applyHabitualSlot('shorts')}
                  className="px-3 py-1.5 rounded-xl border border-fuchsia-500/30 text-[10px] font-bold text-fuchsia-300 hover:bg-fuchsia-500/10"
                >
                  Usar horario habitual (Shorts)
                </button>
              </div>

              {slotPreviewLabel && (
                <p className="text-[11px] text-indigo-300 bg-indigo-950/30 border border-indigo-500/20 rounded-xl px-3 py-2">
                  {slotPreviewLabel}
                </p>
              )}

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
