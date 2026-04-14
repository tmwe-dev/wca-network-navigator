import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { RequestLogRow } from "./types";
import { fmtTime, aggregateBy } from "./utils";
import { KpiCard, Card, StatusPill, SkeletonRows, ErrorBox, EmptyTelemetry } from "./SharedUI";

export function RequestLogsView({ sinceIso }: { sinceIso: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["telemetry-request-logs", sinceIso],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("request_logs")
        .select("*")
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as RequestLogRow[];
    },
    refetchInterval: 30_000,
  });

  if (error) return <ErrorBox message={(error as Error).message} />;
  if (isLoading) return <SkeletonRows />;
  if (!data?.length) return <EmptyTelemetry label="Nessuna chiamata edge function nel periodo" />;

  const total = data.length;
  const errors = data.filter((d) => d.status !== "ok").length;
  const avgLatency = Math.round(
    data.reduce((s, d) => s + (d.latency_ms ?? 0), 0) / Math.max(1, total)
  );
  const errorRate = total > 0 ? ((errors / total) * 100).toFixed(1) : "0";
  const topFns = aggregateBy(data, "function_name").slice(0, 5);

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <KpiCard label="Chiamate totali" value={total.toLocaleString("it-IT")} />
        <KpiCard label="Errori" value={String(errors)} tone={errors > 0 ? "warn" : "ok"} />
        <KpiCard label="Error rate" value={`${errorRate}%`} tone={Number(errorRate) > 5 ? "warn" : "ok"} />
        <KpiCard label="Latenza media" value={`${avgLatency}ms`} />
      </div>

      <Card title="Top edge functions">
        <ul className="text-sm divide-y divide-border">
          {topFns.map((p) => (
            <li key={p.key} className="flex items-center justify-between py-2">
              <span className="font-mono text-xs">{p.key}</span>
              <span className="text-xs text-muted-foreground">{p.count}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card title={`Chiamate recenti (${data.length})`}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-left text-[10px] uppercase text-muted-foreground">
              <tr>
                <th className="py-2">Quando</th>
                <th>Funzione</th>
                <th>Status</th>
                <th>Latenza</th>
                <th>Trace</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.slice(0, 100).map((r) => (
                <tr key={r.id} className="hover:bg-muted/50">
                  <td className="py-1.5 text-muted-foreground whitespace-nowrap">{fmtTime(r.created_at)}</td>
                  <td className="font-mono">{r.function_name}</td>
                  <td><StatusPill status={r.status} /></td>
                  <td className="text-muted-foreground">{r.latency_ms ? `${r.latency_ms}ms` : "—"}</td>
                  <td className="font-mono text-[10px] text-muted-foreground">{r.trace_id?.slice(0, 8) ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
