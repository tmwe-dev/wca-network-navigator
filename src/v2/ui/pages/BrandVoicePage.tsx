/**
 * BrandVoicePage V2 — Read-only KPI dashboard for editorial brand voice.
 * Shows score distribution per channel × journalist role and top recurring deviations.
 * Admin-only. No write actions: editing happens in KB Supervisor / Prompt Lab.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTrackPage } from "@/hooks/useTrackPage";
import { useRequireRole } from "@/v2/hooks/useRequireRole";
import { PageShell } from "@/v2/ui/templates/PageShell";
import { queryKeys } from "@/lib/queryKeys";
import {
  fetchBrandVoiceOutcomes,
  fetchRecentBrandVoiceAudits,
  topDeviations,
  type BrandVoiceOutcomeRow,
} from "@/data/brandVoice";

interface ChannelRoleAgg {
  readonly key: string;
  readonly channel: string;
  readonly role: string;
  readonly audits: number;
  readonly avgScore: number;
  readonly low: number;
  readonly high: number;
}

function aggregate(rows: ReadonlyArray<BrandVoiceOutcomeRow>): ChannelRoleAgg[] {
  const map = new Map<string, { audits: number; sumScore: number; low: number; high: number; channel: string; role: string }>();
  for (const r of rows) {
    const role = r.journalist_role ?? "—";
    const key = `${r.channel}::${role}`;
    const cur = map.get(key) ?? { audits: 0, sumScore: 0, low: 0, high: 0, channel: r.channel, role };
    cur.audits += r.audits;
    cur.sumScore += Number(r.avg_score) * r.audits;
    cur.low += r.low_score_count;
    cur.high += r.high_score_count;
    map.set(key, cur);
  }
  return Array.from(map.entries())
    .map(([key, v]) => ({
      key,
      channel: v.channel,
      role: v.role,
      audits: v.audits,
      avgScore: v.audits > 0 ? Math.round((v.sumScore / v.audits) * 10) / 10 : 0,
      low: v.low,
      high: v.high,
    }))
    .sort((a, b) => (a.channel === b.channel ? a.role.localeCompare(b.role) : a.channel.localeCompare(b.channel)));
}

function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 60) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

export function BrandVoicePage() {
  const isAdmin = useRequireRole({ role: "admin" });
  useTrackPage("brand-voice");

  const outcomesQ = useQuery({
    queryKey: queryKeys.brandVoice.outcomes,
    queryFn: fetchBrandVoiceOutcomes,
    enabled: isAdmin,
    staleTime: 60_000,
  });

  const auditsQ = useQuery({
    queryKey: queryKeys.brandVoice.recentAudits(50),
    queryFn: () => fetchRecentBrandVoiceAudits(50),
    enabled: isAdmin,
    staleTime: 60_000,
  });

  const aggregated = useMemo(() => aggregate(outcomesQ.data ?? []), [outcomesQ.data]);
  const deviations = useMemo(() => topDeviations(auditsQ.data ?? [], 10), [auditsQ.data]);

  if (!isAdmin) {
    return (
      <PageShell title="Brand Voice">
        <div className="flex h-40 items-center justify-center text-muted-foreground">
          Accesso riservato agli amministratori.
        </div>
      </PageShell>
    );
  }

  const totalAudits = aggregated.reduce((s, r) => s + r.audits, 0);
  const overallAvg = totalAudits > 0
    ? Math.round((aggregated.reduce((s, r) => s + r.avgScore * r.audits, 0) / totalAudits) * 10) / 10
    : 0;

  return (
    <PageShell
      width="wide"
      title="Brand Voice"
      description="Aderenza dei messaggi prodotti allo stile TMWE — ultimi 30 giorni"
    >
      <div className="space-y-6">
        {/* KPI summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Audit totali (30g)</div>
            <div className="mt-2 text-2xl font-semibold text-foreground">{totalAudits}</div>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Score medio</div>
            <div className={`mt-2 text-2xl font-semibold ${scoreColor(overallAvg)}`}>{overallAvg || "—"}</div>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Deviazioni distinte</div>
            <div className="mt-2 text-2xl font-semibold text-foreground">{deviations.length}</div>
          </div>
        </div>

        {/* Channel × Role table */}
        <section className="rounded-lg border border-border bg-card">
          <header className="px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Score per canale × ruolo editoriale</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Aggregato dagli ultimi 30 giorni di audit.</p>
          </header>
          {outcomesQ.isLoading ? (
            <div className="p-8 text-sm text-muted-foreground text-center">Caricamento…</div>
          ) : aggregated.length === 0 ? (
            <div className="p-8 text-sm text-muted-foreground text-center">
              Nessun audit registrato ancora. I messaggi prodotti saranno valutati automaticamente dal Journalist Review.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-2 font-medium">Canale</th>
                    <th className="text-left px-4 py-2 font-medium">Ruolo</th>
                    <th className="text-right px-4 py-2 font-medium">Audit</th>
                    <th className="text-right px-4 py-2 font-medium">Score medio</th>
                    <th className="text-right px-4 py-2 font-medium">Sotto 60</th>
                    <th className="text-right px-4 py-2 font-medium">Sopra 80</th>
                  </tr>
                </thead>
                <tbody>
                  {aggregated.map((r) => (
                    <tr key={r.key} className="border-b border-border/50 hover:bg-muted/40">
                      <td className="px-4 py-2 text-foreground">{r.channel}</td>
                      <td className="px-4 py-2 text-muted-foreground">{r.role}</td>
                      <td className="px-4 py-2 text-right text-foreground tabular-nums">{r.audits}</td>
                      <td className={`px-4 py-2 text-right font-semibold tabular-nums ${scoreColor(r.avgScore)}`}>{r.avgScore}</td>
                      <td className="px-4 py-2 text-right text-red-600 dark:text-red-400 tabular-nums">{r.low}</td>
                      <td className="px-4 py-2 text-right text-emerald-600 dark:text-emerald-400 tabular-nums">{r.high}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Top deviations */}
        <section className="rounded-lg border border-border bg-card">
          <header className="px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Top 10 deviazioni ricorrenti</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Pattern di stile che il Journalist Review segnala più spesso. Usa la KB Supervisor per aggiornare il lessico.
            </p>
          </header>
          {auditsQ.isLoading ? (
            <div className="p-8 text-sm text-muted-foreground text-center">Caricamento…</div>
          ) : deviations.length === 0 ? (
            <div className="p-8 text-sm text-muted-foreground text-center">Nessuna deviazione recente.</div>
          ) : (
            <ul className="divide-y divide-border">
              {deviations.map((d) => (
                <li key={d.code} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <code className="text-xs text-foreground bg-muted px-2 py-0.5 rounded">{d.code}</code>
                  <span className="text-muted-foreground tabular-nums">{d.count} occorrenze</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </PageShell>
  );
}