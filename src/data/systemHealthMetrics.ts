/**
 * DAL — metriche per SystemHealthPanel (health-check + conteggi tabelle).
 */
import { supabase } from "@/integrations/supabase/client";

export interface HealthCheckData {
  status: string;
  checks: Record<string, string>;
  timestamp: string;
}

/** Invoca l'edge function health-check. */
export async function invokeHealthCheck(): Promise<HealthCheckData | null> {
  const { data, error } = await supabase.functions.invoke("health-check");
  if (error || !data) return null;
  return data as HealthCheckData;
}

/** Conteggio righe supervisor_audit_log con action_category="error" da una data. */
export async function countSupervisorErrorsSince(sinceIso: string): Promise<number> {
  const { count } = await supabase
    .from("supervisor_audit_log")
    .select("id", { count: "exact", head: true })
    .eq("action_category", "error")
    .gte("created_at", sinceIso);
  return count ?? 0;
}

/** Latenze delle ultime decisioni AI (per calcolo media). */
export async function findRecentDecisionLatencies(limit = 10): Promise<Array<{ execution_time_ms: number | null }>> {
  const { data } = await supabase
    .from("ai_decision_log")
    .select("execution_time_ms")
    .not("execution_time_ms", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

/** Conteggio email classificate da una data. */
export async function countEmailClassificationsSince(sinceIso: string): Promise<number> {
  const { count } = await supabase
    .from("email_classifications")
    .select("id", { count: "exact", head: true })
    .gte("classified_at", sinceIso);
  return count ?? 0;
}
