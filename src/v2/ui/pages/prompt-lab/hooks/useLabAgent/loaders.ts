import type { Block } from "../../types";
import { findKbEntries } from "@/data/kbEntries";
import { loadFullDoctrine } from "../useBlockCollector";
import { filterDoctrineForBlock } from "../useContextBuilder";

/**
 * Carica la KB doctrine COMPLETA e la filtra per rilevanza al blocco.
 * Usa la stessa logica del "Migliora tutto".
 */
export async function loadDoctrineForBlock(block: Block, tabLabel: string): Promise<string> {
  try {
    const fullDoctrine = await loadFullDoctrine();
    if (!fullDoctrine || fullDoctrine.startsWith("(")) return fullDoctrine;
    return filterDoctrineForBlock(fullDoctrine, block, tabLabel);
  } catch {
    return "(impossibile caricare KB doctrine)";
  }
}

/** Carica fino a N voci KB doctrine/system_doctrine come riferimento (legacy fallback). */
export async function loadDoctrineSnippet(maxEntries = 5): Promise<string> {
  try {
    const all = await findKbEntries();
    const doctrine = all
      .filter((e) => ["doctrine", "system_doctrine", "sales_doctrine"].includes(e.category))
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
      .slice(0, maxEntries);
    if (doctrine.length === 0) return "(nessuna voce doctrine disponibile)";
    return doctrine
      .map((d) => `• [${d.category}] ${d.title}: ${(d.content ?? "").slice(0, 220).replace(/\s+/g, " ").trim()}${(d.content ?? "").length > 220 ? "…" : ""}`)
      .join("\n");
  } catch {
    return "(impossibile caricare KB doctrine)";
  }
}

/**
 * Carica i template di prompt vocali ElevenLabs (Aurora/Bruce/Robin) dalla KB
 * come few-shot reference quando si migliora un blocco voce.
 */
export async function loadVoiceTemplatesFewShot(): Promise<string> {
  try {
    const all = await findKbEntries();
    const templates = all
      .filter(
        (e) =>
          e.category === "prompt_template" &&
          Array.isArray(e.tags) &&
          e.tags.includes("voice_template"),
      )
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    if (templates.length === 0) return "(nessun template voce disponibile in KB)";
    return templates
      .map(
        (t) =>
          `### ESEMPIO ${t.title}\n${(t.content ?? "").trim()}\n--- FINE ESEMPIO ---`,
      )
      .join("\n\n");
  } catch {
    return "(impossibile caricare i template voce)";
  }
}