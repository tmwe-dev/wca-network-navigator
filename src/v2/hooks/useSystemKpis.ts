/**
 * useSystemKpis — P6.3
 * Aggrega KPI reali del sistema per la pagina KPI dashboard.
 */
import { useQuery } from "@tanstack/react-query";
import { fetchSystemKpiCounts, fetchLeadStatusFunnel } from "@/v2/io/supabase/queries/system-kpis";

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

async function fetchKpis(): Promise<SystemKpis> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const {
    partnerTotal,
    partnerEnriched,
    sent30d,
    failed30d,
    inbound30d,
    agentsCompleted,
    agentsFailed,
    agentsPending,
  } = await fetchSystemKpiCounts(since);

  const funnel = await fetchLeadStatusFunnel();

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
