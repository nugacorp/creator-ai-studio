import type { ChatMessage } from '../ai/types.js';
import { withProvider } from '../ai/router.js';
import { geminiGenerateWithSystem } from '../ai/gemini.js';
import { getGeminiAuth } from '../secrets/google-auth.js';
import { evaluateChatScope, CHAT_SCOPE_REFUSAL } from '../ai/chat-scope.js';
import type { EpisodeStorage } from '../storage/index.js';
import {
  appendCopilotMessages,
  createCopilotMessage,
  getCopilotMessages,
  resolveCopilotUserId,
} from './store.js';
import {
  COPILOT_TOOL_NAMES,
  confirmCopilotPublish,
  executeCopilotTool,
  type CopilotToolContext,
} from './tools.js';
import type { CopilotChatResponse, CopilotMessage, CopilotToolCall } from './types.js';

export const COPILOT_SYSTEM_PROMPT = `Eres el copiloto oficial de Creator AI Studio — el centro de comando para crear, editar y publicar contenido.

Puedes responder en español de forma clara y también EJECUTAR acciones del estudio usando herramientas.

HERRAMIENTAS DISPONIBLES (usa cuando el usuario pida crear, editar, publicar, listar o ejecutar agentes):
${COPILOT_TOOL_NAMES.map(t => `- ${t}`).join('\n')}

Cuando necesites ejecutar una o más herramientas, responde SOLO con un bloque JSON válido (sin markdown):
{"tools":[{"tool":"nombre_herramienta","args":{...}}],"message":null}

Cuando NO necesites herramientas, responde con texto natural en español:
{"tools":[],"message":"tu respuesta aquí"}

Reglas:
- Para publicar usa publish_episode (requiere confirmación del usuario en la UI).
- Si falta episodeId, usa el episodio activo del contexto cuando exista.
- Agentes válidos: hermes, researcher, scriptwriter, doctrine_reviewer, editorial_reviewer, storyboard_designer, scene_asset_designer, narrator, audio_engineer, thumbnail_designer, video_editor, seo_optimizer, shorts_agent, analytics_agent.
- NO respondas preguntas fuera de Creator AI Studio (matemáticas, trivia, etc.).
- Sé conciso y orientado a la acción.`;

const TOOL_JSON_PATTERN = /\{[\s\S]*"tools"\s*:\s*\[[\s\S]*\][\s\S]*\}/;

function parseToolResponse(text: string): { tools: CopilotToolCall[]; message: string | null } {
  const trimmed = text.trim();
  const jsonMatch = trimmed.match(TOOL_JSON_PATTERN);
  if (!jsonMatch) {
    return { tools: [], message: trimmed };
  }
  try {
    const parsed = JSON.parse(jsonMatch[0]) as {
      tools?: Array<{ tool?: string; args?: Record<string, unknown> }>;
      message?: string | null;
    };
    const tools: CopilotToolCall[] = (parsed.tools ?? [])
      .filter(entry => typeof entry.tool === 'string')
      .map(entry => ({
        tool: entry.tool!,
        args: entry.args ?? {},
      }));
    return {
      tools,
      message: typeof parsed.message === 'string' ? parsed.message : null,
    };
  } catch {
    return { tools: [], message: trimmed };
  }
}

function buildLlmMessages(
  history: CopilotMessage[],
  userMessage: string,
  context?: { episodeTitle?: string; episodeId?: string; channelId?: string },
): ChatMessage[] {
  const contextLines: string[] = [];
  if (context?.channelId) contextLines.push(`Canal activo: ${context.channelId}`);
  if (context?.episodeId) contextLines.push(`Episodio activo ID: ${context.episodeId}`);
  if (context?.episodeTitle) contextLines.push(`Episodio activo: "${context.episodeTitle}"`);

  const systemContext =
    contextLines.length > 0 ? `\n\nContexto actual:\n${contextLines.join('\n')}` : '';

  const llmMessages: ChatMessage[] = [
    { role: 'system', content: COPILOT_SYSTEM_PROMPT + systemContext },
  ];

  for (const msg of history.slice(-20)) {
    if (msg.role === 'user' || msg.role === 'assistant') {
      llmMessages.push({
        role: msg.role,
        content: msg.content,
      });
    }
  }
  llmMessages.push({ role: 'user', content: userMessage });
  return llmMessages;
}

async function callCopilotLlm(llmMessages: ChatMessage[]): Promise<string> {
  const systemMsg = llmMessages.find(m => m.role === 'system');
  const convo = llmMessages.filter(m => m.role !== 'system');
  const instruction = systemMsg?.content ?? COPILOT_SYSTEM_PROMPT;
  const history = convo
    .map(m => `${m.role === 'user' ? 'Usuario' : 'Asistente'}: ${m.content}`)
    .join('\n');

  const auth = await getGeminiAuth();
  if (auth) {
    return geminiGenerateWithSystem(auth, history, 'copilot-chat', instruction);
  }

  const augmented = convo.map((m, i, arr) => {
    const isLastUser =
      m.role === 'user' && arr.slice(i + 1).every(next => next.role !== 'user');
    if (!isLastUser) return m;
    return {
      ...m,
      content: `[Copiloto CAS — sigue estas instrucciones]\n${instruction.slice(0, 3000)}\n\n${m.content}`,
    };
  });
  return withProvider('chat', provider => provider.chat(augmented));
}

