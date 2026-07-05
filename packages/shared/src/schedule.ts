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
