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
import { useAiExportBundle } from "@/hooks/useAiExportBundle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileDown, Package } from "lucide-react";
import { toast } from "sonner";

import { createLogger } from "@/lib/log";
const log = createLogger("AIExportPanel");
// Static source files served at build-time as raw text
import scopeConfigsSource from "../../../supabase/functions/_shared/scopeConfigs.ts?raw";
import {
  type AgentRow,
  type KbRow,
  type OperativePromptRow,
  type MemoryRow,
  type AppSettingRow,
  type AgentPersonaRow,
  safeFilename,
  mdAgent,
  mdKb,
  mdOperativePrompt,
  mdAgentPromptsCatalog,
  mdAgentTemplatesCatalog,
  mdProcedures,
  mdReadme,
} from "./aiExportPanel.helpers";

export function AIExportPanel({ userId }: { userId: string }) {
  const [busy, setBusy] = useState(false);
  const fetchAiExportBundle = useAiExportBundle();

  const exportAll = async () => {
    setBusy(true);
    const t0 = performance.now();
    try {
      // Parallel fetch from DB
      const { agentsRes, kbRes, opRes, memRes, settingsRes, personasRes } =
        await fetchAiExportBundle(userId);

      const agents = (agentsRes.data ?? []) as AgentRow[];
      const kb = (kbRes.data ?? []) as KbRow[];
      const prompts = (opRes.data ?? []) as OperativePromptRow[];
      const memories = (memRes.data ?? []) as MemoryRow[];
      const settings = (settingsRes.data ?? []) as AppSettingRow[];
      const personas = (personasRes.data ?? []) as AgentPersonaRow[];

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

      // App settings (raggruppati in 1 file)
      if (settings.length > 0) {
        const settingsFolder = zip.folder("app_settings")!;
        let body = `# App Settings\n\n`;
        for (const s of settings) {
          body += `## ${s.key}\n\n\`\`\`\n${s.value ?? ""}\n\`\`\`\n\n_aggiornato: ${s.updated_at}_\n\n---\n\n`;
        }
        settingsFolder.file("settings.md", body);
      }

      // Agent personas (1 file per persona)
      if (personas.length > 0) {
        const personasFolder = zip.folder("agent_personas")!;
        for (const p of personas) {
          const agent = agents.find((a) => a.id === p.agent_id);
          const name = agent?.name ?? p.agent_id;
          let body = `# Persona: ${name}\n\n`;
          body += `- **Tono**: ${p.tone ?? "—"}\n- **Lingua**: ${p.language ?? "—"}\n\n`;
          if (p.custom_tone_prompt) body += `## Tone Prompt\n\n${p.custom_tone_prompt}\n\n`;
          if (p.style_rules?.length) body += `## Style Rules\n\n${p.style_rules.map((r) => `- ${r}`).join("\n")}\n\n`;
          if (p.vocabulary_do?.length) body += `## Vocabulary DO\n\n${p.vocabulary_do.map((r) => `- ${r}`).join("\n")}\n\n`;
          if (p.vocabulary_dont?.length) body += `## Vocabulary DON'T\n\n${p.vocabulary_dont.map((r) => `- ${r}`).join("\n")}\n\n`;
          if (p.signature_template) body += `## Signature\n\n\`\`\`\n${p.signature_template}\n\`\`\`\n\n`;
          personasFolder.file(`${safeFilename(name)}.md`, body);
        }
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
            app_settings: settings,
            agent_personas: personas,
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
        settings: settings.length,
        personas: personas.length,
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
        `Export pronto · ${stats.agents} agenti · ${stats.kb} KB · ${stats.prompts} prompt · ${stats.memories} memorie · ${stats.settings} settings · ${stats.personas} personas · ${elapsed}ms`,
      );
    } catch (e) {
      log.error("AIExportPanel error:", { error: e });
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
