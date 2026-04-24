/**
 * harmonizeCollector — collector tri-partito per "Armonizza tutto".
 *
 * Restituisce:
 *  - real:    inventario reale del DB
 *  - desired: inventario desiderato dalla libreria + documenti caricati
 *  - gaps:    classificazione in 4 bucket (text_only / needs_contract /
 *             needs_code_policy / needs_kb_governance)
 *
 * VINCOLO: l'Harmonizer LLM riceve SOLO i bucket text_only e
 * needs_kb_governance come materiale azionabile. Gli altri due diventano
 * note read-only per lo sviluppatore — così il modello non tenta di
 * "scrivere meglio" un problema che è di runtime/contratto/policy.
 */
import { findKbEntries } from "@/data/kbEntries";
import { findOperativePromptsFull } from "@/data/operativePrompts";
import { findEmailPromptsByScope } from "@/data/emailPrompts";
import { findEmailAddressRules } from "@/data/emailAddressRules";
import { findCommercialPlaybooks } from "@/data/commercialPlaybooks";
import { findAgentPersonas } from "@/data/agentPersonas";
import type { ParsedFile } from "../utils/fileParser";
import type { GapClassification, InventorySummary } from "@/data/harmonizeRuns";

/** Voce di inventario neutra (reale o desiderata). */
export interface InventoryItem {
  table: string;
  id?: string;
  category?: string;
  chapter?: string;
  title: string;
  content: string;
  priority?: number;
  figure?: string;
}

/** Singolo gap candidato. */
export interface GapCandidate {
  bucket: keyof GapClassification;
  desired: InventoryItem;
  /** Item reale corrispondente (se UPDATE/MOVE), altrimenti undefined (INSERT). */
  matched?: InventoryItem;
  /** Differenza testuale sintetica per il prompt. */
  reason: string;
}

export interface CollectorOutput {
  real: InventoryItem[];
  desired: InventoryItem[];
  gaps: {
    text_only: GapCandidate[];
    needs_contract: GapCandidate[];
    needs_code_policy: GapCandidate[];
    needs_kb_governance: GapCandidate[];
  };
  realSummary: InventorySummary;
  desiredSummary: InventorySummary;
  classification: GapClassification;
}

/** Heuristic mapping da "categoria suggerita" della libreria a tabella DB. */
const CATEGORY_TO_TABLE: Record<string, string> = {
  doctrine: "kb_entries",
  system_doctrine: "kb_entries",
  procedure: "kb_entries",
  kb_entry: "kb_entries",
  agent: "agents",
  persona: "agent_personas",
  playbook: "commercial_playbooks",
  operative: "operative_prompts",
  email: "email_prompts",
  system_prompt: "app_settings",
};

/** Patterns che indicano che il gap richiede un contratto backend. */
const CONTRACT_KEYWORDS = /\b(EmailBrief|VoiceBrief|ContactLifecycleBrief|OutreachBrief|contract|payload runtime|input strutturato)\b/i;

/** Patterns che indicano una policy hard nel codice. */
const POLICY_KEYWORDS = /\b(blacklist|guard|hard rule|never allow|forbidden|VIETATO|cap di sicurezza|safety cap)\b/i;

/** Carica TUTTO l'inventario reale dal DB (no filtri). */
export async function collectRealInventory(userId: string): Promise<InventoryItem[]> {
  const out: InventoryItem[] = [];

  try {
    const all = await findKbEntries();
    for (const e of all) {
      out.push({
        table: "kb_entries", id: e.id, category: e.category, chapter: e.chapter,
        title: e.title, content: e.content ?? "", priority: e.priority,
      });
    }
  } catch { /* skip */ }

  try {
    const ops = await findOperativePromptsFull(userId);
    for (const p of ops) {
      out.push({
        table: "operative_prompts", id: p.id, title: p.name,
        content: [p.objective, p.procedure, p.criteria].filter(Boolean).join("\n\n"),
      });
    }
  } catch { /* skip */ }

  try {
    const list = await findEmailPromptsByScope(userId, "global");
    for (const p of list) {
      out.push({ table: "email_prompts", id: p.id, title: p.title, content: p.instructions ?? "" });
    }
  } catch { /* skip */ }

  try {
    const rules = await findEmailAddressRules(userId);
    for (const r of rules) {
      out.push({
        table: "email_address_rules", id: r.id, title: r.email_address,
        content: [r.custom_prompt, r.notes].filter(Boolean).join("\n\n"),
      });
    }
  } catch { /* skip */ }

  try {
    const pbs = await findCommercialPlaybooks(userId);
    for (const p of pbs) {
      out.push({
        table: "commercial_playbooks", id: p.id, title: p.name,
        content: [p.description, p.prompt_template].filter(Boolean).join("\n\n"),
      });
    }
  } catch { /* skip */ }

  try {
    const personas = await findAgentPersonas(userId);
    for (const p of personas) {
      out.push({
        table: "agent_personas", id: p.id, title: `Persona ${p.agent_id.slice(0, 8)}`,
        content: [p.custom_tone_prompt, p.signature_template].filter(Boolean).join("\n\n"),
      });
    }
  } catch { /* skip */ }

  return out;
}

