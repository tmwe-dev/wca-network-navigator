/**
 * useOptimusStatus — query lo stato dell'agente Optimus per (channel, page_type).
 * Usato dai badge inline e dal pannello Optimus.
 */
import { useQuery } from "@tanstack/react-query";
import { findOptimusMemory, findOptimusMemoryOverview, findOptimusLogs } from "@/data/optimusAgent";

export type OptimusChannel = "whatsapp" | "linkedin";
export type OptimusPageType = "sidebar" | "thread" | "inbox" | "messaging";

export type OptimusStatusRow = {
  id: string;
  channel: OptimusChannel;
  page_type: OptimusPageType;
  plan_version: number;
  consecutive_failures: number;
  consecutive_successes: number;
  total_invocations: number;
  total_ai_calls: number;
  last_success_at: string | null;
  last_failure_at: string | null;
  confidence: number; // derivato da extraction_plan.confidence
  updated_at: string;
};

export function useOptimusStatus(channel: OptimusChannel, pageType: OptimusPageType) {
  return useQuery<OptimusStatusRow | null>({
    queryKey: ["optimus-status", channel, pageType],
    queryFn: async () => {
      const data = await findOptimusMemory(channel, pageType);
      if (!data) return null;

      const plan = (data.extraction_plan ?? {}) as { confidence?: number };
      const confidence = typeof plan.confidence === "number" ? plan.confidence : 0;

      return {
        id: data.id,
        channel: data.channel as OptimusChannel,
        page_type: data.page_type as OptimusPageType,
        plan_version: data.plan_version ?? 0,
        consecutive_failures: data.consecutive_failures ?? 0,
        consecutive_successes: data.consecutive_successes ?? 0,
        total_invocations: data.total_invocations ?? 0,
        total_ai_calls: data.total_ai_calls ?? 0,
        last_success_at: data.last_success_at,
        last_failure_at: data.last_failure_at,
        confidence,
        updated_at: data.updated_at,
      };
    },
    refetchInterval: 15_000,
    staleTime: 5_000,
  });
}

export type OptimusOverviewRow = OptimusStatusRow;

export function useOptimusOverview() {
  return useQuery<OptimusOverviewRow[]>({
    queryKey: ["optimus-overview"],
    queryFn: async () => {
      const data = await findOptimusMemoryOverview();
      return data.map((d) => {
        const plan = (d.extraction_plan ?? {}) as { confidence?: number };
        return {
          id: d.id,
          channel: d.channel as OptimusChannel,
          page_type: d.page_type as OptimusPageType,
          plan_version: d.plan_version ?? 0,
          consecutive_failures: d.consecutive_failures ?? 0,
          consecutive_successes: d.consecutive_successes ?? 0,
          total_invocations: d.total_invocations ?? 0,
          total_ai_calls: d.total_ai_calls ?? 0,
          last_success_at: d.last_success_at,
          last_failure_at: d.last_failure_at,
          confidence: typeof plan.confidence === "number" ? plan.confidence : 0,
          updated_at: d.updated_at,
        };
      });
    },
    refetchInterval: 30_000,
  });
}

export type OptimusLogRow = {
  id: string;
  channel: string;
  page_type: string;
  used_cached_plan: boolean;
  execution_result: string | null;
  items_found: number | null;
  items_extracted: number | null;
  ai_latency_ms: number | null;
  ai_model: string | null;
  error_message: string | null;
  created_at: string;
};

export function useOptimusLogs(filters?: { channel?: string; result?: string; limit?: number }) {
  return useQuery<OptimusLogRow[]>({
    queryKey: ["optimus-logs", filters?.channel ?? "all", filters?.result ?? "all", filters?.limit ?? 50],
    queryFn: async () => {
      return (await findOptimusLogs(filters)) as OptimusLogRow[];
    },
    refetchInterval: 20_000,
  });
}
