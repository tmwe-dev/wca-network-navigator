/**
 * KpiPage — P6.3
 * Pagina KPI: enrichment coverage, deliverability, response rate,
 * task completion, conversion funnel.
 */
import { useSystemKpis } from "@/v2/hooks/useSystemKpis";
import { SystemDiagnosticsBadge } from "@/v2/ui/components/admin/SystemDiagnosticsBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

function pct(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(digits)}%`;
}

function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "good" | "warn" | "bad";
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/60 p-4">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "mt-1.5 text-2xl font-semibold tabular-nums",
          tone === "good" && "text-emerald-500",
          tone === "warn" && "text-amber-500",
          tone === "bad" && "text-destructive"
        )}
      >
        {value}
      </div>
      {hint && (
        <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>
      )}
    </div>
  );
}

function toneFor(value: number, good: number, warn: number): "good" | "warn" | "bad" {
  if (value >= good) return "good";
  if (value >= warn) return "warn";
  return "bad";
}

export function KpiPage() {
  const { data, isLoading } = useSystemKpis();

  return (
    <div className="h-[calc(100vh-3.5rem)] overflow-hidden bg-background text-foreground">
      <ScrollArea className="h-full">
        <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6">
          <header className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">KPI Sistema</h1>
              <p className="text-sm text-muted-foreground">
                Metriche reali aggregate sugli ultimi 30 giorni.
              </p>
            </div>
            <div className="w-64">
              <SystemDiagnosticsBadge />
            </div>
          </header>

          {isLoading || !data ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : (
            <>
              <section className="space-y-2">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Enrichment partner
                </h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <StatCard
                    label="Coverage"
                    value={pct(data.enrichment.coveragePct)}
                    hint={`${data.enrichment.enriched.toLocaleString("it-IT")} / ${data.enrichment.total.toLocaleString("it-IT")}`}
                    tone={toneFor(data.enrichment.coveragePct, 50, 20)}
                  />
                  <StatCard
                    label="Partner totali"
                    value={data.enrichment.total.toLocaleString("it-IT")}
                  />
                  <StatCard
                    label="Arricchiti"
                    value={data.enrichment.enriched.toLocaleString("it-IT")}
                  />
                </div>
              </section>

              <section className="space-y-2">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Email (30 giorni)
                </h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <StatCard
                    label="Deliverability"
                    value={pct(data.email.deliverabilityPct)}
                    tone={toneFor(data.email.deliverabilityPct, 95, 80)}
                  />
                  <StatCard
                    label="Tasso risposta"
                    value={pct(data.email.responseRatePct)}
                    tone={toneFor(data.email.responseRatePct, 5, 1)}
                  />
                  <StatCard
                    label="Inviate (sent)"
                    value={data.email.sent30d.toLocaleString("it-IT")}
                  />
                  <StatCard
                    label="Fallite/bounce"
                    value={data.email.failed30d.toLocaleString("it-IT")}
                    tone={data.email.failed30d > 50 ? "warn" : "default"}
                  />
                </div>
              </section>

              <section className="space-y-2">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Agent tasks (30 giorni)
                </h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <StatCard
                    label="Completion rate"
                    value={pct(data.agents.completionRatePct)}
                    tone={toneFor(data.agents.completionRatePct, 80, 50)}
                  />
                  <StatCard
                    label="Completed"
                    value={data.agents.completed.toLocaleString("it-IT")}
                  />
                  <StatCard
                    label="Failed"
                    value={data.agents.failed.toLocaleString("it-IT")}
                    tone={data.agents.failed > 0 ? "warn" : "default"}
                  />
                  <StatCard
                    label="Pending now"
                    value={data.agents.pending.toLocaleString("it-IT")}
                    tone={data.agents.pending > 100 ? "bad" : "default"}
                  />
                </div>
              </section>

              <section className="space-y-2">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Conversion funnel (lead status)
                </h2>
                <div className="rounded-xl border border-border/60 bg-card/60 p-4">
                  {Object.keys(data.funnel).length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nessun dato lead_status disponibile.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {Object.entries(data.funnel)
                        .sort((a, b) => b[1] - a[1])
                        .map(([status, count]) => {
                          const total = Object.values(data.funnel).reduce(
                            (s, n) => s + n,
                            0
                          );
                          const p = total > 0 ? (count / total) * 100 : 0;
                          return (
                            <div key={status}>
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-medium">{status}</span>
                                <span className="text-muted-foreground tabular-nums">
                                  {count.toLocaleString("it-IT")} · {p.toFixed(1)}%
                                </span>
                              </div>
                              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                                <div
                                  className="h-full bg-primary"
                                  style={{ width: `${Math.max(p, 1)}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              </section>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export default KpiPage;