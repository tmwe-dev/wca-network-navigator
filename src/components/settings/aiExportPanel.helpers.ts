/**
 * aiExportPanel.helpers — Types + Markdown builders puri per AIExportPanel.
 * Estratti per alleggerire il componente UI senza toccare la logica di export.
 */
import { AGENT_PROMPTS } from "@/constants/agentPrompts";
import { AGENT_TEMPLATES, AGENT_DEFAULT_KB } from "@/constants/agentTemplates";
import { OPERATIONS_PROCEDURES } from "@/constants/operationsProcedures";

export type AgentRow = {
  id: string;
  name: string;
  role: string;
  avatar_emoji: string | null;
  is_active: boolean;
  system_prompt: string | null;
  knowledge_base: unknown;
  assigned_tools: unknown;
  created_at: string;
};

export type KbRow = {
  id: string;
  title: string;
  content: string;
  category: string;
  chapter: string;
  tags: string[] | null;
  priority: number;
  is_active: boolean;
  source_path: string | null;
  created_at: string;
};

export type OperativePromptRow = {
  id: string;
  name: string;
  context: string;
  objective: string;
  procedure: string;
  criteria: string;
  examples: string;
  priority: number;
  tags: string[] | null;
  is_active: boolean;
  created_at: string;
};

export type MemoryRow = {
  id: string;
  content: string;
  memory_type: string;
  level: number;
  importance: number;
  tags: string[] | null;
  created_at: string;
};

export type AppSettingRow = {
  id: string;
  key: string;
  value: string | null;
  updated_at: string;
};

export type AgentPersonaRow = {
  id: string;
  agent_id: string;
  tone: string | null;
  custom_tone_prompt: string | null;
  language: string | null;
  style_rules: string[] | null;
  vocabulary_do: string[] | null;
  vocabulary_dont: string[] | null;
  example_messages: unknown;
  signature_template: string | null;
};

export const safeFilename = (s: string) =>
  s.replace(/[^a-z0-9-_]+/gi, "_").replace(/_+/g, "_").slice(0, 80);

export function mdAgent(a: AgentRow): string {
  const tools = JSON.stringify(a.assigned_tools, null, 2);
  const kb = JSON.stringify(a.knowledge_base, null, 2);
  return `# Agente: ${a.name} ${a.avatar_emoji ?? ""}

- **Ruolo**: ${a.role}
- **Stato**: ${a.is_active ? "attivo" : "disattivo"}
- **ID**: \`${a.id}\`
- **Creato**: ${a.created_at}

## System Prompt

\`\`\`
${a.system_prompt ?? "(vuoto)"}
\`\`\`

## Tool assegnati

\`\`\`json
${tools}
\`\`\`

## Knowledge Base assegnata

\`\`\`json
${kb}
\`\`\`
`;
}

export function mdKb(k: KbRow): string {
  return `# ${k.title}

- **Categoria**: ${k.category} → ${k.chapter}
- **Tag**: ${(k.tags ?? []).join(", ") || "—"}
- **Priorità**: ${k.priority}
- **Stato**: ${k.is_active ? "attiva" : "disattiva"}
- **Sorgente**: ${k.source_path ?? "—"}
- **ID**: \`${k.id}\`

---

${k.content}
`;
}

export function mdOperativePrompt(p: OperativePromptRow): string {
  return `# ${p.name}

- **Contesto**: ${p.context}
- **Obiettivo**: ${p.objective || "—"}
- **Priorità**: ${p.priority}
- **Tag**: ${(p.tags ?? []).join(", ") || "—"}
- **Stato**: ${p.is_active ? "attivo" : "disattivo"}
- **ID**: \`${p.id}\`

## Procedura

${p.procedure || "_(vuota)_"}

## Criteri

${p.criteria || "_(vuoti)_"}

## Esempi

${p.examples || "_(nessuno)_"}
`;
}

