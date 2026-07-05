import type { AgentId, AgentOverride } from '@creator-ai-studio/shared';
import { getSettings, saveSettings } from '../settings/store.js';
import { AGENT_SYSTEM_PROMPTS } from './prompts.js';

export function buildAgentSystemPrompt(base: string, override?: AgentOverride): string {
  const parts = [base];
  const extraSkills = (override?.extraSkills ?? []).map(s => s.trim()).filter(Boolean);
  if (extraSkills.length > 0) {
    parts.push(`\n\nAdditional expertise:\n${extraSkills.map(s => `- ${s}`).join('\n')}`);
  }
  if (override?.promptAppend?.trim()) {
    parts.push(`\n\n${override.promptAppend.trim()}`);
  }
  if (override?.customNotes?.trim()) {
    parts.push(`\n\nCreator notes:\n${override.customNotes.trim()}`);
  }
  return parts.join('');
}

export async function getAgentOverride(agentId: AgentId): Promise<AgentOverride> {
  const settings = await getSettings();
  return settings.agentOverrides?.[agentId] ?? {};
}

export async function patchAgentOverride(
  agentId: AgentId,
  patch: Partial<AgentOverride>,
): Promise<AgentOverride> {
  const current = await getSettings();
  const prev = current.agentOverrides?.[agentId] ?? {};
  const merged: AgentOverride = { ...prev, ...patch };
  const agentOverrides = { ...(current.agentOverrides ?? {}), [agentId]: merged };
  await saveSettings({ agentOverrides });
  return merged;
}

export async function resolveAgentSystemPrompt(agentId: AgentId): Promise<string> {
  const override = await getAgentOverride(agentId);
  return buildAgentSystemPrompt(AGENT_SYSTEM_PROMPTS[agentId], override);
}

export function mergeAgentSkills(base: string[], override?: AgentOverride): string[] {
  const extra = (override?.extraSkills ?? []).map(s => s.trim()).filter(Boolean);
  return extra.length > 0 ? [...base, ...extra] : base;
}
