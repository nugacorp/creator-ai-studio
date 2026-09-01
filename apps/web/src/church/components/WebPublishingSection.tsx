import { useEffect, useState } from 'react';
import {
  canPublishOnWeb,
  isWebPublishable,
  PRODUCTION_VISIBILITIES,
  PRODUCTION_VISIBILITY_LABELS,
  slugifyProductionTitle,
  type Production,
  type ProductionStatus,
} from '@creator-ai-studio/shared';
import { Button } from './primitives';
import { inputClass, selectClass, textareaClass } from './primitives';

interface WebPublishingSectionProps {
  production: Production;
  canManage: boolean;
  onSave: (input: Record<string, unknown>) => Promise<void>;
  busy: boolean;
}

/**
 * Bloque "Sitio web" dentro del detalle de producción.
 *
 * Concentra todos los campos del modelo público del Church Public Portal V1:
 *   - visibility (interna / equipo / pública)
 *   - showOnLanding (toggle)
 *   - publicTitle / publicSummary
 *   - watchUrl
 *   - coverAssetId (placeholder V1.1; el selector real del DAM se monta en V1.1)
 *   - publishedAt / expiresAt
 *
 * El slug se autogenera al activar visibilidad pública si está vacío.
 *
 * Permisos:
 *   - `production.publish` requerido para editar estos campos.
 *   - Solo se permite activar visibilidad pública si el status es 'aprobado'
 *     o 'publicado'. Para status anteriores el formulario aparece deshabilitado
 *     con el motivo.
 */
