import { useCallback, useEffect, useState } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  ListTodo,
  Radio,
  Send,
  Sparkles,
} from 'lucide-react';
import { PRODUCTION_STATUS_LABELS } from '@creator-ai-studio/shared';
import { decideApproval, fetchToday, type TodayResponse } from '../api';
import { useChurch } from '../ChurchContext';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  FormatBadge,
  LiveStatusPill,
  LoadingState,
  SectionHeader,
  StatusPill,
  formatDateTime,
  formatRelative,
} from '../components/primitives';

/**
 * "Hoy" — the landing screen.
 *
 * Ordered by what the person opening the app can act on right now: my work
 * first, then what is waiting on me, then what happens next. A volunteer should
 * be able to answer "what do I do?" without clicking anything.
 */

interface TodayViewProps {
  onOpenProduction: (id: string) => void;
  onGoToLive: () => void;
  onGoToCalendar: () => void;
  onGoToProductions: () => void;
}

export default function TodayView({
  onOpenProduction,
  onGoToLive,
  onGoToCalendar,
  onGoToProductions,
}: TodayViewProps) {
  const { church, member, can, nameOf } = useChurch();
  const [data, setData] = useState<TodayResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [decidingId, setDecidingId] = useState<string | null>(null);

  const timezone = church?.timezone ?? 'America/Bogota';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchToday());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la pantalla de hoy');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDecide = async (approvalId: string, decision: 'aprobado' | 'cambios') => {
    setDecidingId(approvalId);
    try {
      await decideApproval(approvalId, decision);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar la decisión');
    } finally {
      setDecidingId(null);
    }
  };

  if (loading && !data) return <LoadingState label="Preparando tu día…" />;
  if (error && !data) return <ErrorState message={error} onRetry={() => void load()} />;
  if (!data) return null;

  const greeting = buildGreeting(member?.displayName ?? member?.title);
  const hasAnything =
    data.assignedToMe.length > 0 ||
    data.pendingApprovals.length > 0 ||
    data.upcomingPublications.length > 0 ||
    data.upcomingLiveEvents.length > 0;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold text-white">{greeting}</h1>
        <p className="text-sm text-[#A9B4C0] mt-1">
          {hasAnything
            ? 'Esto es lo que está en tu mesa hoy.'
            : 'Hoy no tienes nada pendiente. Buen momento para adelantar trabajo.'}
        </p>
      </header>

      {error && (
        <p className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2.5">
          {error}
        </p>
      )}

      {/* Approvals go first for whoever can act on them: someone is blocked. */}
      {can('production.approve') && data.pendingApprovals.length > 0 && (
        <Card className="p-5 border-amber-400/20 bg-amber-500/[0.04]">
          <SectionHeader
            icon={ClipboardCheck}
            title={`${data.pendingApprovals.length} ${
              data.pendingApprovals.length === 1 ? 'producción espera' : 'producciones esperan'
            } tu aprobación`}
            description="Alguien no puede avanzar hasta que decidas."
          />
          <ul className="space-y-2.5">
            {data.pendingApprovals.map(({ approval, production }) => (
              <li
                key={approval.id}
                className="flex flex-wrap items-center gap-3 bg-[#0B0F14] border border-white/8 rounded-xl p-3.5"
              >
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => production && onOpenProduction(production.id)}
                    className="text-sm font-semibold text-white hover:text-indigo-300 transition-colors cursor-pointer text-left truncate block max-w-full"
                  >
                    {production?.title ?? 'Producción eliminada'}
                  </button>
                  <p className="text-[11px] text-[#7C8794] mt-0.5">
                    Pedido por {nameOf(approval.requestedBy)} · {formatRelative(approval.createdAt)}
                  </p>
                  {approval.comment && (
                    <p className="text-xs text-[#A9B4C0] mt-1.5 italic">“{approval.comment}”</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="ghost"
                    onClick={() => void handleDecide(approval.id, 'cambios')}
                    loading={decidingId === approval.id}
                  >
                    Pedir cambios
                  </Button>
                  <Button
                    variant="primary"
                    icon={CheckCircle2}
                    onClick={() => void handleDecide(approval.id, 'aprobado')}
                    loading={decidingId === approval.id}
                  >
                    Aprobar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <SectionHeader
            icon={ListTodo}
            title="Mi trabajo"
            description="Producciones donde alguien te asignó."
            action={
              <Button variant="ghost" onClick={onGoToProductions}>
                Ver todas
              </Button>
            }
          />
          {data.assignedToMe.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="No tienes nada asignado"
              description="Cuando el equipo te asigne un sermón, un clip o un anuncio, aparecerá aquí."
              action={
                can('production.create') ? (
                  <Button variant="secondary" onClick={onGoToProductions}>
                    Crear una producción
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <ul className="space-y-2">
              {data.assignedToMe.map(production => (
                <li key={production.id}>
                  <button
                    type="button"
                    onClick={() => onOpenProduction(production.id)}
                    className="w-full flex items-center gap-3 min-h-11 text-left bg-[#0B0F14] hover:bg-white/5 border border-white/8 rounded-xl px-3.5 py-3 transition-colors duration-150 cursor-pointer"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-white truncate">{production.title}</p>
                      <p className="text-[11px] text-[#7C8794] mt-0.5">
                        Actualizado {formatRelative(production.updatedAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <FormatBadge format={production.format} />
                      <StatusPill status={production.status} />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <SectionHeader
            icon={CalendarClock}
            title="Próximas publicaciones"
            description="Lo que sale en los próximos 14 días."
            action={
              <Button variant="ghost" onClick={onGoToCalendar}>
                Ver calendario
              </Button>
            }
          />
          {data.upcomingPublications.length === 0 ? (
            <EmptyState
              icon={Send}
              title="Nada programado"
              description="Programa una producción aprobada para que salga sola en su día y hora."
              action={
                can('production.publish') ? (
                  <Button variant="secondary" onClick={onGoToCalendar}>
                    Programar algo
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <ul className="space-y-2">
              {data.upcomingPublications.map(({ entry, production }) => (
                <li
                  key={entry.id}
                  className="flex items-center gap-3 bg-[#0B0F14] border border-white/8 rounded-xl px-3.5 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white truncate">
                      {production?.title ?? 'Evento en vivo'}
                    </p>
                    <p className="text-[11px] text-[#7C8794] mt-0.5">
                      {formatDateTime(entry.scheduledFor, timezone)}
                    </p>
                  </div>
                  {production && <StatusPill status={production.status} />}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <SectionHeader
            icon={Radio}
            title="Próximos en vivo"
            description="Cultos y transmisiones programadas."
            action={
              <Button variant="ghost" onClick={onGoToLive}>
                Ver En Vivo
              </Button>
            }
          />
          {data.upcomingLiveEvents.length === 0 ? (
            <EmptyState
              icon={Radio}
              title="Sin transmisiones programadas"
              description="Crea el evento del próximo culto para repartir puestos y armar el checklist."
              action={
                can('live.control') ? (
                  <Button variant="secondary" onClick={onGoToLive}>
                    Planear una transmisión
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <ul className="space-y-2">
              {data.upcomingLiveEvents.map(event => {
                const done = event.checklist.filter(item => item.done).length;
                return (
                  <li key={event.id}>
                    <button
                      type="button"
                      onClick={onGoToLive}
                      className="w-full flex items-center gap-3 min-h-11 text-left bg-[#0B0F14] hover:bg-white/5 border border-white/8 rounded-xl px-3.5 py-3 transition-colors duration-150 cursor-pointer"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-white truncate">{event.title}</p>
                        <p className="text-[11px] text-[#7C8794] mt-0.5">
                          {formatDateTime(event.scheduledAt, timezone)} · checklist {done}/
                          {event.checklist.length}
                        </p>
                      </div>
                      <LiveStatusPill status={event.status} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <SectionHeader
            icon={ClipboardCheck}
            title="En revisión"
            description="Esperando el visto bueno de un líder."
          />
          {data.inReview.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="Nada en revisión"
              description={`Cuando alguien mande una producción a ${PRODUCTION_STATUS_LABELS.revision}, aparecerá acá.`}
            />
          ) : (
            <ul className="space-y-2">
              {data.inReview.map(production => (
                <li key={production.id}>
                  <button
                    type="button"
                    onClick={() => onOpenProduction(production.id)}
                    className="w-full flex items-center gap-3 min-h-11 text-left bg-[#0B0F14] hover:bg-white/5 border border-white/8 rounded-xl px-3.5 py-3 transition-colors duration-150 cursor-pointer"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-white truncate">{production.title}</p>
                      <p className="text-[11px] text-[#7C8794] mt-0.5">
                        Esperando desde {formatRelative(production.updatedAt)}
                      </p>
                    </div>
                    <FormatBadge format={production.format} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function buildGreeting(name: string | undefined): string {
  const hour = new Date().getHours();
  const salutation = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
  const firstName = name?.trim().split(/\s+/)[0];
  return firstName ? `${salutation}, ${firstName}` : salutation;
}
