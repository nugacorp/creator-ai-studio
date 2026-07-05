import type { PublishSchedule } from './index.js';

/** Camino Bíblico defaults: long video Mon 15:00, shorts Tue/Thu/Sat 10:00 (local). */
export const DEFAULT_PUBLISH_SCHEDULE: PublishSchedule = {
  longVideo: { dayOfWeek: 1, hour: 15, minute: 0, timezone: 'America/Mexico_City' },
  shorts: {
    daysOfWeek: [2, 4, 6],
    hour: 10,
    minute: 0,
    timezone: 'America/Mexico_City',
  },
};

export type PublishScheduleKind = 'longVideo' | 'shorts';

const DAY_LABELS_SHORT = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'] as const;

/** Human-readable summary for settings / calendar UI (Spanish). */
export function formatPublishScheduleSummary(schedule: PublishSchedule): {
  longVideo: string;
  shorts: string;
  timezone: string;
} {
  const lv = schedule.longVideo;
  const longVideo = `Video largo (${DAY_LABELS_SHORT[lv.dayOfWeek] ?? '?'} ${String(lv.hour).padStart(2, '0')}:${String(lv.minute).padStart(2, '0')})`;
  const shortsCfg = schedule.shorts ?? DEFAULT_PUBLISH_SCHEDULE.shorts!;
  const days = [...shortsCfg.daysOfWeek]
    .sort((a, b) => a - b)
    .map(d => DAY_LABELS_SHORT[d] ?? '?')
    .join('/');
  const shorts = `Shorts (${days} ${String(shortsCfg.hour).padStart(2, '0')}:${String(shortsCfg.minute).padStart(2, '0')})`;
  const timezone =
    schedule.longVideo.timezone ??
    shortsCfg.timezone ??
    DEFAULT_PUBLISH_SCHEDULE.longVideo.timezone ??
    'local';
  return { longVideo, shorts, timezone };
}

/** Label for the next suggested slot (Spanish locale). */
export function formatNextPublishSlot(slot: Date, kind: PublishScheduleKind): string {
  const kindLabel = kind === 'longVideo' ? 'video largo' : 'Shorts';
  const when = slot.toLocaleString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  return `Próximo ${kindLabel}: ${when}`;
}

function atLocalSlot(
  base: Date,
  dayOfWeek: number,
  hour: number,
  minute: number,
): Date {
  const candidate = new Date(base);
  const currentDow = candidate.getDay();
  let delta = dayOfWeek - currentDow;
  if (delta < 0) delta += 7;
  if (delta === 0) {
    const slotMinutes = hour * 60 + minute;
    const nowMinutes = candidate.getHours() * 60 + candidate.getMinutes();
    if (nowMinutes >= slotMinutes) delta = 7;
  }
  candidate.setDate(candidate.getDate() + delta);
  candidate.setHours(hour, minute, 0, 0);
  return candidate;
}

/**
 * Suggest the next publish slot according to a recurring pattern.
 * Uses the browser/Node local timezone unless a timezone is added later via Intl.
 */
export function suggestNextPublishSlot(
  schedule: PublishSchedule,
  kind: PublishScheduleKind,
  from: Date = new Date(),
): Date {
  if (kind === 'longVideo') {
    const { dayOfWeek, hour, minute } = schedule.longVideo;
    return atLocalSlot(from, dayOfWeek, hour, minute);
  }

  const shorts = schedule.shorts ?? DEFAULT_PUBLISH_SCHEDULE.shorts!;
  const days = [...shorts.daysOfWeek].sort((a, b) => a - b);
  if (days.length === 0) {
    return atLocalSlot(from, schedule.longVideo.dayOfWeek, schedule.longVideo.hour, schedule.longVideo.minute);
  }

  let best: Date | null = null;
  for (const dow of days) {
    const candidate = atLocalSlot(from, dow, shorts.hour, shorts.minute);
    if (!best || candidate.getTime() < best.getTime()) {
      best = candidate;
    }
  }
  return best ?? atLocalSlot(from, days[0]!, shorts.hour, shorts.minute);
}
