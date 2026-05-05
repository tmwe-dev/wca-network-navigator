import type { AgentRegistryEntry } from "@/data/agentPrompts";
import type { SimulatorResponse } from "@/data/agentSimulator";
import type { KbEntry } from "@/data/kbEntries";

export function buildAgentMarkdown(agent: AgentRegistryEntry, sim: SimulatorResponse | undefined, kb: KbEntry[]): string {
  const lines: string[] = [];
  lines.push(`# ${agent.displayName}`);
  lines.push("");
  lines.push(`> ${agent.description}`);
  lines.push("");
  lines.push(`- **Categoria:** ${agent.category}`);
  lines.push(`- **Edge function:** ${agent.runtime.edgeFunction || "—"}`);
  lines.push(`- **Modello default:** ${agent.runtime.modelDefault}`);
  lines.push(`- **Categorie KB:** ${agent.kbCategories.join(", ") || "—"}`);
  lines.push("");
  if (sim) {
    lines.push(`## System prompt assemblato (${sim.assembled.char_count.toLocaleString("it-IT")} caratteri)`);
    lines.push("");
    lines.push("```");
    lines.push(sim.assembled.system_prompt || "(vuoto)");
    lines.push("```");
    lines.push("");
    lines.push("## Persona");
    lines.push("");
    if (sim.persona.loaded) {
      lines.push(`- Tono: ${sim.persona.tone ?? "—"}`);
      lines.push(`- Lingua: ${sim.persona.language ?? "—"}`);
      lines.push("");
      lines.push("```");
      lines.push(sim.persona.block_preview ?? "");
      lines.push("```");
    } else {
      lines.push(`_${sim.persona.note ?? "Nessuna persona definita."}_`);
    }
    lines.push("");
    lines.push(`## Prompt operativi (${sim.operative_prompts.applied.length})`);
    lines.push("");
    if (sim.operative_prompts.applied.length === 0) {
      lines.push("_Nessun prompt operativo applicato._");
    } else {
      lines.push(sim.operative_prompts.applied.map((n) => `- ${n}`).join("\n"));
      lines.push("");
      lines.push("```");
      lines.push(sim.operative_prompts.block_preview || "");
      lines.push("```");
    }
    lines.push("");
    lines.push("## Tool effettivi");
    lines.push("");
    lines.push(`Consentiti: ${sim.tools.effective.join(", ") || "nessuno"}`);
    if (sim.tools.filtered_out.length > 0) {
      lines.push("");
      lines.push(`Filtrati dalle capabilities: ${sim.tools.filtered_out.join(", ")}`);
    }
    lines.push("");
    lines.push("## Hard guards");
    lines.push("");
    lines.push(`- Tabelle vietate: ${sim.hard_guards.forbidden_tables.join(", ")}`);
    lines.push(`- Operazioni distruttive bloccate: ${sim.hard_guards.destructive_ops_blocked.join(", ")}`);
    lines.push(`- Approvazione sempre richiesta: ${sim.hard_guards.approval_required_always.join(", ")}`);
    lines.push("");
  }
  lines.push(`## Knowledge Base usata (${kb.length} entry)`);
  lines.push("");
  if (kb.length === 0) {
    lines.push("_Nessuna entry KB attiva nelle categorie consultate da questo agente._");
  } else {
    let lastChapter = "";
    let lastCategory = "";
    for (const e of kb) {
      if (e.category !== lastCategory) {
        lines.push("");
        lines.push(`### Categoria: \`${e.category}\``);
        lastCategory = e.category;
        lastChapter = "";
      }
      const chap = e.chapter || "(senza capitolo)";
      if (chap !== lastChapter) {
        lines.push("");
        lines.push(`#### ${chap}`);
        lastChapter = chap;
      }
      lines.push("");
      lines.push(`**${e.title}**  \n_priority ${e.priority} · tags: ${e.tags?.join(", ") || "—"}_`);
      lines.push("");
      lines.push(e.content);
    }
  }
  lines.push("");
  return lines.join("\n");
}

export function buildToolsMarkdown(allAgents: AgentRegistryEntry[], sims: Record<string, SimulatorResponse>): string {
  const lines: string[] = [];
  lines.push("# Funzioni & Strumenti — agenti AI");
  lines.push("");
  lines.push(`Generato: ${new Date().toLocaleString("it-IT")}`);
  lines.push("");
  const universe = new Set<string>();
  for (const s of Object.values(sims)) for (const t of s.tools.all_registered) universe.add(t);
  for (const a of allAgents) for (const t of a.tools) universe.add(t);
  const sortedUniverse = Array.from(universe).sort();

  const toolToAgents = new Map<string, string[]>();
  for (const a of allAgents) {
    const sim = sims[a.id];
    const list = sim ? sim.tools.effective : a.tools;
    for (const t of list) {
      if (!toolToAgents.has(t)) toolToAgents.set(t, []);
      toolToAgents.get(t)!.push(a.displayName);
    }
  }

  lines.push("## Catalogo tool");
  lines.push("");
  for (const t of sortedUniverse) {
    const users = toolToAgents.get(t) ?? [];
    lines.push(`### \`${t}\``);
    lines.push(`- Agenti che lo usano (${users.length}): ${users.join(", ") || "—"}`);
    lines.push("");
  }

  lines.push("---");
  lines.push("");
  lines.push("## Agenti — tool effettivi");
  lines.push("");
  for (const a of allAgents) {
    const sim = sims[a.id];
    lines.push(`### ${a.displayName} (\`${a.id}\`)`);
    lines.push(`- Edge function: ${a.runtime.edgeFunction || "—"}`);
    lines.push(`- Modello: ${a.runtime.modelDefault}`);
    if (sim) {
      lines.push(`- Tool consentiti: ${sim.tools.effective.join(", ") || "nessuno"}`);
      if (sim.tools.filtered_out.length) {
        lines.push(`- Tool filtrati: ${sim.tools.filtered_out.join(", ")}`);
      }
      const approval = sim.tools.approval_map.filter((m) => m.requires_approval).map((m) => m.name);
      if (approval.length) lines.push(`- Richiedono approvazione: ${approval.join(", ")}`);
    } else {
      lines.push(`- Tool dichiarati (registry): ${a.tools.join(", ") || "nessuno"}`);
      if (a.approvalRequiredTools.length) {
        lines.push(`- Richiedono approvazione: ${a.approvalRequiredTools.join(", ")}`);
      }
    }
    lines.push("");
  }
  return lines.join("\n");
}