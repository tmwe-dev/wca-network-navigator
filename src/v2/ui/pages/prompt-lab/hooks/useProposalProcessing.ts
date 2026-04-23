/**
 * useProposalProcessing — Handles block improvement requests and proposal generation.
 *
 * Manages:
 * - System map building
 * - Block improvement via Lab Agent
 * - Proposal state tracking
 */

import { type Block, type BlockSource, PROMPT_LAB_TABS } from "../types";
import { SYSTEM_MISSION } from "./useGlobalPromptImprover";
import { resolveBlockAgent, ORPHAN_AGENT_LABEL } from "./agentMapping";

/**
 * Classificazione dell'esito proposto dal Lab Agent.
 * Non tutti i problemi si risolvono riscrivendo il testo.
 */
export type OutcomeType =
  | "text_fix"             // Riscrittura testo sufficiente
  | "kb_fix"               // Serve aggiungere/modificare una voce KB
  | "contract_needed"      // Serve un contratto backend / logica runtime
  | "code_policy_needed"   // Serve una policy hard nel codice
  | "runtime_mapping_fix"  // Serve correggere il routing/mapping runtime (agente sbagliato, trigger errato)
  | "no_change";           // Blocco già ottimo, nessun intervento

export interface GlobalProposal {
  block: Block;
  tabLabel: string;
  tabActivation?: string;
  before: string;
  after?: string;
  status: "pending" | "improving" | "ready" | "skipped" | "error" | "saved";
  error?: string;
  /** Classificazione del tipo di intervento necessario */
  outcomeType?: OutcomeType;
  /** Nota architetturale se il problema non è solo testuale */
  architecturalNote?: string;
}

/** Stringa "tab label" per ogni tipo di sorgente. */
export function tabLabelFor(src: BlockSource): string {
  switch (src.kind) {
    case "app_setting": return src.key === "system_prompt_blocks" ? "System Prompt" : "Email";
    case "kb_entry": return "KB Doctrine";
    case "operative_prompt": return "Operative";
    case "email_prompt": return "Email";
    case "email_address_rule": return "Email";
    case "playbook": return "Playbooks";
    case "agent_persona": return "Agent Personas";
    case "agent": return "AI Profile";
    default: return "n/d";
  }
}

function activationFor(tabLabel: string): string | undefined {
  return PROMPT_LAB_TABS.find((t) => t.label === tabLabel)?.activation;
}

/** Costruisce una mappa testuale compatta di tutti i blocchi. */
export function buildSystemMap(all: ReadonlyArray<{ tabLabel: string; block: Block }>): string {
  const groups = new Map<string, Block[]>();
  for (const { tabLabel, block } of all) {
    if (!groups.has(tabLabel)) groups.set(tabLabel, []);
    groups.get(tabLabel)!.push(block);
  }
  const lines: string[] = [];
  for (const [tab, blocks] of groups) {
    const activation = activationFor(tab);
    lines.push(`\n## TAB: ${tab}`);
    if (activation) lines.push(`Attivazione runtime: ${activation}`);
    for (const b of blocks) {
      const snippet = (b.content || "(vuoto)").slice(0, 280).replace(/\s+/g, " ").trim();
      lines.push(`- [${b.id}] ${b.label}: ${snippet}${b.content.length > 280 ? "…" : ""}`);
    }
  }
  return lines.join("\n");
}

/**
 * Variante agent-centric: raggruppa per agente proprietario invece che per tab UI.
 * Usata dal "Migliora tutto" in modalità Atlas (Fase 3).
 * I blocchi orfani finiscono in una sezione dedicata in coda.
 */
export function buildSystemMapByAgent(all: ReadonlyArray<{ tabLabel: string; block: Block }>): string {
  const groups = new Map<string, { label: string; items: Block[] }>();
  for (const { block } of all) {
    const binding = resolveBlockAgent(block);
    const bucket = groups.get(binding.agentId);
    if (bucket) bucket.items.push(block);
    else groups.set(binding.agentId, { label: binding.agentLabel, items: [block] });
  }
  const lines: string[] = [];
  // Stampa prima gli agenti, poi orfani in coda
  const ordered = Array.from(groups.entries()).sort(([, a], [, b]) => {
    if (a.label === ORPHAN_AGENT_LABEL) return 1;
    if (b.label === ORPHAN_AGENT_LABEL) return -1;
    return a.label.localeCompare(b.label);
  });
  for (const [, { label, items }] of ordered) {
    lines.push(`\n## AGENT: ${label}`);
    for (const b of items) {
      const snippet = (b.content || "(vuoto)").slice(0, 280).replace(/\s+/g, " ").trim();
      lines.push(`- [${b.id}] ${b.label}: ${snippet}${b.content.length > 280 ? "…" : ""}`);
    }
  }
  return lines.join("\n");
}

/** Converte GlobalProposal[] a GlobalRunProposal[] per DB. */
export function toRunProposals(proposals: GlobalProposal[]): Array<{
  block_id: string;
  tab_label: string;
  tab_activation?: string;
  source: Record<string, unknown>;
  label: string;
  before: string;
  after?: string;
  status: string;
  error?: string;
}> {
  return proposals.map((p) => ({
    block_id: p.block.id,
    tab_label: p.tabLabel,
    tab_activation: p.tabActivation,
    source: p.block.source as unknown as Record<string, unknown>,
    label: p.block.label,
    before: p.before,
    after: p.after,
    status: p.status,
    error: p.error,
  }));
}
