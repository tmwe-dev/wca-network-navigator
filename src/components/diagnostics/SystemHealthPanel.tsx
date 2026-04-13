/**
 * SystemHealthPanel — Live health dashboard for the Diagnostics page.
 * Calls health-check edge function + queries existing tables for metrics.
 * Auto-refreshes every 30s.
 */
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Activity, Database, Brain, Mail, RefreshCw } from "lucide-react";

interface HealthData {
  status: string;
  checks: Record<string, string>;
  timestamp: string;
}

interface Metrics {
  health: HealthData | null;
  recentErrors: number;
  avgAiLatency: number | null;
  emailsToday: number;
  loading: boolean;
  lastRefresh: string | null;
}

export function SystemHealthPanel() {
  const [metrics, setMetrics] = useState<Metrics>({
    health: null, recentErrors: 0, avgAiLatency: null, emailsToday: 0,
    loading: false, lastRefresh: null,
  });

  const refresh = useCallback(async () => {
    setMetrics(prev => ({ ...prev, loading: true }));

    const results: Partial<Metrics> = {};

    // 1. Health check
    try {
      const { data, error } = await supabase.functions.invoke("health-check");
      if (!error && data) results.health = data as HealthData;
    } catch { /* best-effort */ }

    // 2. Recent errors (last 24h from supervisor_audit_log)
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from("supervisor_audit_log")
        .select("id", { count: "exact", head: true })
        .eq("action_category", "error")
        .gte("created_at", since);
      results.recentErrors = count ?? 0;
    } catch { /* best-effort */ }

    // 3. Avg AI latency (last 10 calls)
    try {
      const { data } = await supabase
        .from("ai_decision_log")
        .select("execution_time_ms")
        .not("execution_time_ms", "is", null)
        .order("created_at", { ascending: false })
        .limit(10);
      if (data && data.length > 0) {
        const sum = data.reduce((a, r) => a + (r.execution_time_ms ?? 0), 0);
        results.avgAiLatency = Math.round(sum / data.length);
      }
    } catch { /* best-effort */ }

    // 4. Emails classified today
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { count } = await supabase
        .from("email_classifications")
        .select("id", { count: "exact", head: true })
        .gte("classified_at", today.toISOString());
      results.emailsToday = count ?? 0;
    } catch { /* best-effort */ }

    setMetrics(prev => ({
      ...prev, ...results, loading: false,
      lastRefresh: new Date().toLocaleTimeString("it-IT"),
    }));
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  const statusColor = (v: string) =>
    v === "ok" || v === "healthy" ? "text-emerald-400" : "text-red-400";

  const dot = (ok: boolean) => (
    <span className={`inline-block w-2 h-2 rounded-full ${ok ? "bg-emerald-400" : "bg-red-400"}`} />
  );

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          System Health
        </h3>
        <button
          onClick={refresh}
          disabled={metrics.loading}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          <RefreshCw className={`w-3 h-3 ${metrics.loading ? "animate-spin" : ""}`} />
          {metrics.lastRefresh || "..."}
        </button>
      </div>

      {/* Health checks */}
      {metrics.health && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(metrics.health.checks).map(([name, status]) => (
            <div key={name} className="flex items-center gap-2 text-xs">
              {dot(status === "ok")}
              <span className="text-muted-foreground capitalize">{name.replace("_", " ")}</span>
              <span className={statusColor(status)}>{status}</span>
            </div>
          ))}
        </div>
      )}

      {/* Metrics cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard
          icon={<Database className="w-4 h-4" />}
          label="Overall"
          value={metrics.health?.status || "—"}
          ok={metrics.health?.status === "healthy"}
        />
        <MetricCard
          icon={<Activity className="w-4 h-4" />}
          label="Errori 24h"
          value={String(metrics.recentErrors)}
          ok={metrics.recentErrors === 0}
        />
        <MetricCard
          icon={<Brain className="w-4 h-4" />}
          label="Latenza AI"
          value={metrics.avgAiLatency !== null ? `${metrics.avgAiLatency}ms` : "—"}
          ok={metrics.avgAiLatency !== null && metrics.avgAiLatency < 5000}
        />
        <MetricCard
          icon={<Mail className="w-4 h-4" />}
          label="Email oggi"
          value={String(metrics.emailsToday)}
          ok
        />
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, ok }: {
  icon: React.ReactNode; label: string; value: string; ok: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1">
      <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
        {icon} {label}
      </div>
      <div className={`text-sm font-mono font-semibold ${ok ? "text-foreground" : "text-red-400"}`}>
        {value}
      </div>
    </div>
  );
}
