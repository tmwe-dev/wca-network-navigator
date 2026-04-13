/**
 * Edge Function structured monitoring — Vol. II §12.
 * Emits JSON logs compatible with Supabase Edge logs.
 */

export interface EdgeFunctionMetrics {
  functionName: string;
  startTime: number;
  userId?: string;
  metadata?: Record<string, unknown>;
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
}
