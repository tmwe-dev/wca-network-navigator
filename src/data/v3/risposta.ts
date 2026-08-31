/**
 * DAL V3 — Modulo 5 (Risposta).
 *
 * Due letture:
 * - cosa attende approvazione prima di partire (`ai_pending_actions`);
 * - con che tono e struttura scriviamo (`operative_prompts`).
 *
 * Scrittura ammessa qui: solo il rifiuto di un'azione pendente (non invia nulla).
 * L'approvazione con dispatch reale resta nella pipeline esistente: non la
 * duplichiamo in V3 finché il modulo di invio non è innestato.
 */
import { supabase } from "@/integrations/supabase/client";
import { invokeEdge } from "@/lib/api/invokeEdge";

export interface V3Approvazione {
  readonly id: string;
  readonly tipoAzione: string;
  readonly indirizzo: string | null;
  readonly partnerId: string | null;
  readonly contattoId: string | null;
  readonly contenuto: string | null;
  readonly motivazione: string | null;
  readonly confidenza: number | null;
  readonly rischio: string | null;
  readonly origine: string | null;
  readonly stato: string;
  readonly priorita: number | null;
  readonly ultimoErrore: string | null;
  readonly creatoIl: string | null;
  readonly scadeIl: string | null;
}

export interface V3ApprovazioniFiltri {
  readonly stato: string;
  readonly tipoAzione?: string | null;
  readonly rischio?: string | null;
  readonly origine?: string | null;
  readonly pagina: number;
  readonly perPagina: number;
}

export interface V3ApprovazioniPagina {
  readonly righe: readonly V3Approvazione[];
  readonly totale: number;
}

function mapApprovazione(row: Record<string, unknown>): V3Approvazione {
  return {
    id: String(row.id),
    tipoAzione: String(row.action_type ?? "—"),
    indirizzo: (row.email_address as string | null) ?? null,
    partnerId: (row.partner_id as string | null) ?? null,
    contattoId: (row.contact_id as string | null) ?? null,
    contenuto: (row.suggested_content as string | null) ?? null,
    motivazione: (row.reasoning as string | null) ?? null,
    confidenza: (row.confidence as number | null) ?? null,
    rischio: (row.risk_level as string | null) ?? null,
    origine: (row.source as string | null) ?? null,
    stato: String(row.status ?? "pending"),
    priorita: (row.priority as number | null) ?? null,
    ultimoErrore: (row.last_error as string | null) ?? null,
    creatoIl: (row.created_at as string | null) ?? null,
    scadeIl: (row.expires_at as string | null) ?? null,
  };
}

export async function listApprovazioniV3(filtri: V3ApprovazioniFiltri): Promise<V3ApprovazioniPagina> {
  const perPagina = Math.min(Math.max(filtri.perPagina, 1), 100);
  const pagina = Math.max(filtri.pagina, 0);
  const from = pagina * perPagina;

  let query = supabase
    .from("ai_pending_actions")
    .select(
      "id, action_type, email_address, partner_id, contact_id, suggested_content, reasoning, confidence, risk_level, source, status, priority, last_error, created_at, expires_at",
      { count: "exact" },
    )
    .eq("status", filtri.stato)
    .order("priority", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range(from, from + perPagina - 1);

  if (filtri.tipoAzione) query = query.eq("action_type", filtri.tipoAzione);
  if (filtri.origine) query = query.eq("source", filtri.origine);
  if (filtri.rischio) {
    query = query.eq("risk_level", filtri.rischio as never);
  }

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    righe: (data ?? []).map((row) => mapApprovazione(row as Record<string, unknown>)),
    totale: count ?? 0,
  };
}

export interface V3SintesiApprovazioni {
  readonly perTipo: readonly { readonly tipo: string; readonly conteggio: number }[];
  readonly perRischio: readonly { readonly rischio: string; readonly conteggio: number }[];
  readonly campione: number;
}

/** Sintesi sul campione delle 1000 pendenti più recenti: serve a orientarsi, non a contare. */
export async function getSintesiApprovazioniV3(stato: string): Promise<V3SintesiApprovazioni> {
  const { data, error } = await supabase
    .from("ai_pending_actions")
    .select("action_type, risk_level")
    .eq("status", stato)
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) throw error;
  const righe = (data ?? []) as { action_type: string | null; risk_level: string | null }[];

  const perTipo = new Map<string, number>();
  const perRischio = new Map<string, number>();
  for (const row of righe) {
    const tipo = row.action_type ?? "sconosciuto";
    perTipo.set(tipo, (perTipo.get(tipo) ?? 0) + 1);
    const rischio = row.risk_level ?? "non dichiarato";
    perRischio.set(rischio, (perRischio.get(rischio) ?? 0) + 1);
  }

  return {
    campione: righe.length,
    perTipo: [...perTipo.entries()]
      .map(([tipo, conteggio]) => ({ tipo, conteggio }))
      .sort((a, b) => b.conteggio - a.conteggio)
      .slice(0, 12),
    perRischio: [...perRischio.entries()]
      .map(([rischio, conteggio]) => ({ rischio, conteggio }))
      .sort((a, b) => b.conteggio - a.conteggio),
  };
}

