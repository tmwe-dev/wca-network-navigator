/**
 * TelemetryPage — Metrics, logs, AI request monitoring
 */
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Activity, Cpu, Clock, AlertTriangle } from "lucide-react";
import { StatCard } from "../molecules/StatCard";

export function TelemetryPage(): React.ReactElement {
  const { data: aiLogs } = useQuery({
    queryKey: ["v2-ai-request-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_request_log")
        .select("id, model, status, latency_ms, total_tokens, intent, created_at, error_message")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const totalRequests = aiLogs?.length ?? 0;
  const avgLatency = totalRequests > 0
    ? Math.round((aiLogs ?? []).reduce((s, l) => s + (l.latency_ms ?? 0), 0) / totalRequests)
    : 0;
  const errorCount = aiLogs?.filter((l) => l.status === "error").length ?? 0;
  const totalTokens = (aiLogs ?? []).reduce((s, l) => s + (l.total_tokens ?? 0), 0);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Activity className="h-6 w-6" />Telemetria</h1>
        <p className="text-sm text-muted-foreground">Metriche, log AI e monitoring sistema.</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Richieste AI" value={String(totalRequests)} icon={<Cpu className="h-4 w-4" />} />
        <StatCard title="Latenza media" value={`${avgLatency}ms`} icon={<Clock className="h-4 w-4" />} />
        <StatCard title="Errori" value={String(errorCount)} icon={<AlertTriangle className="h-4 w-4" />} />
        <StatCard title="Token totali" value={totalTokens.toLocaleString()} icon={<Activity className="h-4 w-4" />} />
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-2 font-medium text-muted-foreground">Modello</th>
              <th className="text-left px-4 py-2 font-medium text-muted-foreground">Intent</th>
              <th className="text-left px-4 py-2 font-medium text-muted-foreground">Stato</th>
              <th className="text-left px-4 py-2 font-medium text-muted-foreground">Latenza</th>
              <th className="text-left px-4 py-2 font-medium text-muted-foreground">Token</th>
              <th className="text-left px-4 py-2 font-medium text-muted-foreground">Data</th>
            </tr>
          </thead>
          <tbody>
            {aiLogs?.map((l) => (
              <tr key={l.id} className="border-t">
                <td className="px-4 py-2 text-foreground font-mono text-xs">{l.model ?? "—"}</td>
                <td className="px-4 py-2 text-foreground">{l.intent ?? "—"}</td>
                <td className="px-4 py-2">
                  <span className={`text-xs font-medium ${l.status === "error" ? "text-destructive" : "text-green-600 dark:text-green-400"}`}>
                    {l.status ?? "—"}
                  </span>
                </td>
                <td className="px-4 py-2 text-muted-foreground">{l.latency_ms ?? "—"}ms</td>
                <td className="px-4 py-2 text-muted-foreground">{l.total_tokens ?? "—"}</td>
                <td className="px-4 py-2 text-xs text-muted-foreground">{l.created_at ? new Date(l.created_at).toLocaleString("it") : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
