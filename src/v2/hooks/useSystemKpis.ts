/**
 * useSystemKpis — P6.3
 * Aggrega KPI reali del sistema per la pagina KPI dashboard.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SystemKpis {
  enrichment: {
    total: number;
    enriched: number;
    coveragePct: number;
  };
  email: {
    sent30d: number;
    failed30d: number;
    deliverabilityPct: number;
    inbound30d: number;
    responseRatePct: number;
  };
  agents: {
    completed: number;
    failed: number;
    pending: number;
    completionRatePct: number;
  };
  funnel: Record<string, number>;
}

async function safeCount(query: () => Promise<{ count: number | null; error: unknown }>): Promise<number> {
  try {
    const { count, error } = await query();
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

async function fetchKpis(): Promise<SystemKpis> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    partnerTotal,
    partnerEnriched,
    sent30d,
    failed30d,
    inbound30d,
    agentsCompleted,
    agentsFailed,
    agentsPending,
  ] = await Promise.all([
    safeCount(() =>
      supabase
        .from("partners")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
    ),
    safeCount(() =>
      supabase
        .from("partners")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .not("enrichment_data", "is", null)
    ),
    safeCount(() =>
      supabase
        .from("email_send_log")
        .select("id", { count: "exact", head: true })
        .eq("status", "sent")
        .gte("sent_at", since)
    ),
    safeCount(() =>
      supabase
        .from("email_send_log")
        .select("id", { count: "exact", head: true })
        .in("status", ["failed", "bounced", "rejected"])
        .gte("sent_at", since)
    ),
    safeCount(() =>
      supabase
        .from("channel_messages")
        .select("id", { count: "exact", head: true })
        .eq("direction", "inbound")
        .eq("channel", "email")
        .gte("created_at", since)
    ),
    safeCount(() =>
      supabase
        .from("agent_tasks")
        .select("id", { count: "exact", head: true })
        .eq("status", "completed")
        .gte("created_at", since)
    ),
    safeCount(() =>
      supabase
        .from("agent_tasks")
        .select("id", { count: "exact", head: true })
        .eq("status", "failed")
        .gte("created_at", since)
    ),
    safeCount(() =>
      supabase
        .from("agent_tasks")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending")
    ),
  ]);

  // Funnel lead_status
  const funnel: Record<string, number> = {};
  try {
    const { data } = await supabase
      .from("partners")
      .select("lead_status")
      .is("deleted_at", null)
      .limit(20000);
    if (data) {
      for (const row of data as Array<{ lead_status: string | null }>) {
        const k = row.lead_status ?? "unknown";
        funnel[k] = (funnel[k] ?? 0) + 1;
      }
    }
  } catch {
    // ignore
  }

  const totalEmail = sent30d + failed30d;
  const totalAgents = agentsCompleted + agentsFailed;

  return {
    enrichment: {
      total: partnerTotal,
      enriched: partnerEnriched,
      coveragePct: partnerTotal > 0 ? (partnerEnriched / partnerTotal) * 100 : 0,
    },
    email: {
      sent30d,
      failed30d,
      deliverabilityPct: totalEmail > 0 ? (sent30d / totalEmail) * 100 : 0,
      inbound30d,
      responseRatePct: sent30d > 0 ? (inbound30d / sent30d) * 100 : 0,
    },
    agents: {
      completed: agentsCompleted,
      failed: agentsFailed,
      pending: agentsPending,
      completionRatePct: totalAgents > 0 ? (agentsCompleted / totalAgents) * 100 : 0,
    },
    funnel,
  };
}

export function useSystemKpis() {
  return useQuery({
    queryKey: ["system-kpis"],
    queryFn: fetchKpis,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: true,
  });
}