/**
 * AiMonitorPanel — Dashboard costi AI (Tab Settings).
 * Mostra: budget mese, costi oggi/settimana/mese, storico 30gg,
 * top funzioni, distribuzione dimensioni prompt, cron vs user.
 */
import { useEffect, useState } from "react";
import { Loader2, AlertTriangle, TrendingUp, Zap } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, BarChart, Bar, CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { createLogger } from "@/lib/log";

const log = createLogger("AiMonitorPanel");

interface PeriodTotal {
  cost_usd: number;
  tokens_in: number;
  tokens_out: number;
  call_count: number;
}
interface GroupRow { group_category: string; cost_usd: number; call_count: number }
interface DailyRow { day: string; cost_usd: number; call_count: number; tokens_total: number }
interface TopFn { function_name: string; call_count: number; cost_usd: number; tokens_total: number; avg_latency_ms: number }
interface SizeRow { size_bucket: string; call_count: number; avg_chars: number }
interface CronRow { source: string; cost_usd: number; call_count: number }
interface BudgetInfo {
  monthlyBudgetUsd: number; alertThresholdPercent: number;
  monthSpentUsd: number; budgetPercentage: number;
  subscriptionStart: string | null; subscriptionEnd: string | null;
}
interface MonitorData {
  todayTotal: PeriodTotal | null;
  monthTotal: PeriodTotal | null;
  weekTotal: PeriodTotal | null;
  todayByGroup: GroupRow[];
  dailyHistory: DailyRow[];
  topFunctions: TopFn[];
  sizeDistribution: SizeRow[];
  cronVsUser: CronRow[];
  budget: BudgetInfo;
}

function fmtUsd(v: number | null | undefined): string {
  const n = Number(v ?? 0);
  if (n < 0.01) return "$" + n.toFixed(4);
  if (n < 1) return "$" + n.toFixed(3);
  return "$" + n.toFixed(2);
}
function fmtNum(v: number | null | undefined): string {
  const n = Number(v ?? 0);
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

export function AiMonitorPanel() {
  const [data, setData] = useState<MonitorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await invokeEdge<MonitorData>("ai-monitor", { context: "AiMonitorPanel" });
        if (!cancelled) setData(res);
      } catch (e) {
        log.warn("load failed", { err: e instanceof Error ? e.message : String(e) });
        if (!cancelled) setError(e instanceof Error ? e.message : "Errore caricamento dashboard");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        {error ?? "Dati non disponibili"}
      </div>
    );
  }

  const budget = data.budget;
  const overBudget = budget.budgetPercentage >= 100;
  const nearAlert = budget.budgetPercentage >= budget.alertThresholdPercent;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">AI Monitor</h2>
        <p className="text-sm text-muted-foreground">Costi e consumi delle chiamate AI.</p>
      </div>

      {/* Budget mese */}
      <Card className={overBudget ? "border-destructive" : nearAlert ? "border-warning" : ""}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            {overBudget && <AlertTriangle className="w-4 h-4 text-destructive" />}
            Budget mese
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-bold">{fmtUsd(budget.monthSpentUsd)}</span>
            <span className="text-sm text-muted-foreground">di {fmtUsd(budget.monthlyBudgetUsd)}</span>
          </div>
          <Progress value={Math.min(budget.budgetPercentage, 100)} />
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{budget.budgetPercentage.toFixed(1)}% utilizzato</span>
            {nearAlert && !overBudget && (
              <Badge variant="outline" className="border-warning text-warning">
                Soglia alert {budget.alertThresholdPercent}% superata
              </Badge>
            )}
            {overBudget && <Badge variant="destructive">Budget superato</Badge>}
          </div>
        </CardContent>
      </Card>

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          { label: "Oggi", t: data.todayTotal },
          { label: "Ultimi 7 giorni", t: data.weekTotal },
          { label: "Mese corrente", t: data.monthTotal },
        ].map((k) => (
          <Card key={k.label}>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{k.label}</CardTitle></CardHeader>
            <CardContent className="space-y-1">
              <div className="text-2xl font-bold">{fmtUsd(k.t?.cost_usd)}</div>
              <div className="text-xs text-muted-foreground">
                {fmtNum(k.t?.call_count)} chiamate · {fmtNum((k.t?.tokens_in ?? 0) + (k.t?.tokens_out ?? 0))} token
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Storico 30 giorni */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> Costo giornaliero (30 gg)
          </CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          {data.dailyHistory.length === 0 ? (
            <div className="text-sm text-muted-foreground">Nessun dato.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.dailyHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11}
                  tickFormatter={(v) => String(v).slice(5)} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11}
                  tickFormatter={(v) => "$" + Number(v).toFixed(2)} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                  formatter={(v: number) => fmtUsd(v)}
                />
                <Line type="monotone" dataKey="cost_usd" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Cron vs User + Today by group */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="w-4 h-4" /> Cron vs User (oggi)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.cronVsUser.length === 0 ? (
              <div className="text-sm text-muted-foreground">Nessuna chiamata oggi.</div>
            ) : (
              <ul className="space-y-2">
                {data.cronVsUser.map((r) => (
                  <li key={r.source} className="flex items-center justify-between text-sm">
                    <span className="capitalize">{r.source}</span>
                    <span className="font-mono">{fmtUsd(r.cost_usd)} · {fmtNum(r.call_count)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Oggi per categoria</CardTitle></CardHeader>
          <CardContent>
            {data.todayByGroup.length === 0 ? (
              <div className="text-sm text-muted-foreground">Nessuna chiamata oggi.</div>
            ) : (
              <ul className="space-y-2">
                {data.todayByGroup.map((r) => (
                  <li key={r.group_category} className="flex items-center justify-between text-sm">
                    <span>{r.group_category}</span>
                    <span className="font-mono">{fmtUsd(r.cost_usd)} · {fmtNum(r.call_count)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top functions */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Top funzioni (7 gg)</CardTitle></CardHeader>
        <CardContent>
          {data.topFunctions.length === 0 ? (
            <div className="text-sm text-muted-foreground">Nessun dato.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-muted-foreground border-b">
                    <th className="py-2">Funzione</th>
                    <th className="py-2 text-right">Calls</th>
                    <th className="py-2 text-right">Token</th>
                    <th className="py-2 text-right">Costo</th>
                    <th className="py-2 text-right">Lat. media</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topFunctions.map((f) => (
                    <tr key={f.function_name} className="border-b border-border/50">
                      <td className="py-2 font-mono text-xs">{f.function_name}</td>
                      <td className="py-2 text-right">{fmtNum(f.call_count)}</td>
                      <td className="py-2 text-right">{fmtNum(f.tokens_total)}</td>
                      <td className="py-2 text-right font-medium">{fmtUsd(f.cost_usd)}</td>
                      <td className="py-2 text-right text-muted-foreground">{Math.round(f.avg_latency_ms ?? 0)}ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Size distribution */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Distribuzione dimensione prompt (7 gg)</CardTitle></CardHeader>
        <CardContent className="h-48">
          {data.sizeDistribution.length === 0 ? (
            <div className="text-sm text-muted-foreground">Nessun dato.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.sizeDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="size_bucket" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                />
                <Bar dataKey="call_count" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default AiMonitorPanel;