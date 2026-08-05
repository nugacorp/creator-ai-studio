import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { AlertCircle, Loader2, type LucideIcon } from 'lucide-react';
import {
  CHURCH_ROLE_LABELS,
  PRODUCTION_FORMAT_LABELS,
  PRODUCTION_STATUS_LABELS,
  type CalendarEntryStatus,
  type ChurchRole,
  type LiveEventStatus,
  type ProductionFormat,
  type ProductionStatus,
} from '@creator-ai-studio/shared';

/**
 * Shared UI primitives for the church platform.
 *
 * Two rules drive every choice here, both from the plan's guiding principle
 * ("usable by a volunteer who joined a week ago, without a manual"):
 *  - interactive targets are at least 44px tall,
 *  - nothing communicates by color alone; every state carries a word.
 */

// --- Buttons ---------------------------------------------------------------

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-500/40',
  secondary: 'bg-white/5 hover:bg-white/10 text-slate-100 border border-white/10',
  ghost: 'bg-transparent hover:bg-white/5 text-slate-300 border border-transparent',
  danger: 'bg-rose-600/90 hover:bg-rose-500 text-white border border-rose-500/40',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  icon?: LucideIcon;
  loading?: boolean;
  /** Renders icon-only; the label still reaches screen readers via aria-label. */
  compact?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', icon: Icon, loading, compact, children, className = '', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      {...rest}
      disabled={rest.disabled || loading}
      className={`inline-flex items-center justify-center gap-2 min-h-11 ${
        compact ? 'px-3' : 'px-4'
      } py-2.5 rounded-xl text-sm font-semibold transition-colors duration-150 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${BUTTON_VARIANTS[variant]} ${className}`}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
      ) : (
        Icon && <Icon className="w-4 h-4 shrink-0" aria-hidden />
      )}
      {children && <span className={compact ? 'sr-only' : ''}>{children}</span>}
    </button>
  );
});

// --- Surfaces --------------------------------------------------------------

export function Card({
  children,
  className = '',
  as: Component = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'article' | 'li';
}) {
  return (
    <Component
      className={`bg-[#15191E] border border-white/6 rounded-2xl ${className}`}
    >
      {children}
    </Component>
  );
}

