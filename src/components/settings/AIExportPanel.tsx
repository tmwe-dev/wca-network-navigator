/**
 * AIExportPanel — Export completo leggibile (ZIP + Markdown) di:
 *  - Prompt agenti (DB: agents.system_prompt)
 *  - Prompt operativi (DB: operative_prompts)
 *  - Knowledge Base (DB: kb_entries)
 *  - Memorie AI (DB: ai_memory)
 *  - Logica statica: scopeConfigs, agentTemplates, agentPrompts, operationsProcedures
 *
 * Tutto compresso in un unico .zip scaricabile.
 */
import { useState } from "react";
import JSZip from "jszip";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileDown, Package } from "lucide-react";
import { toast } from "sonner";

import { AGENT_PROMPTS } from "@/data/agentPrompts";
import { AGENT_TEMPLATES, AGENT_DEFAULT_KB } from "@/data/agentTemplates";
import { OPERATIONS_PROCEDURES } from "@/data/operationsProcedures";

// Static source files served at build-time as raw text
import scopeConfigsSource from "../../../supabase/functions/_shared/scopeConfigs.ts?raw";

type AgentRow = {
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

type KbRow = {
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

type OperativePromptRow = {
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

type MemoryRow = {
  id: string;
  content: string;
  memory_type: string;
  level: number;
  importance: number;
  tags: string[] | null;
  created_at: string;
};

const safeFilename = (s: string) =>
  s.replace(/[^a-z0-9-_]+/gi, "_").replace(/_+/g, "_").slice(0, 80);

function mdAgent(a: AgentRow): string {
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

function mdKb(k: KbRow): string {
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

function mdOperativePrompt(p: OperativePromptRow): string {
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

function mdAgentPromptsCatalog(): string {
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

function mdAgentTemplatesCatalog(): string {
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

function mdProcedures(): string {
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

function mdReadme(stats: Record<string, number>): string {
  return `# Export AI Knowledge — WCA Network Navigator

Generato: ${new Date().toISOString()}

## Contenuto del pacchetto

| Cartella | Descrizione | Conteggio |
|---|---|---|
| \`agents/\` | Prompt e configurazione di ogni agente AI dal database | ${stats.agents} |
| \`knowledge_base/\` | Tutte le voci di KB attive | ${stats.kb} |
| \`operative_prompts/\` | Prompt operativi strutturati dal DB | ${stats.prompts} |
| \`memories/\` | Memorie AI consolidate (L2/L3) | ${stats.memories} |
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

export function AIExportPanel({ userId }: { userId: string }) {
  const [busy, setBusy] = useState(false);

  const exportAll = async () => {
    setBusy(true);
    const t0 = performance.now();
    try {
      // Parallel fetch from DB
      const [agentsRes, kbRes, opRes, memRes] = await Promise.all([
        supabase
          .from("agents")
          .select("id,name,role,avatar_emoji,is_active,system_prompt,knowledge_base,assigned_tools,created_at")
          .eq("user_id", userId)
          .order("name"),
        supabase
          .from("kb_entries")
          .select("id,title,content,category,chapter,tags,priority,is_active,source_path,created_at")
          .or(`user_id.eq.${userId},user_id.is.null`)
          .eq("is_active", true)
          .order("category")
          .order("priority", { ascending: false }),
        supabase
          .from("operative_prompts")
          .select("id,name,context,objective,procedure,criteria,examples,priority,tags,is_active,created_at")
          .eq("user_id", userId)
          .order("priority", { ascending: false }),
        supabase
          .from("ai_memory")
          .select("id,content,memory_type,level,importance,tags,created_at")
          .eq("user_id", userId)
          .gte("level", 2)
          .order("importance", { ascending: false })
          .limit(500),
      ]);

      const agents = (agentsRes.data ?? []) as AgentRow[];
      const kb = (kbRes.data ?? []) as KbRow[];
      const prompts = (opRes.data ?? []) as OperativePromptRow[];
      const memories = (memRes.data ?? []) as MemoryRow[];

      const zip = new JSZip();

      // Agents
      const agentsFolder = zip.folder("agents")!;
      for (const a of agents) {
        agentsFolder.file(`${safeFilename(a.name)}.md`, mdAgent(a));
      }

      // KB
      const kbFolder = zip.folder("knowledge_base")!;
      for (const k of kb) {
        const path = `${safeFilename(k.category)}/${safeFilename(k.title)}.md`;
        kbFolder.file(path, mdKb(k));
      }

      // Operative prompts
      const promptsFolder = zip.folder("operative_prompts")!;
      for (const p of prompts) {
        promptsFolder.file(`${safeFilename(p.name)}.md`, mdOperativePrompt(p));
      }

      // Memories
      const memFolder = zip.folder("memories")!;
      const memByType = new Map<string, MemoryRow[]>();
      for (const m of memories) {
        const k = m.memory_type || "general";
        if (!memByType.has(k)) memByType.set(k, []);
        memByType.get(k)!.push(m);
      }
      for (const [type, list] of memByType) {
        let body = `# Memorie: ${type}\n\n`;
        for (const m of list) {
          body += `## L${m.level} · importanza ${m.importance}\n\n${m.content}\n\n_tags: ${(m.tags ?? []).join(", ") || "—"}_\n\n---\n\n`;
        }
        memFolder.file(`${safeFilename(type)}.md`, body);
      }

      // Static logic
      const logicFolder = zip.folder("logic")!;
      logicFolder.file("01-scope-configs.ts", scopeConfigsSource);
      logicFolder.file("02-agent-prompts-catalog.md", mdAgentPromptsCatalog());
      logicFolder.file("03-agent-templates.md", mdAgentTemplatesCatalog());
      logicFolder.file("04-procedures.md", mdProcedures());

      // Raw JSON for restore
      zip.folder("raw")!.file(
        "full-backup.json",
        JSON.stringify(
          {
            exported_at: new Date().toISOString(),
            user_id: userId,
            agents,
            kb_entries: kb,
            operative_prompts: prompts,
            memories,
          },
          null,
          2,
        ),
      );

      const stats = {
        agents: agents.length,
        kb: kb.length,
        prompts: prompts.length,
        memories: memories.length,
      };
      zip.file("README.md", mdReadme(stats));

      const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `wca-ai-export-${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(url);

      const elapsed = Math.round(performance.now() - t0);
      toast.success(
        `Export pronto · ${stats.agents} agenti · ${stats.kb} KB · ${stats.prompts} prompt · ${stats.memories} memorie · ${elapsed}ms`,
      );
    } catch (e) {
      console.error("AIExportPanel error:", e);
      toast.error("Errore durante l'export");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Package className="h-4 w-4" />
          Export completo Knowledge AI
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Scarica un archivio <code>.zip</code> leggibile con tutti i prompt degli agenti, le voci di
          knowledge base, i prompt operativi, le memorie consolidate e la logica applicata
          (scope, template, procedure). Formato Markdown + JSON di backup tecnico.
        </p>
        <Button onClick={exportAll} disabled={busy} className="w-full sm:w-auto">
          <FileDown className="h-4 w-4 mr-2" />
          {busy ? "Generazione in corso..." : "Esporta tutto (.zip)"}
        </Button>
      </CardContent>
    </Card>
  );
}
