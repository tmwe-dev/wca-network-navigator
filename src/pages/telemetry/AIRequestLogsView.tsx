import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AIRequestLogRow } from "./types";
import { fmtTime, aggregateBy } from "./utils";
import { KpiCard, Card, StatusPill, SkeletonRows, ErrorBox, EmptyTelemetry } from "./SharedUI";

export function AIRequestLogsView({ sinceIso }: { sinceIso: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["telemetry-ai-requests", sinceIso],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_request_log")
        .select("*")
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as AIRequestLogRow[];
    },
    refetchInterval: 30_000,
  });

  if (error) return <ErrorBox message={(error as Error).message} />;
  if (isLoading) return <SkeletonRows />;
  if (!data?.length) return <EmptyTelemetry label="Nessuna richiesta AI nel periodo selezionato" />;

  const total = data.length;
  const totalCost = data.reduce((s, d) => s + (Number(d.cost_usd) || 0), 0);
  const totalTokens = data.reduce((s, d) => s + (d.total_tokens ?? 0), 0);
  const errors = data.filter((d) => d.status !== "ok").length;
  const byAgent = aggregateBy(data, "agent_code");

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <KpiCard label="Richieste AI" value={total.toLocaleString("it-IT")} />
        <KpiCard label="Token totali" value={totalTokens.toLocaleString("it-IT")} />
        <KpiCard label="Costo stimato" value={`$${totalCost.toFixed(4)}`} />
        <KpiCard label="Errori" value={String(errors)} tone={errors > 0 ? "warn" : "ok"} />
      </div>

      <Card title="Per agente">
        <ul className="text-sm divide-y divide-border">
          {byAgent.map((p) => (
            <li key={p.key} className="flex items-center justify-between py-2">
              <span className="font-medium">{p.key || "—"}</span>
              <span className="text-xs text-muted-foreground">{p.count} richieste</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card title={`Richieste recenti (${data.length})`}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-left text-[10px] uppercase text-muted-foreground">
              <tr>
                <th className="py-2">Quando</th>
                <th>Agente</th>
                <th>Modello</th>
                <th>Token</th>
                <th>Latenza</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.slice(0, 100).map((a) => (
                <tr key={a.id} className="hover:bg-muted/50">
                  <td className="py-1.5 text-muted-foreground whitespace-nowrap">{fmtTime(a.created_at)}</td>
                  <td className="font-medium">{a.agent_code ?? "—"}</td>
                  <td className="font-mono text-muted-foreground">{a.model ?? "—"}</td>
                  <td className="text-muted-foreground">{a.total_tokens ?? "—"}</td>
                  <td className="text-muted-foreground">{a.latency_ms ? `${a.latency_ms}ms` : "—"}</td>
                  <td><StatusPill status={a.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
