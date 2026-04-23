/**
 * agentMapping — Mappa BlockSource → AgentRegistryEntry per il Lab Agent.
 *
 * Fase 3 dell'evoluzione Atlas/Architect: il "Migliora tutto" deve poter
 * raggruppare i blocchi per agente proprietario (non più per tab UI), così
 * che il contesto dei "Blocchi vicini" diventi semanticamente corretto:
 * blocchi che convivono nello stesso runtime, non blocchi che convivono
 * nello stesso tab dell'editor.
 *
 * NOTA — DEBITO TECNICO V1:
 * Il mapping è basato su euristiche derivate da AGENT_REGISTRY[*].promptSources.
 * Quando un blocco è ambiguo (es. KB doctrine condivisa da N agenti) viene
 * assegnato all'agente con priorità più alta secondo OWNERSHIP_RANK; gli
 * altri agenti vedono comunque la KB completa via doctrineFull, quindi non
 * c'è perdita di contesto, solo "ownership" per la selezione dei vicini.
 */

import type { Block, BlockSource } from "../types";
import { AGENT_REGISTRY, type AgentRegistryEntry } from "@/data/agentPrompts";

/**
 * Priorità di ownership quando più agenti condividono la stessa sorgente.
 * Il primo che matcha vince. Riflette "chi è il primo consumatore" del blocco.
 */
const OWNERSHIP_RANK: ReadonlyArray<string> = [
  // Generativi: ownership forte sui propri prompt operativi
  "generate-email",
  "email-improver",
  "generate-outreach",
  "voice-elevenlabs",
  // Cockpit/contacts: ownership su operative_prompts e procedure email/WA
  "cockpit-assistant",
  "contacts-assistant",
  // Strategici/conversazionali: ownership su system_prompt + ai_profile
  "luca",
  "super-assistant",
];

/** Bucket sintetico per blocchi orfani (non mappati a nessun agente noto). */
export const ORPHAN_AGENT_ID = "__orphan__";
export const ORPHAN_AGENT_LABEL = "Blocchi non mappati";

/** Risultato della risoluzione per un blocco. */
export interface BlockAgentBinding {
  agentId: string;
  agentLabel: string;
  /** Tutti gli agenti che leggono questo blocco (incluso owner). Utile per diagnostica. */
  consumers: string[];
}

/** Mappa diretta dichiarativa per source → owner candidate set. */
function candidatesForSource(src: BlockSource): string[] {
  const out = new Set<string>();
  for (const [id, entry] of Object.entries(AGENT_REGISTRY)) {
    if (matchesSource(entry, src)) out.add(id);
  }
  return Array.from(out);
}

function matchesSource(entry: AgentRegistryEntry, src: BlockSource): boolean {
  for (const ps of entry.promptSources) {
    const s = ps.source.toLowerCase();
    switch (src.kind) {
      case "app_setting":
        if (s.includes(src.key.toLowerCase())) return true;
        // ai_profile: blocchi app_settings.ai_*
        if (src.key.startsWith("ai_") && s.includes("app_settings.ai_")) return true;
        break;
      case "kb_entry":
        if (s.includes("kb_entries")) return true;
        break;
      case "operative_prompt":
        if (s.includes("operative_prompts")) return true;
        break;
      case "email_prompt":
        if (s.includes("email_prompts")) return true;
        break;
      case "email_address_rule":
        if (s.includes("email_address_rules")) return true;
        break;
      case "playbook":
        if (s.includes("commercial_playbooks")) return true;
        break;
      case "agent_persona":
        if (s.includes("agent_personas")) return true;
        break;
      case "agent":
        if (s.includes("agents.")) return true;
        break;
    }
  }
  return false;
}

/** Risolve l'agente proprietario di un blocco. Mai null: fallback a ORPHAN. */
export function resolveBlockAgent(block: Block): BlockAgentBinding {
  const candidates = candidatesForSource(block.source);
  if (candidates.length === 0) {
    return { agentId: ORPHAN_AGENT_ID, agentLabel: ORPHAN_AGENT_LABEL, consumers: [] };
  }
  // Owner = primo candidate per OWNERSHIP_RANK; tie-break = primo in ordine alfabetico
  const ranked = [...candidates].sort((a, b) => {
    const ra = OWNERSHIP_RANK.indexOf(a);
    const rb = OWNERSHIP_RANK.indexOf(b);
    const aIdx = ra === -1 ? OWNERSHIP_RANK.length : ra;
    const bIdx = rb === -1 ? OWNERSHIP_RANK.length : rb;
    if (aIdx !== bIdx) return aIdx - bIdx;
    return a.localeCompare(b);
  });
  const owner = ranked[0];
  const ownerEntry = AGENT_REGISTRY[owner];
  return {
    agentId: owner,
    agentLabel: ownerEntry?.displayName ?? owner,
    consumers: candidates,
  };
}

/** Raggruppa una lista di blocchi per agente proprietario. */
export function groupBlocksByAgent(
  all: ReadonlyArray<{ tabLabel: string; block: Block }>,
): Map<string, { agentLabel: string; items: Array<{ tabLabel: string; block: Block }> }> {
  const groups = new Map<string, { agentLabel: string; items: Array<{ tabLabel: string; block: Block }> }>();
  for (const item of all) {
    const binding = resolveBlockAgent(item.block);
    const bucket = groups.get(binding.agentId);
    if (bucket) {
      bucket.items.push(item);
    } else {
      groups.set(binding.agentId, { agentLabel: binding.agentLabel, items: [item] });
    }
  }
  return groups;
}
