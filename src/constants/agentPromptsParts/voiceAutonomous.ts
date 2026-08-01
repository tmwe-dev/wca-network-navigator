import type { AgentRegistryEntry } from "./types";

export const VOICE_AUTONOMOUS_AGENTS: Record<string, AgentRegistryEntry> = {
  "voice-elevenlabs": {
    id: "voice-elevenlabs",
    displayName: "Voice Agent",
    description: "Specialista voce ElevenLabs per sintesi e design vocale. Gestisce TTS e scenari di interazione vocale.",
    coreFile: "",
    avatarIcon: "Mic",
    avatarColor: "destructive",
    category: "voice",
    roleInModel: "voce",
    kbCategories: ["voice_templates", "pronunciation_rules", "voice_scenarios"],
    criticalProcedures: [],
    requiredVars: [],
    promptSources: [
      { label: "Template vocali", source: "voice_templates", promptLabTab: "templates" },
      { label: "Regole pronuncia", source: "pronunciation_rules", promptLabTab: "doctrine" },
    ],
    runtime: {
      edgeFunction: "",
      modelDefault: "elevenlabs-v2",
      triggers: ["Richiesta sintesi vocale", "Scenario voice agent"],
    },
    tools: [], // TODO: implement edge function
    approvalRequiredTools: [],
    dependsOn: [],
    contract: {
      input: "{ text: string, voiceId?: string, scenario?: string }",
      output: "{ audioUrl: string, duration: number }",
    },
  },

  "agent-execute": {
    id: "agent-execute",
    displayName: "Agent Executor",
    description: "Executor autonomo con approvazione workflow e gate controllo. Esegue decisioni approvate e azioni di sistema.",
    coreFile: "",
    avatarIcon: "Zap",
    avatarColor: "destructive",
    category: "autonomous",
    roleInModel: "codice",
    kbCategories: ["system_doctrine", "workflow_gate"],
    criticalProcedures: [],
    requiredVars: [],
    promptSources: [
      { label: "Dottrina workflow gate", source: "workflow_gate", promptLabTab: "doctrine" },
      { label: "Dottrina di sistema", source: "system_doctrine", promptLabTab: "doctrine" },
    ],
    runtime: {
      edgeFunction: "agent-execute",
      modelDefault: "gpt-4o",
      triggers: ["Approvazione pending action", "Workflow automatico", "Decision engine"],
    },
    tools: ["execute_decision", "search_partners", "send_email", "create_reminder"],
    approvalRequiredTools: ["send_email", "update_lead_status", "execute_decision"],
    dependsOn: [],
    contract: {
      input: "{ decision: Decision, approved: boolean }",
      output: "{ executed: boolean, result: ActionResult, auditLog: AuditEntry }",
    },
  },

  "mission-executor": {
    id: "mission-executor",
    displayName: "Mission Executor",
    description: "Executor missioni con bulk update e autonomia controllata. Gestisce operazioni batch su grandi set di partner.",
    coreFile: "",
    avatarIcon: "Rocket",
    avatarColor: "destructive",
    category: "autonomous",
    roleInModel: "codice",
    kbCategories: ["system_doctrine", "mission_rules"],
    criticalProcedures: [],
    requiredVars: [],
    promptSources: [
      { label: "Regole missioni", source: "mission_rules", promptLabTab: "doctrine" },
      { label: "Dottrina di sistema", source: "system_doctrine", promptLabTab: "doctrine" },
    ],
    runtime: {
      edgeFunction: "",
      modelDefault: "gpt-4o",
      triggers: ["Lancio missione batch", "Coda missioni autonome"],
    },
    tools: [], // TODO: implement edge function
    approvalRequiredTools: [],
    dependsOn: [],
    contract: {
      input: "{ mission: MissionDefinition, scope: PartnerFilter }",
      output: "{ processed: number, results: MissionResult[], errors: string[] }",
    },
  },
};