export default function WebPublishingSection({
  production,
  canManage,
  onSave,
  busy,
}: WebPublishingSectionProps) {
  const [visibility, setVisibility] = useState(production.visibility ?? 'interna');
  const [showOnLanding, setShowOnLanding] = useState(production.showOnLanding ?? false);
  const [publicTitle, setPublicTitle] = useState(production.publicTitle ?? '');
  const [publicSummary, setPublicSummary] = useState(production.publicSummary ?? '');
  const [watchUrl, setWatchUrl] = useState(production.watchUrl ?? '');
  const [publishedAt, setPublishedAt] = useState(production.publishedAt ?? '');
  const [expiresAt, setExpiresAt] = useState(production.expiresAt ?? '');

  useEffect(() => {
    setVisibility(production.visibility ?? 'interna');
    setShowOnLanding(production.showOnLanding ?? false);
    setPublicTitle(production.publicTitle ?? '');
    setPublicSummary(production.publicSummary ?? '');
    setWatchUrl(production.watchUrl ?? '');
    setPublishedAt(production.publishedAt ?? '');
    setExpiresAt(production.expiresAt ?? '');
  }, [production.id, production.visibility, production.showOnLanding, production.publicTitle, production.publicSummary, production.watchUrl, production.publishedAt, production.expiresAt]);

  const statusPublishable = canPublishOnWeb(production.status as ProductionStatus);
  const readyToPublish = isWebPublishable({
    status: production.status as ProductionStatus,
    watchUrl: watchUrl || undefined,
    coverAssetId: production.coverAssetId,
  });
  const willBePublic = showOnLanding && visibility === 'publica';
  const effectiveDate = publishedAt ? new Date(publishedAt) : null;
  const visibleFromNow = willBePublic && (!effectiveDate || effectiveDate.getTime() <= Date.now());

  if (!canManage) {
    return (
      <section>
        <h3 className="text-xs font-bold uppercase tracking-wide text-[#A9B4C0] mb-3">
          Sitio web
        </h3>
        {willBePublic ? (
          <p className="text-sm text-[#A9B4C0]">
            {production.publicTitle || production.title} — visible en el portal
            {visibleFromNow ? ' ahora' : effectiveDate ? ` desde ${effectiveDate.toLocaleDateString('es-CO')}` : ' (pendiente de fecha)'}.
          </p>
        ) : (
          <p className="text-xs text-[#7C8794]">
            Esta producción no se muestra en el sitio web.
          </p>
        )}
      </section>
    );
  }

  return (
    <section>
      <h3 className="text-xs font-bold uppercase tracking-wide text-[#A9B4C0] mb-3">
        Sitio web
      </h3>
      {!statusPublishable && (
        <p className="text-xs text-[#7C8794] mb-3">
          Solo puedes publicar en el sitio web cuando el estado sea "Aprobado" o "Publicado".
        </p>
      )}
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm text-white">
          <input
            type="checkbox"
            checked={showOnLanding}
            disabled={!statusPublishable}
            onChange={event => setShowOnLanding(event.target.checked)}
            className="w-4 h-4 accent-indigo-500 cursor-pointer"
          />
          Mostrar en el sitio web
        </label>

        <div>
          <label className="block text-xs text-[#A9B4C0] mb-1">Visibilidad</label>
          <select
            value={visibility}
            disabled={!statusPublishable}
            onChange={event =>
              setVisibility(event.target.value as (typeof PRODUCTION_VISIBILITIES)[number])
            }
            className={selectClass}
          >
            {PRODUCTION_VISIBILITIES.map(option => (
              <option key={option} value={option}>
                {PRODUCTION_VISIBILITY_LABELS[option]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-[#A9B4C0] mb-1">Título público</label>
          <input
            value={publicTitle}
            disabled={!statusPublishable}
            onChange={event => setPublicTitle(event.target.value)}
            className={inputClass}
            placeholder={production.title}
          />
        </div>

        <div>
          <label className="block text-xs text-[#A9B4C0] mb-1">Resumen público</label>
          <textarea
            value={publicSummary}
            rows={3}
            disabled={!statusPublishable}
            onChange={event => setPublicSummary(event.target.value)}
            className={textareaClass}
            placeholder="Resumen que verá el visitante en la landing."
          />
        </div>

        <div>
          <label className="block text-xs text-[#A9B4C0] mb-1">
            Enlace del video (YouTube/Facebook)
          </label>
          <input
            value={watchUrl}
            disabled={!statusPublishable}
            onChange={event => setWatchUrl(event.target.value)}
            className={inputClass}
            placeholder="https://www.youtube.com/watch?v=..."
          />
          <p className="text-[10px] text-[#7C8794] mt-1">
            El video se incrusta desde YouTube/Facebook; el VPS nunca sirve video.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-[#A9B4C0] mb-1">Publicar el</label>
            <input
              type="datetime-local"
              value={
                publishedAt
                  ? new Date(publishedAt).toISOString().slice(0, 16)
                  : ''
              }
              disabled={!statusPublishable}
              onChange={event =>
                setPublishedAt(event.target.value ? new Date(event.target.value).toISOString() : '')
              }
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs text-[#A9B4C0] mb-1">Expira</label>
            <input
              type="datetime-local"
              value={
                expiresAt ? new Date(expiresAt).toISOString().slice(0, 16) : ''
              }
              disabled={!statusPublishable}
              onChange={event =>
                setExpiresAt(event.target.value ? new Date(event.target.value).toISOString() : '')
              }
              className={inputClass}
            />
          </div>
        </div>

        {production.slug && (
          <p className="text-[10px] text-[#7C8794]">
            Dirección: <span className="font-mono">/mensajes/{production.slug}</span>
          </p>
        )}

        <Button
          variant="secondary"
          loading={busy}
          disabled={!statusPublishable}
          onClick={() =>
            void onSave({
              visibility,
              showOnLanding,
              publicTitle: publicTitle.trim() || undefined,
              publicSummary: publicSummary.trim() || undefined,
              watchUrl: watchUrl.trim() || undefined,
              publishedAt: publishedAt || null,
              expiresAt: expiresAt || null,
              slug: production.slug ?? slugifyProductionTitle(production.title),
            })
          }
        >
          Guardar configuración web
        </Button>

        {!readyToPublish && statusPublishable && (
          <p className="text-[11px] text-amber-300/80">
            Para que aparezca necesitas un enlace de video o una portada.
          </p>
        )}
        {willBePublic && (
          <p className="text-[11px] text-[#A9B4C0]">
            {visibleFromNow
              ? 'Visible en el sitio desde ahora.'
              : effectiveDate
                ? `Visible en el sitio desde el ${effectiveDate.toLocaleDateString('es-CO')}.`
                : 'Indica una fecha de publicación.'}
          </p>
        )}
      </div>
    </section>
  );
}
