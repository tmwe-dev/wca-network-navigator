/**
 * EdgeFunctionMetricsPanel — Sprint H Observability.
 * Shows aggregated metrics from edge_function_logs:
 * - Top 10 functions by invocation count (24h)
 * - Error rate by function
 * - Average latency (p50/p95)
 *
 * Read-only, DAL via untypedFrom.
 */
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, AlertTriangle, Clock, Zap } from "lucide-react";
import { untypedFrom } from "@/lib/supabaseUntyped";

interface EdgeMetricRow {
  function_name: string;
  invocations: number;
  errors: number;
  avg_latency_ms: number;
  p95_latency_ms: number;
}

async function fetchEdgeFunctionMetrics(): Promise<EdgeMetricRow[]> {
  // Aggregate from edge_function_logs (last 24h)
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await untypedFrom("edge_function_logs")
    .select("function_name, status, latency_ms")
    .gte("created_at", since)
    .limit(5000);
  if (error) throw error;

  const rows = (data ?? []) as Array<{
    function_name: string;
    status: string;
    latency_ms: number | null;
  }>;

  // Group by function_name
  const grouped = new Map<string, { invocations: number; errors: number; latencies: number[] }>();
  for (const r of rows) {
    const entry = grouped.get(r.function_name) ?? { invocations: 0, errors: 0, latencies: [] };
    entry.invocations += 1;
    if (r.status === "error" || r.status === "failed") entry.errors += 1;
    if (r.latency_ms != null) entry.latencies.push(r.latency_ms);
    grouped.set(r.function_name, entry);
  }

  const result: EdgeMetricRow[] = [];
  for (const [name, stats] of grouped) {
    const sorted = stats.latencies.sort((a, b) => a - b);
    const avg = sorted.length > 0 ? sorted.reduce((s, v) => s + v, 0) / sorted.length : 0;
    const p95Idx = Math.floor(sorted.length * 0.95);
    const p95 = sorted.length > 0 ? sorted[Math.min(p95Idx, sorted.length - 1)] : 0;
    result.push({
      function_name: name,
      invocations: stats.invocations,
      errors: stats.errors,
      avg_latency_ms: Math.round(avg),
      p95_latency_ms: Math.round(p95),
    });
  }

  return result.sort((a, b) => b.invocations - a.invocations).slice(0, 15);
}

function ErrorRateBadge({ errors, total }: { errors: number; total: number }) {
  if (total === 0) return <Badge variant="outline" className="text-[10px]">N/A</Badge>;
  const rate = (errors / total) * 100;
  const variant = rate === 0 ? "outline" : rate < 5 ? "secondary" : "destructive";
  return <Badge variant={variant} className="text-[10px]">{rate.toFixed(1)}%</Badge>;
}

export function EdgeFunctionMetricsPanel() {
  const { data: metrics, isLoading, error } = useQuery({
    queryKey: ["edge-function-metrics-24h"],
    queryFn: fetchEdgeFunctionMetrics,
    staleTime: 120_000,
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4 animate-pulse" /> Edge Functions (24h)</CardTitle></CardHeader>
        <CardContent><div className="text-sm text-muted-foreground">Caricamento metriche...</div></CardContent>
      </Card>
    );
  }

  if (error || !metrics) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" /> Edge Functions</CardTitle></CardHeader>
        <CardContent><div className="text-sm text-muted-foreground">Metriche non disponibili</div></CardContent>
      </Card>
    );
  }

  const totalInvocations = metrics.reduce((s, m) => s + m.invocations, 0);
  const totalErrors = metrics.reduce((s, m) => s + m.errors, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            Edge Functions (24h)
          </CardTitle>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span><strong className="text-foreground">{totalInvocations.toLocaleString("it-IT")}</strong> invocazioni</span>
            <span className={totalErrors > 0 ? "text-rose-500" : ""}>
              <strong>{totalErrors}</strong> errori
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {metrics.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center">
            Nessuna invocazione nelle ultime 24 ore.
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="grid grid-cols-[1fr_80px_70px_80px_80px] gap-2 text-[10px] text-muted-foreground uppercase tracking-wider pb-1 border-b">
              <span>Funzione</span>
              <span className="text-right">Invocazioni</span>
              <span className="text-right">Err %</span>
              <span className="text-right flex items-center justify-end gap-1"><Clock className="h-3 w-3" /> Avg</span>
              <span className="text-right">P95</span>
            </div>
            {metrics.map((m) => (
              <div key={m.function_name} className="grid grid-cols-[1fr_80px_70px_80px_80px] gap-2 items-center text-xs py-1">
                <span className="font-mono text-[11px] truncate" title={m.function_name}>
                  {m.function_name}
                </span>
                <span className="text-right tabular-nums">{m.invocations.toLocaleString("it-IT")}</span>
                <span className="text-right"><ErrorRateBadge errors={m.errors} total={m.invocations} /></span>
                <span className="text-right tabular-nums">{m.avg_latency_ms}ms</span>
                <span className="text-right tabular-nums text-muted-foreground">{m.p95_latency_ms}ms</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
