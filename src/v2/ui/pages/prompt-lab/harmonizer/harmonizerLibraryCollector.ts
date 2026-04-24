/**
 * harmonizerLibraryCollector — variante session-aware del collector classico.
 *
 * Differenze:
 *  - Riceve UN solo chunk del documento sorgente (non l'intero file).
 *  - Filtra l'inventario reale alle SOLE tabelle target del chunk (riduce rumore + token).
 *  - Esclude da `desired` ciò che è già stato creato nei chunk precedenti
 *    (evita re-INSERT, marca come "esistente" per gli UPDATE).
 *  - Applica `preloadedDuplicates` per skip silenzioso.
 */
import {
  collectRealInventory,
  parseDesiredInventoryDetailed,
  classifyGaps,
  type InventoryItem,
  type CollectorOutput,
} from "../hooks/harmonizeCollector";
import type { HarmonizerSession } from "@/data/harmonizerSessions";
import { sliceChunkLines, type TmweChunkDef } from "./tmweChunks";
import type { InventorySummary } from "@/data/harmonizeRuns";

export interface LibraryCollectorInput {
  userId: string;
  sourceText: string;
  chunkDef: TmweChunkDef;
  session: HarmonizerSession;
}

export async function runLibraryChunkCollector(
  input: LibraryCollectorInput,
): Promise<CollectorOutput> {
  const { userId, sourceText, chunkDef, session } = input;

  // 1. Slice: estrai SOLO le righe del chunk corrente.
  const chunkText = sliceChunkLines(sourceText, chunkDef);

  // 2. Inventario reale FILTRATO alle target tables del chunk.
  const allReal = await collectRealInventory(userId);
  const filteredReal = allReal.filter((i) => chunkDef.targetTables.includes(i.table));

  // 3. Aggiungi al "real" anche le entities_created dai chunk precedenti
  //    (così findMatch le riconosce come esistenti e non genera duplicati).
  const sessionCreated: InventoryItem[] = session.entities_created
    .filter((e) => chunkDef.targetTables.includes(e.table))
    .map((e) => ({
      table: e.table,
      id: e.id,
      title: e.title,
      content: `[creato in chunk #${e.created_in_chunk}]`,
    }));
  const realWithSession = [...filteredReal, ...sessionCreated];

  // 4. Parsa desired SOLO dal chunk corrente.
  const { items: desired, diagnostics } = parseDesiredInventoryDetailed(chunkText, []);

  // 5. Skip preloadedDuplicates.
  const dupTitles = new Set(
    chunkDef.preloadedDuplicates.map((d) => d.title.toLowerCase().trim()),
  );
  const desiredFiltered = desired.filter(
    (d) => !dupTitles.has(d.title.toLowerCase().trim()),
  );

  // 6. Classifica gap su realWithSession.
  const gaps = classifyGaps(realWithSession, desiredFiltered);

  const summarize = (items: InventoryItem[]): InventorySummary => {
    const by: Record<string, number> = {};
    for (const i of items) by[i.table] = (by[i.table] ?? 0) + 1;
    return { by_table: by, total: items.length };
  };

  return {
    real: realWithSession,
    desired: desiredFiltered,
    diagnostics,
    gaps,
    realSummary: summarize(realWithSession),
    desiredSummary: summarize(desiredFiltered),
    classification: {
      text_only: gaps.text_only.length,
      needs_contract: gaps.needs_contract.length,
      needs_code_policy: gaps.needs_code_policy.length,
      needs_kb_governance: gaps.needs_kb_governance.length,
    },
  };
}