/** Rifiuto: cambia solo lo stato, non invia e non cancella nulla. */
export async function rifiutaApprovazioneV3(id: string): Promise<void> {
  const { error } = await supabase.from("ai_pending_actions").update({ status: "rejected" }).eq("id", id);
  if (error) throw error;
}

export interface V3Modello {
  readonly id: string;
  readonly nome: string;
  readonly contesto: string | null;
  readonly obiettivo: string | null;
  readonly procedura: string | null;
  readonly criteri: string | null;
  readonly esempi: string | null;
  readonly tag: readonly string[];
  readonly priorita: number | null;
  readonly attivo: boolean;
  readonly aggiornatoIl: string | null;
}

export interface V3ModelliFiltri {
  readonly ricerca?: string;
  readonly tag?: string | null;
  /** `null` = tutti; `true` = solo attivi. */
  readonly attivo?: boolean | null;
  readonly pagina: number;
  readonly perPagina: number;
}

export interface V3ModelliPagina {
  readonly righe: readonly V3Modello[];
  readonly totale: number;
  readonly tagDisponibili: readonly string[];
}

function sanitizeSearch(value: string): string {
  return value.replace(/[,()\\%*]/g, " ").trim();
}

export async function listModelliV3(filtri: V3ModelliFiltri): Promise<V3ModelliPagina> {
  const perPagina = Math.min(Math.max(filtri.perPagina, 1), 100);
  const pagina = Math.max(filtri.pagina, 0);
  const from = pagina * perPagina;

  let query = supabase
    .from("operative_prompts")
    .select(
      "id, name, context, objective, procedure, criteria, examples, tags, priority, is_active, updated_at",
      { count: "exact" },
    )
    .is("deprecated_at", null)
    .order("priority", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false, nullsFirst: false })
    .range(from, from + perPagina - 1);

  const ricerca = sanitizeSearch(filtri.ricerca ?? "");
  if (ricerca) query = query.or(`name.ilike.%${ricerca}%,objective.ilike.%${ricerca}%,context.ilike.%${ricerca}%`);
  if (filtri.attivo === true) query = query.eq("is_active", true);
  if (filtri.attivo === false) query = query.eq("is_active", false);
  if (filtri.tag) query = query.contains("tags", [filtri.tag]);

  const { data, error, count } = await query;
  if (error) throw error;

  const righe = (data ?? []).map((row) => {
    const item = row as Record<string, unknown>;
    return {
      id: String(item.id),
      nome: String(item.name ?? "Senza nome"),
      contesto: (item.context as string | null) ?? null,
      obiettivo: (item.objective as string | null) ?? null,
      procedura: (item.procedure as string | null) ?? null,
      criteri: (item.criteria as string | null) ?? null,
      esempi: (item.examples as string | null) ?? null,
      tag: ((item.tags as string[] | null) ?? []).filter((t) => typeof t === "string"),
      priorita: (item.priority as number | null) ?? null,
      attivo: item.is_active !== false,
      aggiornatoIl: (item.updated_at as string | null) ?? null,
    } satisfies V3Modello;
  });

  const tagDisponibili = [...new Set(righe.flatMap((r) => r.tag))].sort((a, b) => a.localeCompare(b, "it"));

  return { righe, totale: count ?? righe.length, tagDisponibili };
}

/* ─────────── Approvazione con invio reale ─────────── */

/**
 * Approva un'azione pendente e la fa eseguire dalla pipeline esistente
 * (`pending-action-executor`, unico autorizzato al dispatch post-approvazione).
 * Nessun invio duplicato qui: si passa allo stato `approved` e si delega.
 */
export async function approvaEdEseguiV3(id: string): Promise<void> {
  const { error } = await supabase
    .from("ai_pending_actions")
    .update({ status: "approved", approved_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending");
  if (error) throw error;

  await invokeEdge("pending-action-executor", {
    body: { pending_action_id: id },
    context: "v3/approvazioni.approvaEdEsegui",
  });
}
