/**
 * DAL V3 — Cestino (Modulo 2, Contatti).
 *
 * Le policy RLS nascondono le righe soft-deleted al client: la lettura passa
 * dalla RPC `v3_list_deleted` (security definer, riservata agli operatori).
 * Il ripristino (`v3_restore_deleted`) vale solo per partner e contatti;
 * i messaggi eliminati restano in sola lettura.
 */
import { supabase } from "@/integrations/supabase/client";

export type V3TipoEliminato = "partner" | "contatto" | "messaggio";

export interface V3ElementoEliminato {
  readonly tipo: V3TipoEliminato;
  readonly id: string;
  readonly nome: string;
  readonly dettaglio: string | null;
  readonly eliminatoIl: string | null;
}

export interface V3CestinoFiltri {
  readonly tipo?: V3TipoEliminato | null;
  readonly giorni: number;
  readonly limite: number;
}

export async function listCestinoV3(filtri: V3CestinoFiltri): Promise<readonly V3ElementoEliminato[]> {
  const { data, error } = await supabase.rpc("v3_list_deleted" as never, {
    _tipo: filtri.tipo ?? null,
    _giorni: Math.max(filtri.giorni, 1),
    _limite: Math.min(Math.max(filtri.limite, 1), 500),
  } as never);
  if (error) throw error;

  const rows = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
  return rows.map((row) => ({
    tipo: String(row.tipo) as V3TipoEliminato,
    id: String(row.id),
    nome: String(row.nome ?? "(senza nome)"),
    dettaglio: (row.dettaglio as string | null) ?? null,
    eliminatoIl: (row.eliminato_il as string | null) ?? null,
  }));
}

/** Ripristina un partner o un contatto eliminato. I messaggi non sono ripristinabili da qui. */
export async function ripristinaV3(tipo: "partner" | "contatto", id: string): Promise<void> {
  const { error } = await supabase.rpc("v3_restore_deleted" as never, { _tipo: tipo, _id: id } as never);
  if (error) throw error;
}
