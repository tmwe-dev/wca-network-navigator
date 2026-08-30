/**
 * DAL V3 — Modulo 7 (Tracciamento).
 *
 * Tre letture, tutte sui dati reali:
 * - pipeline: partner per stato di relazione (`partners.lead_status`);
 * - andamento: volumi in/out e risposte nel periodo (`channel_messages`, `activities`);
 * - registro: cosa ha deciso l'AI e perché (`ai_decision_log`).
 *
 * Sola lettura: spostamenti di fase e creazione attività arrivano con le
 * mutazioni dedicate, non da qui.
 */
import { supabase } from "@/integrations/supabase/client";

export const V3_FASI_PIPELINE = ["new", "first_touch_sent", "engaged", "customer", "lost"] as const;

export const V3_ETICHETTA_FASE: Record<string, string> = {
  new: "Da contattare",
  first_touch_sent: "Primo contatto inviato",
  engaged: "In conversazione",
  customer: "Cliente",
  lost: "Perso",
};

export interface V3VocePipeline {
  readonly id: string;
  readonly azienda: string;
  readonly paese: string | null;
  readonly citta: string | null;
  readonly fase: string;
  readonly email: string | null;
  readonly ultimoContatto: string | null;
  readonly interazioni: number;
}

export interface V3FaseConteggio {
  readonly fase: string;
  readonly conteggio: number;
}

export interface V3PipelineFiltri {
  readonly fase: string;
  readonly ricerca?: string;
  readonly pagina: number;
  readonly perPagina: number;
}

export interface V3PipelinePagina {
  readonly righe: readonly V3VocePipeline[];
  readonly totale: number;
}

function sanitizeSearch(value: string): string {
  return value.replace(/[,()\\%*]/g, " ").trim();
}

export async function getFasiPipelineV3(): Promise<V3FaseConteggio[]> {
  const risultati = await Promise.all(
    V3_FASI_PIPELINE.map(async (fase) => {
      const { count, error } = await supabase
        .from("partners")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .eq("lead_status", fase);
      if (error) throw error;
      return { fase, conteggio: count ?? 0 };
    }),
  );
  return risultati;
}

export async function listPipelineV3(filtri: V3PipelineFiltri): Promise<V3PipelinePagina> {
  const perPagina = Math.min(Math.max(filtri.perPagina, 1), 100);
  const pagina = Math.max(filtri.pagina, 0);
  const from = pagina * perPagina;

  let query = supabase
    .from("partners")
    .select("id, company_name, country_name, city, lead_status, email, last_interaction_at, interaction_count", {
      count: "exact",
    })
    .is("deleted_at", null)
    .eq("lead_status", filtri.fase)
    .order("last_interaction_at", { ascending: false, nullsFirst: false })
    .range(from, from + perPagina - 1);

  const ricerca = sanitizeSearch(filtri.ricerca ?? "");
  if (ricerca) query = query.or(`company_name.ilike.%${ricerca}%,email.ilike.%${ricerca}%,country_name.ilike.%${ricerca}%`);

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    righe: (data ?? []).map((row) => {
      const item = row as Record<string, unknown>;
      return {
        id: String(item.id),
        azienda: String(item.company_name ?? "Senza nome"),
        paese: (item.country_name as string | null) ?? null,
        citta: (item.city as string | null) ?? null,
        fase: String(item.lead_status ?? "new"),
        email: (item.email as string | null) ?? null,
        ultimoContatto: (item.last_interaction_at as string | null) ?? null,
        interazioni: (item.interaction_count as number | null) ?? 0,
      };
    }),
    totale: count ?? 0,
  };
}

export interface V3Andamento {
  readonly ricevuti: number;
  readonly inviati: number;
  readonly conRisposta: number;
  readonly attivitaCreate: number;
  readonly attivitaCompletate: number;
  readonly perCanale: readonly { readonly canale: string; readonly conteggio: number }[];
}

