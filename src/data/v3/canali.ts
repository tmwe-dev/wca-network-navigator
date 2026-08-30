/**
 * DAL V3 — pagina "Canali" (Modulo 3).
 * Conversazioni WhatsApp/LinkedIn aggregate per contatto. Sola lettura.
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
    .select("id, channel, direction, from_address, from_name, to_address, subject, body_text, email_date, created_at, read_at")
    .is("deleted_at", null)
    .in("channel", filtri.canale ? [filtri.canale] : [...V3_CANALI_NON_EMAIL])
    .gte("created_at", dal)
    .order("created_at", { ascending: false })
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
    const dataMsg = (row.email_date as string | null) ?? (row.created_at as string | null) ?? null;
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
