/**
 * DAL V3 — Anagrafica unificata.
 *
 * Unisce in un'unica lista server-side tre fonti: contatti CRM
 * (`imported_contacts`), biglietti da visita (`business_cards`) e partner WCA
 * (`partners`). La fusione, i filtri e la paginazione avvengono nella funzione
 * SQL `v3_directory`: la V3 non scarica le tabelle intere.
 */
import { supabase } from "@/integrations/supabase/client";

export const V3_FONTI_ANAGRAFICA = ["crm", "biglietti", "wca"] as const;
export type V3FonteAnagrafica = (typeof V3_FONTI_ANAGRAFICA)[number];

export const ETICHETTE_FONTE: Record<V3FonteAnagrafica, string> = {
  crm: "CRM",
  biglietti: "Biglietto",
  wca: "WCA",
};

export interface V3AnagraficaRiga {
  readonly fonte: V3FonteAnagrafica;
  readonly id: string;
  readonly nome: string | null;
  readonly azienda: string | null;
  readonly email: string | null;
  readonly telefono: string | null;
  readonly paese: string | null;
  readonly paeseCode: string | null;
  readonly dominio: string | null;
  readonly ruolo: string | null;
  readonly stato: string | null;
  readonly interazioni: number;
  readonly ultimaInterazione: string | null;
  /** Quante voci dell'anagrafica condividono la stessa azienda. */
  readonly colleghi: number;
}

export const V3_ORDINI_ANAGRAFICA = [
  "recente",
  "nome",
  "azienda",
  "paese",
  "fonte",
  "stato",
  "interazioni",
] as const;
export type V3OrdineAnagrafica = (typeof V3_ORDINI_ANAGRAFICA)[number];

export interface V3AnagraficaFiltri {
  readonly ricerca?: string;
  /** Filtri multipli: più valori sullo stesso campo si sommano in OR. */
  readonly fonti?: readonly string[];
  readonly paesi?: readonly string[];
  readonly stati?: readonly string[];
  /** Nomi azienda già normalizzati in minuscolo. */
  readonly aziende?: readonly string[];
  readonly soloConEmail?: boolean;
  readonly ordine?: V3OrdineAnagrafica;
  readonly discendente?: boolean;
  readonly pagina: number;
  readonly perPagina: number;
}


export interface V3AnagraficaPagina {
  readonly righe: readonly V3AnagraficaRiga[];
  readonly totale: number;
}

interface DirectoryRow {
  fonte: string;
  id: string;
  nome: string | null;
  azienda: string | null;
  email: string | null;
  telefono: string | null;
  paese: string | null;
  paese_code: string | null;
  dominio: string | null;
  ruolo: string | null;
  stato: string | null;
  interazioni: number | null;
  ultima_interazione: string | null;
  colleghi: number | null;
  totale: number | null;
}

function toFonte(value: string): V3FonteAnagrafica {
  return value === "biglietti" || value === "wca" ? value : "crm";
}

export async function listAnagraficaV3(filtri: V3AnagraficaFiltri): Promise<V3AnagraficaPagina> {
  const perPagina = Math.min(Math.max(filtri.perPagina, 1), 200);
  const pagina = Math.max(filtri.pagina, 0);

  const lista = (valori?: readonly string[]) => (valori && valori.length > 0 ? [...valori] : undefined);

  // Parametri omessi (undefined) = default SQL null = nessun filtro.
  const { data, error } = await supabase.rpc("v3_directory", {
    _search: filtri.ricerca?.trim() ? filtri.ricerca.trim() : undefined,
    _fonti: lista(filtri.fonti),
    _paesi: lista(filtri.paesi),
    _stati: lista(filtri.stati),
    _aziende: lista(filtri.aziende),
    _solo_email: filtri.soloConEmail ?? false,
    _ordine: filtri.ordine ?? "recente",
    _discendente: filtri.discendente ?? true,
    _offset: pagina * perPagina,
    _limit: perPagina,
  });


  if (error) throw error;

  const rows = (data ?? []) as DirectoryRow[];
  return {
    righe: rows.map((row) => ({
      fonte: toFonte(row.fonte),
      id: row.id,
      nome: row.nome,
      azienda: row.azienda,
      email: row.email,
      telefono: row.telefono,
      paese: row.paese,
      paeseCode: row.paese_code,
      dominio: row.dominio,
      ruolo: row.ruolo,
      stato: row.stato,
      interazioni: row.interazioni ?? 0,
      ultimaInterazione: row.ultima_interazione,
      colleghi: row.colleghi ?? 1,
    })),
    totale: rows.length > 0 ? (rows[0].totale ?? 0) : 0,
  };
}

/** Paesi presenti nelle tre fonti, per il filtro. Deriva dai dati reali. */
export async function listPaesiAnagraficaV3(): Promise<string[]> {
  const { data, error } = await supabase.rpc("v3_directory_countries");
  if (error) throw error;
  return ((data ?? []) as { paese: string | null }[])
    .map((row) => row.paese)
    .filter((value): value is string => Boolean(value));
}