export async function getAndamentoV3(giorni: number): Promise<V3Andamento> {
  const dal = new Date(Date.now() - Math.max(giorni, 1) * 86_400_000).toISOString();

  const [ricevuti, inviati, conRisposta, attivitaCreate, attivitaCompletate, canali] = await Promise.all([
    supabase
      .from("channel_messages")
      .select("id", { count: "exact", head: true })
      .eq("direction", "inbound")
      .gte("sent_at", dal),
    supabase
      .from("channel_messages")
      .select("id", { count: "exact", head: true })
      .eq("direction", "outbound")
      .gte("sent_at", dal),
    supabase
      .from("activities")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .eq("response_received", true)
      .gte("created_at", dal),
    supabase
      .from("activities")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .gte("created_at", dal),
    supabase
      .from("activities")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .eq("status", "completed")
      .gte("created_at", dal),
    supabase.from("channel_messages").select("channel").gte("sent_at", dal).limit(2000),
  ]);

  for (const res of [ricevuti, inviati, conRisposta, attivitaCreate, attivitaCompletate, canali]) {
    if (res.error) throw res.error;
  }

  const perCanale = new Map<string, number>();
  for (const row of (canali.data ?? []) as { channel: string | null }[]) {
    const key = row.channel ?? "sconosciuto";
    perCanale.set(key, (perCanale.get(key) ?? 0) + 1);
  }

  return {
    ricevuti: ricevuti.count ?? 0,
    inviati: inviati.count ?? 0,
    conRisposta: conRisposta.count ?? 0,
    attivitaCreate: attivitaCreate.count ?? 0,
    attivitaCompletate: attivitaCompletate.count ?? 0,
    perCanale: [...perCanale.entries()]
      .map(([canale, conteggio]) => ({ canale, conteggio }))
      .sort((a, b) => b.conteggio - a.conteggio),
  };
}

export interface V3VoceRegistro {
  readonly id: string;
  readonly tipoDecisione: string;
  readonly indirizzo: string | null;
  readonly ragionamento: string | null;
  readonly esito: string | null;
  readonly confidenza: number | null;
  readonly modello: string | null;
  readonly token: number | null;
  readonly automatica: boolean;
  readonly revisione: string | null;
  readonly durataMs: number | null;
  readonly data: string | null;
}

export interface V3RegistroFiltri {
  readonly giorni: number;
  readonly tipoDecisione?: string | null;
  /** `null` = tutte; altrimenti valore di `user_review`. */
  readonly revisione?: string | null;
  readonly soloAutomatiche?: boolean;
  readonly pagina: number;
  readonly perPagina: number;
}

export interface V3RegistroPagina {
  readonly righe: readonly V3VoceRegistro[];
  readonly totale: number;
  readonly tipiDisponibili: readonly { readonly tipo: string; readonly conteggio: number }[];
}

function testoEsito(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

export async function listRegistroV3(filtri: V3RegistroFiltri): Promise<V3RegistroPagina> {
  const perPagina = Math.min(Math.max(filtri.perPagina, 1), 100);
  const pagina = Math.max(filtri.pagina, 0);
  const from = pagina * perPagina;
  const dal = new Date(Date.now() - Math.max(filtri.giorni, 1) * 86_400_000).toISOString();

  let query = supabase
    .from("ai_decision_log")
    .select(
      "id, decision_type, email_address, ai_reasoning, decision_output, confidence, model_used, tokens_used, was_auto_executed, user_review, execution_time_ms, created_at",
      { count: "exact" },
    )
    .gte("created_at", dal)
    .order("created_at", { ascending: false })
    .range(from, from + perPagina - 1);

  if (filtri.tipoDecisione) query = query.eq("decision_type", filtri.tipoDecisione);
  if (filtri.revisione) query = query.eq("user_review", filtri.revisione);
  if (filtri.soloAutomatiche) query = query.eq("was_auto_executed", true);

  const [res, tipi] = await Promise.all([
    query,
    supabase.from("ai_decision_log").select("decision_type").gte("created_at", dal).limit(1000),
  ]);

  if (res.error) throw res.error;
  if (tipi.error) throw tipi.error;

  const conteggi = new Map<string, number>();
  for (const row of (tipi.data ?? []) as { decision_type: string | null }[]) {
    const key = row.decision_type ?? "sconosciuto";
    conteggi.set(key, (conteggi.get(key) ?? 0) + 1);
  }

  return {
    righe: (res.data ?? []).map((row) => {
      const item = row as Record<string, unknown>;
      return {
        id: String(item.id),
        tipoDecisione: String(item.decision_type ?? "—"),
        indirizzo: (item.email_address as string | null) ?? null,
        ragionamento: (item.ai_reasoning as string | null) ?? null,
        esito: testoEsito(item.decision_output),
        confidenza: (item.confidence as number | null) ?? null,
        modello: (item.model_used as string | null) ?? null,
        token: (item.tokens_used as number | null) ?? null,
        automatica: Boolean(item.was_auto_executed),
        revisione: (item.user_review as string | null) ?? null,
        durataMs: (item.execution_time_ms as number | null) ?? null,
        data: (item.created_at as string | null) ?? null,
      };
    }),
    totale: res.count ?? 0,
    tipiDisponibili: [...conteggi.entries()]
      .map(([tipo, conteggio]) => ({ tipo, conteggio }))
      .sort((a, b) => b.conteggio - a.conteggio),
  };
}
