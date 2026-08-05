import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  ClapperboardIcon,
  MessageSquare,
  Plus,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import {
  PRODUCTION_FORMATS,
  PRODUCTION_FORMAT_LABELS,
  PRODUCTION_STATUSES,
  PRODUCTION_STATUS_FLOW,
  PRODUCTION_STATUS_LABELS,
  PRODUCTION_STATUS_PERMISSION,
  type Production,
  type ProductionFormat,
  type ProductionStatus,
} from '@creator-ai-studio/shared';
import {
  addComment,
  createProduction,
  decideApproval,
  deleteProduction,
  fetchProduction,
  fetchProductions,
  moveProduction,
  updateProduction,
  type ProductionDetail,
} from '../api';
import { useChurch } from '../ChurchContext';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  FormatBadge,
  LoadingState,
  PermissionNotice,
  StatusPill,
  formatDate,
  formatRelative,
  inputClass,
  selectClass,
  textareaClass,
} from '../components/primitives';

/**
 * "Producciones" — the board (WO-2).
 *
 * Columns are the six lifecycle states. A card can only move where
 * PRODUCTION_STATUS_FLOW allows, and the two gates that matter — approval and
 * publication — are visibly closed to roles that lack them rather than failing
 * after the click.
 */

interface ProductionsViewProps {
  focusedProductionId: string | null;
  onFocusHandled: () => void;
}

