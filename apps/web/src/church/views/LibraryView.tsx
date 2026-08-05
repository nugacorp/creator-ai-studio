import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Download,
  FileText,
  Film,
  Image as ImageIcon,
  LayoutTemplate,
  Music,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { ASSET_KINDS, type Asset, type AssetKind } from '@creator-ai-studio/shared';
import {
  deleteAsset,
  downloadAsset,
  fetchAssets,
  fetchAssetsSummary,
  loadAssetThumbnail,
  updateAsset,
  uploadAsset,
  type AssetQuery,
  type AssetsSummary,
} from '../api';
import { useChurch } from '../ChurchContext';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  PermissionNotice,
  StatTile,
  formatBytes,
  formatDate,
  inputClass,
  selectClass,
} from '../components/primitives';

/**
 * "Biblioteca" — the DAM (WO-1).
 *
 * The screen the team touches every day, so it optimizes for two motions:
 * dropping a file in, and finding a file again. Everything else is secondary.
 */

const KIND_LABELS: Record<AssetKind, string> = {
  video: 'Video',
  audio: 'Audio',
  image: 'Imagen',
  document: 'Documento',
  template: 'Plantilla',
};

const KIND_ICONS: Record<AssetKind, typeof Film> = {
  video: Film,
  audio: Music,
  image: ImageIcon,
  document: FileText,
  template: LayoutTemplate,
};

