import type { CalendarEventDto } from './events.js';

export interface SundayServicePostResult {
  generatedAt: string;
  fridayDate: string;
  sundayDate?: string;
  foundSundayEvent: boolean;
  message: string;
  event?: {
    id: string;
    title: string;
    time: string;
    channel: string;
    youtubeUrl?: string;
  };
}

export function buildSundayServiceImagePrompt(post: SundayServicePostResult): string {
  const eventTitle = post.event?.title?.trim() || 'Servicio del domingo';
  const sundayDate = post.sundayDate ?? 'este domingo';
  return [
    'Create a realistic inspirational church social media post image, no readable text.',
    'Theme: Christian Sunday service invitation.',
    `Focus: ${eventTitle}.`,
    `Date context: ${sundayDate}.`,
    'Style: warm cinematic lighting, hopeful atmosphere, diverse congregation silhouette, modern church interior, soft depth of field, high contrast composition, clean focal point for future text overlay.',
    'Format: 16:9, high quality, social media ready.',
  ].join(' ');
}

function toIsoDateUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfDayUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0));
}

function weekdayUtc(isoDate: string): number {
  const d = new Date(`${isoDate}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return -1;
  return d.getUTCDay();
}

function nextFridayDateUtc(from: Date): string {
  const day = from.getUTCDay();
  const delta = (5 - day + 7) % 7;
  const target = new Date(from.getTime());
  target.setUTCDate(target.getUTCDate() + delta);
  return toIsoDateUtc(target);
}

function formatSpanishSunday(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    timeZone: 'UTC',
  }).format(d);
}

function eventMs(event: CalendarEventDto): number {
  const iso = event.scheduledAt ?? `${event.date}T${event.time}:00.000Z`;
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? Number.MAX_SAFE_INTEGER : ms;
}

function buildSundayMessage(event: {
  title: string;
  sundayDate: string;
  time: string;
  channel: string;
  youtubeUrl?: string;
}): string {
  const lines = [
    'Este viernes te compartimos la informacion del servicio de este domingo:',
    '',
    `Tema: ${event.title}`,
    `Fecha: ${formatSpanishSunday(event.sundayDate)}`,
    `Hora: ${event.time}`,
    `Canal: ${event.channel}`,
    '',
    'Te esperamos. Comparte este mensaje con alguien que lo necesite.',
  ];
  if (event.youtubeUrl) {
    lines.push('', `Enlace: ${event.youtubeUrl}`);
  }
  return lines.join('\n');
}

function buildFallbackMessage(sundayDate: string): string {
  return [
    'Este viernes te compartimos la informacion del servicio de este domingo.',
    '',
    `Fecha: ${formatSpanishSunday(sundayDate)}`,
    'Hora: 10:00',
    '',
    'Muy pronto publicaremos el tema y los detalles. Te esperamos.',
  ].join('\n');
}

export function buildSundayServicePost(
  events: CalendarEventDto[],
  now: Date = new Date(),
): SundayServicePostResult {
  const today = startOfDayUtc(now);
  const todayIso = toIsoDateUtc(today);
  const fridayDate = nextFridayDateUtc(now);

  const nextSundayEvent = events
    .filter(event => event.status === 'scheduled')
    .filter(event => event.date >= todayIso)
    .filter(event => weekdayUtc(event.date) === 0)
    .sort((a, b) => eventMs(a) - eventMs(b))[0];

  if (nextSundayEvent) {
    return {
      generatedAt: new Date().toISOString(),
      fridayDate,
      sundayDate: nextSundayEvent.date,
      foundSundayEvent: true,
      message: buildSundayMessage({
        title: nextSundayEvent.title,
        sundayDate: nextSundayEvent.date,
        time: nextSundayEvent.time,
        channel: nextSundayEvent.channel,
        youtubeUrl: nextSundayEvent.youtubeUrl,
      }),
      event: {
        id: nextSundayEvent.id,
        title: nextSundayEvent.title,
        time: nextSundayEvent.time,
        channel: nextSundayEvent.channel,
        youtubeUrl: nextSundayEvent.youtubeUrl,
      },
    };
  }

  const daysToSunday = (7 - now.getUTCDay()) % 7;
  const fallbackSunday = new Date(today.getTime());
  fallbackSunday.setUTCDate(fallbackSunday.getUTCDate() + daysToSunday);
  const sundayDate = toIsoDateUtc(fallbackSunday);

  return {
    generatedAt: new Date().toISOString(),
    fridayDate,
    sundayDate,
    foundSundayEvent: false,
    message: buildFallbackMessage(sundayDate),
  };
}
