/**
 * DAL V3 — Modulo 4 (Comprensione).
 *
 * Due domande, due letture:
 * - come viene smistato ciò che arriva (gruppi + regole per mittente/dominio);
 * - quanto bene sta classificando (esiti recenti del classificatore).
 * Sola lettura: correzioni e promozione a regola arrivano dopo, con mutazioni dedicate.
 */
import { supabase } from "@/integrations/supabase/client";

export interface V3Gruppo {
  readonly id: string;
  readonly nome: string;
  readonly descrizione: string | null;
  readonly colore: string | null;
  readonly azioneAutomatica: string | null;
  readonly predefinito: boolean;
  readonly regole: number;
}

export interface V3Regola {
  readonly id: string;
  readonly indirizzo: string | null;
  readonly dominio: string | null;
  readonly nomeVisualizzato: string | null;
  readonly azienda: string | null;
  readonly gruppoId: string | null;
  readonly gruppoNome: string | null;
  readonly categoria: string | null;
  readonly azioneAutomatica: string | null;
  readonly eseguiAutomaticamente: boolean;
  readonly attiva: boolean;
  readonly bloccato: boolean;
  readonly applicazioni: number;
  readonly ultimaApplicazione: string | null;
  readonly emailConteggio: number;
}

export interface V3RegoleFiltri {
  readonly ricerca?: string;
  readonly gruppoId?: string | null;
  /** `null` = tutte; `true` = solo attive; `false` = solo disattivate. */
  readonly attiva?: boolean | null;
  readonly soloBloccati?: boolean;
  readonly pagina: number;
  readonly perPagina: number;
}

export interface V3RegolePagina {
  readonly righe: readonly V3Regola[];
  readonly totale: number;
}

function sanitizeSearch(value: string): string {
  return value.replace(/[,()\\%*]/g, " ").trim();
}

export async function listGruppiV3(): Promise<V3Gruppo[]> {
  const { data, error } = await supabase
    .from("email_sender_groups")
    .select("id, nome_gruppo, descrizione, colore, auto_action, is_default, sort_order")
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("nome_gruppo", { ascending: true });

  if (error) throw error;
  const gruppi = data ?? [];

  // Conteggio regole per gruppo: una HEAD per gruppo è troppo lenta,
  // si legge la sola colonna group_id e si aggrega in memoria.
  const { data: regole, error: erroreRegole } = await supabase
    .from("email_address_rules")
    .select("group_id")
    .is("deleted_at", null)
    .not("group_id", "is", null)
    .limit(20000);

  if (erroreRegole) throw erroreRegole;

  const conteggi = new Map<string, number>();
  for (const row of regole ?? []) {
    const key = (row as { group_id: string | null }).group_id;
    if (key) conteggi.set(key, (conteggi.get(key) ?? 0) + 1);
  }

  return gruppi.map((row) => {
    const item = row as Record<string, unknown>;
    const id = String(item.id);
    return {
      id,
      nome: String(item.nome_gruppo ?? "Senza nome"),
      descrizione: (item.descrizione as string | null) ?? null,
      colore: (item.colore as string | null) ?? null,
      azioneAutomatica: (item.auto_action as string | null) ?? null,
      predefinito: Boolean(item.is_default),
      regole: conteggi.get(id) ?? 0,
    };
  });
}

export async function listRegoleV3(filtri: V3RegoleFiltri): Promise<V3RegolePagina> {
  const perPagina = Math.min(Math.max(filtri.perPagina, 1), 100);
  const pagina = Math.max(filtri.pagina, 0);
  const from = pagina * perPagina;

  let query = supabase
    .from("email_address_rules")
    .select(
      "id, email_address, address, domain, domain_pattern, display_name, company_name, group_id, group_name, category, auto_action, auto_execute, is_active, is_blocked, applied_count, last_applied_at, email_count",
      { count: "exact" },
    )
    .is("deleted_at", null)
    .order("applied_count", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range(from, from + perPagina - 1);

  const ricerca = sanitizeSearch(filtri.ricerca ?? "");
  if (ricerca) {
    query = query.or(
      `email_address.ilike.%${ricerca}%,domain.ilike.%${ricerca}%,display_name.ilike.%${ricerca}%,company_name.ilike.%${ricerca}%`,
    );
  }
  if (filtri.gruppoId) query = query.eq("group_id", filtri.gruppoId);
  if (filtri.attiva === true) query = query.eq("is_active", true);
  if (filtri.attiva === false) query = query.eq("is_active", false);
  if (filtri.soloBloccati) query = query.eq("is_blocked", true);

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    righe: (data ?? []).map((row) => {
      const item = row as Record<string, unknown>;
      return {
        id: String(item.id),
        indirizzo: (item.email_address as string | null) ?? (item.address as string | null) ?? null,
        dominio: (item.domain as string | null) ?? (item.domain_pattern as string | null) ?? null,
        nomeVisualizzato: (item.display_name as string | null) ?? null,
        azienda: (item.company_name as string | null) ?? null,
        gruppoId: (item.group_id as string | null) ?? null,
        gruppoNome: (item.group_name as string | null) ?? null,
        categoria: (item.category as string | null) ?? null,
        azioneAutomatica: (item.auto_action as string | null) ?? null,
        eseguiAutomaticamente: Boolean(item.auto_execute),
        attiva: item.is_active !== false,
        bloccato: Boolean(item.is_blocked),
        applicazioni: (item.applied_count as number | null) ?? 0,
        ultimaApplicazione: (item.last_applied_at as string | null) ?? null,
        emailConteggio: (item.email_count as number | null) ?? 0,
      };
    }),
    totale: count ?? 0,
  };
}

