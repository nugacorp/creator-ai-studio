import { describe, expect, it } from 'vitest';
import {
  CHAT_SCOPE_REFUSAL,
  evaluateChatScope,
  extractUserQuestion,
  isObviousOffTopic,
  isProjectScopedChat,
} from '../src/ai/chat-scope.js';

describe('chat-scope', () => {
  it('extractUserQuestion strips episode context prefix', () => {
    expect(
      extractUserQuestion('[Contexto: episodio activo "David vs Goliat"] cuanto es 4+9?'),
    ).toBe('cuanto es 4+9?');
  });

  it('detects obvious off-topic math', () => {
    expect(isObviousOffTopic('cuanto es 4+9?')).toBe(true);
    expect(isObviousOffTopic('4+9')).toBe(true);
    expect(isObviousOffTopic('cuantos son 3 x 7')).toBe(true);
  });

  it('rejects math even when wrapped in episode context', () => {
    const messages = [
      {
        role: 'user',
        content: '[Contexto: episodio activo "David vs Goliat"] cuanto es 4+9?',
      },
    ];
    expect(isProjectScopedChat(messages)).toBe(false);
    expect(evaluateChatScope(messages)).toEqual({ allowed: false, outOfScope: true });
  });

  it('allows in-scope copilot questions', () => {
    expect(
      isProjectScopedChat([{ role: 'user', content: 'Hola copiloto, ayúdame con un gancho' }]),
    ).toBe(true);
    expect(
      isProjectScopedChat([
        { role: 'user', content: 'Dame 5 ideas de títulos CTR para Proverbios 3' },
      ]),
    ).toBe(true);
  });

  it('rejects general trivia without project keywords', () => {
    expect(isProjectScopedChat([{ role: 'user', content: 'capital de Francia' }])).toBe(false);
    expect(isObviousOffTopic('capital de Francia')).toBe(true);
  });

  it('exports a fixed Spanish refusal message', () => {
    expect(CHAT_SCOPE_REFUSAL).toContain('Creator AI Studio');
    expect(CHAT_SCOPE_REFUSAL).toContain('no puedo responder');
  });
});
