import { useCallback, useState } from 'react';
import {
  CalendarDays,
  Church,
  Clapperboard,
  Library,
  Radio,
  Sun,
  Users2,
  X,
  type LucideIcon,
} from 'lucide-react';
import { CHURCH_ROLE_LABELS } from '@creator-ai-studio/shared';
import { createChurch } from './api';
import { useChurch } from './ChurchContext';
import {
  Button,
  Card,
  ErrorState,
  Field,
  LoadingState,
  inputClass,
} from './components/primitives';
import TodayView from './views/TodayView';
import LibraryView from './views/LibraryView';
import ProductionsView from './views/ProductionsView';
import LiveView from './views/LiveView';
import CalendarView from './views/CalendarView';
import TeamView from './views/TeamView';

/**
 * The six spaces (§8 of the plan). Thirteen sidebar entries became six because
 * a volunteer scanning a list of thirteen picks the wrong one.
 */
export const CHURCH_SPACES = [
  { id: 'today', label: 'Hoy', icon: Sun, hint: 'Lo que te toca' },
  { id: 'library', label: 'Biblioteca', icon: Library, hint: 'Todo el material' },
  { id: 'productions', label: 'Producciones', icon: Clapperboard, hint: 'El trabajo en curso' },
  { id: 'live', label: 'En Vivo', icon: Radio, hint: 'Cultos y transmisiones' },
  { id: 'calendar', label: 'Calendario', icon: CalendarDays, hint: 'Qué sale y cuándo' },
  { id: 'team', label: 'Equipo', icon: Users2, hint: 'Personas y permisos' },
] as const satisfies ReadonlyArray<{
  id: string;
  label: string;
  icon: LucideIcon;
  hint: string;
}>;

export type ChurchSpaceId = (typeof CHURCH_SPACES)[number]['id'];

export function isChurchSpace(value: string): value is ChurchSpaceId {
  return CHURCH_SPACES.some(space => space.id === value);
}

interface ChurchShellProps {
  space: ChurchSpaceId;
  onNavigate: (space: ChurchSpaceId) => void;
}

export default function ChurchShell({ space, onNavigate }: ChurchShellProps) {
  const { loading, configured, church, error, refresh } = useChurch();
  const [focusedProductionId, setFocusedProductionId] = useState<string | null>(null);

  const openProduction = useCallback(
    (id: string) => {
      setFocusedProductionId(id);
      onNavigate('productions');
    },
    [onNavigate],
  );

  if (loading) return <LoadingState label="Cargando tu iglesia…" />;

  if (!configured) {
    return (
      <Card className="p-6">
        <ErrorState
          message="La plataforma de iglesia necesita Supabase configurado (SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY en el servidor)."
          onRetry={() => void refresh()}
        />
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <ErrorState message={error} onRetry={() => void refresh()} />
      </Card>
    );
  }

  if (!church) return <ChurchOnboarding />;

  switch (space) {
    case 'today':
      return (
        <TodayView
          onOpenProduction={openProduction}
          onGoToLive={() => onNavigate('live')}
          onGoToCalendar={() => onNavigate('calendar')}
          onGoToProductions={() => onNavigate('productions')}
        />
      );
    case 'library':
      return <LibraryView />;
    case 'productions':
      return (
        <ProductionsView
          focusedProductionId={focusedProductionId}
          onFocusHandled={() => setFocusedProductionId(null)}
        />
      );
    case 'live':
      return <LiveView />;
    case 'calendar':
      return <CalendarView />;
    case 'team':
      return <TeamView />;
    default:
      return null;
  }
}

/**
 * First run. One screen, two fields, no wizard — the person doing this is
 * setting up a tool for their church on a Tuesday night, not configuring a CRM.
 */
