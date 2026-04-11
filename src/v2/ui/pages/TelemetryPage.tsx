/**
 * TelemetryPage — AI request monitoring with model breakdown and cost estimates
 */
import * as React from "react";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Activity, Cpu, Clock, AlertTriangle, Filter } from "lucide-react";
import { StatCard } from "../molecules/StatCard";
import { StatusBadge } from "../atoms/StatusBadge";

export function TelemetryPage(): React.ReactElement {
  const [modelFilter, setModelFilter] = useState<string>("all");

  const { data: aiLogs } = useQuery({
    queryKey: ["v2-ai-request-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_request_log")
        .select("id, model, status, latency_ms, total_tokens, intent, created_at, error_message, agent_code, channel")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const filteredLogs = useMemo(() => {
    if (!aiLogs) return [];
    if (modelFilter === "all") return aiLogs;
    return aiLogs.filter((l) => l.model === modelFilter);
  }, [aiLogs, modelFilter]);

  const models = useMemo(() => {
    const set = new Set<string>();
    aiLogs?.forEach((l) => { if (l.model) set.add(l.model); });
    return Array.from(set).sort();
  }, [aiLogs]);

  const stats = useMemo(() => {
    const logs = filteredLogs;
    const total = logs.length;
    const avgLatency = total > 0 ? Math.round(logs.reduce((s, l) => s + (l.latency_ms ?? 0), 0) / total) : 0;
    const errors = logs.filter((l) => l.status === "error").length;
    const tokens = logs.reduce((s, l) => s + (l.total_tokens ?? 0), 0);
    return { total, avgLatency, errors, tokens };
  }, [filteredLogs]);

  const modelBreakdown = useMemo(() => {
    const map = new Map<string, { count: number; tokens: number; errors: number }>();
    aiLogs?.forEach((l) => {
      const model = l.model ?? "unknown";
      const entry = map.get(model) ?? { count: 0, tokens: 0, errors: 0 };
      entry.count++;
      entry.tokens += l.total_tokens ?? 0;
      if (l.status === "error") entry.errors++;
      map.set(model, entry);
    });
    return Array.from(map.entries()).sort((a, b) => b[1].count - a[1].count);
  }, [aiLogs]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Activity className="h-6 w-6" />Telemetria
        </h1>
        <p className="text-sm text-muted-foreground">Metriche AI, log richieste e analisi costi.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Richieste AI" value={String(stats.total)} icon={<Cpu className="h-4 w-4" />} />
        <StatCard title="Latenza media" value={`${stats.avgLatency}ms`} icon={<Clock className="h-4 w-4" />} />
        <StatCard title="Errori" value={String(stats.errors)} icon={<AlertTriangle className="h-4 w-4" />} />
        <StatCard title="Token totali" value={stats.tokens.toLocaleString()} icon={<Activity className="h-4 w-4" />} />
      </div>

      {/* Model breakdown */}
      {modelBreakdown.length > 0 ? (
        <div className="space-y-3">
          <h3 className="font-semibold text-foreground">Utilizzo per modello</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {modelBreakdown.map(([model, data]) => (
              <div key={model} className="p-3 rounded-lg border bg-card">
                <p className="text-xs font-mono text-foreground truncate">{model}</p>
                <div className="flex items-center gap-4 mt-1.5">
                  <span className="text-xs text-muted-foreground">{data.count} req</span>
                  <span className="text-xs text-muted-foreground">{data.tokens.toLocaleString()} tok</span>
                  {data.errors > 0 ? <span className="text-xs text-destructive">{data.errors} err</span> : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Filter + Log table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground">Log richieste</h3>
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <select
              className="rounded-md border bg-background px-2 py-1 text-xs text-foreground"
              value={modelFilter}
              onChange={(e) => setModelFilter(e.target.value)}
            >
              <option value="all">Tutti i modelli</option>
              {models.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Modello</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Intent</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Agente</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Stato</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Latenza</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Token</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Data</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.slice(0, 50).map((l) => (
                <tr key={l.id} className="border-t">
                  <td className="px-4 py-2 text-foreground font-mono text-xs truncate max-w-[150px]">{l.model ?? "—"}</td>
                  <td className="px-4 py-2 text-foreground text-xs">{l.intent ?? "—"}</td>
                  <td className="px-4 py-2 text-muted-foreground text-xs">{l.agent_code ?? "—"}</td>
                  <td className="px-4 py-2">
                    <StatusBadge
                      status={l.status === "error" ? "error" : "success"}
                      label={l.status ?? "—"}
                    />
                  </td>
                  <td className="px-4 py-2 text-muted-foreground text-xs">{l.latency_ms ?? "—"}ms</td>
                  <td className="px-4 py-2 text-muted-foreground text-xs">{l.total_tokens ?? "—"}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{l.created_at ? new Date(l.created_at).toLocaleString("it") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
