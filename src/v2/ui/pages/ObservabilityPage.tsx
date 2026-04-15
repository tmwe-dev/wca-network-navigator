/**
 * ObservabilityPage — /v2/observability
 * Token spend, avg steps per mission, top tools, errors.
 */
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { untypedFrom } from "@/lib/supabaseUntyped";
import { useAuth } from "@/providers/AuthProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, BarChart3, Activity, Zap, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

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
      // data is the CSV text
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
          <p className="text-sm text-muted-foreground">Monitoraggio consumo AI, tool e missioni</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExportCsv}>
          <Download className="w-4 h-4 mr-2" />
          Esporta Audit CSV
        </Button>
      </div>

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
    </div>
  );
}

export default ObservabilityPage;