export default function LibraryView() {
  const { church, ministries, can, nameOf } = useChurch();
  const timezone = church?.timezone ?? 'America/Bogota';

  const [assets, setAssets] = useState<Asset[]>([]);
  const [summary, setSummary] = useState<AssetsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<AssetQuery>({});
  const [searchInput, setSearchInput] = useState('');
  const [selected, setSelected] = useState<Asset | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const load = useCallback(async (query: AssetQuery) => {
    setLoading(true);
    setError(null);
    try {
      const [items, stats] = await Promise.all([fetchAssets(query), fetchAssetsSummary()]);
      setAssets(items);
      setSummary(stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la biblioteca');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(filters);
  }, [load, filters]);

  // Debounce the text box so typing "Romanos" is one query, not seven.
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters(prev =>
        (prev.search ?? '') === searchInput.trim()
          ? prev
          : { ...prev, search: searchInput.trim() || undefined },
      );
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const activeFilterCount = useMemo(
    () => Object.values(filters).filter(Boolean).length,
    [filters],
  );

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setPendingFile(file);
    setUploadOpen(true);
  };

  const handleDelete = async (asset: Asset) => {
    if (!window.confirm(`¿Eliminar "${asset.name}" y todos sus archivos? No se puede deshacer.`)) {
      return;
    }
    try {
      await deleteAsset(asset.id);
      setSelected(null);
      await load(filters);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar');
    }
  };

  return (
    <div
      className="space-y-6"
      onDragOver={event => {
        if (!can('asset.upload')) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={event => {
        if (event.currentTarget === event.target) setDragging(false);
      }}
      onDrop={event => {
        if (!can('asset.upload')) return;
        event.preventDefault();
        setDragging(false);
        handleFiles(event.dataTransfer.files);
      }}
    >
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Biblioteca</h1>
          <p className="text-sm text-[#A9B4C0] mt-1">
            Todo el material del equipo en un solo lugar. Arrastra un archivo a esta pantalla para
            subirlo.
          </p>
        </div>
        {can('asset.upload') && (
          <Button variant="primary" icon={Upload} onClick={() => setUploadOpen(true)}>
            Subir material
          </Button>
        )}
      </header>

      {summary && (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <StatTile label="Archivos" value={summary.totalAssets} />
          <StatTile label="Espacio usado" value={formatBytes(summary.totalBytes)} />
          <StatTile label="Videos" value={summary.byKind.video?.count ?? 0} />
          <StatTile label="Imágenes" value={summary.byKind.image?.count ?? 0} />
        </div>
      )}

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7C8794]"
              aria-hidden
            />
            <label htmlFor="library-search" className="sr-only">
              Buscar en la biblioteca
            </label>
            <input
              id="library-search"
              type="search"
              value={searchInput}
              onChange={event => setSearchInput(event.target.value)}
              placeholder="Buscar por título, predicador, serie o cita bíblica…"
              className={`${inputClass} pl-9`}
            />
          </div>

          <select
            aria-label="Filtrar por tipo"
            value={filters.kind ?? ''}
            onChange={event =>
              setFilters(prev => ({
                ...prev,
                kind: (event.target.value || undefined) as AssetKind | undefined,
              }))
            }
            className={selectClass}
          >
            <option value="">Todos los tipos</option>
            {ASSET_KINDS.map(kind => (
              <option key={kind} value={kind}>
                {KIND_LABELS[kind]}
              </option>
            ))}
          </select>

          <select
            aria-label="Filtrar por ministerio"
            value={filters.ministryId ?? ''}
            onChange={event =>
              setFilters(prev => ({ ...prev, ministryId: event.target.value || undefined }))
            }
            className={selectClass}
          >
            <option value="">Todos los ministerios</option>
            {ministries.map(ministry => (
              <option key={ministry.id} value={ministry.id}>
                {ministry.name}
              </option>
            ))}
          </select>

          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              icon={X}
              onClick={() => {
                setFilters({});
                setSearchInput('');
              }}
            >
              Limpiar
            </Button>
          )}
        </div>
      </Card>

      {error && <ErrorState message={error} onRetry={() => void load(filters)} />}

      {loading ? (
        <LoadingState label="Buscando material…" />
      ) : assets.length === 0 ? (
        <Card>
          <EmptyState
            icon={Upload}
            title={activeFilterCount > 0 ? 'Nada coincide con esa búsqueda' : 'La biblioteca está vacía'}
            description={
              activeFilterCount > 0
                ? 'Prueba con menos filtros o con otra palabra: buscamos en el título, la serie, el predicador, la cita y las etiquetas.'
                : 'Sube el primer sermón, foto o plantilla. Arrastra el archivo aquí o usa el botón de arriba.'
            }
            action={
              can('asset.upload') ? (
                <Button variant="primary" icon={Upload} onClick={() => setUploadOpen(true)}>
                  Subir el primero
                </Button>
              ) : (
                <PermissionNotice message="Tu rol permite ver la biblioteca, pero no subir archivos." />
              )
            }
          />
        </Card>
      ) : (
        <ul className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {assets.map(asset => (
            <AssetCard
              key={asset.id}
              asset={asset}
              timezone={timezone}
              onOpen={() => setSelected(asset)}
            />
          ))}
        </ul>
      )}

      {dragging && can('asset.upload') && (
        <div className="fixed inset-0 z-40 bg-[#0B0F14]/85 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="border-2 border-dashed border-indigo-400/60 rounded-3xl px-12 py-16 text-center">
            <Upload className="w-10 h-10 text-indigo-400 mx-auto mb-3" aria-hidden />
            <p className="font-display text-lg font-bold text-white">Suelta el archivo aquí</p>
            <p className="text-sm text-[#A9B4C0] mt-1">Lo subimos y le sacamos la miniatura solos.</p>
          </div>
        </div>
      )}

      {uploadOpen && (
        <UploadDialog
          initialFile={pendingFile}
          onClose={() => {
            setUploadOpen(false);
            setPendingFile(null);
          }}
          onUploaded={async () => {
            setUploadOpen(false);
            setPendingFile(null);
            await load(filters);
          }}
        />
      )}

      {selected && (
        <AssetDetailPanel
          asset={selected}
          timezone={timezone}
          canDelete={can('asset.delete')}
          canEdit={can('asset.upload')}
          nameOf={nameOf}
          onClose={() => setSelected(null)}
          onDelete={() => void handleDelete(selected)}
          onSaved={async updated => {
            setSelected(updated);
            await load(filters);
          }}
        />
      )}
    </div>
  );
}