/**
 * Parser semplice della libreria: spacca per "## 📄" oppure "## " come fallback.
 * Estrae:
 *  - **Categoria suggerita:** <cat>
 *  - **Capitolo:** <chap>
 *  - **Priorità:** <num>
 *  - **Figura (opzionale):** <name>
 */
export function parseDesiredInventory(librarySource: string, uploadedDocs: ParsedFile[] = []): InventoryItem[] {
  const sources: Array<{ name: string; content: string }> = [];
  if (librarySource.trim()) sources.push({ name: "libreria-tmwe.md", content: librarySource });
  for (const f of uploadedDocs) sources.push({ name: f.name, content: f.content });

  const out: InventoryItem[] = [];
  for (const src of sources) {
    const sections = src.content.split(/\n(?=## (?:📄|📚|🎯|🤖|✉️|📞)?\s*)/g);
    for (const sec of sections) {
      const titleMatch = sec.match(/^##\s*(?:📄|📚|🎯|🤖|✉️|📞)?\s*(.+)$/m);
      if (!titleMatch) continue;
      const title = titleMatch[1].trim();
      if (!title || title.toLowerCase().includes("placeholder")) continue;

      const catMatch = sec.match(/\*\*Categoria suggerita:\*\*\s*(.+)/i);
      const chapMatch = sec.match(/\*\*Capitolo:\*\*\s*(.+)/i);
      const prioMatch = sec.match(/\*\*Priorit[àa]:\*\*\s*(\d+)/i);
      const figMatch = sec.match(/\*\*Figura(?:\s*\(opzionale\))?:\*\*\s*(.+)/i);

      const category = (catMatch?.[1] ?? "doctrine").trim().toLowerCase();
      const table = CATEGORY_TO_TABLE[category] ?? "kb_entries";
      const body = sec
        .replace(/^##.*$/m, "")
        .replace(/\*\*(?:Categoria suggerita|Capitolo|Priorit[àa]|Figura(?:\s*\(opzionale\))?):\*\*.+/gi, "")
        .trim();

      out.push({
        table,
        category,
        chapter: chapMatch?.[1]?.trim(),
        title,
        content: body,
        priority: prioMatch ? Number(prioMatch[1]) : 50,
        figure: figMatch?.[1]?.trim(),
      });
    }
  }
  return out;
}

/** Confronto fuzzy tra desired e real per matching. */
function findMatch(desired: InventoryItem, real: InventoryItem[]): InventoryItem | undefined {
  const dt = desired.title.toLowerCase().trim();
  // 1. match esatto su titolo + tabella
  const exact = real.find((r) => r.table === desired.table && r.title.toLowerCase().trim() === dt);
  if (exact) return exact;
  // 2. match parziale (titolo desired contenuto in titolo reale o viceversa)
  const partial = real.find(
    (r) => r.table === desired.table && (
      r.title.toLowerCase().includes(dt) || dt.includes(r.title.toLowerCase())
    ),
  );
  return partial;
}

/** Classifica i gap in 4 bucket. */
export function classifyGaps(real: InventoryItem[], desired: InventoryItem[]): CollectorOutput["gaps"] {
  const gaps: CollectorOutput["gaps"] = {
    text_only: [], needs_contract: [], needs_code_policy: [], needs_kb_governance: [],
  };

  for (const d of desired) {
    const m = findMatch(d, real);
    let bucket: keyof GapClassification = "text_only";
    let reason = "";

    if (POLICY_KEYWORDS.test(d.content)) {
      bucket = "needs_code_policy";
      reason = "Il contenuto desiderato menziona regole hard / guard che richiedono codice.";
    } else if (CONTRACT_KEYWORDS.test(d.content)) {
      bucket = "needs_contract";
      reason = "Il contenuto richiede un contratto backend strutturato (es. EmailBrief, VoiceBrief).";
    } else if (m && m.category && d.category && m.category !== d.category) {
      bucket = "needs_kb_governance";
      reason = `Il blocco esiste ma è in categoria "${m.category}" invece di "${d.category}".`;
    } else if (!m) {
      bucket = "text_only";
      reason = "Voce desiderata mancante nel DB. Candidata a INSERT testuale.";
    } else {
      bucket = "text_only";
      reason = "Voce esistente da allineare al testo desiderato (UPDATE).";
    }

    gaps[bucket].push({ bucket, desired: d, matched: m, reason });
  }

  return gaps;
}

/** Pipeline completa del collector. */
export async function runHarmonizeCollector(
  userId: string,
  librarySource: string,
  uploadedDocs: ParsedFile[] = [],
): Promise<CollectorOutput> {
  const [real, desired] = await Promise.all([
    collectRealInventory(userId),
    Promise.resolve(parseDesiredInventory(librarySource, uploadedDocs)),
  ]);

  const gaps = classifyGaps(real, desired);

  const summarize = (items: InventoryItem[]): InventorySummary => {
    const by: Record<string, number> = {};
    for (const i of items) by[i.table] = (by[i.table] ?? 0) + 1;
    return { by_table: by, total: items.length };
  };

  return {
    real,
    desired,
    gaps,
    realSummary: summarize(real),
    desiredSummary: summarize(desired),
    classification: {
      text_only: gaps.text_only.length,
      needs_contract: gaps.needs_contract.length,
      needs_code_policy: gaps.needs_code_policy.length,
      needs_kb_governance: gaps.needs_kb_governance.length,
    },
  };
}