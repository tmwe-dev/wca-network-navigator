/**
 * useArchitectKb — carica la procedura Lab Architect (Fase 4).
 *
 * La categoria `lab_architect_procedure` è ISOLATA: nessun assembler runtime
 * la include nei prompt di produzione (verificato via grep su supabase/functions/).
 * Viene caricata SOLO quando il Lab Agent è in modalità Architect.
 *
 * Cache in modulo (singleton lazy) per evitare round-trip ripetuti durante
 * un singolo run di analisi multi-blocco.
 */
import { useCallback } from "react";
import { findKbEntries } from "@/data/kbEntries";

const ARCHITECT_KB_CATEGORY = "lab_architect_procedure";

let cachedProcedure: string | null = null;
let inflight: Promise<string> | null = null;

async function loadArchitectProcedureRaw(): Promise<string> {
  try {
    const all = await findKbEntries();
    const entries = all
      .filter((e) => e.category === ARCHITECT_KB_CATEGORY && e.is_active)
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    if (entries.length === 0) {
      return "(procedura Architect non trovata in KB — usa fallback minimo)";
    }
    return entries
      .map((e) => `### ${e.title}\n${e.content ?? ""}`)
      .join("\n\n---\n\n");
  } catch {
    return "(impossibile caricare procedura Architect)";
  }
}

export function useArchitectKb() {
  const loadProcedure = useCallback(async (): Promise<string> => {
    if (cachedProcedure !== null) return cachedProcedure;
    if (inflight) return inflight;
    inflight = loadArchitectProcedureRaw().then((p) => {
      cachedProcedure = p;
      inflight = null;
      return p;
    });
    return inflight;
  }, []);

  const invalidate = useCallback(() => {
    cachedProcedure = null;
    inflight = null;
  }, []);

  return { loadProcedure, invalidate };
}

export const ARCHITECT_KB_CATEGORY_ID = ARCHITECT_KB_CATEGORY;
