export type AgentCategory =
  | "core"
  | "email"
  | "outreach"
  | "analysis"
  | "voice"
  | "autonomous"
  | "classifier";

export type AgentRole =
  | "oracolo"
  | "genera"
  | "migliora"
  | "giornalista"
  | "voce"
  | "codice"
  | "worker"
  | "classifier";

export interface PromptSource {
  label: string;
  source: string;
  promptLabTab: string;
  hint?: string;
}

export interface AgentRegistryEntry {
  id: string;
  displayName: string;
  description: string;
  coreFile: string;
  avatarIcon: string;
  avatarColor: "primary" | "secondary" | "accent" | "muted" | "destructive";
  category: AgentCategory;
  roleInModel: AgentRole;
  kbCategories: string[];
  criticalProcedures: string[];
  requiredVars: string[];
  promptSources: PromptSource[];
  runtime: {
    edgeFunction: string;
    modelDefault: string;
    triggers: string[];
  };
  tools: string[];
  approvalRequiredTools: string[];
  dependsOn: string[];
  contract: {
    input: string;
    output: string;
  };
}