function formatToolResultsSummary(
  results: Array<{ result: { success: boolean; summary: string } }>,
): string {
  return results.map(r => (r.result.success ? `✓ ${r.result.summary}` : `✗ ${r.result.summary}`)).join('\n');
}

export interface HandleCopilotChatInput {
  storage: EpisodeStorage;
  userId?: string;
  channelId?: string;
  activeEpisodeId?: string;
  episodeTitle?: string;
  message: string;
}

export async function handleCopilotChat(input: HandleCopilotChatInput): Promise<CopilotChatResponse> {
  const scopedUserId = resolveCopilotUserId(input.userId);
  const history = await getCopilotMessages(scopedUserId, input.channelId);

  const scopeMessages = [{ role: 'user', content: input.message }];
  const scope = evaluateChatScope(scopeMessages);
  if (!scope.allowed) {
    const assistantMsg = createCopilotMessage('assistant', CHAT_SCOPE_REFUSAL, {
      outOfScope: true,
    });
    await appendCopilotMessages(scopedUserId, input.channelId, [
      createCopilotMessage('user', input.message),
      assistantMsg,
    ]);
    return { reply: CHAT_SCOPE_REFUSAL, out_of_scope: true, messages: [...history, assistantMsg] };
  }

  const userMsg = createCopilotMessage('user', input.message);
  const llmMessages = buildLlmMessages(history, input.message, {
    episodeTitle: input.episodeTitle,
    episodeId: input.activeEpisodeId,
    channelId: input.channelId,
  });

  const rawLlm = await callCopilotLlm(llmMessages);
  const parsed = parseToolResponse(rawLlm);

  const ctx: CopilotToolContext = {
    storage: input.storage,
    userId: input.userId,
    channelId: input.channelId,
    activeEpisodeId: input.activeEpisodeId,
  };

  const toolResults = [];
  const pendingActions = [];

  for (const call of parsed.tools.slice(0, 5)) {
    const executed = await executeCopilotTool(ctx, call);
    toolResults.push(executed.result);
    if (executed.pendingActions) {
      pendingActions.push(...executed.pendingActions);
    }
  }

  let reply: string;
  if (parsed.tools.length > 0) {
    const summary = formatToolResultsSummary(
      toolResults.map(result => ({ result })),
    );
    if (parsed.message?.trim()) {
      reply = `${parsed.message.trim()}\n\n${summary}`;
    } else {
      reply = summary || 'Acciones ejecutadas.';
    }
  } else {
    reply = parsed.message ?? rawLlm;
  }

  const assistantMsg = createCopilotMessage('assistant', reply, {
    toolResults: toolResults.length > 0 ? toolResults : undefined,
    pendingActions: pendingActions.length > 0 ? pendingActions : undefined,
  });

  const updated = await appendCopilotMessages(scopedUserId, input.channelId, [userMsg, assistantMsg]);

  return {
    reply,
    toolResults: toolResults.length > 0 ? toolResults : undefined,
    pendingActions: pendingActions.length > 0 ? pendingActions : undefined,
    messages: updated,
  };
}

export async function handleCopilotConfirm(
  storage: EpisodeStorage,
  userId: string | undefined,
  channelId: string | undefined,
  body: { action: string; episodeId: string; scheduledAt?: string },
): Promise<CopilotChatResponse> {
  const scopedUserId = resolveCopilotUserId(userId);
  const ctx: CopilotToolContext = { storage, userId, channelId };

  if (body.action !== 'confirm_publish') {
    return { reply: 'Acción no reconocida.' };
  }

  const result = await confirmCopilotPublish(ctx, body.episodeId, body.scheduledAt);
  const reply = result.success
    ? `✓ ${result.summary}`
    : `✗ ${result.summary}`;

  const assistantMsg = createCopilotMessage('assistant', reply, {
    toolResults: [result],
  });
  const updated = await appendCopilotMessages(scopedUserId, channelId, [assistantMsg]);

  return { reply, toolResults: [result], messages: updated };
}

export const COPILOT_WELCOME =
  '¡Hola! Soy tu copiloto de Creator AI Studio. Puedo crear ideas y episodios, editar guiones, ejecutar agentes, programar publicaciones y ayudarte con SEO y producción. Dime qué quieres hacer — también puedes seguir editando manualmente en Contenido, Proyectos y el workspace.';

/** @internal test helper */
export { parseToolResponse };
