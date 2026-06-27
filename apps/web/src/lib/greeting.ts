/** Time-of-day greeting in Spanish (local timezone). */
export function getTimeGreeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return 'Buenos días';
  if (hour >= 12 && hour < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

/** Preferred display name from profile or auth user. */
export function resolveDisplayName(options: {
  displayName?: string | null;
  email?: string | null;
  fallback?: string;
}): string {
  const trimmed = options.displayName?.trim();
  if (trimmed) return trimmed;
  const local = options.email?.split('@')[0]?.trim();
  if (local) return local;
  return options.fallback ?? 'Creador';
}
