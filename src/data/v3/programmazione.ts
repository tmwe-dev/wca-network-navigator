/**
 * DAL V3 — Modulo 6 (Programmazione).
 *
 * Tre letture:
 * - agenda: attività e promemoria con scadenza (`activities`, `reminders`);
 * - campagne: lotti di invio raggruppati per `campaign_batch_id`;
 * - coda: righe di `email_campaign_queue` con stato ed errore.
 *
 * Sola lettura: riprova/sblocco toccano la pipeline di invio e restano fuori
 * da questa maschera finché il modulo di invio non è innestato in V3.
 */
import { supabase } from "@/integrations/supabase/client";

export type V3VoceAgendaOrigine = "attivita" | "promemoria";

export interface V3VoceAgenda {
  readonly id: string;
  readonly origine: V3VoceAgendaOrigine;
  readonly titolo: string;
  readonly descrizione: string | null;
  readonly tipo: string | null;
  readonly stato: string;
  readonly priorita: string | null;
  readonly scadenza: string | null;
  readonly partnerId: string | null;
}

export interface V3AgendaFiltri {
  /** Finestra in giorni a partire da oggi; le voci scadute rientrano sempre. */
  readonly giorni: number;
  readonly tipo?: string | null;
  /** `null` = tutte; altrimenti stato esatto. */
  readonly stato?: string | null;
  readonly soloScadute?: boolean;
}

function fineFinestra(giorni: number): string {
  return new Date(Date.now() + Math.max(giorni, 1) * 86_400_000).toISOString().slice(0, 10);
}

export async function listAgendaV3(filtri: V3AgendaFiltri): Promise<V3VoceAgenda[]> {
  const oggi = new Date().toISOString().slice(0, 10);
  const fine = fineFinestra(filtri.giorni);

  let attivita = supabase
    .from("activities")
    .select("id, title, description, activity_type, status, priority, due_date, scheduled_at, partner_id")
    .is("deleted_at", null)
    .lte("due_date", fine)
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(200);

  if (filtri.tipo) attivita = attivita.eq("activity_type", filtri.tipo as never);
  if (filtri.stato) attivita = attivita.eq("status", filtri.stato as never);
  if (filtri.soloScadute) attivita = attivita.lt("due_date", oggi);

  let promemoria = supabase
    .from("reminders")
    .select("id, title, description, status, priority, due_date, partner_id")
    .is("deleted_at", null)
    .lte("due_date", fine)
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(200);

  if (filtri.stato) promemoria = promemoria.eq("status", filtri.stato as never);
  if (filtri.soloScadute) promemoria = promemoria.lt("due_date", oggi);

  const [resAttivita, resPromemoria] = await Promise.all([attivita, promemoria]);
  if (resAttivita.error) throw resAttivita.error;
  if (resPromemoria.error) throw resPromemoria.error;

  const voci: V3VoceAgenda[] = [];

  for (const row of resAttivita.data ?? []) {
    const item = row as Record<string, unknown>;
    voci.push({
      id: String(item.id),
      origine: "attivita",
      titolo: String(item.title ?? "Attività senza titolo"),
      descrizione: (item.description as string | null) ?? null,
      tipo: (item.activity_type as string | null) ?? null,
      stato: String(item.status ?? "pending"),
      priorita: (item.priority as string | null) ?? null,
      scadenza: (item.due_date as string | null) ?? (item.scheduled_at as string | null) ?? null,
      partnerId: (item.partner_id as string | null) ?? null,
    });
  }

  if (!filtri.tipo) {
    for (const row of resPromemoria.data ?? []) {
      const item = row as Record<string, unknown>;
      voci.push({
        id: String(item.id),
        origine: "promemoria",
        titolo: String(item.title ?? "Promemoria"),
        descrizione: (item.description as string | null) ?? null,
        tipo: null,
        stato: String(item.status ?? "pending"),
        priorita: (item.priority as string | null) ?? null,
        scadenza: (item.due_date as string | null) ?? null,
        partnerId: (item.partner_id as string | null) ?? null,
      });
    }
  }

  return voci.sort((a, b) => (a.scadenza ?? "9999").localeCompare(b.scadenza ?? "9999"));
}

export interface V3VoceCoda {
  readonly id: string;
  readonly destinatario: string | null;
  readonly nome: string | null;
  readonly oggetto: string | null;
  readonly stato: string;
  readonly errore: string | null;
  readonly tentativi: number;
  readonly programmatoIl: string | null;
  readonly inviatoIl: string | null;
  readonly creatoIl: string | null;
  readonly aperture: number;
}

export interface V3CodaFiltri {
  readonly stato?: string | null;
  readonly soloErrori?: boolean;
  readonly pagina: number;
  readonly perPagina: number;
}

export interface V3CodaPagina {
  readonly righe: readonly V3VoceCoda[];
  readonly totale: number;
  readonly statiDisponibili: readonly { readonly stato: string; readonly conteggio: number }[];
}

export async function listCodaV3(filtri: V3CodaFiltri): Promise<V3CodaPagina> {
  const perPagina = Math.min(Math.max(filtri.perPagina, 1), 100);
  const pagina = Math.max(filtri.pagina, 0);
  const from = pagina * perPagina;

  let query = supabase
    .from("email_campaign_queue")
    .select(
      "id, recipient_email, recipient_name, subject, status, error_message, retry_count, scheduled_at, sent_at, created_at, open_count",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, from + perPagina - 1);

  if (filtri.stato) query = query.eq("status", filtri.stato);
  if (filtri.soloErrori) query = query.not("error_message", "is", null);

  const [res, stati] = await Promise.all([
    query,
    supabase.from("email_campaign_queue").select("status").limit(1000),
  ]);

  if (res.error) throw res.error;
  if (stati.error) throw stati.error;

  const conteggi = new Map<string, number>();
  for (const row of (stati.data ?? []) as { status: string | null }[]) {
    const key = row.status ?? "sconosciuto";
    conteggi.set(key, (conteggi.get(key) ?? 0) + 1);
  }

  return {
    righe: (res.data ?? []).map((row) => {
      const item = row as Record<string, unknown>;
      return {
        id: String(item.id),
        destinatario: (item.recipient_email as string | null) ?? null,
        nome: (item.recipient_name as string | null) ?? null,
        oggetto: (item.subject as string | null) ?? null,
        stato: String(item.status ?? "pending"),
        errore: (item.error_message as string | null) ?? null,
        tentativi: (item.retry_count as number | null) ?? 0,
        programmatoIl: (item.scheduled_at as string | null) ?? null,
        inviatoIl: (item.sent_at as string | null) ?? null,
        creatoIl: (item.created_at as string | null) ?? null,
        aperture: (item.open_count as number | null) ?? 0,
      };
    }),
    totale: res.count ?? 0,
    statiDisponibili: [...conteggi.entries()]
      .map(([stato, conteggio]) => ({ stato, conteggio }))
      .sort((a, b) => b.conteggio - a.conteggio),
  };
}
