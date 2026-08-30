/**
 * DAL V3 — Modulo 2 (Contatti).
 *
 * Sola lettura. Filtri e paginazione sono server-side: la V3 non scarica
 * l'intera tabella per poi filtrarla nel browser.
 * Il soft-delete è sempre rispettato (`deleted_at is null`).
 */
import { supabase } from "@/integrations/supabase/client";

export const V3_STATI_LEAD = [
  "new",
  "first_touch_sent",
  "holding",
  "engaged",
  "qualified",
  "negotiation",
  "converted",
  "archived",
  "blacklisted",
] as const;

export type V3StatoLead = (typeof V3_STATI_LEAD)[number];

export interface V3ContattoRiga {
  readonly id: string;
  readonly nome: string | null;
  readonly azienda: string | null;
  readonly email: string | null;
  readonly telefono: string | null;
  readonly paese: string | null;
  readonly ruolo: string | null;
  readonly stato: string | null;
  readonly punteggio: number | null;
  readonly interazioni: number;
  readonly ultimaInterazione: string | null;
}

export interface V3ContattiFiltri {
  readonly ricerca?: string;
  readonly paese?: string | null;
  readonly stato?: string | null;
  /** Solo contatti con email valorizzata: sono gli unici contattabili via email. */
  readonly soloConEmail?: boolean;
  readonly pagina: number;
  readonly perPagina: number;
}

export interface V3ContattiPagina {
  readonly righe: readonly V3ContattoRiga[];
  readonly totale: number;
}

const SELECT_RIGA =
  "id, name, company_name, email, phone, country, position, lead_status, lead_score, interaction_count, last_interaction_at";

/** Neutralizza i caratteri che romperebbero un filtro PostgREST `or(...)`. */
function sanitizeSearch(value: string): string {
  return value.replace(/[,()\\%*]/g, " ").trim();
}

function toRiga(row: Record<string, unknown>): V3ContattoRiga {
  return {
    id: String(row.id),
    nome: (row.name as string | null) ?? null,
    azienda: (row.company_name as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    telefono: (row.phone as string | null) ?? null,
    paese: (row.country as string | null) ?? null,
    ruolo: (row.position as string | null) ?? null,
    stato: (row.lead_status as string | null) ?? null,
    punteggio: (row.lead_score as number | null) ?? null,
    interazioni: (row.interaction_count as number | null) ?? 0,
    ultimaInterazione: (row.last_interaction_at as string | null) ?? null,
  };
}

export async function listContattiV3(filtri: V3ContattiFiltri): Promise<V3ContattiPagina> {
  const perPagina = Math.min(Math.max(filtri.perPagina, 1), 200);
  const pagina = Math.max(filtri.pagina, 0);
  const from = pagina * perPagina;

  let query = supabase
    .from("imported_contacts")
    .select(SELECT_RIGA, { count: "exact" })
    .is("deleted_at", null)
    .order("last_interaction_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range(from, from + perPagina - 1);

  const ricerca = sanitizeSearch(filtri.ricerca ?? "");
  if (ricerca) {
    query = query.or(
      `name.ilike.%${ricerca}%,company_name.ilike.%${ricerca}%,email.ilike.%${ricerca}%,city.ilike.%${ricerca}%`,
    );
  }
  if (filtri.paese) query = query.eq("country", filtri.paese);
  if (filtri.stato) query = query.eq("lead_status", filtri.stato);
  if (filtri.soloConEmail) query = query.not("email", "is", null);

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    righe: (data ?? []).map((row) => toRiga(row as Record<string, unknown>)),
    totale: count ?? 0,
  };
}

export interface V3ContattoDettaglio extends V3ContattoRiga {
  readonly citta: string | null;
  readonly indirizzo: string | null;
  readonly mobile: string | null;
  readonly note: string | null;
  readonly origine: string | null;
  readonly statoEmail: string | null;
  readonly creatoIl: string | null;
  readonly partnerId: string | null;
  readonly partnerNome: string | null;
}

export async function getContattoV3(id: string): Promise<V3ContattoDettaglio | null> {
  const { data, error } = await supabase
    .from("imported_contacts")
    .select(
      `${SELECT_RIGA}, city, address, mobile, note, origin, email_status, created_at, wca_partner_id, deleted_at`,
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data || (data as Record<string, unknown>).deleted_at) return null;

  const row = data as Record<string, unknown>;
  let partnerNome: string | null = null;
  const partnerId = (row.wca_partner_id as string | null) ?? null;

  if (partnerId) {
    const { data: partner } = await supabase
      .from("partners")
      .select("company_name")
      .eq("id", partnerId)
      .maybeSingle();
    partnerNome = (partner?.company_name as string | null) ?? null;
  }

  return {
    ...toRiga(row),
    citta: (row.city as string | null) ?? null,
    indirizzo: (row.address as string | null) ?? null,
    mobile: (row.mobile as string | null) ?? null,
    note: (row.note as string | null) ?? null,
    origine: (row.origin as string | null) ?? null,
    statoEmail: (row.email_status as string | null) ?? null,
    creatoIl: (row.created_at as string | null) ?? null,
    partnerId,
    partnerNome,
  };
}

export interface V3Interazione {
  readonly id: string;
  readonly tipo: string | null;
  readonly titolo: string | null;
  readonly descrizione: string | null;
  readonly esito: string | null;
  readonly data: string | null;
}

/** Ultime interazioni registrate per il contatto. Storia sintetica, non archivio. */
export async function listInterazioniContattoV3(contattoId: string, limite = 20): Promise<V3Interazione[]> {
  const { data, error } = await supabase
    .from("contact_interactions")
    .select("id, interaction_type, title, description, outcome, created_at")
    .eq("contact_id", contattoId)
    .order("created_at", { ascending: false })
    .limit(limite);

  if (error) throw error;

  return (data ?? []).map((row) => {
    const item = row as Record<string, unknown>;
    return {
      id: String(item.id),
      tipo: (item.interaction_type as string | null) ?? null,
      titolo: (item.title as string | null) ?? null,
      descrizione: (item.description as string | null) ?? null,
      esito: (item.outcome as string | null) ?? null,
      data: (item.created_at as string | null) ?? null,
    };
  });
}

/** Paesi presenti, per il filtro. Deriva dai dati reali, non da una lista fissa. */
export async function listPaesiContattiV3(): Promise<string[]> {
  const { data, error } = await supabase.rpc("get_contact_filter_options");
  if (error) throw error;

  const payload = data as { countries?: unknown } | null;
  const countries = Array.isArray(payload?.countries) ? payload?.countries : [];
  return countries
    .map((entry) => (typeof entry === "string" ? entry : ((entry as { value?: string })?.value ?? null)))
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => a.localeCompare(b));
}