export interface V3Classificazione {
  readonly id: string;
  readonly indirizzo: string | null;
  readonly oggetto: string | null;
  readonly categoria: string | null;
  readonly confidenza: number | null;
  readonly urgenza: string | null;
  readonly sentiment: string | null;
  readonly azioneSuggerita: string | null;
  readonly motivazione: string | null;
  readonly data: string | null;
}

export interface V3ClassificazioniFiltri {
  readonly giorni: number;
  readonly categoria?: string | null;
  /** Sotto questa soglia la classificazione è considerata incerta. */
  readonly soloIncerte?: boolean;
  readonly pagina: number;
  readonly perPagina: number;
}

export const V3_SOGLIA_INCERTEZZA = 0.7;

export interface V3ClassificazioniPagina {
  readonly righe: readonly V3Classificazione[];
  readonly totale: number;
}

export async function listClassificazioniV3(
  filtri: V3ClassificazioniFiltri,
): Promise<V3ClassificazioniPagina> {
  const perPagina = Math.min(Math.max(filtri.perPagina, 1), 100);
  const pagina = Math.max(filtri.pagina, 0);
  const from = pagina * perPagina;
  const dal = new Date(Date.now() - Math.max(filtri.giorni, 1) * 86_400_000).toISOString();

  let query = supabase
    .from("email_classifications")
    .select(
      "id, email_address, subject, category, confidence, urgency, sentiment, action_suggested, reasoning, classified_at, created_at",
      { count: "exact" },
    )
    .gte("created_at", dal)
    .order("created_at", { ascending: false })
    .range(from, from + perPagina - 1);

  if (filtri.categoria) query = query.eq("category", filtri.categoria);
  if (filtri.soloIncerte) query = query.lt("confidence", V3_SOGLIA_INCERTEZZA);

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    righe: (data ?? []).map((row) => {
      const item = row as Record<string, unknown>;
      return {
        id: String(item.id),
        indirizzo: (item.email_address as string | null) ?? null,
        oggetto: (item.subject as string | null) ?? null,
        categoria: (item.category as string | null) ?? null,
        confidenza: (item.confidence as number | null) ?? null,
        urgenza: (item.urgency as string | null) ?? null,
        sentiment: (item.sentiment as string | null) ?? null,
        azioneSuggerita: (item.action_suggested as string | null) ?? null,
        motivazione: (item.reasoning as string | null) ?? null,
        data: (item.classified_at as string | null) ?? (item.created_at as string | null) ?? null,
      };
    }),
    totale: count ?? 0,
  };
}

export interface V3QualitaClassificazione {
  readonly totale: number;
  readonly incerte: number;
  readonly confidenzaMedia: number | null;
  readonly perCategoria: readonly { readonly categoria: string; readonly conteggio: number }[];
}

/**
 * Sintesi sul periodo. Il campione è limitato a 2000 righe: serve a dire
 * "sta funzionando?", non a produrre una statistica esatta.
 */
export async function getQualitaClassificazioneV3(giorni: number): Promise<V3QualitaClassificazione> {
  const dal = new Date(Date.now() - Math.max(giorni, 1) * 86_400_000).toISOString();

  const { data, error, count } = await supabase
    .from("email_classifications")
    .select("category, confidence", { count: "exact" })
    .gte("created_at", dal)
    .order("created_at", { ascending: false })
    .limit(2000);

  if (error) throw error;

  const righe = (data ?? []) as { category: string | null; confidence: number | null }[];
  const conConfidenza = righe.filter((row) => typeof row.confidence === "number");
  const perCategoria = new Map<string, number>();
  for (const row of righe) {
    const key = row.category ?? "senza categoria";
    perCategoria.set(key, (perCategoria.get(key) ?? 0) + 1);
  }

  return {
    totale: count ?? righe.length,
    incerte: conConfidenza.filter((row) => (row.confidence as number) < V3_SOGLIA_INCERTEZZA).length,
    confidenzaMedia: conConfidenza.length
      ? conConfidenza.reduce((sum, row) => sum + (row.confidence as number), 0) / conConfidenza.length
      : null,
    perCategoria: [...perCategoria.entries()]
      .map(([categoria, conteggio]) => ({ categoria, conteggio }))
      .sort((a, b) => b.conteggio - a.conteggio)
      .slice(0, 12),
  };
}
