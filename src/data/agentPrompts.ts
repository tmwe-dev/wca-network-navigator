/**
 * Registro Metadati Agenti AI — barrel.
 * Definizioni splittate in src/data/agentPromptsParts/* per LOC budget.
 */
import { CORE_AGENTS } from "./agentPromptsParts/core";
import { EMAIL_OUTREACH_AGENTS } from "./agentPromptsParts/emailOutreach";
import { VOICE_AUTONOMOUS_AGENTS } from "./agentPromptsParts/voiceAutonomous";
import type { AgentRegistryEntry } from "./agentPromptsParts/types";

export type {
  AgentCategory,
  AgentRole,
  PromptSource,
  AgentRegistryEntry,
} from "./agentPromptsParts/types";

export const AGENT_REGISTRY: Record<string, AgentRegistryEntry> = {
  ...CORE_AGENTS,
  ...EMAIL_OUTREACH_AGENTS,
  ...VOICE_AUTONOMOUS_AGENTS,
};

/* ─── Vista compatibile per documentazione (AIExportPanel) ─── */

interface AgentPromptSection {
  role: string;
  rules: string[];
  outputFormat?: string;
  contextInjection?: string[];
}

export const AGENT_PROMPTS: Record<string, AgentPromptSection> = Object.fromEntries(
  Object.entries(AGENT_REGISTRY).map(([key, meta]) => [
    key,
    {
      role: meta.description,
      rules: [
        `Core prompt: src/v2/agent/prompts/${meta.coreFile}.ts`,
        `KB categories: ${meta.kbCategories.join(", ")}`,
        meta.criticalProcedures.length > 0
          ? `Procedure critiche iniettate: ${meta.criticalProcedures.join(", ")}`
          : "Nessuna procedura critica iniettata (solo indice KB)",
        meta.requiredVars.length > 0
          ? `Variabili richieste: ${meta.requiredVars.join(", ")}`
          : "Nessuna variabile obbligatoria",
      ],
      outputFormat: "Definito nel prompt core e nella doctrine/tone-and-format della KB",
      contextInjection: [...meta.kbCategories, ...meta.criticalProcedures],
    },
  ]),
);
