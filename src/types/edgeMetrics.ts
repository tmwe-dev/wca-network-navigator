/**
 * Sprint H — Edge function observability types.
 *
 * Used by the EdgeMetrics dashboard and alerting pipeline.
 */

/** Aggregated metrics for a single edge function over the last 24 h. */
export interface EdgeFunctionMetric {
  /** Supabase edge function name (e.g. "ai-gateway", "check-inbox"). */
  function_name: string;
  /** Total invocations in the last 24 hours. */
  call_count_24h: number;
  /** Median latency in milliseconds. */
  p50_ms: number;
  /** 95th-percentile latency in milliseconds. */
  p95_ms: number;
  /** 99th-percentile latency in milliseconds. */
  p99_ms: number;
  /** Fraction of calls that returned a non-2xx status (0 – 1). */
  error_rate: number;
  /** Approximate total LLM token usage (input + output) over the window. */
  token_usage: number;
}

/** Severity channels supported by the alerting pipeline. */
export type AlertSeverity = "info" | "warning" | "critical";

/** A single alert rule that fires when a metric crosses a threshold. */
export interface AlertRule {
  /** The metric to watch (e.g. "error_rate", "p95_ms"). */
  metric: keyof Omit<EdgeFunctionMetric, "function_name">;
  /** Fire when the metric exceeds this value. */
  threshold: number;
  /** Notification channel to use (e.g. "discord", "email", "slack"). */
  channel: string;
}
