/**
 * DAL v2 — KPI di sistema (contatori aggregati read-only).
 * Estratto da `src/v2/hooks/useSystemKpis.ts` per rimuovere query dirette dal layer hook.
 */
import { supabase } from "@/integrations/supabase/client";

async function safeCount(query: () => PromiseLike<{ count: number | null; error: unknown }>): Promise<number> {
  try {
    const { count, error } = await query();
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

export interface SystemKpiCounts {
  partnerTotal: number;
  partnerEnriched: number;
  sent30d: number;
  failed30d: number;
  inbound30d: number;
  agentsCompleted: number;
  agentsFailed: number;
  agentsPending: number;
}

/** Contatori KPI su finestra temporale ISO `since`. */
export async function fetchSystemKpiCounts(since: string): Promise<SystemKpiCounts> {
  const [partnerTotal, partnerEnriched, sent30d, failed30d, inbound30d, agentsCompleted, agentsFailed, agentsPending] =
    await Promise.all([
      safeCount(() => supabase.from("partners").select("id", { count: "exact", head: true }).is("deleted_at", null)),
      safeCount(() =>
        supabase
          .from("partners")
          .select("id", { count: "exact", head: true })
          .is("deleted_at", null)
          .not("enrichment_data", "is", null),
      ),
      safeCount(() =>
        supabase
          .from("email_send_log")
          .select("id", { count: "exact", head: true })
          .eq("status", "sent")
          .gte("sent_at", since),
      ),
      safeCount(() =>
        supabase
          .from("email_send_log")
          .select("id", { count: "exact", head: true })
          .in("status", ["failed", "bounced", "rejected"])
          .gte("sent_at", since),
      ),
      safeCount(() =>
        supabase
          .from("channel_messages")
          .select("id", { count: "exact", head: true })
          .eq("direction", "inbound")
          .eq("channel", "email")
          .gte("created_at", since),
      ),
      safeCount(() =>
        supabase
          .from("agent_tasks")
          .select("id", { count: "exact", head: true })
          .eq("status", "completed")
          .gte("created_at", since),
      ),
      safeCount(() =>
        supabase
          .from("agent_tasks")
          .select("id", { count: "exact", head: true })
          .eq("status", "failed")
          .gte("created_at", since),
      ),
      safeCount(() =>
        supabase.from("agent_tasks").select("id", { count: "exact", head: true }).eq("status", "pending"),
      ),
    ]);

  return {
    partnerTotal,
    partnerEnriched,
    sent30d,
    failed30d,
    inbound30d,
    agentsCompleted,
    agentsFailed,
    agentsPending,
  };
}

/** Distribuzione partner per `lead_status` (funnel). */
export async function fetchLeadStatusFunnel(): Promise<Record<string, number>> {
  const funnel: Record<string, number> = {};
  try {
    const { data } = await supabase.from("partners").select("lead_status").is("deleted_at", null).limit(20000);
    for (const row of (data ?? []) as Array<{ lead_status: string | null }>) {
      const k = row.lead_status ?? "unknown";
      funnel[k] = (funnel[k] ?? 0) + 1;
    }
  } catch {
    /* funnel opzionale: fallback vuoto */
  }
  return funnel;
}
