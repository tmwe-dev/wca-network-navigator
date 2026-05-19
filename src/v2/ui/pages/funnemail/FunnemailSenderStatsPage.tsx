/**
 * FunnemailSenderStatsPage — KPI grid + tabella mittenti aggregata.
 * Riusa `listFunnemailBrain` (esistente) per derivare statistiche dal
 * cervello Funnemail. Logica DAL invariata.
 */
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, TrendingUp, Users, Activity, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PageTitleHeader } from "@/v2/ui/templates/PageTitleHeader";
import { FunnemailGlassCard } from "@/v2/ui/atoms/funnemail/FunnemailGlassCard";
import { listFunnemailBrain, type FunnemailBrainRow } from "@/data/funnemailBrain";

const QK = ["funnemail", "sender-stats"] as const;

interface SenderAgg {
  readonly address: string;
  readonly count: number;
  readonly lastSeen: string;
  readonly avgConfidence: number;
}

function aggregate(rows: readonly FunnemailBrainRow[]): {
  senders: readonly SenderAgg[];
  totals: { messages: number; uniqueSenders: number; highConfPct: number; last24h: number };
} {
  const map = new Map<string, { count: number; confSum: number; confN: number; last: number }>();
  const oneDay = Date.now() - 24 * 3600_000;
  let last24h = 0;
  let highConf = 0;

  for (const r of rows) {
    const addr = (r.from_address ?? "(sconosciuto)").toLowerCase();
    const ts = new Date(r.received_at).getTime();
    if (ts >= oneDay) last24h += 1;
    const conf = r.decision_confidence ?? 0;
    if (conf >= 0.7) highConf += 1;
    const cur = map.get(addr) ?? { count: 0, confSum: 0, confN: 0, last: 0 };
    cur.count += 1;
    cur.confSum += conf;
    cur.confN += conf > 0 ? 1 : 0;
    if (ts > cur.last) cur.last = ts;
    map.set(addr, cur);
  }

  const senders: SenderAgg[] = Array.from(map.entries())
    .map(([address, v]) => ({
      address,
      count: v.count,
      lastSeen: new Date(v.last).toISOString(),
      avgConfidence: v.confN ? v.confSum / v.confN : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 50);

  return {
    senders,
    totals: {
      messages: rows.length,
      uniqueSenders: map.size,
      highConfPct: rows.length ? Math.round((highConf / rows.length) * 100) : 0,
      last24h,
    },
  };
}

export default function FunnemailSenderStatsPage(): React.ReactElement {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: QK,
    queryFn: () => listFunnemailBrain(500),
    staleTime: 60_000,
  });

  const { senders, totals } = React.useMemo(() => aggregate(rows), [rows]);

  React.useEffect(() => {
    const prev = document.title;
    document.title = "Funnemail · Statistiche mittenti";
    return () => { document.title = prev; };
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <PageTitleHeader
        icon={BarChart3}
        title="Statistiche mittenti"
        subtitle="Aggregato dal cervello Funnemail (ultime 500 decisioni)"
        right={
          <Button asChild variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
            <Link to="/v2/funnemail"><ArrowLeft className="h-3.5 w-3.5" />Hub</Link>
          </Button>
        }
      />

      <div className="flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi icon={Activity} label="Decisioni totali" value={totals.messages.toLocaleString("it-IT")} />
            <Kpi icon={Users} label="Mittenti unici" value={totals.uniqueSenders.toLocaleString("it-IT")} />
            <Kpi icon={TrendingUp} label="Confidenza ≥70%" value={`${totals.highConfPct}%`} accent="text-success" />
            <Kpi icon={Activity} label="Ultime 24h" value={totals.last24h.toLocaleString("it-IT")} accent="text-warning" />
          </div>

          <FunnemailGlassCard className="p-0 overflow-hidden">
            <header className="flex items-center justify-between border-b border-border/60 px-5 py-3">
              <h2 className="text-sm font-semibold text-foreground">Top 50 mittenti per volume</h2>
              <span className="text-xs text-muted-foreground">{isLoading ? "Caricamento…" : `${senders.length} righe`}</span>
            </header>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-5 py-2 text-left font-medium">Mittente</th>
                    <th className="px-5 py-2 text-right font-medium">Messaggi</th>
                    <th className="px-5 py-2 text-right font-medium">Confidenza media</th>
                    <th className="px-5 py-2 text-right font-medium">Ultimo</th>
                  </tr>
                </thead>
                <tbody>
                  {senders.length === 0 && !isLoading && (
                    <tr>
                      <td colSpan={4} className="px-5 py-8 text-center text-sm text-muted-foreground">
                        Nessun dato ancora. Appena Funnemail classifica messaggi, qui compariranno i mittenti.
                      </td>
                    </tr>
                  )}
                  {senders.map((s) => (
                    <tr key={s.address} className="border-t border-border/40 hover:bg-muted/30">
                      <td className="px-5 py-2 font-medium text-foreground">{s.address}</td>
                      <td className="px-5 py-2 text-right tabular-nums">{s.count}</td>
                      <td className="px-5 py-2 text-right tabular-nums">
                        {s.avgConfidence > 0 ? `${Math.round(s.avgConfidence * 100)}%` : "—"}
                      </td>
                      <td className="px-5 py-2 text-right text-xs text-muted-foreground">
                        {new Date(s.lastSeen).toLocaleString("it-IT")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </FunnemailGlassCard>
        </div>
      </div>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent?: string;
}): React.ReactElement {
  return (
    <FunnemailGlassCard className="p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums text-foreground ${accent ?? ""}`}>{value}</div>
    </FunnemailGlassCard>
  );
}

export { FunnemailSenderStatsPage };