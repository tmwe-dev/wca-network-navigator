/**
 * EmailObservabilityPanel — sezione Dashboard per metriche invio email.
 * Legge email_send_log via DAL (RLS user-scoped).
 */
import { useState } from "react";
import { Mail, AlertTriangle, CheckCircle2, RefreshCcw } from "lucide-react";
import { useEmailSendLog, type EmailRangePreset } from "@/v2/hooks/useEmailSendLog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";

const RANGES: Array<{ key: EmailRangePreset; label: string }> = [
  { key: "24h", label: "24h" },
  { key: "7d", label: "7 giorni" },
  { key: "30d", label: "30 giorni" },
];

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diffMs / 60_000);
  if (m < 1) return "ora";
  if (m < 60) return `${m}m fa`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h fa`;
  return `${Math.floor(h / 24)}g fa`;
}

function statusVariant(status: string): "default" | "destructive" | "secondary" | "outline" {
  if (status === "sent") return "default";
  if (status === "bounced" || status === "rejected") return "secondary";
  return "destructive";
}

export function EmailObservabilityPanel() {
  const [range, setRange] = useState<EmailRangePreset>("7d");
  const { data, isLoading, isFetching, error } = useEmailSendLog(range);
  const qc = useQueryClient();

  const totalFailures = (data?.failed ?? 0) + (data?.bounced ?? 0) + (data?.rejected ?? 0);
  const failureRatePct = data ? Math.round(data.failureRate * 100) : 0;

  return (
    <section
      data-testid="email-observability-panel"
      className="rounded-xl border border-border/60 bg-card/40 p-4 space-y-3"
    >
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold tracking-tight">Email — Osservabilità</h2>
        </div>
        <div className="flex items-center gap-1.5">
          {RANGES.map((r) => (
            <Button
              key={r.key}
              size="sm"
              variant={range === r.key ? "default" : "outline"}
              className="h-7 px-2 text-[11px]"
              onClick={() => setRange(r.key)}
            >
              {r.label}
            </Button>
          ))}
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => qc.invalidateQueries({ queryKey: queryKeys.email.sendLog(range) })}
            aria-label="Aggiorna"
          >
            <RefreshCcw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
          </Button>
        </div>
      </header>

      {error && (
        <div className="text-[11px] text-destructive">
          Errore caricamento log email: {(error as Error).message}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat label="Inviate" value={data?.sent ?? 0} loading={isLoading} icon={<CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />} />
        <Stat label="Fallite" value={totalFailures} loading={isLoading} icon={<AlertTriangle className="h-3.5 w-3.5 text-destructive" />} />
        <Stat label="Bounce" value={data?.bounced ?? 0} loading={isLoading} />
        <Stat label="Tasso errore" value={isLoading ? null : `${failureRatePct}%`} loading={isLoading} highlight={failureRatePct >= 10} />
      </div>

      <div className="space-y-1.5">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Ultimi errori
        </div>
        {isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : !data || data.recentErrors.length === 0 ? (
          <div className="text-[11px] text-muted-foreground italic">Nessun errore nel periodo selezionato.</div>
        ) : (
          <ul className="divide-y divide-border/40 rounded-md border border-border/40 bg-background/50">
            {data.recentErrors.map((e) => (
              <li key={e.id} className="px-2.5 py-2 flex items-start justify-between gap-3 text-[11px]">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <Badge variant={statusVariant(e.status)} className="h-4 px-1.5 text-[9px] uppercase">
                      {e.status}
                    </Badge>
                    <span className="text-muted-foreground">{e.send_method}</span>
                    <span className="text-muted-foreground/70">·</span>
                    <span className="text-muted-foreground">{formatRelative(e.sent_at)}</span>
                  </div>
                  <div className="mt-1 truncate font-medium text-foreground" title={e.subject}>
                    {e.subject || "(senza oggetto)"}
                  </div>
                  <div className="truncate text-muted-foreground" title={e.recipient_email}>
                    → {e.recipient_email}
                  </div>
                  {e.error_message && (
                    <div className="mt-0.5 truncate text-destructive/80" title={e.error_message}>
                      {e.error_message}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

interface StatProps {
  label: string;
  value: number | string | null;
  loading: boolean;
  icon?: React.ReactNode;
  highlight?: boolean;
}

function Stat({ label, value, loading, icon, highlight }: StatProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border/50 bg-background/50 px-2.5 py-2",
        highlight && "border-destructive/50 bg-destructive/5"
      )}
    >
      <div className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className={cn("mt-0.5 text-lg font-semibold tabular-nums", highlight && "text-destructive")}>
        {loading ? <Skeleton className="h-5 w-12" /> : value ?? 0}
      </div>
    </div>
  );
}
