/**
 * DiagnosticsPage — Full system health dashboard with checks, table counts, edge function status
 */
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDiagnosticsV2 } from "@/v2/hooks/useDiagnosticsV2";
import { Button } from "../atoms/Button";
import { StatusBadge } from "../atoms/StatusBadge";
import { StatCard } from "../molecules/StatCard";
import { Database, ShieldCheck, Server, Globe, HardDrive, Layers, Clock } from "lucide-react";

const TABLE_NAMES = [
  "partners", "imported_contacts", "activities", "agents", "agent_tasks",
  "download_jobs", "channel_messages", "email_drafts", "email_campaign_queue",
  "cockpit_queue", "ai_memory", "ai_conversations", "ai_request_log",
  "commercial_playbooks", "commercial_workflows", "directory_cache",
  "business_cards", "blacklist_entries",
] as const;

const ICONS: Record<string, React.ReactNode> = {
  Database: <Database className="h-4 w-4" />,
  Autenticazione: <ShieldCheck className="h-4 w-4" />,
  "Edge Functions": <Server className="h-4 w-4" />,
  "WCA API": <Globe className="h-4 w-4" />,
  Storage: <HardDrive className="h-4 w-4" />,
};

export function DiagnosticsPage(): React.ReactElement {
  const { checks, running, run } = useDiagnosticsV2();

  const { data: tableCounts, isLoading: countsLoading } = useQuery({
    queryKey: ["v2-diag-table-counts"],
    queryFn: async () => {
      const results: { name: string; count: number }[] = [];
      for (const table of TABLE_NAMES) {
        const { count, error } = await supabase
          .from(table)
          .select("*", { count: "exact", head: true });
        results.push({ name: table, count: error ? -1 : (count ?? 0) });
      }
      return results;
    },
    staleTime: 120_000,
  });

  const totalRows = tableCounts?.reduce((s, t) => s + Math.max(0, t.count), 0) ?? 0;
  const healthyChecks = checks.filter((c) => c.status === "ok").length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Diagnostica di sistema</h1>
          <p className="text-sm text-muted-foreground">Verifica connessioni, tabelle e servizi.</p>
        </div>
        <Button onClick={run} isLoading={running}>
          {running ? "Verificando..." : "Esegui diagnostica"}
        </Button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Servizi OK" value={checks.length > 0 ? `${healthyChecks}/${checks.length}` : "—"} icon={<ShieldCheck className="h-4 w-4" />} />
        <StatCard title="Tabelle" value={String(TABLE_NAMES.length)} icon={<Layers className="h-4 w-4" />} />
        <StatCard title="Righe totali" value={countsLoading ? "..." : totalRows.toLocaleString("it-IT")} icon={<Database className="h-4 w-4" />} />
        <StatCard title="Ultimo check" value={checks.length > 0 ? new Date().toLocaleTimeString("it") : "—"} icon={<Clock className="h-4 w-4" />} />
      </div>

      {/* Health checks */}
      {checks.length === 0 && !running ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Premi "Esegui diagnostica" per verificare lo stato di tutti i servizi.
        </p>
      ) : (
        <div className="space-y-3">
          <h3 className="font-semibold text-foreground">Controlli di sistema</h3>
          {checks.map((check) => (
            <div key={check.name} className="flex items-center justify-between p-4 rounded-lg border bg-card">
              <div className="flex items-center gap-3">
                {ICONS[check.name] ?? <Server className="h-4 w-4" />}
                <span className="font-medium text-foreground">{check.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground font-mono">{check.latencyMs}ms</span>
                <span className="text-sm text-muted-foreground max-w-[200px] truncate">{check.message}</span>
                <StatusBadge
                  status={check.status === "ok" ? "success" : check.status === "error" ? "error" : "warning"}
                  label={check.status === "ok" ? "OK" : check.status === "error" ? "Errore" : "..."}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Table counts */}
      <div className="space-y-3">
        <h3 className="font-semibold text-foreground">Conteggio tabelle</h3>
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Tabella</th>
                <th className="text-right px-4 py-2 font-medium text-muted-foreground">Righe</th>
              </tr>
            </thead>
            <tbody>
              {tableCounts?.map((t) => (
                <tr key={t.name} className="border-t">
                  <td className="px-4 py-2 text-foreground font-mono text-xs">{t.name}</td>
                  <td className="px-4 py-2 text-right text-foreground">
                    {t.count < 0 ? <span className="text-destructive text-xs">errore</span> : t.count.toLocaleString("it-IT")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
