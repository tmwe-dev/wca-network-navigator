/**
 * compactIndex — Snapshot METADATI ONLY del DB reale per le 6 tabelle target.
 *
 * Differenza chiave da `collectRealInventory`:
 *  - Zero contenuti (per evitare token explosion)
 *  - Solo: id, title, table, category, contentLength
 *  - Map secondarie per match O(1) per tabella e per titolo normalizzato
 *
 * Dimensione attesa: ~5KB per ~200 entry. Resta SEMPRE in memoria del client.
 * Il contenuto vero viene fetchato on-demand da `entityRetriever`.
 */
import { findKbEntries } from "@/data/kbEntries";
import { findOperativePromptsFull } from "@/data/operativePrompts";
import { findEmailPromptsByScope } from "@/data/emailPrompts";
import { findEmailAddressRules } from "@/data/emailAddressRules";
import { findCommercialPlaybooks } from "@/data/commercialPlaybooks";
import { findAgentPersonas } from "@/data/agentPersonas";

import { createLogger } from "@/lib/log";
const log = createLogger("compactIndex");

export interface IndexEntry {
  id: string;
  table: string;
  title: string;
  category?: string;
  /** Dimensione del contenuto reale (per heuristics di matching). */
  contentLength: number;
}

export interface CompactIndex {
  entries: IndexEntry[];
  /** entries raggruppate per tabella. */
  byTable: Map<string, IndexEntry[]>;
  /** lookup veloce per titolo normalizzato (lowercase trim). */
  byTitle: Map<string, IndexEntry[]>;
  stats: {
    total: number;
    byTable: Record<string, number>;
    estimatedBytes: number;
  };
}

function normalizeTitle(t: string): string {
  return t.toLowerCase().replace(/\s+/g, " ").trim();
}

function len(s?: string | null): number {
  return s ? s.length : 0;
}

function isTransientFetchError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /failed to fetch|networkerror|load failed|fetch/i.test(message);
}

async function withFetchRetry<T>(label: string, operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isTransientFetchError(error) || attempt === 2) break;
      await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
    }
  }
  log.warn(`[compactIndex] ${label} failed after retry`, { error: lastError });
  throw lastError;
}

/**
 * Carica tutti i metadati delle 6 tabelle target in parallelo.
 * Errori per-tabella vengono loggati e bypassati (resilienza).
 */
export async function buildCompactIndex(userId: string): Promise<CompactIndex> {
  const settled = await Promise.allSettled([
    withFetchRetry("kb_entries", () => findKbEntries()),
    withFetchRetry("operative_prompts", () => findOperativePromptsFull(userId)),
    withFetchRetry("email_prompts", () => findEmailPromptsByScope(userId, "global")),
    withFetchRetry("email_address_rules", () => findEmailAddressRules(userId)),
    withFetchRetry("commercial_playbooks", () => findCommercialPlaybooks(userId)),
    withFetchRetry("agent_personas", () => findAgentPersonas(userId)),
  ]);

  const entries: IndexEntry[] = [];

  // 0 — kb_entries
  if (settled[0].status === "fulfilled") {
    for (const e of settled[0].value) {
      entries.push({
        id: e.id,
        table: "kb_entries",
        title: e.title,
        category: e.category,
        contentLength: len(e.content),
      });
    }
  } else {
    log.warn("[compactIndex] kb_entries failed", { error: settled[0].reason });
  }

  // 1 — operative_prompts
  if (settled[1].status === "fulfilled") {
    for (const p of settled[1].value) {
      entries.push({
        id: p.id,
        table: "operative_prompts",
        title: p.name,
        contentLength: len(p.objective) + len(p.procedure) + len(p.criteria),
      });
    }
  } else {
    log.warn("[compactIndex] operative_prompts failed", { error: settled[1].reason });
  }

  // 2 — email_prompts
  if (settled[2].status === "fulfilled") {
    for (const p of settled[2].value) {
      entries.push({
        id: p.id,
        table: "email_prompts",
        title: p.title,
        contentLength: len(p.instructions),
      });
    }
  } else {
    log.warn("[compactIndex] email_prompts failed", { error: settled[2].reason });
  }

  // 3 — email_address_rules
  if (settled[3].status === "fulfilled") {
    for (const r of settled[3].value) {
      entries.push({
        id: r.id,
        table: "email_address_rules",
        title: r.email_address,
        contentLength: len(r.custom_prompt) + len(r.notes),
      });
    }
  } else {
    log.warn("[compactIndex] email_address_rules failed", { error: settled[3].reason });
  }

  // 4 — commercial_playbooks
  if (settled[4].status === "fulfilled") {
    for (const p of settled[4].value) {
      entries.push({
        id: p.id,
        table: "commercial_playbooks",
        title: p.name,
        contentLength: len(p.description) + len(p.prompt_template),
      });
    }
  } else {
    log.warn("[compactIndex] commercial_playbooks failed", { error: settled[4].reason });
  }

  // 5 — agent_personas
  if (settled[5].status === "fulfilled") {
    for (const p of settled[5].value) {
      entries.push({
        id: p.id,
        table: "agent_personas",
        title: `Persona ${p.agent_id.slice(0, 8)}`,
        contentLength: len(p.custom_tone_prompt) + len(p.signature_template),
      });
    }
  } else {
    log.warn("[compactIndex] agent_personas failed", { error: settled[5].reason });
  }

  // Costruisci mappe.
  const byTable = new Map<string, IndexEntry[]>();
  const byTitle = new Map<string, IndexEntry[]>();
  const tableCounts: Record<string, number> = {};

  for (const e of entries) {
    const tList = byTable.get(e.table) ?? [];
    tList.push(e);
    byTable.set(e.table, tList);

    const key = normalizeTitle(e.title);
    const titleList = byTitle.get(key) ?? [];
    titleList.push(e);
    byTitle.set(key, titleList);

    tableCounts[e.table] = (tableCounts[e.table] ?? 0) + 1;
  }

  const estimatedBytes = JSON.stringify(entries).length;

  return {
    entries,
    byTable,
    byTitle,
    stats: {
      total: entries.length,
      byTable: tableCounts,
      estimatedBytes,
    },
  };
}

/** Bootstrap entities da iniettare nella sessione (id reali del DB). */
export function indexToBootstrapEntities(index: CompactIndex): {
  table: string;
  id?: string;
  title: string;
  created_in_chunk: number;
}[] {
  return index.entries.map((e) => ({
    table: e.table,
    id: e.id,
    title: e.title,
    created_in_chunk: 0, // 0 = bootstrap (pre-pipeline)
  }));
}
