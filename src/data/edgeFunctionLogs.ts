/**
 * DAL — edge_function_logs (sola lettura per i pannelli di osservabilità).
 * Colonne verificate sullo schema live: function_name, status_code, duration_ms,
 * success, error_message, created_at.
 */
import { supabase } from "@/integrations/supabase/client";

export interface EdgeFunctionLogSample {
  function_name: string;
  status_code: number | null;
  duration_ms: number | null;
  success: boolean | null;
}

export async function fetchRecentEdgeFunctionLogs(
  hours = 24,
  limit = 5000,
): Promise<EdgeFunctionLogSample[]> {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("edge_function_logs")
    .select("function_name, status_code, duration_ms, success")
    .gte("created_at", since)
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    function_name: r.function_name,
    status_code: r.status_code,
    duration_ms: r.duration_ms,
    success: r.success,
  }));
}
