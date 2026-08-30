/**
 * DAL V3 — pagine "Canali" (Modulo 3) e "Cestino" (Modulo 2).
 *
 * Canali: conversazioni WhatsApp/LinkedIn aggregate per contatto.
 * Cestino: righe soft-deleted delle tabelle business.
 * Sola lettura: il ripristino tocca la governance del soft-delete e resta
 * fuori da questa maschera.
 */
import { supabase } from "@/integrations/supabase/client";

export const V3_CANALI_NON_EMAIL = ["whatsapp", "linkedin"] as const;

export interface V3Conversazione {
  readonly chiave: string;
  readonly canale: string;
  readonly contatto: string;
  readonly ultimoMessaggio: string | null;
  readonly ultimaData: string | null;
  readonly totale: number;
  readonly nonLetti: number;
  readonly ultimoId: string;
}

export interface V3CanaliFiltri {
  readonly canale: string | null;
  readonly ricerca?: string;
  readonly giorni: number;
}

export interface V3CanaliRisultato {
  readonly conversazioni: readonly V3Conversazione[];
  readonly perCanale: readonly { readonly canale: string; readonly conteggio: number }[];
}

export async function listConversazioniCanaliV3(filtri: V3CanaliFiltri): Promise<V3CanaliRisultato> {
  const dal = new Date(Date.now() - Math.max(filtri.giorni, 1) * 86_400_000).toISOString();

  let query = supabase
    .from("channel_messages")
    .select("id, channel, direction, from_address, from_name, to_address, subject, body_text, email_date, read_at")
    .is("deleted_at", null)
    .in("channel", filtri.canale ? [filtri.canale] : [...V3_CANALI_NON_EMAIL])
    .gte("email_date", dal)
    .order("email_date", { ascending: false })
    .limit(500);

  const ricerca = (filtri.ricerca ?? "").replace(/[,()\\%*]/g, " ").trim();
  if (ricerca) query = query.or(`from_address.ilike.%${ricerca}%,from_name.ilike.%${ricerca}%`);

  const { data, error } = await query;
  if (error) throw error;

  const righe = (data ?? []) as Record<string, unknown>[];
  const perCanale = new Map<string, number>();
  const conversazioni = new Map<string, V3Conversazione>();

  for (const row of righe) {
    const canale = String(row.channel ?? "sconosciuto");
    perCanale.set(canale, (perCanale.get(canale) ?? 0) + 1);

    const inbound = String(row.direction ?? "inbound") === "inbound";
    const controparte =
      (inbound ? (row.from_name as string | null) || (row.from_address as string | null) : (row.to_address as string | null)) ??
      "sconosciuto";
    const chiave = `${canale}::${controparte}`;
    const esistente = conversazioni.get(chiave);
    const testo = ((row.body_text as string | null) ?? (row.subject as string | null) ?? "").slice(0, 200);
    const dataMsg = (row.email_date as string | null) ?? null;
    const nonLetto = inbound && !row.read_at ? 1 : 0;

    if (!esistente) {
      conversazioni.set(chiave, {
        chiave,
        canale,
        contatto: controparte,
        ultimoMessaggio: testo || null,
        ultimaData: dataMsg,
        totale: 1,
        nonLetti: nonLetto,
        ultimoId: String(row.id),
      });
    } else {
      conversazioni.set(chiave, {
        ...esistente,
        totale: esistente.totale + 1,
        nonLetti: esistente.nonLetti + nonLetto,
      });
    }
  }

  return {
    conversazioni: [...conversazioni.values()].sort((a, b) => (b.ultimaData ?? "").localeCompare(a.ultimaData ?? "")),
    perCanale: [...perCanale.entries()]
      .map(([canale, conteggio]) => ({ canale, conteggio }))
      .sort((a, b) => b.conteggio - a.conteggio),
  };
}

export type V3TipoCestino = "partners" | "partner_contacts" | "channel_messages" | "activities";

export const V3_TIPI_CESTINO: readonly { readonly tipo: V3TipoCestino; readonly etichetta: string }[] = [
  { tipo: "partners", etichetta: "Aziende" },
  { tipo: "partner_contacts", etichetta: "Contatti" },
  { tipo: "channel_messages", etichetta: "Messaggi" },
  { tipo: "activities", etichetta: "Attività" },
];

export interface V3VoceCestino {
  readonly id: string;
  readonly tipo: V3TipoCestino;
  readonly titolo: string;
  readonly dettaglio: string | null;
  readonly eliminatoIl: string | null;
}

export interface V3CestinoFiltri {
  readonly tipo: V3TipoCestino;
  readonly giorni: number | null;
  readonly pagina: number;
  readonly perPagina: number;
}

export interface V3CestinoPagina {
  readonly righe: readonly V3VoceCestino[];
  readonly totale: number;
}

const SELECT_CESTINO: Record<V3TipoCestino, string> = {
  partners: "id, company_name, country_name, deleted_at",
  partner_contacts: "id, name, email, deleted_at",
  channel_messages: "id, subject, from_address, deleted_at",
  activities: "id, title, description, deleted_at",
};

function mapCestino(tipo: V3TipoCestino, row: Record<string, unknown>): V3VoceCestino {
  const base = { id: String(row.id), tipo, eliminatoIl: (row.deleted_at as string | null) ?? null };
  switch (tipo) {
    case "partners":
      return { ...base, titolo: String(row.company_name ?? "Azienda senza nome"), dettaglio: (row.country_name as string | null) ?? null };
    case "partner_contacts":
      return { ...base, titolo: String(row.name ?? "Contatto senza nome"), dettaglio: (row.email as string | null) ?? null };
    case "channel_messages":
      return { ...base, titolo: String(row.subject ?? "Messaggio senza oggetto"), dettaglio: (row.from_address as string | null) ?? null };
    case "activities":
      return { ...base, titolo: String(row.title ?? "Attività senza titolo"), dettaglio: (row.description as string | null) ?? null };
  }
}

export async function listCestinoV3(filtri: V3CestinoFiltri): Promise<V3CestinoPagina> {
  const perPagina = Math.min(Math.max(filtri.perPagina, 1), 100);
  const pagina = Math.max(filtri.pagina, 0);
  const from = pagina * perPagina;

  let query = supabase
    .from(filtri.tipo)
    .select(SELECT_CESTINO[filtri.tipo], { count: "exact" })
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false })
    .range(from, from + perPagina - 1);

  if (filtri.giorni !== null) {
    const dal = new Date(Date.now() - Math.max(filtri.giorni, 1) * 86_400_000).toISOString();
    query = query.gte("deleted_at", dal);
  }

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    righe: ((data ?? []) as unknown as Record<string, unknown>[]).map((row) => mapCestino(filtri.tipo, row)),
    totale: count ?? 0,
  };
}

/** Conteggio per tipo, per il rail dei filtri. */
export async function getConteggiCestinoV3(): Promise<Record<V3TipoCestino, number>> {
  const risultati = await Promise.all(
    V3_TIPI_CESTINO.map(async ({ tipo }) => {
      const { count, error } = await supabase
        .from(tipo)
        .select("id", { count: "exact", head: true })
        .not("deleted_at", "is", null);
      if (error) throw error;
      return [tipo, count ?? 0] as const;
    }),
  );
  return Object.fromEntries(risultati) as Record<V3TipoCestino, number>;
}
