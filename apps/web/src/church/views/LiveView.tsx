import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckSquare, Plus, Radio, Square, Trash2, X } from 'lucide-react';
import {
  DEFAULT_PREFLIGHT_CHECKLIST,
  LIVE_CREW_ROLES,
  LIVE_CREW_ROLE_LABELS,
  type LiveCrewAssignment,
  type LiveCrewRole,
  type LiveEvent,
  type LiveEventStatus,
} from '@creator-ai-studio/shared';
import {
  addIncident,
  createLiveEvent,
  deleteLiveEvent,
  fetchLiveEvents,
  toggleChecklistItem,
  updateLiveEvent,
} from '../api';
import { useChurch } from '../ChurchContext';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  LiveStatusPill,
  LoadingState,
  PermissionNotice,
  SectionHeader,
  formatDateTime,
  formatRelative,
  inputClass,
  selectClass,
} from '../components/primitives';

/**
 * "En Vivo" — WO-4, scoped to what works without touching the church's network.
 *
 * Planning, crew assignment, a preflight checklist that records who checked
 * what and when, and a post-event incident log. OBS control lands on top of
 * this once connectivity is decided (§7); the value here does not depend on it.
 */

const NEXT_STATUS: Record<LiveEventStatus, { next: LiveEventStatus; label: string } | null> = {
  planeado: { next: 'preflight', label: 'Empezar preparación' },
  preflight: { next: 'en_vivo', label: 'Estamos al aire' },
  en_vivo: { next: 'finalizado', label: 'Terminar transmisión' },
  finalizado: null,
};

