/**
 * DAL — dati dei grafici dashboard (SuperHome3D) e mini-chart Outreach.
 * Estratto 1:1 dai componenti: stessi select, filtri, order e limit.
 * Semantica errori preservata: le read ignoravano `error` e usavano `data || []`.
 */
import { supabase } from "@/integrations/supabase/client";

/** Attività degli ultimi 30 giorni (tipo + data). */
export async function findActivitiesSince(
  isoDate: string,
): Promise<Array<{ created_at: string; activity_type: string | null }>> {
  const { data } = await supabase.from("activities").select("created_at, activity_type").gte("created_at", isoDate);
  return data ?? [];
}

/** Ultime 1000 attività, solo il canale. */
export async function findActivityTypes(): Promise<Array<{ activity_type: string | null }>> {
  const { data } = await supabase.from("activities").select("activity_type").limit(1000);
  return data ?? [];
}

/** Top 10 paesi per volume inviato. */
export async function findTopResponsePatterns(): Promise<
  Array<{ country_code: string | null; response_rate: number | null; total_sent: number | null }>
> {
  const { data } = await supabase
    .from("response_patterns")
    .select("country_code, response_rate, total_sent")
    .not("country_code", "is", null)
    .gt("total_sent", 0)
    .order("total_sent", { ascending: false })
    .limit(10);
  return data ?? [];
}

/** Lead score dei contatti importati (solo valorizzati). */
export async function findLeadScores(): Promise<Array<{ lead_score: number | null }>> {
  const { data } = await supabase.from("imported_contacts").select("lead_score").not("lead_score", "is", null);
  return data ?? [];
}

/** Attività di outreach (email/follow-up) dalla data indicata. */
export async function findOutreachActivityDates(isoDate: string): Promise<Array<{ created_at: string }>> {
  const { data } = await supabase
    .from("activities")
    .select("created_at")
    .gte("created_at", isoDate)
    .in("activity_type", ["send_email", "follow_up"]);
  return data ?? [];
}

/** Stato delle attività dalla data indicata. */
export async function findActivityStatuses(isoDate: string): Promise<Array<{ status: string | null }>> {
  const { data } = await supabase.from("activities").select("status").gte("created_at", isoDate);
  return data ?? [];
}

/** Conteggio risposte ricevute in una finestra temporale. */
export async function countResponsesReceived(params: { since: string; before?: string }): Promise<number> {
  let q = supabase.from("activities").select("*", { count: "exact", head: true }).gte("created_at", params.since);
  if (params.before) q = q.lt("created_at", params.before);
  const { count } = await q.eq("response_received", true);
  return count ?? 0;
}
