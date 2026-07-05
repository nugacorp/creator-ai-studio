export const CHAT_SCOPE_REFUSAL =
  'Soy el copiloto de Creator AI Studio y no puedo responder consultas fuera del proyecto. Puedo ayudarte con episodios, guiones bíblicos, miniaturas, SEO, YouTube, producción, kanban, automatización, agentes, integraciones o el estado operativo de Creator AI Studio.';

export const CHAT_SYSTEM_PROMPT = `Eres el copiloto de Creator AI Studio, un asistente exclusivo para producción de videos cristianos en YouTube y operaciones del proyecto.

SOLO puedes ayudar con temas relacionados con Creator AI Studio: episodios, guiones bíblicos, shorts, ganchos de retención, títulos CTR, SEO, miniaturas/thumbnails, analytics, kanban, pipeline de producción, render, TTS/narración, publicación, agentes de IA, automatización e integraciones (YouTube, Supabase, workers).

PROHIBIDO responder preguntas de conocimiento general, matemáticas, trivia, clima, deportes, política, entretenimiento, programación ajena al proyecto o cualquier tema no vinculado a Creator AI Studio.

Si recibes una pregunta fuera de alcance, responde EXACTAMENTE con este mensaje y nada más:
"${CHAT_SCOPE_REFUSAL}"

Responde en español, de forma clara y práctica.`;

const CHAT_SCOPE_KEYWORDS = [
  'creator ai studio',
  'creator os',
  'creator',
  'cas',
  'copiloto',
  'proyecto',
  'episodio',
  'guion',
  'guión',
  'biblia',
  'bíblico',
  'biblico',
  'cristiano',
  'youtube',
  'short',
  'titulo',
  'título',
  'ctr',
  'seo',
  'miniatura',
  'thumbnail',
  'produccion',
  'producción',
  'video',
  'canal',
  'metricas',
  'métricas',
  'analytics',
  'pipeline',
  'kanban',
  'tts',
  'narracion',
  'narración',
  'voz',
  'render',
  'publicacion',
  'publicación',
  'publicar',
  'staging',
  'deploy',
  'despliegue',
  'sistema',
  'worker',
  'redis',
  'supabase',
  'google',
  'gemini',
  'openai',
  'claude',
  'api',
  'dashboard',
  'agente',
  'automatizacion',
  'automatización',
  'contenido',
  'gancho',
  'retencion',
  'retención',
  'audiencia',
  'integracion',
  'integración',
  'reflexion',
  'reflexión',
  'sermon',
  'predicacion',
  'predicación',
  'versiculo',
  'versículo',
];

/** Patterns for general knowledge / math / trivia that must never reach the LLM. */
const OFF_TOPIC_PATTERNS = [
  /\b\d+\s*[+\-*/x×÷]\s*\d+\b/,
  /\bcu[aá]nto\s+es\b/,
  /\bcu[aá]ntos\s+son\b/,
  /\b(suma|resta|multiplica|divide|multiplicar|dividir)\b/,
  /\b\d+\s*=\s*\?/,
  /\b(capital|presidente|primer\s+ministro)\s+(de|del)\b/,
  /\b(clima|tiempo|temperatura)\s+(en|de|hoy)\b/,
  /\b(quien\s+invent[oó]|quien\s+descubri[oó]|historia\s+de)\b/,
  /\b(receta|ingredientes)\s+(de|para)\b/,
  /\b(traduce|traducir|translate)\s+/,
  /\b(hola\s+mundo|python|javascript|java|c\+\+)\b/,
];

const EPISODE_CONTEXT_PREFIX = /^\[Contexto:[^\]]*\]\s*/i;

export function normalizeForScope(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Strip frontend episode context wrapper so it cannot bypass scope checks. */
export function extractUserQuestion(content: string): string {
  return content.replace(EPISODE_CONTEXT_PREFIX, '').trim();
}

export function isObviousOffTopic(content: string): boolean {
  const question = extractUserQuestion(content);
  if (!question) return true;
  const normalized = normalizeForScope(question);
  return OFF_TOPIC_PATTERNS.some(pattern => pattern.test(normalized));
}

export function isProjectScopedChat(messages: Array<{ role: string; content: string }>): boolean {
  const lastUserMessage = [...messages]
    .reverse()
    .find(message => message.role === 'user')
    ?.content;

  if (!lastUserMessage) return false;

  const question = extractUserQuestion(lastUserMessage);
  if (!question) return false;
  if (isObviousOffTopic(question)) return false;

  const normalized = normalizeForScope(question);
  return CHAT_SCOPE_KEYWORDS.some(keyword => normalized.includes(normalizeForScope(keyword)));
}

export function evaluateChatScope(messages: Array<{ role: string; content: string }>): {
  allowed: boolean;
  outOfScope: boolean;
} {
  if (isProjectScopedChat(messages)) {
    return { allowed: true, outOfScope: false };
  }
  return { allowed: false, outOfScope: true };
}