export default function ProductionsView({
  focusedProductionId,
  onFocusHandled,
}: ProductionsViewProps) {
  const { church, ministries, can } = useChurch();
  const timezone = church?.timezone ?? 'America/Bogota';

  const [productions, setProductions] = useState<Production[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formatFilter, setFormatFilter] = useState<ProductionFormat | ''>('');
  const [ministryFilter, setMinistryFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(focusedProductionId);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProductions(
        await fetchProductions({
          ...(formatFilter ? { format: formatFilter } : {}),
          ...(ministryFilter ? { ministryId: ministryFilter } : {}),
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las producciones');
    } finally {
      setLoading(false);
    }
  }, [formatFilter, ministryFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (focusedProductionId) {
      setOpenId(focusedProductionId);
      onFocusHandled();
    }
  }, [focusedProductionId, onFocusHandled]);

  const columns = useMemo(
    () =>
      PRODUCTION_STATUSES.map(status => ({
        status,
        items: productions.filter(production => production.status === status),
      })),
    [productions],
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Producciones</h1>
          <p className="text-sm text-[#A9B4C0] mt-1">
            Cada sermón, clip o anuncio avanza de izquierda a derecha. Nadie publica sin la
            aprobación de un líder.
          </p>
        </div>
        {can('production.create') && (
          <Button variant="primary" icon={Plus} onClick={() => setCreateOpen(true)}>
            Nueva producción
          </Button>
        )}
      </header>

      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="filter-format" className="block text-xs font-semibold text-slate-200 mb-1.5">
              Formato
            </label>
            <select
              id="filter-format"
              value={formatFilter}
              onChange={event => setFormatFilter(event.target.value as ProductionFormat | '')}
              className={selectClass}
            >
              <option value="">Todos</option>
              {PRODUCTION_FORMATS.map(format => (
                <option key={format} value={format}>
                  {PRODUCTION_FORMAT_LABELS[format]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="filter-ministry"
              className="block text-xs font-semibold text-slate-200 mb-1.5"
            >
              Ministerio
            </label>
            <select
              id="filter-ministry"
              value={ministryFilter}
              onChange={event => setMinistryFilter(event.target.value)}
              className={selectClass}
            >
              <option value="">Todos</option>
              {ministries.map(ministry => (
                <option key={ministry.id} value={ministry.id}>
                  {ministry.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <p className="text-xs text-[#7C8794]">
              {productions.length} {productions.length === 1 ? 'producción' : 'producciones'}
            </p>
          </div>
        </div>
      </Card>

      {error && <ErrorState message={error} onRetry={() => void load()} />}

      {loading ? (
        <LoadingState label="Cargando el tablero…" />
      ) : productions.length === 0 ? (
        <Card>
          <EmptyState
            icon={ClapperboardIcon}
            title="Todavía no hay producciones"
            description="Una producción es cualquier cosa que el equipo prepara: el sermón del domingo, un reel, un anuncio. Crea la primera para empezar a seguirle el rastro."
            action={
              can('production.create') ? (
                <Button variant="primary" icon={Plus} onClick={() => setCreateOpen(true)}>
                  Crear la primera
                </Button>
              ) : (
                <PermissionNotice message="Tu rol puede ver el tablero, pero no crear producciones." />
              )
            }
          />
        </Card>
      ) : (
        // Horizontal scroll stays inside this container; the page never scrolls sideways.
        <div className="overflow-x-auto pb-2 -mx-1 px-1">
          <div className="flex gap-4 min-w-max">
            {columns.map(column => (
              <section key={column.status} className="w-72 shrink-0">
                <div className="flex items-center justify-between mb-3 px-1">
                  <h2 className="text-xs font-bold uppercase tracking-wide text-[#A9B4C0]">
                    {PRODUCTION_STATUS_LABELS[column.status]}
                  </h2>
                  <span className="text-[11px] text-[#7C8794] tabular-nums">
                    {column.items.length}
                  </span>
                </div>
                <ul className="space-y-2.5">
                  {column.items.length === 0 ? (
                    <li className="border border-dashed border-white/8 rounded-xl px-3 py-6 text-center">
                      <p className="text-[11px] text-[#7C8794]">Nada aquí</p>
                    </li>
                  ) : (
                    column.items.map(production => (
                      <li key={production.id}>
                        <button
                          type="button"
                          onClick={() => setOpenId(production.id)}
                          className="w-full text-left bg-[#15191E] hover:bg-[#1B2029] border border-white/6 hover:border-indigo-500/40 rounded-xl p-3.5 transition-colors duration-150 cursor-pointer"
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <FormatBadge format={production.format} />
                            {production.serviceDate && (
                              <span className="text-[10px] text-[#7C8794] shrink-0">
                                {formatDate(production.serviceDate, timezone)}
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-semibold text-white leading-snug">
                            {production.title}
                          </p>
                          {production.preacher && (
                            <p className="text-[11px] text-[#A9B4C0] mt-1.5 truncate">
                              {production.preacher}
                            </p>
                          )}
                          <p className="text-[10px] text-[#7C8794] mt-2">
                            {formatRelative(production.updatedAt)}
                          </p>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </section>
            ))}
          </div>
        </div>
      )}

      {createOpen && (
        <CreateProductionDialog
          onClose={() => setCreateOpen(false)}
          onCreated={async id => {
            setCreateOpen(false);
            await load();
            setOpenId(id);
          }}
        />
      )}

      {openId && (
        <ProductionPanel
          productionId={openId}
          onClose={() => setOpenId(null)}
          onChanged={() => void load()}
        />
      )}
    </div>
  );
}

function CreateProductionDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => Promise<void>;
}) {
  const { ministries } = useChurch();
  const [title, setTitle] = useState('');
  const [format, setFormat] = useState<ProductionFormat>('sermon');
  const [ministryId, setMinistryId] = useState('');
  const [serviceDate, setServiceDate] = useState('');
  const [preacher, setPreacher] = useState('');
  const [bibleRef, setBibleRef] = useState('');
  const [summary, setSummary] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!title.trim()) {
      setError('Ponle un título');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await createProduction({
        title: title.trim(),
        format,
        ...(ministryId ? { ministryId } : {}),
        ...(serviceDate ? { serviceDate } : {}),
        ...(preacher.trim() ? { preacher: preacher.trim() } : {}),
        ...(bibleRef.trim() ? { bibleRef: bibleRef.trim() } : {}),
        ...(summary.trim() ? { summary: summary.trim() } : {}),
      });
      await onCreated(created.id);
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
      aria-labelledby="create-production-title"
    >
      <Card className="w-full max-w-lg p-5 my-8">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 id="create-production-title" className="font-display text-lg font-bold text-white">
              Nueva producción
            </h2>
            <p className="text-xs text-[#A9B4C0] mt-1">
              Empieza en <strong className="text-white">Idea</strong>. Solo el título es obligatorio.
            </p>
          </div>
          <Button variant="ghost" icon={X} compact onClick={onClose} disabled={saving}>
            Cerrar
          </Button>
        </div>

        <div className="space-y-4">
          <Field label="Título" htmlFor="new-title">
            <input
              id="new-title"
              value={title}
              onChange={event => setTitle(event.target.value)}
              className={inputClass}
              placeholder="Sermón del domingo — Romanos 8"
              autoFocus
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Formato"
              htmlFor="new-format"
              hint="Define qué etapas necesita."
            >
              <select
                id="new-format"
                value={format}
                onChange={event => setFormat(event.target.value as ProductionFormat)}
                className={selectClass}
              >
                {PRODUCTION_FORMATS.map(option => (
                  <option key={option} value={option}>
                    {PRODUCTION_FORMAT_LABELS[option]}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Ministerio" htmlFor="new-ministry">
              <select
                id="new-ministry"
                value={ministryId}
                onChange={event => setMinistryId(event.target.value)}
                className={selectClass}
              >
                <option value="">Sin ministerio</option>
                {ministries.map(ministry => (
                  <option key={ministry.id} value={ministry.id}>
                    {ministry.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Predicador" htmlFor="new-preacher">
              <input
                id="new-preacher"
                value={preacher}
                onChange={event => setPreacher(event.target.value)}
                className={inputClass}
              />
            </Field>

            <Field label="Cita bíblica" htmlFor="new-bible">
              <input
                id="new-bible"
                value={bibleRef}
                onChange={event => setBibleRef(event.target.value)}
                className={inputClass}
                placeholder="Romanos 8:28"
              />
            </Field>
          </div>

          <Field label="Fecha del servicio" htmlFor="new-date">
            <input
              id="new-date"
              type="date"
              value={serviceDate}
              onChange={event => setServiceDate(event.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Notas" htmlFor="new-summary" hint="Contexto para quien lo tome después.">
            <textarea
              id="new-summary"
              rows={3}
              value={summary}
              onChange={event => setSummary(event.target.value)}
              className={textareaClass}
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

function ProductionPanel({
  productionId,
  onClose,
  onChanged,
}: {
  productionId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { church, members, can, nameOf } = useChurch();
  const timezone = church?.timezone ?? 'America/Bogota';

  const [detail, setDetail] = useState<ProductionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [script, setScript] = useState('');
  const [assignedTo, setAssignedTo] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchProduction(productionId);
      setDetail(next);
      setScript(next.production.script ?? '');
      setAssignedTo(next.production.assignedTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo abrir la producción');
    } finally {
      setLoading(false);
    }
  }, [productionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const production = detail?.production;

  const nextStates = useMemo(
    () => (production ? PRODUCTION_STATUS_FLOW[production.status] : []),
    [production],
  );

  const pendingApproval = detail?.approvals.find(approval => !approval.decision);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      await load();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo completar la acción');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!production) return;
    if (!window.confirm(`¿Eliminar "${production.title}"? No se puede deshacer.`)) return;
    setBusy(true);
    try {
      await deleteProduction(production.id);
      onChanged();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar');
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0B0F14]/85 backdrop-blur-sm flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby="production-panel-title"
      onClick={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside className="w-full max-w-2xl h-full bg-[#15191E] border-l border-white/8 overflow-y-auto">
        {loading && !detail ? (
          <LoadingState />
        ) : !production ? (
          <ErrorState message={error ?? 'No encontrada'} onRetry={() => void load()} />
        ) : (
          <>
            <div className="sticky top-0 z-10 bg-[#15191E] border-b border-white/8 px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2
                    id="production-panel-title"
                    className="font-display text-lg font-bold text-white"
                  >
                    {production.title}
                  </h2>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <StatusPill status={production.status} />
                    <FormatBadge format={production.format} />
                    {production.serviceDate && (
                      <span className="text-[11px] text-[#7C8794]">
                        {formatDate(production.serviceDate, timezone)}
                      </span>
                    )}
                  </div>
                </div>
                <Button variant="ghost" icon={X} compact onClick={onClose}>
                  Cerrar
                </Button>
              </div>
            </div>

            <div className="p-5 space-y-6">
              {error && (
                <p className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2.5">
                  {error}
                </p>
              )}

              {/* Moving the card is the primary action, so it sits at the top. */}
              <section>
                <h3 className="text-xs font-bold uppercase tracking-wide text-[#A9B4C0] mb-3">
                  Siguiente paso
                </h3>
                {nextStates.length === 0 ? (
                  <p className="text-xs text-[#A9B4C0] bg-white/4 border border-white/8 rounded-xl px-3 py-2.5">
                    Esta producción ya está publicada. No hay más pasos.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {nextStates.map(status => {
                      const needed = PRODUCTION_STATUS_PERMISSION[status];
                      const allowed = !needed || can(needed);
                      return (
                        <Button
                          key={status}
                          variant={status === 'publicado' ? 'primary' : 'secondary'}
                          icon={status === 'publicado' ? Send : ArrowRight}
                          disabled={!allowed || busy}
                          title={
                            allowed
                              ? undefined
                              : status === 'aprobado'
                                ? 'Solo un líder o administrador puede aprobar'
                                : 'Solo un líder o administrador puede publicar'
                          }
                          onClick={() => void run(() => moveProduction(production.id, status))}
                        >
                          {PRODUCTION_STATUS_LABELS[status]}
                        </Button>
                      );
                    })}
                  </div>
                )}
                {production.status === 'revision' && !can('production.approve') && (
                  <div className="mt-3">
                    <PermissionNotice message="Está esperando el visto bueno de un líder. Te avisamos cuando decida." />
                  </div>
                )}
              </section>

              {pendingApproval && can('production.approve') && (
                <Card className="p-4 border-amber-400/20 bg-amber-500/[0.04]">
                  <h3 className="text-sm font-bold text-white mb-1">Decide sobre esta producción</h3>
                  <p className="text-xs text-[#A9B4C0] mb-3">
                    Pedido por {nameOf(pendingApproval.requestedBy)} ·{' '}
                    {formatRelative(pendingApproval.createdAt)}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      disabled={busy}
                      onClick={() =>
                        void run(() => decideApproval(pendingApproval.id, 'cambios'))
                      }
                    >
                      Pedir cambios
                    </Button>
                    <Button
                      variant="primary"
                      icon={CheckCircle2}
                      disabled={busy}
                      onClick={() =>
                        void run(() => decideApproval(pendingApproval.id, 'aprobado'))
                      }
                    >
                      Aprobar
                    </Button>
                  </div>
                </Card>
              )}

              <section>
                <h3 className="text-xs font-bold uppercase tracking-wide text-[#A9B4C0] mb-3">
                  Responsables
                </h3>
                {can('production.edit_script') ? (
                  <div className="space-y-2">
                    {members.map(member => {
                      const checked = assignedTo.includes(member.userId);
                      return (
                        <label
                          key={member.id}
                          className="flex items-center gap-3 min-h-11 bg-[#0B0F14] border border-white/8 rounded-xl px-3.5 py-2.5 cursor-pointer hover:border-white/15 transition-colors duration-150"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            className="w-4 h-4 accent-indigo-500 cursor-pointer"
                            onChange={event => {
                              const next = event.target.checked
                                ? [...assignedTo, member.userId]
                                : assignedTo.filter(id => id !== member.userId);
                              setAssignedTo(next);
                              void run(() =>
                                updateProduction(production.id, { assignedTo: next }),
                              );
                            }}
                          />
                          <span className="text-sm text-white">
                            {member.displayName || member.title || member.email || 'Integrante'}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                ) : production.assignedTo.length === 0 ? (
                  <p className="text-xs text-[#7C8794]">Sin responsables asignados.</p>
                ) : (
                  <ul className="flex flex-wrap gap-2">
                    {production.assignedTo.map(userId => (
                      <li
                        key={userId}
                        className="text-xs text-white bg-white/6 border border-white/10 rounded-lg px-2.5 py-1"
                      >
                        {nameOf(userId)}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <h3 className="text-xs font-bold uppercase tracking-wide text-[#A9B4C0] mb-3">
                  Guion y notas
                </h3>
                {can('production.edit_script') ? (
                  <div className="space-y-3">
                    <textarea
                      rows={8}
                      value={script}
                      onChange={event => setScript(event.target.value)}
                      className={textareaClass}
                      placeholder="Bosquejo, guion o notas de producción…"
                      aria-label="Guion y notas"
                    />
                    <Button
                      variant="secondary"
                      loading={busy}
                      onClick={() => void run(() => updateProduction(production.id, { script }))}
                    >
                      Guardar guion
                    </Button>
                  </div>
                ) : production.script ? (
                  <p className="text-sm text-[#A9B4C0] whitespace-pre-wrap bg-[#0B0F14] border border-white/8 rounded-xl p-3.5 leading-relaxed">
                    {production.script}
                  </p>
                ) : (
                  <p className="text-xs text-[#7C8794]">Todavía no hay guion.</p>
                )}
              </section>

              <section>
                <h3 className="text-xs font-bold uppercase tracking-wide text-[#A9B4C0] mb-3">
                  Conversación
                </h3>
                {can('comment.write') && (
                  <div className="flex gap-2 mb-3">
                    <label htmlFor="new-comment" className="sr-only">
                      Escribe un comentario
                    </label>
                    <input
                      id="new-comment"
                      value={commentText}
                      onChange={event => setCommentText(event.target.value)}
                      onKeyDown={event => {
                        if (event.key === 'Enter' && commentText.trim()) {
                          void run(async () => {
                            await addComment(production.id, commentText.trim());
                            setCommentText('');
                          });
                        }
                      }}
                      className={inputClass}
                      placeholder="Escribe un comentario…"
                    />
                    <Button
                      variant="secondary"
                      icon={MessageSquare}
                      compact
                      disabled={!commentText.trim() || busy}
                      onClick={() =>
                        void run(async () => {
                          await addComment(production.id, commentText.trim());
                          setCommentText('');
                        })
                      }
                    >
                      Comentar
                    </Button>
                  </div>
                )}

                {detail.comments.length === 0 ? (
                  <p className="text-xs text-[#7C8794]">
                    Sin comentarios todavía. Úsalos para dejar contexto a quien siga.
                  </p>
                ) : (
                  <ul className="space-y-2.5">
                    {detail.comments.map(comment => (
                      <li
                        key={comment.id}
                        className="bg-[#0B0F14] border border-white/8 rounded-xl px-3.5 py-3"
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-xs font-semibold text-white">
                            {nameOf(comment.authorUserId)}
                          </span>
                          <span className="text-[10px] text-[#7C8794]">
                            {formatRelative(comment.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm text-[#A9B4C0] leading-relaxed whitespace-pre-wrap">
                          {comment.body}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {detail.approvals.length > 0 && (
                <section>
                  <h3 className="text-xs font-bold uppercase tracking-wide text-[#A9B4C0] mb-3">
                    Historial de aprobaciones
                  </h3>
                  <ul className="space-y-2">
                    {detail.approvals.map(approval => (
                      <li
                        key={approval.id}
                        className="flex items-start justify-between gap-3 bg-[#0B0F14] border border-white/8 rounded-xl px-3.5 py-3"
                      >
                        <div className="min-w-0">
                          <p className="text-xs text-white font-semibold">
                            {approval.decision === 'aprobado'
                              ? 'Aprobado'
                              : approval.decision === 'cambios'
                                ? 'Pidió cambios'
                                : 'Pendiente'}
                          </p>
                          <p className="text-[11px] text-[#7C8794] mt-0.5">
                            Pedido por {nameOf(approval.requestedBy)}
                            {approval.decidedBy && ` · Decidió ${nameOf(approval.decidedBy)}`}
                          </p>
                          {approval.comment && (
                            <p className="text-xs text-[#A9B4C0] mt-1.5 italic">
                              “{approval.comment}”
                            </p>
                          )}
                        </div>
                        <span className="text-[10px] text-[#7C8794] shrink-0">
                          {formatRelative(approval.decidedAt ?? approval.createdAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {can('asset.delete') && (
                <div className="pt-4 border-t border-white/8">
                  <Button variant="danger" icon={Trash2} onClick={() => void handleDelete()} disabled={busy}>
                    Eliminar producción
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