export function SectionHeader({
  title,
  description,
  icon: Icon,
  action,
  level = 2,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  /** Keeps the document outline sequential — screen readers navigate by it. */
  level?: 2 | 3;
}) {
  const Heading = level === 2 ? 'h2' : 'h3';
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
      <div className="flex items-start gap-3 min-w-0">
        {Icon && (
          <span className="mt-0.5 w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
            <Icon className="w-4.5 h-4.5 text-indigo-400" aria-hidden />
          </span>
        )}
        <div className="min-w-0">
          <Heading className="font-display text-base font-bold text-white truncate">{title}</Heading>
          {description && (
            <p className="text-xs text-[#A9B4C0] mt-0.5 leading-relaxed">{description}</p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

// --- States ----------------------------------------------------------------

/**
 * Empty states always name the next action. A blank panel tells a new
 * volunteer nothing; "Aún no hay sermones — Subir el primero" tells them
 * everything.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6">
      <span className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-slate-400" aria-hidden />
      </span>
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="text-xs text-[#A9B4C0] mt-1.5 max-w-sm leading-relaxed">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function LoadingState({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div
      className="flex items-center justify-center gap-2.5 py-12 text-sm text-[#A9B4C0]"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
      {label}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      className="flex flex-col items-center justify-center text-center py-10 px-6"
      role="alert"
    >
      <AlertCircle className="w-6 h-6 text-rose-400 mb-3" aria-hidden />
      <p className="text-sm text-white font-semibold">Algo no salió bien</p>
      <p className="text-xs text-[#A9B4C0] mt-1.5 max-w-md leading-relaxed">{message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry} className="mt-4">
          Reintentar
        </Button>
      )}
    </div>
  );
}

/** Inline banner for a permission the current role lacks. Explains, not scolds. */
export function PermissionNotice({ message }: { message: string }) {
  return (
    <p className="flex items-start gap-2 text-[11px] text-[#A9B4C0] bg-white/4 border border-white/8 rounded-xl px-3 py-2.5">
      <AlertCircle className="w-3.5 h-3.5 mt-px shrink-0 text-amber-400" aria-hidden />
      <span className="leading-relaxed">{message}</span>
    </p>
  );
}

// --- Status pills ----------------------------------------------------------

const STATUS_STYLES: Record<ProductionStatus, string> = {
  idea: 'bg-slate-500/12 text-slate-300 border-slate-400/25',
  grabacion: 'bg-violet-500/12 text-violet-300 border-violet-400/25',
  edicion: 'bg-sky-500/12 text-sky-300 border-sky-400/25',
  revision: 'bg-amber-500/12 text-amber-300 border-amber-400/25',
  aprobado: 'bg-emerald-500/12 text-emerald-300 border-emerald-400/25',
  publicado: 'bg-green-500/16 text-green-300 border-green-400/30',
};

export function StatusPill({ status }: { status: ProductionStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${STATUS_STYLES[status]}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden />
      {PRODUCTION_STATUS_LABELS[status]}
    </span>
  );
}

export function FormatBadge({ format }: { format: ProductionFormat }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide bg-white/6 text-[#A9B4C0] border border-white/8">
      {PRODUCTION_FORMAT_LABELS[format]}
    </span>
  );
}

const ROLE_STYLES: Record<ChurchRole, string> = {
  admin: 'bg-indigo-500/14 text-indigo-300 border-indigo-400/30',
  lider: 'bg-emerald-500/14 text-emerald-300 border-emerald-400/30',
  productor: 'bg-sky-500/14 text-sky-300 border-sky-400/30',
  disenador: 'bg-fuchsia-500/14 text-fuchsia-300 border-fuchsia-400/30',
  voluntario: 'bg-slate-500/14 text-slate-300 border-slate-400/30',
};

export function RolePill({ role }: { role: ChurchRole }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${ROLE_STYLES[role]}`}
    >
      {CHURCH_ROLE_LABELS[role]}
    </span>
  );
}

const CALENDAR_STATUS_STYLES: Record<CalendarEntryStatus, { label: string; className: string }> = {
  programado: { label: 'Programado', className: 'bg-sky-500/12 text-sky-300 border-sky-400/25' },
  publicando: {
    label: 'Publicando',
    className: 'bg-amber-500/12 text-amber-300 border-amber-400/25',
  },
  publicado: {
    label: 'Publicado',
    className: 'bg-green-500/14 text-green-300 border-green-400/30',
  },
  fallido: { label: 'Falló', className: 'bg-rose-500/14 text-rose-300 border-rose-400/30' },
};

export function CalendarStatusPill({ status }: { status: CalendarEntryStatus }) {
  const config = CALENDAR_STATUS_STYLES[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${config.className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden />
      {config.label}
    </span>
  );
}

const LIVE_STATUS_STYLES: Record<LiveEventStatus, { label: string; className: string }> = {
  planeado: { label: 'Planeado', className: 'bg-slate-500/12 text-slate-300 border-slate-400/25' },
  preflight: {
    label: 'En preparación',
    className: 'bg-amber-500/12 text-amber-300 border-amber-400/25',
  },
  en_vivo: { label: 'EN VIVO', className: 'bg-rose-500/18 text-rose-300 border-rose-400/40' },
  finalizado: {
    label: 'Finalizado',
    className: 'bg-white/6 text-[#A9B4C0] border-white/10',
  },
};

export function LiveStatusPill({ status }: { status: LiveEventStatus }) {
  const config = LIVE_STATUS_STYLES[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${config.className}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full bg-current ${status === 'en_vivo' ? 'animate-pulse' : ''}`}
        aria-hidden
      />
      {config.label}
    </span>
  );
}

// --- Forms -----------------------------------------------------------------

/**
 * Labels are always visible. A placeholder disappears the moment someone types,
 * taking the only explanation of the field with it.
 */
export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-xs font-semibold text-slate-200">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-[11px] text-rose-300 flex items-center gap-1.5">
          <AlertCircle className="w-3 h-3 shrink-0" aria-hidden />
          {error}
        </p>
      ) : (
        hint && <p className="text-[11px] text-[#7C8794] leading-relaxed">{hint}</p>
      )}
    </div>
  );
}

export const inputClass =
  'w-full min-h-11 bg-[#0B0F14] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-[#7C8794] focus:border-indigo-500/60 focus:outline-none transition-colors duration-150';

export const selectClass = `${inputClass} cursor-pointer`;

export const textareaClass =
  'w-full bg-[#0B0F14] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-[#7C8794] focus:border-indigo-500/60 focus:outline-none transition-colors duration-150 resize-y';

// --- Data display ----------------------------------------------------------

export function StatTile({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'neutral' | 'good' | 'warn' | 'bad';
}) {
  const toneClass = {
    neutral: 'text-white',
    good: 'text-emerald-300',
    warn: 'text-amber-300',
    bad: 'text-rose-300',
  }[tone];

  return (
    <Card className="p-4">
      <p className="text-[11px] font-medium text-[#A9B4C0] uppercase tracking-wide">{label}</p>
      <p className={`font-display text-2xl font-bold mt-1.5 tabular-nums ${toneClass}`}>{value}</p>
      {hint && <p className="text-[11px] text-[#7C8794] mt-1">{hint}</p>}
    </Card>
  );
}

/** Human file size. Volunteers think in MB and GB, not bytes. */
export function formatBytes(bytes: number): string {
  if (!bytes) return '0 MB';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value >= 10 || exponent < 2 ? 0 : 1)} ${units[exponent]}`;
}

/** Dates always render in the church's timezone, never raw UTC. */
export function formatDateTime(iso: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('es-CO', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: timezone,
    }).format(new Date(iso));
  } catch {
    return new Date(iso).toLocaleString('es-CO');
  }
}

export function formatDate(iso: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('es-CO', {
      dateStyle: 'medium',
      timeZone: timezone,
    }).format(new Date(iso));
  } catch {
    return new Date(iso).toLocaleDateString('es-CO');
  }
}

export function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (Math.abs(minutes) < 1) return 'ahora mismo';
  const formatter = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
  if (Math.abs(minutes) < 60) return formatter.format(-minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(-hours, 'hour');
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return formatter.format(-days, 'day');
  return formatter.format(-Math.round(days / 30), 'month');
}