function ChurchOnboarding() {
  const { refresh } = useChurch();
  const [name, setName] = useState('');
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Bogota',
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imported, setImported] = useState<number | null>(null);

  const submit = async () => {
    if (!name.trim()) {
      setError('Escribe el nombre de la iglesia');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await createChurch({ name: name.trim(), timezone });
      setImported(result.importedMembers);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la iglesia');
      setSaving(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto py-8">
      <Card className="p-6">
        <span className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center mb-4">
          <Church className="w-6 h-6 text-indigo-300" aria-hidden />
        </span>
        <h1 className="font-display text-xl font-bold text-white">Configura tu iglesia</h1>
        <p className="text-sm text-[#A9B4C0] mt-1.5 leading-relaxed">
          Es lo único que hay que hacer antes de empezar. Quedarás como administrador y podrás
          agregar al resto del equipo enseguida.
        </p>

        <div className="space-y-4 mt-6">
          <Field label="Nombre de la iglesia" htmlFor="onboarding-name">
            <input
              id="onboarding-name"
              value={name}
              onChange={event => setName(event.target.value)}
              className={inputClass}
              placeholder="Iglesia Cristiana Vida Nueva"
              autoFocus
            />
          </Field>

          <Field
            label="Zona horaria"
            htmlFor="onboarding-tz"
            hint="Todas las fechas del calendario se muestran en esta hora."
          >
            <input
              id="onboarding-tz"
              value={timezone}
              onChange={event => setTimezone(event.target.value)}
              className={inputClass}
            />
          </Field>

          {imported !== null && imported > 0 && (
            <p className="text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2.5">
              Se importaron {imported} integrantes del equipo anterior.
            </p>
          )}

          {error && (
            <p className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2.5">
              {error}
            </p>
          )}

          <Button variant="primary" icon={Church} onClick={() => void submit()} loading={saving}>
            Crear iglesia
          </Button>
        </div>
      </Card>
    </div>
  );
}

/** Sidebar for the six spaces. Replaces the thirteen-entry legacy nav. */
export function ChurchSidebar({
  space,
  onNavigate,
  mobileOpen,
  setMobileOpen,
  legacyFooter,
}: {
  space: string;
  onNavigate: (space: ChurchSpaceId) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  legacyFooter?: React.ReactNode;
}) {
  const { church, role } = useChurch();

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-[#0B0F14]/80 backdrop-blur-sm z-45 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 border-r border-white/5 bg-[#0B0F14] flex flex-col h-screen lg:sticky top-0 select-none shrink-0 transition-transform duration-200 ease-out lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="h-16 flex items-center justify-between px-5 border-b border-white/5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
              <Church className="w-4 h-4 text-white" aria-hidden />
            </div>
            <div className="min-w-0">
              <span className="font-display font-bold text-sm text-white block truncate">
                {church?.name ?? 'Estudio de la iglesia'}
              </span>
              {role && (
                <span className="text-[10px] text-[#7C8794] block">
                  {CHURCH_ROLE_LABELS[role]}
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            aria-label="Cerrar menú"
          >
            <X className="w-5 h-5" aria-hidden />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" aria-label="Navegación principal">
          {CHURCH_SPACES.map(item => {
            const Icon = item.icon;
            const isActive = space === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => {
                  onNavigate(item.id);
                  setMobileOpen(false);
                }}
                className={`w-full flex items-start gap-3 min-h-11 px-3 py-2.5 rounded-xl text-sm transition-colors duration-150 cursor-pointer text-left ${
                  isActive
                    ? 'bg-white/6 text-white font-semibold border border-white/10'
                    : 'text-[#A9B4C0] hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                <Icon
                  className={`w-4.5 h-4.5 mt-0.5 shrink-0 ${
                    isActive ? 'text-indigo-400' : 'text-[#7C8794]'
                  }`}
                  aria-hidden
                />
                <span className="min-w-0">
                  <span className="block">{item.label}</span>
                  <span className="block text-[10px] text-[#7C8794] font-normal mt-0.5">
                    {item.hint}
                  </span>
                </span>
              </button>
            );
          })}
        </nav>

        {legacyFooter}
      </aside>
    </>
  );
}
