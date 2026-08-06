/**
 * DAL — memoria e log dell'agente scraper "Optimus".
 */
import { supabase } from "@/integrations/supabase/client";

const MEMORY_SELECT =
  "id, channel, page_type, plan_version, consecutive_failures, consecutive_successes, total_invocations, total_ai_calls, last_success_at, last_failure_at, extraction_plan, updated_at";

const LOG_SELECT =
  "id, channel, page_type, used_cached_plan, execution_result, items_found, items_extracted, ai_latency_ms, ai_model, error_message, created_at";

export interface OptimusMemoryRow {
  id: string;
  channel: string;
  page_type: string;
  plan_version: number | null;
  consecutive_failures: number | null;
  consecutive_successes: number | null;
  total_invocations: number | null;
  total_ai_calls: number | null;
  last_success_at: string | null;
  last_failure_at: string | null;
  extraction_plan: unknown;
  updated_at: string;
}

export interface OptimusLogEntry {
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
}

/** Memoria per (channel, page_type). Ritorna null su errore o assenza (parità col chiamante). */
export async function findOptimusMemory(channel: string, pageType: string): Promise<OptimusMemoryRow | null> {
  const { data, error } = await supabase
    .from("scraper_agent_memory")
    .select(MEMORY_SELECT)
    .eq("channel", channel)
    .eq("page_type", pageType)
    .maybeSingle();
  if (error || !data) return null;
  return data as OptimusMemoryRow;
}

export async function findOptimusMemoryOverview(): Promise<OptimusMemoryRow[]> {
  const { data, error } = await supabase
    .from("scraper_agent_memory")
    .select(MEMORY_SELECT)
    .order("channel", { ascending: true })
    .order("page_type", { ascending: true });
  if (error || !data) return [];
  return data as OptimusMemoryRow[];
}

export async function findOptimusLogs(filters?: {
  channel?: string;
  result?: string;
  limit?: number;
}): Promise<OptimusLogEntry[]> {
  let q = supabase
    .from("scraper_agent_log")
    .select(LOG_SELECT)
    .order("created_at", { ascending: false })
    .limit(filters?.limit ?? 50);

  if (filters?.channel && filters.channel !== "all") q = q.eq("channel", filters.channel);
  if (filters?.result && filters.result !== "all") q = q.eq("execution_result", filters.result);

  const { data, error } = await q;
  if (error || !data) return [];
  return data as OptimusLogEntry[];
}
