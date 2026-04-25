/**
 * entityRetriever — Fetch on-demand del CONTENUTO COMPLETO di un entry indicizzato.
 *
 * Usato dall'orchestrator solo per i top-N candidati selezionati dal matcher.
 * Implementa cache in-memory (Map) per dedup tra entità che matchano gli stessi entry.
 */
import { findKbEntries } from "@/data/kbEntries";
import { findOperativePromptsFull } from "@/data/operativePrompts";
import { findEmailPromptsByScope } from "@/data/emailPrompts";
import { findEmailAddressRules } from "@/data/emailAddressRules";
import { findCommercialPlaybooks } from "@/data/commercialPlaybooks";
import { findAgentPersonas } from "@/data/agentPersonas";

export interface FullEntryContent {
  id: string;
  table: string;
  title: string;
  content: string;
  category?: string;
}

export interface RetrieverCache {
  byId: Map<string, FullEntryContent>;
  /** Tabelle già caricate completamente (per evitare query duplicate). */
  loadedTables: Set<string>;
  userId: string;
}

export function createRetrieverCache(userId: string): RetrieverCache {
  return { byId: new Map(), loadedTables: new Set(), userId };
}

/** Carica TUTTI i record di una tabella e li mette in cache. */
async function loadTableIntoCache(
  cache: RetrieverCache,
  table: string,
): Promise<void> {
  if (cache.loadedTables.has(table)) return;

  try {
    if (table === "kb_entries") {
      const list = await findKbEntries();
      for (const e of list) {
        cache.byId.set(e.id, {
          id: e.id,
          table,
          title: e.title,
          content: e.content ?? "",
          category: e.category,
        });
      }
    } else if (table === "operative_prompts") {
      const list = await findOperativePromptsFull(cache.userId);
      for (const p of list) {
        cache.byId.set(p.id, {
          id: p.id,
          table,
          title: p.name,
          content: [p.objective, p.procedure, p.criteria].filter(Boolean).join("\n\n"),
        });
      }
    } else if (table === "email_prompts") {
      const list = await findEmailPromptsByScope(cache.userId, "global");
      for (const p of list) {
        cache.byId.set(p.id, {
          id: p.id,
          table,
          title: p.title,
          content: p.instructions ?? "",
        });
      }
    } else if (table === "email_address_rules") {
      const list = await findEmailAddressRules(cache.userId);
      for (const r of list) {
        cache.byId.set(r.id, {
          id: r.id,
          table,
          title: r.email_address,
          content: [r.custom_prompt, r.notes].filter(Boolean).join("\n\n"),
        });
      }
    } else if (table === "commercial_playbooks") {
      const list = await findCommercialPlaybooks(cache.userId);
      for (const p of list) {
        cache.byId.set(p.id, {
          id: p.id,
          table,
          title: p.name,
          content: [p.description, p.prompt_template].filter(Boolean).join("\n\n"),
        });
      }
    } else if (table === "agent_personas") {
      const list = await findAgentPersonas(cache.userId);
      for (const p of list) {
        cache.byId.set(p.id, {
          id: p.id,
          table,
          title: `Persona ${p.agent_id.slice(0, 8)}`,
          content: [p.custom_tone_prompt, p.signature_template].filter(Boolean).join("\n\n"),
        });
      }
    }
    cache.loadedTables.add(table);
  } catch (err) {
    console.warn(`[entityRetriever] table ${table} load failed`, err);
    cache.loadedTables.add(table); // segna come "tentato" per non riprovare
  }
}

/**
 * Retrieve contenuto completo per una lista di candidati.
 * Carica in lazy le tabelle necessarie e mette in cache.
 */
export async function retrieveContents(
  cache: RetrieverCache,
  candidates: { id: string; table: string }[],
): Promise<FullEntryContent[]> {
  // Identifica tabelle non ancora caricate.
  const tablesToLoad = new Set<string>();
  for (const c of candidates) {
    if (!cache.loadedTables.has(c.table)) tablesToLoad.add(c.table);
  }

  // Carica in parallelo le tabelle mancanti.
  await Promise.all([...tablesToLoad].map((t) => loadTableIntoCache(cache, t)));

  // Risolvi i candidati dalla cache (truncate content a 4000 char per safety).
  const out: FullEntryContent[] = [];
  for (const c of candidates) {
    const found = cache.byId.get(c.id);
    if (found) {
      out.push({
        ...found,
        content: found.content.length > 4000
          ? `${found.content.slice(0, 4000)}\n[...troncato per safety...]`
          : found.content,
      });
    }
  }
  return out;
}