function AssetCard({
  asset,
  timezone,
  onOpen,
}: {
  asset: Asset;
  timezone: string;
  onOpen: () => void;
}) {
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const Icon = KIND_ICONS[asset.kind];

  useEffect(() => {
    let objectUrl: string | null = null;
    let active = true;

    void loadAssetThumbnail(asset.id).then(url => {
      if (!active) {
        if (url) URL.revokeObjectURL(url);
        return;
      }
      objectUrl = url;
      setThumbnail(url);
    });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [asset.id]);

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="group w-full text-left bg-[#15191E] border border-white/6 hover:border-indigo-500/40 rounded-2xl overflow-hidden transition-colors duration-150 cursor-pointer"
      >
        {/* Fixed aspect ratio reserves the space before the image loads (no CLS). */}
        <div className="aspect-video bg-[#0B0F14] flex items-center justify-center overflow-hidden">
          {thumbnail ? (
            <img
              src={thumbnail}
              alt=""
              loading="lazy"
              className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-200"
            />
          ) : (
            <Icon className="w-8 h-8 text-slate-600" aria-hidden />
          )}
        </div>
        <div className="p-3.5">
          <p className="text-sm font-semibold text-white truncate">{asset.name}</p>
          <p className="text-[11px] text-[#7C8794] mt-1 truncate">
            {KIND_LABELS[asset.kind]} · {formatBytes(asset.sizeBytes)}
            {asset.currentVersion > 1 && ` · v${asset.currentVersion}`}
          </p>
          {(asset.preacher || asset.bibleRef) && (
            <p className="text-[11px] text-[#A9B4C0] mt-1.5 truncate">
              {[asset.preacher, asset.bibleRef].filter(Boolean).join(' · ')}
            </p>
          )}
          {asset.serviceDate && (
            <p className="text-[10px] text-[#7C8794] mt-1">
              {formatDate(asset.serviceDate, timezone)}
            </p>
          )}
        </div>
      </button>
    </li>
  );
}

