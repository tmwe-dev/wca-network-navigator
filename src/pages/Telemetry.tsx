/**
 * Telemetry — operator-facing observability page.
 *
 * Shows page_events, request_logs, ai_request_log so Luca can see
 * exactly what users (and agents) do in the platform: pages visited,
 * actions taken, edge function calls, AI request volume and cost.
 *
 * Backend: see migration 20260408095954_wave6_hardening_telemetry_staff.sql
 */
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTrackPage } from "@/hooks/useTrackPage";
import { useUrlState } from "@/hooks/useUrlState";

type TabKey = "events" | "requests" | "ai";

interface PageEventRow {
  id: string;
  user_id: string | null;
  session_id: string | null;
  event_name: string;
  page: string;
  entity_type: string | null;
  entity_id: string | null;
  props: Record<string, unknown> | null;
  duration_ms: number | null;
  created_at: string;
}

interface RequestLogRow {
  id: string;
  trace_id: string | null;
  user_id: string | null;
  function_name: string;
  channel: string;
  http_status: number | null;
  status: string;
  latency_ms: number | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
}

interface AIRequestLogRow {
  id: string;
  trace_id: string | null;
  user_id: string | null;
  agent_code: string | null;
  channel: string;
  model: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  cost_usd: number | null;
  latency_ms: number | null;
  status: string;
  intent: string | null;
  created_at: string;
}

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "events", label: "Eventi pagina", icon: "📊" },
  { key: "requests", label: "Chiamate edge", icon: "⚡" },
  { key: "ai", label: "Richieste AI", icon: "🤖" },
];

const RANGES: { key: string; label: string; hours: number }[] = [
  { key: "1h", label: "Ultima ora", hours: 1 },
  { key: "24h", label: "Ultime 24h", hours: 24 },
  { key: "7d", label: "Ultimi 7 giorni", hours: 24 * 7 },
  { key: "30d", label: "Ultimi 30 giorni", hours: 24 * 30 },
];

