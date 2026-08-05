import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Info,
  Plus,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import {
  AUTO_CAPABLE_PLATFORMS,
  PUBLISH_PLATFORMS,
  type CalendarEntry,
  type Production,
  type PublishPlatform,
  type PublishTarget,
} from '@creator-ai-studio/shared';
import {
  createTarget,
  deleteCalendarEntry,
  deleteTarget,
  fetchCalendar,
  fetchProductions,
  fetchTargets,
  scheduleEntries,
} from '../api';
import { useChurch } from '../ChurchContext';
import {
  Button,
  CalendarStatusPill,
  Card,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  PermissionNotice,
  SectionHeader,
  formatDateTime,
  inputClass,
  selectClass,
} from '../components/primitives';

/**
 * "Calendario" — WO-3.
 *
 * A month grid in the church's timezone plus the destination list. The screen
 * is honest about what each destination can do: `assisted` targets say so on
 * the card, because a promise the connector cannot keep is worse than no
 * connector at all (AD-3).
 */

const PLATFORM_LABELS: Record<PublishPlatform, string> = {
  youtube: 'YouTube',
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  x: 'X',
};

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export default function CalendarView() {
  const { church, can } = useChurch();
  const timezone = church?.timezone ?? 'America/Bogota';

  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()));
  const [entries, setEntries] = useState<Array<{ entry: CalendarEntry; production: Production | null }>>([]);
  const [targets, setTargets] = useState<PublishTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [targetOpen, setTargetOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const from = startOfMonth(monthCursor);
      const to = endOfMonth(monthCursor);
      const [items, targetData] = await Promise.all([
        fetchCalendar({ from: from.toISOString(), to: to.toISOString() }),
        fetchTargets(),
      ]);
      setEntries(items);
      setTargets(targetData.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el calendario');
    } finally {
      setLoading(false);
    }
  }, [monthCursor]);

  useEffect(() => {
    void load();
  }, [load]);

  const targetsById = useMemo(
    () => new Map(targets.map(target => [target.id, target])),
    [targets],
  );

  const days = useMemo(() => buildMonthGrid(monthCursor, timezone, entries), [
    monthCursor,
    timezone,
    entries,
  ]);

  const monthLabel = new Intl.DateTimeFormat('es-CO', {
    month: 'long',
    year: 'numeric',
    timeZone: timezone,
  }).format(monthCursor);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Calendario</h1>
          <p className="text-sm text-[#A9B4C0] mt-1">
            Qué sale, cuándo y a dónde. Todo en hora de la iglesia ({timezone}).
          </p>
        </div>
        {can('production.publish') && (
          <Button variant="primary" icon={Plus} onClick={() => setScheduleOpen(true)}>
            Programar publicación
          </Button>
        )}
      </header>

      {error && <ErrorState message={error} onRetry={() => void load()} />}

      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <Button
            variant="ghost"
            icon={ChevronLeft}
            compact
            onClick={() => setMonthCursor(addMonths(monthCursor, -1))}
          >
            Mes anterior
          </Button>
          <h2 className="font-display text-base font-bold text-white capitalize">{monthLabel}</h2>
          <Button
            variant="ghost"
            icon={ChevronRight}
            compact
            onClick={() => setMonthCursor(addMonths(monthCursor, 1))}
          >
            Mes siguiente
          </Button>
        </div>

        {loading ? (
          <LoadingState label="Cargando el mes…" />
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[640px]">
              <div className="grid grid-cols-7 gap-1.5 mb-1.5">
                {WEEKDAYS.map(day => (
                  <div
                    key={day}
                    className="text-[10px] font-bold uppercase tracking-wide text-[#7C8794] text-center py-1"
                  >
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {days.map(day => (
                  <div
                    key={day.key}
                    className={`min-h-24 rounded-xl border p-2 ${
                      day.inMonth
                        ? 'bg-[#0B0F14] border-white/8'
                        : 'bg-transparent border-white/4 opacity-45'
                    } ${day.isToday ? 'ring-1 ring-indigo-500/50' : ''}`}
                  >
                    <p
                      className={`text-[11px] font-semibold mb-1.5 tabular-nums ${
                        day.isToday ? 'text-indigo-300' : 'text-[#7C8794]'
                      }`}
                    >
                      {day.dayNumber}
                    </p>
                    <ul className="space-y-1">
                      {day.entries.map(({ entry, production }) => {
                        const target = targetsById.get(entry.targetId);
                        return (
                          <li
                            key={entry.id}
                            className="text-[10px] leading-tight bg-white/6 border border-white/8 rounded-md px-1.5 py-1"
                            title={`${production?.title ?? 'Evento'} → ${
                              target?.displayName ?? 'destino'
                            }`}
                          >
                            <span className="block text-white font-medium truncate">
                              {production?.title ?? 'Evento en vivo'}
                            </span>
                            <span className="block text-[#A9B4C0] truncate">
                              {target ? PLATFORM_LABELS[target.platform] : 'Destino'}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Card>

      <Card className="p-5">
        <SectionHeader
          icon={Send}
          title="Publicaciones programadas"
          description="En orden, con su estado real."
        />
        {entries.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="Nada programado este mes"
            description="Programa una producción aprobada y saldrá sola en su día y hora."
            action={
              can('production.publish') ? (
                <Button variant="secondary" icon={Plus} onClick={() => setScheduleOpen(true)}>
                  Programar
                </Button>
              ) : (
                <PermissionNotice message="Tu rol puede ver el calendario, pero solo un líder o administrador programa publicaciones." />
              )
            }
          />
        ) : (
          <ul className="space-y-2">
            {entries.map(({ entry, production }) => {
              const target = targetsById.get(entry.targetId);
              return (
                <li
                  key={entry.id}
                  className="flex flex-wrap items-center gap-3 bg-[#0B0F14] border border-white/8 rounded-xl px-3.5 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white truncate">
                      {production?.title ?? 'Evento en vivo'}
                    </p>
                    <p className="text-[11px] text-[#7C8794] mt-0.5">
                      {formatDateTime(entry.scheduledFor, timezone)}
                      {target && ` · ${target.displayName} (${PLATFORM_LABELS[target.platform]})`}
                      {target?.mode === 'assisted' && ' · publica una persona'}
                    </p>
                    {entry.lastError && (
                      <p className="text-[11px] text-rose-300 mt-1">{entry.lastError}</p>
                    )}
                  </div>
                  <CalendarStatusPill status={entry.status} />
                  {can('production.publish') && (
                    <Button
                      variant="ghost"
                      icon={Trash2}
                      compact
                      onClick={() => {
                        if (window.confirm('¿Quitar esta publicación del calendario?')) {
                          void deleteCalendarEntry(entry.id).then(load);
                        }
                      }}
                    >
                      Quitar
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card className="p-5">
        <SectionHeader
          icon={Send}
          title="Destinos de publicación"
          description="Dónde puede salir el contenido del equipo."
          action={
            can('credentials.manage') ? (
              <Button variant="secondary" icon={Plus} onClick={() => setTargetOpen(true)}>
                Agregar destino
              </Button>
            ) : undefined
          }
        />

        <p className="flex items-start gap-2 text-[11px] text-[#A9B4C0] bg-white/4 border border-white/8 rounded-xl px-3 py-2.5 mb-4">
          <Info className="w-3.5 h-3.5 mt-px shrink-0 text-sky-400" aria-hidden />
          <span className="leading-relaxed">
            YouTube y Facebook publican solos. Instagram y TikTok no lo permiten sin intervención
            humana: para esos, la plataforma deja el video y el texto listos y avisa a quien
            publica.
          </span>
        </p>

        {targets.length === 0 ? (
          <EmptyState
            icon={Send}
            title="Sin destinos configurados"
            description="Agrega al menos un destino (el canal de YouTube o la página de Facebook) para poder programar."
            action={
              can('credentials.manage') ? (
                <Button variant="secondary" icon={Plus} onClick={() => setTargetOpen(true)}>
                  Agregar el primero
                </Button>
              ) : (
                <PermissionNotice message="Solo un administrador configura los destinos de publicación." />
              )
            }
          />
        ) : (
          <ul className="grid gap-2.5 sm:grid-cols-2">
            {targets.map(target => (
              <li
                key={target.id}
                className="flex items-center justify-between gap-3 bg-[#0B0F14] border border-white/8 rounded-xl px-3.5 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{target.displayName}</p>
                  <p className="text-[11px] text-[#7C8794] mt-0.5">
                    {PLATFORM_LABELS[target.platform]} ·{' '}
                    {target.mode === 'auto' ? 'Publica solo' : 'Publica una persona'} ·{' '}
                    {target.renderPreset}
                  </p>
                </div>
                {can('credentials.manage') && (
                  <Button
                    variant="ghost"
                    icon={Trash2}
                    compact
                    onClick={() => {
                      if (window.confirm(`¿Eliminar el destino "${target.displayName}"?`)) {
                        void deleteTarget(target.id).then(load);
                      }
                    }}
                  >
                    Eliminar
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {scheduleOpen && (
        <ScheduleDialog
          targets={targets}
          onClose={() => setScheduleOpen(false)}
          onScheduled={async () => {
            setScheduleOpen(false);
            await load();
          }}
        />
      )}

      {targetOpen && (
        <TargetDialog
          onClose={() => setTargetOpen(false)}
          onCreated={async () => {
            setTargetOpen(false);
            await load();
          }}
        />
      )}
    </div>
  );
}

function ScheduleDialog({
  targets,
  onClose,
  onScheduled,
}: {
  targets: PublishTarget[];
  onClose: () => void;
  onScheduled: () => Promise<void>;
}) {
  const [approved, setApproved] = useState<Production[]>([]);
  const [productionId, setProductionId] = useState('');
  const [targetIds, setTargetIds] = useState<string[]>([]);
  const [scheduledFor, setScheduledFor] = useState(defaultSundayMorning());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchProductions({ status: 'aprobado' })
      .then(items => {
        setApproved(items);
        setProductionId(items[0]?.id ?? '');
      })
      .catch(() => setApproved([]))
      .finally(() => setLoading(false));
  }, []);

  const submit = async () => {
    if (!productionId) {
      setError('Elige una producción aprobada');
      return;
    }
    if (targetIds.length === 0) {
      setError('Elige al menos un destino');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await scheduleEntries({
        productionId,
        targetIds,
        scheduledFor: new Date(scheduledFor).toISOString(),
      });
      await onScheduled();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo programar');
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0B0F14]/85 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="schedule-title"
    >
      <Card className="w-full max-w-lg p-5 my-8">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 id="schedule-title" className="font-display text-lg font-bold text-white">
              Programar publicación
            </h2>
            <p className="text-xs text-[#A9B4C0] mt-1">
              Solo aparecen producciones ya aprobadas.
            </p>
          </div>
          <Button variant="ghost" icon={X} compact onClick={onClose} disabled={saving}>
            Cerrar
          </Button>
        </div>

        {loading ? (
          <LoadingState />
        ) : approved.length === 0 ? (
          <EmptyState
            icon={Send}
            title="No hay producciones aprobadas"
            description="Una producción tiene que pasar por revisión y recibir el visto bueno de un líder antes de poder programarse."
          />
        ) : (
          <div className="space-y-4">
            <Field label="Producción" htmlFor="schedule-production">
              <select
                id="schedule-production"
                value={productionId}
                onChange={event => setProductionId(event.target.value)}
                className={selectClass}
              >
                {approved.map(production => (
                  <option key={production.id} value={production.id}>
                    {production.title}
                  </option>
                ))}
              </select>
            </Field>

            <div>
              <p className="text-xs font-semibold text-slate-200 mb-2">Destinos</p>
              {targets.length === 0 ? (
                <p className="text-xs text-[#7C8794]">
                  Todavía no hay destinos configurados. Agrega uno primero.
                </p>
              ) : (
                <div className="space-y-2">
                  {targets.map(target => (
                    <label
                      key={target.id}
                      className="flex items-center gap-3 min-h-11 bg-[#0B0F14] border border-white/8 rounded-xl px-3.5 py-2.5 cursor-pointer hover:border-white/15 transition-colors duration-150"
                    >
                      <input
                        type="checkbox"
                        checked={targetIds.includes(target.id)}
                        onChange={event =>
                          setTargetIds(prev =>
                            event.target.checked
                              ? [...prev, target.id]
                              : prev.filter(id => id !== target.id),
                          )
                        }
                        className="w-4 h-4 accent-indigo-500 cursor-pointer"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="text-sm text-white block truncate">
                          {target.displayName}
                        </span>
                        <span className="text-[11px] text-[#7C8794] block">
                          {PLATFORM_LABELS[target.platform]} ·{' '}
                          {target.mode === 'auto' ? 'publica solo' : 'publica una persona'}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <Field label="Fecha y hora" htmlFor="schedule-when" hint="En hora de la iglesia.">
              <input
                id="schedule-when"
                type="datetime-local"
                value={scheduledFor}
                onChange={event => setScheduledFor(event.target.value)}
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
              <Button variant="primary" icon={Send} onClick={() => void submit()} loading={saving}>
                Programar
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function TargetDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [platform, setPlatform] = useState<PublishPlatform>('youtube');
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canAuto = AUTO_CAPABLE_PLATFORMS.includes(platform);

  const submit = async () => {
    if (!displayName.trim()) {
      setError('Ponle un nombre al destino');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createTarget({
        platform,
        displayName: displayName.trim(),
        mode: canAuto ? 'auto' : 'assisted',
      });
      await onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el destino');
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0B0F14]/85 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="target-title"
    >
      <Card className="w-full max-w-md p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <h2 id="target-title" className="font-display text-lg font-bold text-white">
            Nuevo destino
          </h2>
          <Button variant="ghost" icon={X} compact onClick={onClose} disabled={saving}>
            Cerrar
          </Button>
        </div>

        <div className="space-y-4">
          <Field label="Plataforma" htmlFor="target-platform">
            <select
              id="target-platform"
              value={platform}
              onChange={event => setPlatform(event.target.value as PublishPlatform)}
              className={selectClass}
            >
              {PUBLISH_PLATFORMS.map(option => (
                <option key={option} value={option}>
                  {PLATFORM_LABELS[option]}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Nombre"
            htmlFor="target-name"
            hint="Como lo reconoce el equipo: “Canal principal”, “Página de la iglesia”."
          >
            <input
              id="target-name"
              value={displayName}
              onChange={event => setDisplayName(event.target.value)}
              className={inputClass}
            />
          </Field>

          <p className="flex items-start gap-2 text-[11px] text-[#A9B4C0] bg-white/4 border border-white/8 rounded-xl px-3 py-2.5">
            <Info className="w-3.5 h-3.5 mt-px shrink-0 text-sky-400" aria-hidden />
            <span className="leading-relaxed">
              {canAuto
                ? 'Esta plataforma publica automáticamente una vez conectada la cuenta.'
                : 'Esta plataforma no permite publicación automática. La producción quedará lista y avisaremos a quien publica.'}
            </span>
          </p>

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
              Crear destino
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

// --- Date helpers -----------------------------------------------------------

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

interface GridDay {
  key: string;
  dayNumber: number;
  inMonth: boolean;
  isToday: boolean;
  entries: Array<{ entry: CalendarEntry; production: Production | null }>;
}

/** Monday-first grid, with entries bucketed by their date in the church timezone. */
function buildMonthGrid(
  cursor: Date,
  timezone: string,
  entries: Array<{ entry: CalendarEntry; production: Production | null }>,
): GridDay[] {
  const first = startOfMonth(cursor);
  const last = endOfMonth(cursor);
  const leading = (first.getDay() + 6) % 7;

  const byDay = new Map<string, Array<{ entry: CalendarEntry; production: Production | null }>>();
  const keyFormatter = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: timezone,
  });
  for (const item of entries) {
    const key = keyFormatter.format(new Date(item.entry.scheduledFor));
    const bucket = byDay.get(key) ?? [];
    bucket.push(item);
    byDay.set(key, bucket);
  }

  const todayKey = keyFormatter.format(new Date());
  const days: GridDay[] = [];

  for (let index = 0; index < leading; index += 1) {
    const date = new Date(first);
    date.setDate(date.getDate() - (leading - index));
    days.push({
      key: `lead-${index}`,
      dayNumber: date.getDate(),
      inMonth: false,
      isToday: false,
      entries: [],
    });
  }

  for (let day = 1; day <= last.getDate(); day += 1) {
    const date = new Date(cursor.getFullYear(), cursor.getMonth(), day);
    const key = keyFormatter.format(date);
    days.push({
      key,
      dayNumber: day,
      inMonth: true,
      isToday: key === todayKey,
      entries: byDay.get(key) ?? [],
    });
  }

  while (days.length % 7 !== 0) {
    days.push({
      key: `trail-${days.length}`,
      dayNumber: days.length % 7,
      inMonth: false,
      isToday: false,
      entries: [],
    });
  }

  return days;
}

function defaultSundayMorning(): string {
  const date = new Date();
  const daysUntilSunday = (7 - date.getDay()) % 7 || 7;
  date.setDate(date.getDate() + daysUntilSunday);
  date.setHours(10, 0, 0, 0);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}
