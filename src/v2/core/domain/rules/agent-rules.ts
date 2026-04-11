/**
 * Agent Domain Rules — STEP 8
 * Pure business logic for agent evaluation.
 */

import type { Agent } from "../entities";

/** Checks if an agent can accept new tasks */
export function canAcceptTasks(agent: Agent): boolean {
  return agent.isActive;
}

/** Checks if agent has territory coverage for a country */
export function coversTerritory(agent: Agent, countryCode: string): boolean {
  if (agent.territoryCodes.length === 0) return true; // global agent
  return agent.territoryCodes.includes(countryCode.toUpperCase());
}

/** Agent readiness score (0-100) */
export function agentReadinessScore(agent: Agent): number {
  let score = 0;
  if (agent.isActive) score += 30;
  if (agent.systemPrompt.length > 50) score += 20;
  if (agent.territoryCodes.length > 0) score += 15;
  if (agent.signatureHtml) score += 10;
  if (agent.elevenlabsVoiceId) score += 10;
  if (agent.knowledgeBase.length > 0) score += 15;
  return Math.min(100, score);
}

/** Find best agent for a territory from a list */
export function findAgentForTerritory(
  agents: readonly Agent[],
  countryCode: string,
): Agent | null {
  const activeAgents = agents.filter((a) => a.isActive);
  const territorial = activeAgents.find((a) => coversTerritory(a, countryCode));
  return territorial ?? null;
}
