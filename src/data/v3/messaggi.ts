/**
 * DAL V3 — Modulo 3 (Messaggi).
 *
 * Sola lettura più una mutazione minima (segna come letto).
 * Fonte unica: `channel_messages` (email, WhatsApp, LinkedIn nella stessa tabella).
 * Sempre esclusi: soft-delete e messaggi nascosti da regola.
 */
import { supabase } from "@/integrations/supabase/client";

export const V3_CANALI = ["email", "whatsapp", "linkedin"] as const;
export type V3Canale = (typeof V3_CANALI)[number];

export type V3Direzione = "inbound" | "outbound";

export interface V3MessaggioRiga {
  readonly id: string;
  readonly canale: string;
  readonly direzione: string;
  readonly oggetto: string | null;
  readonly anteprima: string | null;
  readonly da: string | null;
  readonly daNome: string | null;
  readonly a: string | null;
  readonly data: string | null;
  readonly letto: boolean;
  readonly categoria: string | null;
  readonly threadId: string | null;
  readonly partnerId: string | null;
}

export interface V3MessaggiFiltri {
  readonly ricerca?: string;
  readonly canale?: string | null;
  readonly casellaId?: string | null;
  readonly categoria?: string | null;
  readonly soloNonLetti?: boolean;
  /** `null` = entrambe le direzioni. */
  readonly direzione?: V3Direzione | null;
  readonly pagina: number;
  readonly perPagina: number;
}

export interface V3MessaggiPagina {
  readonly righe: readonly V3MessaggioRiga[];
  readonly totale: number;
}

const SELECT_RIGA =
  "id, channel, direction, subject, body_text, from_address, from_name, to_address, email_date, created_at, read_at, category, thread_id, partner_id";

function sanitizeSearch(value: string): string {
  return value.replace(/[,()\\%*]/g, " ").trim();
}

function anteprima(body: string | null): string | null {
  if (!body) return null;
  const flat = body.replace(/\s+/g, " ").trim();
  return flat.length > 180 ? `${flat.slice(0, 180)}…` : flat;
}

function toRiga(row: Record<string, unknown>): V3MessaggioRiga {
  return {
    id: String(row.id),
    canale: (row.channel as string | null) ?? "email",
    direzione: (row.direction as string | null) ?? "inbound",
    oggetto: (row.subject as string | null) ?? null,
    anteprima: anteprima((row.body_text as string | null) ?? null),
    da: (row.from_address as string | null) ?? null,
    daNome: (row.from_name as string | null) ?? null,
    a: (row.to_address as string | null) ?? null,
    data: (row.email_date as string | null) ?? (row.created_at as string | null) ?? null,
    letto: Boolean(row.read_at),
    categoria: (row.category as string | null) ?? null,
    threadId: (row.thread_id as string | null) ?? null,
    partnerId: (row.partner_id as string | null) ?? null,
  };
}

export async function listMessaggiV3(filtri: V3MessaggiFiltri): Promise<V3MessaggiPagina> {
  const perPagina = Math.min(Math.max(filtri.perPagina, 1), 100);
  const pagina = Math.max(filtri.pagina, 0);
  const from = pagina * perPagina;

  let query = supabase
    .from("channel_messages")
    .select(SELECT_RIGA, { count: "exact" })
    .is("deleted_at", null)
    .not("hidden_by_rule", "is", true)
    .order("email_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range(from, from + perPagina - 1);

  const ricerca = sanitizeSearch(filtri.ricerca ?? "");
  if (ricerca) {
    query = query.or(
      `subject.ilike.%${ricerca}%,from_address.ilike.%${ricerca}%,from_name.ilike.%${ricerca}%,to_address.ilike.%${ricerca}%`,
    );
  }
  if (filtri.canale) query = query.eq("channel", filtri.canale);
  if (filtri.casellaId) query = query.eq("mailbox_id", filtri.casellaId);
  if (filtri.categoria) query = query.eq("category", filtri.categoria);
  if (filtri.direzione) query = query.eq("direction", filtri.direzione);
  if (filtri.soloNonLetti) query = query.is("read_at", null);

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    righe: (data ?? []).map((row) => toRiga(row as Record<string, unknown>)),
    totale: count ?? 0,
  };
}

export interface V3MessaggioDettaglio extends V3MessaggioRiga {
  readonly corpoTesto: string | null;
  readonly corpoHtml: string | null;
  readonly cc: string | null;
  readonly aNome: string | null;
  readonly cartella: string | null;
  /** Suggerimento di classificazione già presente sul messaggio (Modulo 4 lo userà davvero). */
  readonly classificazione: Record<string, unknown> | null;
}

export async function getMessaggioV3(id: string): Promise<V3MessaggioDettaglio | null> {
  const { data, error } = await supabase
    .from("channel_messages")
    .select(
      `${SELECT_RIGA}, body_html, cc_addresses, to_name, folder, ai_classification_suggestion, deleted_at`,
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as Record<string, unknown>;
  if (row.deleted_at) return null;

  return {
    ...toRiga(row),
    corpoTesto: (row.body_text as string | null) ?? null,
    corpoHtml: (row.body_html as string | null) ?? null,
    cc: (row.cc_addresses as string | null) ?? null,
    aNome: (row.to_name as string | null) ?? null,
    cartella: (row.folder as string | null) ?? null,
    classificazione: (row.ai_classification_suggestion as Record<string, unknown> | null) ?? null,
  };
}

/** Gli altri messaggi dello stesso thread, dal più vecchio al più recente. */
export async function listThreadV3(threadId: string, escludiId?: string): Promise<V3MessaggioRiga[]> {
  let query = supabase
    .from("channel_messages")
    .select(SELECT_RIGA)
    .eq("thread_id", threadId)
    .is("deleted_at", null)
    .order("email_date", { ascending: true, nullsFirst: true })
    .limit(50);

  if (escludiId) query = query.neq("id", escludiId);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => toRiga(row as Record<string, unknown>));
}

/**
 * Segna come letto. Idempotente e non distruttiva: non tocca mai `read_at`
 * se è già valorizzato, così la data di prima lettura resta quella vera.
 */
export async function segnaLettoV3(id: string): Promise<void> {
  const { error } = await supabase
    .from("channel_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .is("read_at", null);
  if (error) throw error;
}

export interface V3Casella {
  readonly id: string;
  readonly etichetta: string;
  readonly email: string | null;
}

/** Caselle a cui l'operatore ha davvero accesso: la RPC applica già i permessi. */
export async function listCaselleV3(): Promise<V3Casella[]> {
  const { data, error } = await supabase.rpc("get_accessible_mailboxes");
  if (error) throw error;

  const rows = Array.isArray(data) ? data : [];
  return rows
    .map((entry) => {
      const row = entry as Record<string, unknown>;
      const id = row.id ?? row.mailbox_id;
      if (!id) return null;
      return {
        id: String(id),
        etichetta: String(row.label ?? row.email ?? row.slug ?? "Casella"),
        email: (row.email as string | null) ?? null,
      };
    })
    .filter((item): item is V3Casella => item !== null);
}