export default function LiveView() {
  const { church, can } = useChurch();
  const timezone = church?.timezone ?? 'America/Bogota';

  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setEvents(await fetchLiveEvents());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las transmisiones');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (id: string, action: () => Promise<unknown>) => {
    setBusyId(id);
    setError(null);
    try {
      await action();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo completar la acción');
    } finally {
      setBusyId(null);
    }
  };

  const upcoming = events.filter(event => event.status !== 'finalizado');
  const past = events.filter(event => event.status === 'finalizado');

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">En Vivo</h1>
          <p className="text-sm text-[#A9B4C0] mt-1">
            Planea el culto, reparte los puestos y no dejes ningún cable sin revisar.
          </p>
        </div>
        {can('live.control') && (
          <Button variant="primary" icon={Plus} onClick={() => setCreateOpen(true)}>
            Planear transmisión
          </Button>
        )}
      </header>

      {error && (
        <p className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2.5">
          {error}
        </p>
      )}

      {loading ? (
        <LoadingState label="Cargando transmisiones…" />
      ) : events.length === 0 ? (
        <Card>
          <EmptyState
            icon={Radio}
            title="Sin transmisiones planeadas"
            description="Crea el evento del próximo culto: reparte quién va en switcher, audio y cámara, y arma el checklist que se revisa 30 minutos antes."
            action={
              can('live.control') ? (
                <Button variant="primary" icon={Plus} onClick={() => setCreateOpen(true)}>
                  Planear la primera
                </Button>
              ) : (
                <PermissionNotice message="Tu rol puede ver las transmisiones, pero no planearlas." />
              )
            }
          />
        </Card>
      ) : (
        <>
          {upcoming.length > 0 && (
            <section className="space-y-4">
              {upcoming.map(event => (
                <LiveEventCard
                  key={event.id}
                  event={event}
                  timezone={timezone}
                  canControl={can('live.control')}
                  busy={busyId === event.id}
                  onRun={action => void run(event.id, action)}
                  onReload={() => void load()}
                />
              ))}
            </section>
          )}

          {past.length > 0 && (
            <section>
              <SectionHeader
                title="Transmisiones pasadas"
                description="Con su registro de incidentes."
                icon={Radio}
              />
              <ul className="space-y-2">
                {past.map(event => (
                  <li key={event.id}>
                    <Card className="px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{event.title}</p>
                        <p className="text-[11px] text-[#7C8794] mt-0.5">
                          {formatDateTime(event.scheduledAt, timezone)}
                          {event.incidents.length > 0 &&
                            ` · ${event.incidents.length} ${
                              event.incidents.length === 1 ? 'incidente' : 'incidentes'
                            }`}
                        </p>
                      </div>
                      <LiveStatusPill status={event.status} />
                    </Card>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {createOpen && (
        <CreateLiveEventDialog
          onClose={() => setCreateOpen(false)}
          onCreated={async () => {
            setCreateOpen(false);
            await load();
          }}
        />
      )}
    </div>
  );
}

function LiveEventCard({
  event,
  timezone,
  canControl,
  busy,
  onRun,
  onReload,
}: {
  event: LiveEvent;
  timezone: string;
  canControl: boolean;
  busy: boolean;
  onRun: (action: () => Promise<unknown>) => void;
  onReload: () => void;
}) {
  const { nameOf } = useChurch();
  const [incidentNote, setIncidentNote] = useState('');
  const done = event.checklist.filter(item => item.done).length;
  const total = event.checklist.length;
  const ready = total > 0 && done === total;
  const transition = NEXT_STATUS[event.status];

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="font-display text-lg font-bold text-white">{event.title}</h2>
            <LiveStatusPill status={event.status} />
          </div>
          <p className="text-xs text-[#A9B4C0] mt-1">
            {formatDateTime(event.scheduledAt, timezone)}
          </p>
        </div>

        {canControl && (
          <div className="flex items-center gap-2">
            {transition && (
              <Button
                variant={transition.next === 'en_vivo' ? 'primary' : 'secondary'}
                icon={Radio}
                loading={busy}
                disabled={transition.next === 'en_vivo' && !ready}
                title={
                  transition.next === 'en_vivo' && !ready
                    ? 'Completa el checklist antes de salir al aire'
                    : undefined
                }
                onClick={() => onRun(() => updateLiveEvent(event.id, { status: transition.next }))}
              >
                {transition.label}
              </Button>
            )}
            <Button
              variant="ghost"
              icon={Trash2}
              compact
              onClick={() => {
                if (window.confirm(`¿Eliminar la transmisión "${event.title}"?`)) {
                  onRun(async () => {
                    await deleteLiveEvent(event.id);
                    onReload();
                  });
                }
              }}
            >
              Eliminar
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wide text-[#A9B4C0]">
              Checklist de preparación
            </h3>
            <span
              className={`text-[11px] font-semibold tabular-nums ${
                ready ? 'text-emerald-300' : 'text-amber-300'
              }`}
            >
              {done}/{total}
            </span>
          </div>

          <div
            className="h-1.5 bg-white/8 rounded-full overflow-hidden mb-3"
            role="progressbar"
            aria-valuenow={done}
            aria-valuemin={0}
            aria-valuemax={total}
            aria-label="Progreso del checklist"
          >
            <div
              className={`h-full transition-[width] duration-200 ${
                ready ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
              style={{ width: total > 0 ? `${(done / total) * 100}%` : '0%' }}
            />
          </div>

          <ul className="space-y-1.5">
            {event.checklist.map(item => (
              <li key={item.id}>
                <button
                  type="button"
                  disabled={!canControl || busy}
                  onClick={() =>
                    onRun(() => toggleChecklistItem(event.id, item.id, !item.done))
                  }
                  className="w-full flex items-start gap-2.5 min-h-11 text-left bg-[#0B0F14] hover:bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 transition-colors duration-150 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {item.done ? (
                    <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" aria-hidden />
                  ) : (
                    <Square className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" aria-hidden />
                  )}
                  <span className="min-w-0">
                    <span
                      className={`text-sm block ${
                        item.done ? 'text-[#7C8794] line-through' : 'text-white'
                      }`}
                    >
                      {item.label}
                    </span>
                    {item.done && item.checkedAt && (
                      <span className="text-[10px] text-[#7C8794] block mt-0.5">
                        {nameOf(item.checkedBy)} · {formatRelative(item.checkedAt)}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-5">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-[#A9B4C0] mb-2.5">
              Equipo del día
            </h3>
            {event.crew.length === 0 ? (
              <p className="text-xs text-[#7C8794]">Nadie asignado todavía.</p>
            ) : (
              <ul className="space-y-1.5">
                {event.crew.map(assignment => (
                  <li
                    key={`${assignment.userId}-${assignment.role}`}
                    className="flex items-center justify-between bg-[#0B0F14] border border-white/8 rounded-xl px-3 py-2.5"
                  >
                    <span className="text-sm text-white truncate">{nameOf(assignment.userId)}</span>
                    <span className="text-[11px] font-semibold text-[#A9B4C0] shrink-0">
                      {LIVE_CREW_ROLE_LABELS[assignment.role]}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-[#A9B4C0] mb-2.5">
              Incidentes
            </h3>
            {canControl && (
              <div className="flex gap-2 mb-2.5">
                <label htmlFor={`incident-${event.id}`} className="sr-only">
                  Registrar un incidente
                </label>
                <input
                  id={`incident-${event.id}`}
                  value={incidentNote}
                  onChange={changeEvent => setIncidentNote(changeEvent.target.value)}
                  className={inputClass}
                  placeholder="Se cayó el audio del micrófono 2…"
                />
                <Button
                  variant="secondary"
                  icon={AlertTriangle}
                  compact
                  disabled={!incidentNote.trim() || busy}
                  onClick={() =>
                    onRun(async () => {
                      await addIncident(event.id, incidentNote.trim(), 'warning');
                      setIncidentNote('');
                    })
                  }
                >
                  Registrar
                </Button>
              </div>
            )}
            {event.incidents.length === 0 ? (
              <p className="text-xs text-[#7C8794]">Sin incidentes. Que siga así.</p>
            ) : (
              <ul className="space-y-1.5">
                {event.incidents.map(incident => (
                  <li
                    key={incident.id}
                    className="bg-[#0B0F14] border border-white/8 rounded-xl px-3 py-2.5"
                  >
                    <p className="text-sm text-white">{incident.note}</p>
                    <p className="text-[10px] text-[#7C8794] mt-1">
                      {nameOf(incident.reportedBy)} · {formatRelative(incident.at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

function CreateLiveEventDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const { members } = useChurch();
  const [title, setTitle] = useState('Culto dominical');
  const [scheduledAt, setScheduledAt] = useState(defaultNextSunday());
  const [crew, setCrew] = useState<LiveCrewAssignment[]>([]);
  const [obsProfile, setObsProfile] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setCrewRole = (userId: string, role: LiveCrewRole | '') => {
    setCrew(prev => {
      const without = prev.filter(entry => entry.userId !== userId);
      return role ? [...without, { userId, role }] : without;
    });
  };

  const submit = async () => {
    if (!title.trim() || !scheduledAt) {
      setError('Necesitas un título y una fecha');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createLiveEvent({
        title: title.trim(),
        scheduledAt: new Date(scheduledAt).toISOString(),
        crew,
        checklist: [...DEFAULT_PREFLIGHT_CHECKLIST],
        ...(obsProfile.trim() ? { obsProfile: obsProfile.trim() } : {}),
      });
      await onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear');
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0B0F14]/85 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-live-title"
    >
      <Card className="w-full max-w-lg p-5 my-8">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 id="create-live-title" className="font-display text-lg font-bold text-white">
              Planear transmisión
            </h2>
            <p className="text-xs text-[#A9B4C0] mt-1">
              Se crea con el checklist estándar. Puedes marcarlo el día del culto.
            </p>
          </div>
          <Button variant="ghost" icon={X} compact onClick={onClose} disabled={saving}>
            Cerrar
          </Button>
        </div>

        <div className="space-y-4">
          <Field label="Título" htmlFor="live-title">
            <input
              id="live-title"
              value={title}
              onChange={event => setTitle(event.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Fecha y hora" htmlFor="live-date">
            <input
              id="live-date"
              type="datetime-local"
              value={scheduledAt}
              onChange={event => setScheduledAt(event.target.value)}
              className={inputClass}
            />
          </Field>

          <div>
            <p className="text-xs font-semibold text-slate-200 mb-2">Puestos</p>
            <div className="space-y-2">
              {members.map(member => (
                <div
                  key={member.id}
                  className="flex items-center gap-3 bg-[#0B0F14] border border-white/8 rounded-xl px-3 py-2"
                >
                  <span className="text-sm text-white flex-1 truncate">
                    {member.displayName || member.title || member.email || 'Integrante'}
                  </span>
                  <label htmlFor={`crew-${member.id}`} className="sr-only">
                    Puesto de {member.displayName ?? 'integrante'}
                  </label>
                  <select
                    id={`crew-${member.id}`}
                    value={crew.find(entry => entry.userId === member.userId)?.role ?? ''}
                    onChange={event =>
                      setCrewRole(member.userId, event.target.value as LiveCrewRole | '')
                    }
                    className={`${selectClass} w-36 shrink-0`}
                  >
                    <option value="">Sin puesto</option>
                    {LIVE_CREW_ROLES.map(role => (
                      <option key={role} value={role}>
                        {LIVE_CREW_ROLE_LABELS[role]}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <Field
            label="Perfil de OBS"
            htmlFor="live-obs"
            hint="Opcional. El nombre del perfil que usa la PC de transmisión."
          >
            <input
              id="live-obs"
              value={obsProfile}
              onChange={event => setObsProfile(event.target.value)}
              className={inputClass}
            />
          </Field>

          {error && (
            <p className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2.5">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button variant="primary" icon={Plus} onClick={() => void submit()} loading={saving}>
              Crear
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

/** Next Sunday at 10:00 local — the default the team actually needs. */
function defaultNextSunday(): string {
  const date = new Date();
  const daysUntilSunday = (7 - date.getDay()) % 7 || 7;
  date.setDate(date.getDate() + daysUntilSunday);
  date.setHours(10, 0, 0, 0);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}
