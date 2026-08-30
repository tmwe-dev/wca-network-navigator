/**
 * DAL V3 — pagina "Duplicati" (Modulo 2).
 *
 * Sola lettura. Il raggruppamento avviene in memoria su un campione delle
 * aziende attive: serve a far vedere cosa unire, non a decidere da solo.
 * L'unione resta nella procedura di merge esistente.
 */
import { supabase } from "@/integrations/supabase/client";

export type V3TipoDuplicato = "email" | "azienda";

export interface V3MembroDuplicato {
  readonly id: string;
  readonly azienda: string;
  readonly email: string | null;
  readonly paese: string | null;
  readonly citta: string | null;
  readonly interazioni: number;
  readonly creatoIl: string | null;
}

export interface V3GruppoDuplicati {
  readonly chiave: string;
  readonly tipo: V3TipoDuplicato;
  readonly valore: string;
  readonly membri: readonly V3MembroDuplicato[];
}

export interface V3DuplicatiFiltri {
  readonly tipo: V3TipoDuplicato;
  /** Numero minimo di righe perché il gruppo sia mostrato. */
  readonly soglia: number;
  readonly ricerca?: string;
}

export interface V3DuplicatiRisultato {
  readonly gruppi: readonly V3GruppoDuplicati[];
  readonly campione: number;
  readonly righeCoinvolte: number;
}

const CAMPIONE = 4000;

function normalizzaAzienda(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b(s\.?r\.?l\.?|s\.?p\.?a\.?|ltd|llc|inc|gmbh|co|corp|company|srl|spa)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export async function listDuplicatiV3(filtri: V3DuplicatiFiltri): Promise<V3DuplicatiRisultato> {
  // PostgREST limita ogni risposta a 1000 righe: il campione si compone a blocchi.
  const BLOCCO = 1000;
  const righe: Record<string, unknown>[] = [];
  for (let from = 0; from < CAMPIONE; from += BLOCCO) {
    const { data, error } = await supabase
      .from("partners")
      .select("id, company_name, email, country_name, city, interaction_count, created_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .range(from, from + BLOCCO - 1);
    if (error) throw error;
    const blocco = (data ?? []) as Record<string, unknown>[];
    righe.push(...blocco);
    if (blocco.length < BLOCCO) break;
  }
  const gruppi = new Map<string, { valore: string; membri: V3MembroDuplicato[] }>();

  for (const row of righe) {
    const azienda = String(row.company_name ?? "").trim();
    const email = ((row.email as string | null) ?? "").trim();
    const chiave =
      filtri.tipo === "email" ? email.toLowerCase() : normalizzaAzienda(azienda);
    if (!chiave) continue;

    const membro: V3MembroDuplicato = {
      id: String(row.id),
      azienda: azienda || "Senza nome",
      email: email || null,
      paese: (row.country_name as string | null) ?? null,
      citta: (row.city as string | null) ?? null,
      interazioni: (row.interaction_count as number | null) ?? 0,
      creatoIl: (row.created_at as string | null) ?? null,
    };

    const esistente = gruppi.get(chiave);
    if (esistente) esistente.membri.push(membro);
    else gruppi.set(chiave, { valore: filtri.tipo === "email" ? email : azienda, membri: [membro] });
  }

  const ricerca = (filtri.ricerca ?? "").trim().toLowerCase();
  const soglia = Math.max(filtri.soglia, 2);

  const risultato = [...gruppi.entries()]
    .filter(([, g]) => g.membri.length >= soglia)
    .filter(([chiave, g]) =>
      ricerca ? chiave.includes(ricerca) || g.membri.some((m) => m.azienda.toLowerCase().includes(ricerca)) : true,
    )
    .map(([chiave, g]) => ({
      chiave,
      tipo: filtri.tipo,
      valore: g.valore || chiave,
      membri: g.membri.sort((a, b) => b.interazioni - a.interazioni),
    }))
    .sort((a, b) => b.membri.length - a.membri.length);

  return {
    gruppi: risultato,
    campione: righe.length,
    righeCoinvolte: risultato.reduce((sum, g) => sum + g.membri.length, 0),
  };
}
