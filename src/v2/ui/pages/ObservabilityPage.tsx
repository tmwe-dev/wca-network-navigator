/**
 * ObservabilityPage — /v2/observability
 * Token spend, avg steps per mission, top tools, errors, cron jobs.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { untypedFrom } from "@/lib/supabaseUntyped";
import { useAuth } from "@/providers/AuthProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, BarChart3, Activity, Zap, AlertTriangle, Clock, RefreshCw, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";


import { createLogger } from "@/lib/log";
const log = createLogger("ObservabilityPage");
// ── Types ──────────────────────────────────────────────────

interface UsageSummary {
  totalAiTokens: number;
  totalTtsChars: number;
  aiTokenCap: number;
  ttsCharCap: number;
  daysTracked: number;
}

interface ToolStats {
  name: string;
  count: number;
}

interface MissionStats {
  totalMissions: number;
  avgSteps: number;
  totalErrors: number;
}

interface CronJobInfo {
  jobid: number;
  jobname: string;
  schedule: string;
  active: boolean;
  last_run: string | null;
  last_status: string | null;
  last_return_message: string | null;
}

// ── Hooks ──────────────────────────────────────────────────

function useUsageSummary(userId: string | undefined) {
  return useQuery({
    queryKey: ["observability", "usage", userId],
    queryFn: async (): Promise<UsageSummary> => {
      if (!userId) return { totalAiTokens: 0, totalTtsChars: 0, aiTokenCap: 500000, ttsCharCap: 50000, daysTracked: 0 };
      const { data } = await untypedFrom("usage_daily_budget")
        .select("ai_tokens_used, tts_chars_used, ai_token_cap, tts_char_cap")
        .eq("user_id", userId)
        .order("usage_date", { ascending: false })
        .limit(30);
      const rows = (data ?? []) as Array<Record<string, number>>;
      return {
        totalAiTokens: rows.reduce((s, r) => s + (r.ai_tokens_used ?? 0), 0),
        totalTtsChars: rows.reduce((s, r) => s + (r.tts_chars_used ?? 0), 0),
        aiTokenCap: rows[0]?.ai_token_cap ?? 500000,
        ttsCharCap: rows[0]?.tts_char_cap ?? 50000,
        daysTracked: rows.length,
      };
    },
    enabled: !!userId,
    staleTime: 60_000,
  });
}

function useToolStats(userId: string | undefined) {
  return useQuery({
    queryKey: ["observability", "tools", userId],
    queryFn: async (): Promise<ToolStats[]> => {
      if (!userId) return [];
      const { data } = await untypedFrom("agent_action_log")
        .select("tool_name")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1000);
      const rows = (data ?? []) as Array<{ tool_name: string }>;
      const counts = new Map<string, number>();
      for (const r of rows) {
        counts.set(r.tool_name, (counts.get(r.tool_name) ?? 0) + 1);
      }
      return Array.from(counts.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 15);
    },
    enabled: !!userId,
    staleTime: 60_000,
  });
}

function useMissionStats(userId: string | undefined) {
  return useQuery({
    queryKey: ["observability", "missions", userId],
    queryFn: async (): Promise<MissionStats> => {
      if (!userId) return { totalMissions: 0, avgSteps: 0, totalErrors: 0 };
      const { data } = await untypedFrom("agent_action_log")
        .select("conversation_id, result")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1000);
      const rows = (data ?? []) as Array<{ conversation_id: string | null; result: Record<string, unknown> }>;
      const missions = new Set(rows.map((r) => r.conversation_id).filter(Boolean));
      const errors = rows.filter((r) => {
        const res = r.result;
        return res && typeof res === "object" && "success" in res && !(res as Record<string, unknown>).success;
      });
      return {
        totalMissions: missions.size,
        avgSteps: missions.size > 0 ? Math.round(rows.length / missions.size) : 0,
        totalErrors: errors.length,
      };
    },
    enabled: !!userId,
    staleTime: 60_000,
  });
}

function useCronJobs() {
  return useQuery({
    queryKey: ["observability", "cron-jobs"],
    queryFn: async (): Promise<CronJobInfo[]> => {
      const { data, error } = await supabase.rpc("cron_job_status" as never);
      if (error) {
        log.warn("cron_job_status RPC not available:", { error: error.message });
        return [];
      }
      return (data as unknown as CronJobInfo[]) ?? [];
    },
    staleTime: 30_000,
    retry: 1,
  });
}

// ── Cron Tab Component ─────────────────────────────────────

function CronTab() {
  const { data: jobs, isLoading, refetch, isRefetching } = useCronJobs();

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    const date = new Date(d);
    return date.toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!jobs || jobs.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Clock className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            Nessun job cron configurato. La funzione RPC <code>cron_job_status</code> potrebbe non essere ancora disponibile.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{jobs.length} job configurati</p>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
          <RefreshCw className={cn("w-4 h-4 mr-2", isRefetching && "animate-spin")} />
          Aggiorna
        </Button>
      </div>

      <div className="grid gap-3">
        {jobs.map((job) => (
          <Card key={job.jobid} className="border-border/50">
            <CardContent className="py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-medium truncate">{job.jobname}</span>
                    <Badge variant={job.active ? "default" : "secondary"} className="text-[10px] shrink-0">
                      {job.active ? "Attivo" : "Disattivo"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">{job.schedule}</p>
                </div>

                <div className="text-right shrink-0 space-y-1">
                  {job.last_status && (
                    <div className="flex items-center gap-1.5 justify-end">
                      {job.last_status === "succeeded" ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-destructive" />
                      )}
                      <span className={cn(
                        "text-xs font-medium",
                        job.last_status === "succeeded" ? "text-emerald-500" : "text-destructive"
                      )}>
                        {job.last_status}
                      </span>
                    </div>
                  )}
                  <p className="text-[10px] text-muted-foreground">
                    {job.last_run ? formatDate(job.last_run) : "Mai eseguito"}
                  </p>
                </div>
              </div>

              {job.last_return_message && job.last_status !== "succeeded" && (
                <p className="mt-2 text-xs text-destructive/80 font-mono bg-destructive/5 rounded px-2 py-1 truncate">
                  {job.last_return_message}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────

export function ObservabilityPage() {
  const { user } = useAuth();
  const userId = user?.id;
  const { data: usage } = useUsageSummary(userId);
  const { data: tools } = useToolStats(userId);
  const { data: missions } = useMissionStats(userId);

  const handleExportCsv = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("export-audit-csv", {});
      if (error) throw error;
      const blob = new Blob([data as string], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit_log_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Audit log esportato");
    } catch (e) {
      toast.error(`Errore export: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Observability</h1>
          <p className="text-sm text-muted-foreground">Monitoraggio consumo AI, tool, missioni e cron</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExportCsv}>
          <Download className="w-4 h-4 mr-2" />
          Esporta Audit CSV
        </Button>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="cron" className="gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            Cron
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Usage cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Zap className="w-4 h-4" /> Token AI (30gg)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{(usage?.totalAiTokens ?? 0).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Cap giornaliero: {(usage?.aiTokenCap ?? 500000).toLocaleString()}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Activity className="w-4 h-4" /> Caratteri TTS (30gg)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{(usage?.totalTtsChars ?? 0).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Cap giornaliero: {(usage?.ttsCharCap ?? 50000).toLocaleString()}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" /> Missioni
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{missions?.totalMissions ?? 0}</p>
                <p className="text-xs text-muted-foreground">Media step: {missions?.avgSteps ?? 0}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> Errori
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-destructive">{missions?.totalErrors ?? 0}</p>
                <p className="text-xs text-muted-foreground">Ultimi 30 giorni</p>
              </CardContent>
            </Card>
          </div>

          {/* Top tools */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Tool più utilizzati</CardTitle>
            </CardHeader>
            <CardContent>
              {tools && tools.length > 0 ? (
                <div className="space-y-2">
                  {tools.map((t) => (
                    <div key={t.name} className="flex items-center gap-3">
                      <span className="text-sm font-mono text-muted-foreground w-40 truncate">{t.name}</span>
                      <div className="flex-1 bg-muted rounded-full h-2">
                        <div
                          className="bg-primary rounded-full h-2 transition-all"
                          style={{ width: `${Math.min(100, (t.count / (tools[0]?.count || 1)) * 100)}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium w-12 text-right">{t.count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nessun dato disponibile</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cron">
          <CronTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default ObservabilityPage;
