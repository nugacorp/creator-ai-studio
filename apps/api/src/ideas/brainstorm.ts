import { randomUUID } from 'node:crypto';
import type { IdeaProposal } from '@creator-ai-studio/shared';
import { withProvider } from '../ai/router.js';

function parseJsonBlock(text: string): Record<string, unknown> | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function demoProposals(rawIdea: string, audience?: string): IdeaProposal[] {
  const now = new Date().toISOString();
  const base = rawIdea.trim();
  const aud = audience?.trim() ? ` para ${audience.trim()}` : '';
  return [
    {
      id: randomUUID(),
      title: `${base}: el mensaje que transforma`,
      points: [
        'Gancho emocional con pregunta directa al espectador',
        'Contexto bíblico en 60 segundos',
        'Aplicación práctica para la vida diaria',
        'Cierre con llamado a reflexión y oración',
      ],
      status: 'pending',
      createdAt: now,
    },
    {
      id: randomUUID(),
      title: `Lo que nadie te cuenta sobre ${base}`,
      points: [
        'Mito o creencia popular a desmontar',
        'Versículo clave con exégesis breve',
        'Historia o analogía memorable',
        `Lección accionable${aud}`,
      ],
      status: 'pending',
      createdAt: now,
    },
    {
      id: randomUUID(),
      title: `${base} — una reflexión en 8 minutos`,
      points: [
        'Introducción íntima con tono pastoral',
        'Tres puntos de enseñanza progresivos',
        'Conexión con la audiencia y testimonio breve',
        'Invitación a comentar y compartir',
      ],
      status: 'pending',
      createdAt: now,
    },
    {
      id: randomUUID(),
      title: `¿Por qué ${base} sigue siendo relevante hoy?`,
      points: [
        'Puente entre el pasado bíblico y el presente',
        'Datos o contexto histórico ligero',
        'Desafío personal al espectador',
        'Versículo de memoria para llevar',
      ],
      status: 'pending',
      createdAt: now,
    },
  ];
}

function normalizeProposals(raw: unknown): IdeaProposal[] {
  if (!Array.isArray(raw)) return [];
  const now = new Date().toISOString();
  const proposals: IdeaProposal[] = [];
  for (const entry of raw.slice(0, 5)) {
    const item = entry as { title?: string; points?: string[] };
    const title = String(item.title ?? '').trim();
    const points = Array.isArray(item.points)
      ? item.points.map(p => String(p).trim()).filter(Boolean).slice(0, 6)
      : [];
    if (!title || points.length === 0) continue;
    proposals.push({
      id: randomUUID(),
      title,
      points,
      status: 'pending',
      createdAt: now,
    });
  }
  return proposals;
}

export async function brainstormIdeaProposals(options: {
  rawIdea: string;
  audience?: string;
  passage?: string;
}): Promise<IdeaProposal[]> {
  const { rawIdea, audience, passage } = options;
  const contextParts = [
    `Idea base: "${rawIdea.trim()}"`,
    audience ? `Audiencia: ${audience.trim()}` : null,
    passage ? `Pasaje o referencia: ${passage.trim()}` : null,
  ].filter(Boolean);

  const prompt = `${contextParts.join('\n')}

Genera entre 3 y 5 propuestas de video para YouTube (canal cristiano/reflexiones bíblicas).
Cada propuesta debe tener un título atractivo con alto CTR (sin clickbait engañoso) y 3-5 puntos/ángulos en español.

Responde SOLO JSON válido:
{"proposals":[{"title":"...","points":["...","..."]}]}`;

  try {
    const text = await withProvider('chat', provider =>
      provider.chat([
        {
          role: 'system',
          content:
            'Eres un estratega de contenido cristiano para YouTube. Respondes únicamente con JSON válido en español.',
        },
        { role: 'user', content: prompt },
      ]),
    );

    const parsed = parseJsonBlock(text);
    const proposals = normalizeProposals(parsed?.proposals);
    if (proposals.length >= 3) return proposals;
  } catch {
    // fall through to demo proposals
  }

  return demoProposals(rawIdea, audience);
}