function UploadDialog({
  initialFile,
  onClose,
  onUploaded,
}: {
  initialFile: File | null;
  onClose: () => void;
  onUploaded: () => Promise<void>;
}) {
  const { ministries } = useChurch();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(initialFile);
  const [name, setName] = useState(initialFile?.name ?? '');
  const [kind, setKind] = useState<AssetKind | ''>('');
  const [ministryId, setMinistryId] = useState('');
  const [series, setSeries] = useState('');
  const [preacher, setPreacher] = useState('');
  const [bibleRef, setBibleRef] = useState('');
  const [serviceDate, setServiceDate] = useState('');
  const [tags, setTags] = useState('');
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!file) {
      setError('Elige un archivo para subir');
      return;
    }
    setError(null);
    setProgress(0);
    try {
      await uploadAsset(
        {
          file,
          name: name.trim() || file.name,
          ...(kind ? { kind } : {}),
          ...(ministryId ? { ministryId } : {}),
          ...(series.trim() ? { series: series.trim() } : {}),
          ...(preacher.trim() ? { preacher: preacher.trim() } : {}),
          ...(bibleRef.trim() ? { bibleRef: bibleRef.trim() } : {}),
          ...(serviceDate ? { serviceDate } : {}),
          ...(tags.trim() ? { tags: tags.split(',').map(t => t.trim()).filter(Boolean) } : {}),
        },
        setProgress,
      );
      await onUploaded();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo subir el archivo');
      setProgress(null);
    }
  };

  const uploading = progress !== null;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0B0F14]/85 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-title"
    >
      <Card className="w-full max-w-lg p-5 my-8">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 id="upload-title" className="font-display text-lg font-bold text-white">
              Subir material
            </h2>
            <p className="text-xs text-[#A9B4C0] mt-1">
              Solo el archivo es obligatorio. Lo demás ayuda a encontrarlo después.
            </p>
          </div>
          <Button variant="ghost" icon={X} compact onClick={onClose} disabled={uploading}>
            Cerrar
          </Button>
        </div>

        <div className="space-y-4">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="w-full border-2 border-dashed border-white/12 hover:border-indigo-500/50 rounded-2xl px-4 py-6 text-center transition-colors duration-150 cursor-pointer disabled:cursor-not-allowed"
          >
            <Upload className="w-6 h-6 text-slate-400 mx-auto mb-2" aria-hidden />
            {file ? (
              <>
                <p className="text-sm font-semibold text-white truncate">{file.name}</p>
                <p className="text-[11px] text-[#7C8794] mt-0.5">{formatBytes(file.size)}</p>
              </>
            ) : (
              <p className="text-sm text-[#A9B4C0]">Elige un archivo del computador</p>
            )}
          </button>
          <input
            ref={inputRef}
            type="file"
            className="sr-only"
            onChange={event => {
              const chosen = event.target.files?.[0] ?? null;
              setFile(chosen);
              if (chosen && !name.trim()) setName(chosen.name);
            }}
          />

          <Field label="Nombre" htmlFor="asset-name" hint="Como lo va a buscar el equipo.">
            <input
              id="asset-name"
              value={name}
              onChange={event => setName(event.target.value)}
              className={inputClass}
              disabled={uploading}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tipo" htmlFor="asset-kind" hint="Si lo dejas vacío, lo detectamos.">
              <select
                id="asset-kind"
                value={kind}
                onChange={event => setKind(event.target.value as AssetKind | '')}
                className={selectClass}
                disabled={uploading}
              >
                <option value="">Detectar automáticamente</option>
                {ASSET_KINDS.map(option => (
                  <option key={option} value={option}>
                    {KIND_LABELS[option]}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Ministerio" htmlFor="asset-ministry">
              <select
                id="asset-ministry"
                value={ministryId}
                onChange={event => setMinistryId(event.target.value)}
                className={selectClass}
                disabled={uploading}
              >
                <option value="">Sin ministerio</option>
                {ministries.map(ministry => (
                  <option key={ministry.id} value={ministry.id}>
                    {ministry.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Predicador" htmlFor="asset-preacher">
              <input
                id="asset-preacher"
                value={preacher}
                onChange={event => setPreacher(event.target.value)}
                className={inputClass}
                disabled={uploading}
              />
            </Field>

            <Field label="Cita bíblica" htmlFor="asset-bible" hint="Ej: Romanos 8:28">
              <input
                id="asset-bible"
                value={bibleRef}
                onChange={event => setBibleRef(event.target.value)}
                className={inputClass}
                disabled={uploading}
              />
            </Field>

            <Field label="Serie" htmlFor="asset-series">
              <input
                id="asset-series"
                value={series}
                onChange={event => setSeries(event.target.value)}
                className={inputClass}
                disabled={uploading}
              />
            </Field>

            <Field label="Fecha del servicio" htmlFor="asset-date">
              <input
                id="asset-date"
                type="date"
                value={serviceDate}
                onChange={event => setServiceDate(event.target.value)}
                className={inputClass}
                disabled={uploading}
              />
            </Field>
          </div>

          <Field label="Etiquetas" htmlFor="asset-tags" hint="Separadas por coma.">
            <input
              id="asset-tags"
              value={tags}
              onChange={event => setTags(event.target.value)}
              className={inputClass}
              disabled={uploading}
              placeholder="jóvenes, alabanza, bautismos"
            />
          </Field>

          {uploading && (
            <div>
              <div className="flex items-center justify-between text-[11px] text-[#A9B4C0] mb-1.5">
                <span>Subiendo…</span>
                <span className="tabular-nums">{progress}%</span>
              </div>
              <div
                className="h-1.5 bg-white/8 rounded-full overflow-hidden"
                role="progressbar"
                aria-valuenow={progress ?? 0}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="h-full bg-indigo-500 transition-[width] duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-[11px] text-[#7C8794] mt-2">
                No cierres esta ventana hasta que termine.
              </p>
            </div>
          )}

          {error && (
            <p className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2.5">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={onClose} disabled={uploading}>
              Cancelar
            </Button>
            <Button variant="primary" icon={Upload} onClick={() => void submit()} loading={uploading}>
              Subir
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function AssetDetailPanel({
  asset,
  timezone,
  canDelete,
  canEdit,
  nameOf,
  onClose,
  onDelete,
  onSaved,
}: {
  asset: Asset;
  timezone: string;
  canDelete: boolean;
  canEdit: boolean;
  nameOf: (userId: string | undefined) => string;
  onClose: () => void;
  onDelete: () => void;
  onSaved: (asset: Asset) => Promise<void>;
}) {
  const [name, setName] = useState(asset.name);
  const [preacher, setPreacher] = useState(asset.preacher ?? '');
  const [bibleRef, setBibleRef] = useState(asset.bibleRef ?? '');
  const [series, setSeries] = useState(asset.series ?? '');
  const [tags, setTags] = useState(asset.tags.join(', '));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const updated = await updateAsset(asset.id, {
        name: name.trim(),
        preacher: preacher.trim(),
        bibleRef: bibleRef.trim(),
        series: series.trim(),
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      });
      await onSaved(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0B0F14]/85 backdrop-blur-sm flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby="asset-detail-title"
      onClick={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside className="w-full max-w-md h-full bg-[#15191E] border-l border-white/8 overflow-y-auto">
        <div className="sticky top-0 bg-[#15191E] border-b border-white/8 px-5 py-4 flex items-start justify-between gap-3">
          <h2 id="asset-detail-title" className="font-display text-base font-bold text-white truncate">
            {asset.name}
          </h2>
          <Button variant="ghost" icon={X} compact onClick={onClose}>
            Cerrar
          </Button>
        </div>

        <div className="p-5 space-y-5">
          <dl className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <dt className="text-[#7C8794]">Tipo</dt>
              <dd className="text-white font-medium mt-0.5">{KIND_LABELS[asset.kind]}</dd>
            </div>
            <div>
              <dt className="text-[#7C8794]">Tamaño</dt>
              <dd className="text-white font-medium mt-0.5">{formatBytes(asset.sizeBytes)}</dd>
            </div>
            <div>
              <dt className="text-[#7C8794]">Versión</dt>
              <dd className="text-white font-medium mt-0.5">v{asset.currentVersion}</dd>
            </div>
            <div>
              <dt className="text-[#7C8794]">Subido por</dt>
              <dd className="text-white font-medium mt-0.5 truncate">{nameOf(asset.uploadedBy)}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-[#7C8794]">Subido el</dt>
              <dd className="text-white font-medium mt-0.5">
                {formatDate(asset.createdAt, timezone)}
              </dd>
            </div>
          </dl>

          <div className="flex gap-2">
            <Button
              variant="secondary"
              icon={Download}
              onClick={() => void downloadAsset(asset.id, asset.name)}
            >
              Descargar
            </Button>
            {canDelete && (
              <Button variant="danger" icon={Trash2} onClick={onDelete}>
                Eliminar
              </Button>
            )}
          </div>

          {asset.versions.length > 1 && (
            <div>
              <h3 className="text-xs font-semibold text-slate-200 mb-2">Versiones anteriores</h3>
              <ul className="space-y-1.5">
                {[...asset.versions]
                  .sort((a, b) => b.version - a.version)
                  .map(version => (
                    <li
                      key={version.version}
                      className="flex items-center justify-between text-[11px] bg-[#0B0F14] border border-white/8 rounded-lg px-3 py-2"
                    >
                      <span className="text-white font-medium">v{version.version}</span>
                      <span className="text-[#7C8794]">
                        {formatBytes(version.sizeBytes)} · {formatDate(version.uploadedAt, timezone)}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          )}

          {canEdit ? (
            <div className="space-y-4 pt-2 border-t border-white/8">
              <h3 className="text-xs font-semibold text-slate-200 pt-4">Editar datos</h3>
              <Field label="Nombre" htmlFor="edit-name">
                <input
                  id="edit-name"
                  value={name}
                  onChange={event => setName(event.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Predicador" htmlFor="edit-preacher">
                <input
                  id="edit-preacher"
                  value={preacher}
                  onChange={event => setPreacher(event.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Cita bíblica" htmlFor="edit-bible">
                <input
                  id="edit-bible"
                  value={bibleRef}
                  onChange={event => setBibleRef(event.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Serie" htmlFor="edit-series">
                <input
                  id="edit-series"
                  value={series}
                  onChange={event => setSeries(event.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Etiquetas" htmlFor="edit-tags" hint="Separadas por coma.">
                <input
                  id="edit-tags"
                  value={tags}
                  onChange={event => setTags(event.target.value)}
                  className={inputClass}
                />
              </Field>

              {error && (
                <p className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2.5">
                  {error}
                </p>
              )}

              <Button variant="primary" onClick={() => void save()} loading={saving}>
                Guardar cambios
              </Button>
            </div>
          ) : (
            <PermissionNotice message="Tu rol permite ver y descargar, pero no editar los datos del archivo." />
          )}
        </div>
      </aside>
    </div>
  );
}