export function mdAgentPromptsCatalog(): string {
  let out = `# Catalogo prompt agenti hardcoded\n\n`;
  out += `Fonte: \`src/data/agentPrompts.ts\`. Questi prompt sono hardcoded nelle edge function per performance, ma rappresentano la fonte di verità documentale.\n\n`;
  for (const [key, v] of Object.entries(AGENT_PROMPTS)) {
    out += `## ${key}\n\n`;
    out += `**Ruolo**: ${v.role}\n\n`;
    out += `**Regole**:\n`;
    for (const r of v.rules) out += `- ${r}\n`;
    if (v.outputFormat) out += `\n**Formato output**: ${v.outputFormat}\n`;
    if (v.contextInjection) out += `\n**Iniezione contesto**: ${v.contextInjection.join(", ")}\n`;
    out += `\n---\n\n`;
  }
  return out;
}

export function mdAgentTemplatesCatalog(): string {
  let out = `# Catalogo template agenti predefiniti\n\nFonte: \`src/data/agentTemplates/\`.\n\n`;
  for (const [key, t] of Object.entries(AGENT_TEMPLATES)) {
    out += `## ${t.name} (\`${key}\`)\n\n`;
    out += `\`\`\`\n${t.system_prompt}\n\`\`\`\n\n`;
    if (t.assigned_tools?.length) {
      out += `**Tool**: \`${JSON.stringify(t.assigned_tools)}\`\n\n`;
    }
    out += `---\n\n`;
  }
  out += `\n# Knowledge Base di default per ruolo\n\n`;
  for (const [role, items] of Object.entries(AGENT_DEFAULT_KB)) {
    out += `## Ruolo: \`${role}\`\n\n`;
    for (const kb of items) {
      out += `### ${kb.title}\n\n${kb.content}\n\n`;
    }
    out += `---\n\n`;
  }
  return out;
}

export function mdProcedures(): string {
  let out = `# Procedure operative\n\nFonte: \`src/data/operationsProcedures/\`. Logica applicata: workflow, prerequisiti, step.\n\n`;
  for (const p of OPERATIONS_PROCEDURES) {
    out += `## ${p.name}\n\n`;
    out += `- **ID**: \`${p.id}\`\n- **Categoria**: ${p.category}\n- **Tag**: ${p.tags.join(", ")}\n\n`;
    out += `${p.description}\n\n`;
    if (p.prerequisites?.length) {
      out += `### Prerequisiti\n`;
      for (const pre of p.prerequisites) out += `- ${pre.label}\n`;
      out += `\n`;
    }
    out += `### Step\n`;
    p.steps.forEach((s) => {
      out += `${s.order}. **${s.action}**${s.detail ? ` — ${s.detail}` : ""}${s.tool ? ` _(tool: ${s.tool})_` : ""}${s.optional ? " _[opzionale]_" : ""}\n`;
    });
    if (p.tips?.length) {
      out += `\n### Tips\n`;
      for (const t of p.tips) out += `- ${t}\n`;
    }
    out += `\n---\n\n`;
  }
  return out;
}

export function mdReadme(stats: Record<string, number>): string {
  return `# Export AI Knowledge — WCA Network Navigator

Generato: ${new Date().toISOString()}

## Contenuto del pacchetto

| Cartella | Descrizione | Conteggio |
|---|---|---|
| \`agents/\` | Prompt e configurazione di ogni agente AI dal database | ${stats.agents} |
| \`knowledge_base/\` | Tutte le voci di KB attive | ${stats.kb} |
| \`operative_prompts/\` | Prompt operativi strutturati dal DB | ${stats.prompts} |
| \`memories/\` | Memorie AI consolidate (L2/L3) | ${stats.memories} |
| \`app_settings/\` | Impostazioni applicazione (profilo AI, tone, prompt email) | ${stats.settings} |
| \`agent_personas/\` | Persona di voce/stile per ogni agente | ${stats.personas} |
| \`logic/\` | Logica statica: scope, template, procedure | 4 file |
| \`raw/\` | JSON tecnico completo (per ripristino) | 1 file |

## File logica statica

- \`logic/01-scope-configs.ts\` — Prompt per scope (cockpit, contacts, strategic, …)
- \`logic/02-agent-prompts-catalog.md\` — Catalogo prompt agenti (\`AGENT_PROMPTS\`)
- \`logic/03-agent-templates.md\` — Template predefiniti per creare nuovi agenti
- \`logic/04-procedures.md\` — Procedure operative del CRM

## Ripristino

Il file \`raw/full-backup.json\` contiene il dump tecnico completo per eventuale re-import.
`;
}