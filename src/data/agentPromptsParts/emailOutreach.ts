import type { AgentRegistryEntry } from "./types";

export const EMAIL_OUTREACH_AGENTS: Record<string, AgentRegistryEntry> = {
  "generate-email": {
    id: "generate-email",
    displayName: "Email Generator",
    description: "Generatore email B2B con ricerca partner e knowledge base. Crea email personalizzate basate sul profilo del destinatario.",
    coreFile: "",
    avatarIcon: "Mail",
    avatarColor: "primary",
    category: "email",
    roleInModel: "genera",
    kbCategories: ["email_forge", "sales_doctrine", "email_templates"],
    criticalProcedures: [],
    requiredVars: [],
    promptSources: [
      { label: "Template email forge", source: "email_forge", promptLabTab: "templates" },
      { label: "Dottrina vendita", source: "sales_doctrine", promptLabTab: "doctrine" },
    ],
    runtime: {
      edgeFunction: "generate-email",
      modelDefault: "gpt-4o",
      triggers: ["Pulsante 'Genera email'", "Sequenza outreach automatica"],
    },
    tools: ["search_partners", "get_partner_detail", "read_kb"],
    approvalRequiredTools: [],
    dependsOn: [],
    contract: {
      input: "{ partnerId: string, template?: string, context?: OutreachContext }",
      output: "{ subject: string, body: string, tone: string, personalization: string[] }",
    },
  },

  "generate-outreach": {
    id: "generate-outreach",
    displayName: "Outreach Generator",
    description: "Generatore strategie outreach multicanale con code queueing. Pianifica sequenze email/WA/LinkedIn.",
    coreFile: "",
    avatarIcon: "Send",
    avatarColor: "accent",
    category: "outreach",
    roleInModel: "genera",
    kbCategories: ["outreach_doctrine", "sales_doctrine", "channel_rules"],
    criticalProcedures: [],
    requiredVars: [],
    promptSources: [
      { label: "Dottrina outreach", source: "outreach_doctrine", promptLabTab: "doctrine" },
      { label: "Regole canale", source: "channel_rules", promptLabTab: "doctrine" },
    ],
    runtime: {
      edgeFunction: "generate-outreach",
      modelDefault: "gpt-4o",
      triggers: ["Pianificazione outreach manuale", "Batch outreach da pipeline"],
    },
    tools: ["search_partners", "queue_outreach", "get_outreach_stats"],
    approvalRequiredTools: [],
    dependsOn: [],
    contract: {
      input: "{ partnerIds: string[], strategy?: string }",
      output: "{ sequences: OutreachSequence[], schedule: ScheduleItem[] }",
    },
  },

  "optimus-analyze": {
    id: "optimus-analyze",
    displayName: "Optimus Analyzer",
    description: "Analizzatore partner con valutazione e metriche globali. Esegue deep analysis su potenziali partner.",
    coreFile: "",
    avatarIcon: "BarChart3",
    avatarColor: "secondary",
    category: "analysis",
    roleInModel: "migliora",
    kbCategories: ["system_doctrine", "enrichment_rules"],
    criticalProcedures: [],
    requiredVars: [],
    promptSources: [
      { label: "Regole enrichment", source: "enrichment_rules", promptLabTab: "doctrine" },
      { label: "Dottrina di sistema", source: "system_doctrine", promptLabTab: "doctrine" },
    ],
    runtime: {
      edgeFunction: "",
      modelDefault: "gpt-4o",
      triggers: ["Analisi partner manuale", "Deep search automatica"],
    },
    tools: [], // TODO: implement edge function
    approvalRequiredTools: [],
    dependsOn: [],
    contract: {
      input: "{ partnerId: string, depth?: 'quick' | 'deep' }",
      output: "{ score: number, analysis: AnalysisSection[], recommendations: string[] }",
    },
  },

  "journalists-ai": {
    id: "journalists-ai",
    displayName: "Giornalista AI",
    description: "Giornalista AI per contenuti di marca e articoli editoriali. Genera contenuti professionali con brand voice.",
    coreFile: "",
    avatarIcon: "PenTool",
    avatarColor: "accent",
    category: "email",
    roleInModel: "giornalista",
    kbCategories: ["journalism_doctrine", "brand_voice", "editorial_rules"],
    criticalProcedures: [],
    requiredVars: [],
    promptSources: [
      { label: "Dottrina giornalistica", source: "journalism_doctrine", promptLabTab: "doctrine" },
      { label: "Brand voice", source: "brand_voice", promptLabTab: "doctrine" },
      { label: "Regole editoriali", source: "editorial_rules", promptLabTab: "doctrine" },
    ],
    runtime: {
      edgeFunction: "",
      modelDefault: "gpt-4o",
      triggers: ["Richiesta contenuto editoriale", "Generazione articolo"],
    },
    tools: [], // TODO: implement edge function
    approvalRequiredTools: [],
    dependsOn: [],
    contract: {
      input: "{ topic: string, format: 'article' | 'post' | 'newsletter', tone?: string }",
      output: "{ content: string, title: string, summary: string }",
    },
  },
};
