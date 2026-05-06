/**
 * E2E Status — mostra l'ultimo nightly run + storia recente.
 * Dati popolati via webhook `record-e2e-run` chiamata da GitHub Actions.
 */
import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, MinusCircle, AlertTriangle, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { listRecentE2ERuns, type E2ERunRow, type E2ESpecResult } from "@/data/e2eRuns";
import { PageTitleHeader } from "@/v2/ui/templates/PageTitleHeader";
import { Activity } from "lucide-react";

function StatusIcon({ status }: { status: E2ESpecResult["status"] }) {
  if (status === "passed") return <CheckCircle2 className="w-4 h-4 text-success" />;
  if (status === "failed" || status === "timedOut") return <XCircle className="w-4 h-4 text-destructive" />;
  if (status === "flaky") return <AlertTriangle className="w-4 h-4 text-warning" />;
  return <MinusCircle className="w-4 h-4 text-muted-foreground" />;
}

function fmtDuration(ms: number | null | undefined) {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 100) / 10;
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}

export function E2EStatusPage() {
  const [runs, setRuns] = useState<E2ERunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    try {
      const rows = await listRecentE2ERuns(20);
      setRuns(rows);
      setErr(null);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void reload(); }, []);

  const latest = runs[0];

  return (
    <div data-testid="page-e2e-status" className="flex h-full min-h-0 flex-col overflow-hidden">
      <PageTitleHeader icon={Activity} title="E2E Status" subtitle="risultati ultima esecuzione end-to-end" />
      <div className="flex-1 overflow-auto p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            La suite completa gira ogni notte alle 02:00 UTC tramite GitHub Actions.
            La PR chain esegue solo le 8 spec smoke.
          </div>
          <button
            onClick={reload}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs hover:bg-accent"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Ricarica
          </button>
        </div>

        {loading && (
          <div className="float-panel p-8 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {err && (
          <div className="float-panel p-4 border-l-4 border-destructive text-sm">
            Errore caricamento risultati: {err}
          </div>
        )}

        {!loading && !err && !latest && (
          <div className="float-panel p-6 text-sm text-muted-foreground">
            Nessun run registrato. Il primo nightly verrà eseguito alle 02:00 UTC,
            oppure puoi scatenarlo manualmente da GitHub Actions →
            <span className="font-mono"> e2e-nightly</span>.
          </div>
        )}

        {latest && (
          <div className="float-panel p-5 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <div className="text-xs text-muted-foreground">Ultimo run</div>
                <div className="text-base font-semibold">
                  {new Date(latest.finished_at).toLocaleString()}
                  {latest.branch && <span className="ml-2 text-xs text-muted-foreground font-mono">{latest.branch}</span>}
                </div>
              </div>
              {latest.report_url && (
                <a
                  href={latest.report_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs hover:bg-accent"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Report HTML
                </a>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
              <Stat label="Totali" value={latest.total_tests} />
              <Stat label="Pass" value={latest.passed} tone="green" />
              <Stat label="Fail" value={latest.failed} tone={latest.failed > 0 ? "red" : "muted"} />
              <Stat label="Skip" value={latest.skipped} tone="muted" />
              <Stat label="Flaky" value={latest.flaky} tone={latest.flaky > 0 ? "amber" : "muted"} />
            </div>
            <div className="text-xs text-muted-foreground">
              Durata totale: {fmtDuration(latest.duration_ms)}
              {latest.commit_sha && <> · commit <span className="font-mono">{latest.commit_sha.slice(0, 7)}</span></>}
            </div>

            <div className="border-t border-border pt-3">
              <div className="text-xs font-semibold mb-2">Dettaglio per spec</div>
              <div className="rounded-md border border-border/60 divide-y divide-border/60 max-h-[420px] overflow-auto">
                {latest.spec_results.length === 0 ? (
                  <div className="p-3 text-xs text-muted-foreground">Nessun dettaglio spec disponibile.</div>
                ) : (
                  latest.spec_results.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                      <StatusIcon status={s.status} />
                      <span className="font-mono flex-1 truncate" title={s.file}>{s.file}</span>
                      {s.title && <span className="text-muted-foreground truncate hidden md:inline">{s.title}</span>}
                      <span className="text-muted-foreground tabular-nums">{fmtDuration(s.duration_ms)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {runs.length > 1 && (
          <div className="float-panel p-5">
            <div className="text-xs font-semibold mb-2">Storia recente</div>
            <div className="text-xs">
              {runs.slice(1).map((r) => (
                <div key={r.id} className="flex items-center gap-2 py-1 border-b border-border/40 last:border-0">
                  <span className="text-muted-foreground tabular-nums w-36">{new Date(r.finished_at).toLocaleString()}</span>
                  <span className="text-success">{r.passed}P</span>
                  <span className={r.failed > 0 ? "text-destructive" : "text-muted-foreground"}>{r.failed}F</span>
                  <span className="text-muted-foreground">{r.skipped}S</span>
                  <span className="text-muted-foreground ml-auto">{fmtDuration(r.duration_ms)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, tone = "default" }: { label: string; value: number; tone?: "green" | "red" | "amber" | "muted" | "default" }) {
  const colors = {
    green: "text-success",
    red: "text-destructive",
    amber: "text-warning",
    muted: "text-muted-foreground",
    default: "text-foreground",
  };
  return (
    <div className="rounded-md border border-border/60 py-2">
      <div className={`text-xl font-bold tabular-nums ${colors[tone]}`}>{value}</div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}