export default function Telemetry() {
  useTrackPage("telemetry");
  const [tab, setTab] = useUrlState<TabKey>("tab", "events");
  const [range, setRange] = useUrlState<string>("range", "24h");

  const sinceIso = useMemo(() => {
    const hours = RANGES.find((r) => r.key === range)?.hours ?? 24;
    return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  }, [range]);

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Telemetria
            </h1>
            <p className="text-xs text-slate-500">
              Cosa sta succedendo nel sistema in tempo reale
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={range}
              onChange={(e) => setRange(e.target.value)}
              className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
            >
              {RANGES.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="inline-flex p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-medium">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-md transition ${
                tab === t.key
                  ? "bg-white dark:bg-slate-900 text-indigo-600 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
              }`}
            >
              <span className="mr-1">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {tab === "events" && <PageEventsView sinceIso={sinceIso} />}
        {tab === "requests" && <RequestLogsView sinceIso={sinceIso} />}
        {tab === "ai" && <AIRequestLogsView sinceIso={sinceIso} />}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// PAGE EVENTS
// ──────────────────────────────────────────────────────────────────────

function PageEventsView({ sinceIso }: { sinceIso: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["telemetry-page-events", sinceIso],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("page_events" as any)
        .select("*")
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as PageEventRow[];
    },
    refetchInterval: 30_000,
  });

  if (error) return <ErrorBox message={(error as Error).message} />;
  if (isLoading) return <SkeletonRows />;
  if (!data?.length) return <EmptyTelemetry label="Nessun evento nel periodo selezionato" />;

  // KPI
  const total = data.length;
  const uniquePages = new Set(data.map((d) => d.page)).size;
  const uniqueSessions = new Set(data.map((d) => d.session_id).filter(Boolean)).size;
  const topPages = aggregateBy(data, "page").slice(0, 5);

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <KpiCard label="Eventi totali" value={total.toLocaleString("it-IT")} />
        <KpiCard label="Pagine distinte" value={String(uniquePages)} />
        <KpiCard label="Sessioni" value={String(uniqueSessions)} />
      </div>

      <Card title="Top pagine">
        <ul className="text-sm divide-y divide-slate-100 dark:divide-slate-800">
          {topPages.map((p) => (
            <li key={p.key} className="flex items-center justify-between py-2">
              <span className="font-mono text-xs text-slate-600 dark:text-slate-300">
                {p.key}
              </span>
              <span className="text-xs text-slate-500">{p.count}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card title={`Eventi recenti (${data.length})`}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-left text-[10px] uppercase text-slate-400">
              <tr>
                <th className="py-2">Quando</th>
                <th>Evento</th>
                <th>Pagina</th>
                <th>Entità</th>
                <th>Durata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.slice(0, 100).map((e) => (
                <tr key={e.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="py-1.5 text-slate-500 whitespace-nowrap">{fmtTime(e.created_at)}</td>
                  <td className="font-medium">{e.event_name}</td>
                  <td className="font-mono text-slate-600 dark:text-slate-400">{e.page}</td>
                  <td className="text-slate-500">
                    {e.entity_type ? `${e.entity_type}:${e.entity_id?.slice(0, 8)}` : "—"}
                  </td>
                  <td className="text-slate-500">{e.duration_ms ? `${e.duration_ms}ms` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// REQUEST LOGS
// ──────────────────────────────────────────────────────────────────────

function RequestLogsView({ sinceIso }: { sinceIso: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["telemetry-request-logs", sinceIso],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("request_logs" as any)
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
        <ul className="text-sm divide-y divide-slate-100 dark:divide-slate-800">
          {topFns.map((p) => (
            <li key={p.key} className="flex items-center justify-between py-2">
              <span className="font-mono text-xs">{p.key}</span>
              <span className="text-xs text-slate-500">{p.count}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card title={`Chiamate recenti (${data.length})`}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-left text-[10px] uppercase text-slate-400">
              <tr>
                <th className="py-2">Quando</th>
                <th>Funzione</th>
                <th>Status</th>
                <th>Latenza</th>
                <th>Trace</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.slice(0, 100).map((r) => (
                <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="py-1.5 text-slate-500 whitespace-nowrap">{fmtTime(r.created_at)}</td>
                  <td className="font-mono">{r.function_name}</td>
                  <td>
                    <StatusPill status={r.status} />
                  </td>
                  <td className="text-slate-500">{r.latency_ms ? `${r.latency_ms}ms` : "—"}</td>
                  <td className="font-mono text-[10px] text-slate-400">
                    {r.trace_id?.slice(0, 8) ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// AI REQUEST LOGS
// ──────────────────────────────────────────────────────────────────────

function AIRequestLogsView({ sinceIso }: { sinceIso: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["telemetry-ai-requests", sinceIso],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_request_log" as any)
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
  if (!data?.length)
    return <EmptyTelemetry label="Nessuna richiesta AI nel periodo selezionato" />;

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
        <ul className="text-sm divide-y divide-slate-100 dark:divide-slate-800">
          {byAgent.map((p) => (
            <li key={p.key} className="flex items-center justify-between py-2">
              <span className="font-medium">{p.key || "—"}</span>
              <span className="text-xs text-slate-500">{p.count} richieste</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card title={`Richieste recenti (${data.length})`}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-left text-[10px] uppercase text-slate-400">
              <tr>
                <th className="py-2">Quando</th>
                <th>Agente</th>
                <th>Modello</th>
                <th>Token</th>
                <th>Latenza</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.slice(0, 100).map((a) => (
                <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="py-1.5 text-slate-500 whitespace-nowrap">{fmtTime(a.created_at)}</td>
                  <td className="font-medium">{a.agent_code ?? "—"}</td>
                  <td className="font-mono text-slate-500">{a.model ?? "—"}</td>
                  <td className="text-slate-500">{a.total_tokens ?? "—"}</td>
                  <td className="text-slate-500">{a.latency_ms ? `${a.latency_ms}ms` : "—"}</td>
                  <td>
                    <StatusPill status={a.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// SHARED UI BITS
// ──────────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "ok" | "warn";
}) {
  const toneCls =
    tone === "warn"
      ? "text-amber-600 dark:text-amber-400"
      : tone === "ok"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-slate-900 dark:text-slate-100";
  return (
    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <div className="text-[11px] uppercase font-semibold text-slate-400">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${toneCls}`}>{value}</div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800 text-[11px] uppercase font-semibold text-slate-400">
        {title}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    ok: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    error: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
    timeout: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    rate_limited: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
    blocked: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400",
  };
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded ${map[status] ?? "bg-slate-100 text-slate-700"}`}>
      {status}
    </span>
  );
}

function SkeletonRows() {
  return (
    <div className="space-y-2 max-w-6xl">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="h-10 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse"
        />
      ))}
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="max-w-3xl p-4 rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-900/20 text-sm text-rose-700 dark:text-rose-300">
      <div className="font-semibold mb-1">Errore caricamento telemetria</div>
      <div className="text-xs font-mono">{message}</div>
      <div className="text-[11px] text-rose-600 mt-2">
        Verifica che la migration Wave 6 sia stata applicata e che le RLS permettano la lettura.
      </div>
    </div>
  );
}

function EmptyTelemetry({ label }: { label: string }) {
  return (
    <div className="max-w-md mx-auto text-center py-16">
      <div className="text-5xl mb-3">📡</div>
      <div className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</div>
      <div className="text-xs text-slate-500 mt-1">
        Le metriche compariranno appena l'app viene utilizzata.
      </div>
    </div>
  );
}

function aggregateBy<T extends Record<string, any>>(
  rows: T[],
  key: keyof T
): { key: string; count: number }[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const k = String(r[key] ?? "—");
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "ora";
  if (diffMin < 60) return `${diffMin}m fa`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h fa`;
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
