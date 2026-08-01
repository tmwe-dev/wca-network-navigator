/**
 * Edge Function structured monitoring — Vol. II §12.
 * Emits JSON logs compatible with Supabase Edge logs.
 * Lotto 4 (2026-05-11): persistenza best-effort su public.edge_metrics
 * per riattivare la telemetria — non blocca mai, fallisce in silenzio.
 */
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export interface EdgeFunctionMetrics {
  functionName: string;
  startTime: number;
  userId?: string;
  metadata?: Record<string, unknown>;
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
let _adminClient: SupabaseClient | null = null;
function getAdmin(): SupabaseClient | null {
  if (!SUPABASE_URL || !SERVICE_ROLE) return null;
  if (!_adminClient) {
    _adminClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _adminClient;
}

function persistMetric(row: Record<string, unknown>): void {
  // Fire-and-forget: mai await, mai throw.
  try {
    const admin = getAdmin();
    if (!admin) return;
    void admin.from("edge_metrics").insert(row as never).then(() => {}).catch(() => {});
  } catch { /* never throw */ }
}

export function startMetrics(functionName: string, userId?: string): EdgeFunctionMetrics {
  return { functionName, startTime: Date.now(), userId };
}

export function endMetrics(metrics: EdgeFunctionMetrics, success: boolean, statusCode: number): void {
  const duration = Date.now() - metrics.startTime;
  const level = duration > 10000 ? "warning" : success ? "info" : "error";
  console.log(JSON.stringify({
    type: "edge_function_metric",
    function: metrics.functionName,
    duration_ms: duration,
    success,
    status_code: statusCode,
    user_id: metrics.userId || "anonymous",
    level,
    timestamp: new Date().toISOString(),
    ...(metrics.metadata || {}),
  }));
  persistMetric({
    function_name: metrics.functionName,
    event_type: "perf",
    severity: success ? (duration > 10000 ? "warn" : "info") : "error",
    message: success ? "ok" : "failed",
    duration_ms: duration,
    status_code: statusCode,
    user_id: metrics.userId ?? null,
    context: metrics.metadata ?? {},
    tags: success ? [] : ["failure"],
  });
}

export function logEdgeError(functionName: string, error: unknown, context?: Record<string, unknown>): void {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  console.error(JSON.stringify({
    type: "edge_function_error",
    function: functionName,
    error: message,
    stack: stack?.substring(0, 1000),
    timestamp: new Date().toISOString(),
    ...(context || {}),
  }));
  persistMetric({
    function_name: functionName,
    event_type: "error",
    severity: "error",
    message: message.slice(0, 500),
    duration_ms: null,
    status_code: null,
    user_id: null,
    context: { ...(context ?? {}), stack: stack?.substring(0, 500) },
    tags: ["error"],
  });
}
