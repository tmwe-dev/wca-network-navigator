/**
 * OperativeMetricsGrid — Compact structured dashboard metrics
 */
import { Loader2 } from "lucide-react";
import type { OperativeMetrics } from "@/v2/hooks/useDashboardOperativeMetrics";

interface Props {
  metrics: OperativeMetrics | undefined;
  isLoading: boolean;
}

function Metric({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col items-center px-2 py-1.5">
      <span className={`text-lg font-bold leading-none ${value > 0 ? color : "text-muted-foreground/40"}`}>
        {value.toLocaleString("it-IT")}
      </span>
      <span className="text-[9px] text-muted-foreground/70 mt-0.5 text-center leading-tight">{label}</span>
    </div>
  );
}

function Divider() {
  return <div className="w-px h-8 bg-border/40 self-center" />;
}

export function OperativeMetricsGrid({ metrics, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-border/60 bg-card/80 p-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Caricamento…
      </div>
    );
  }

  if (!metrics) return null;

  const { contacts, outreach, messages } = metrics;

  return (
    <div className="rounded-xl border border-border/60 bg-card/80 backdrop-blur-xl px-4 py-3">
      <div className="flex items-center justify-between flex-wrap gap-y-2">
        {/* Contacts block */}
        <div className="flex items-center gap-0">
          <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/60 mr-2 writing-vertical hidden sm:block">👥</span>
          <Metric label="Totale" value={contacts.total} color="text-primary" />
          <Metric label="Da contattare" value={contacts.toContact} color="text-amber-500" />
          <Metric label="Contattati" value={contacts.contacted} color="text-blue-500" />
          <Metric label="Risposte" value={contacts.replied} color="text-emerald-500" />
        </div>

        <Divider />

        {/* Outreach block */}
        <div className="flex items-center gap-0">
          <Metric label="Creati" value={outreach.created} color="text-primary" />
          <Metric label="Programmati" value={outreach.scheduled} color="text-amber-500" />
          <Metric label="Autorizzati" value={outreach.authorized} color="text-emerald-500" />
          <Metric label="Da autoriz." value={outreach.pendingApproval} color="text-orange-500" />
        </div>

        <Divider />

        {/* Messages block */}
        <div className="flex items-center gap-0">
          <Metric label="Inviati oggi" value={messages.sentToday} color="text-primary" />
          <Metric label="In attesa" value={messages.awaitingReply} color="text-amber-500" />
          <Metric label="Risposte" value={messages.repliesReceived} color="text-emerald-500" />
        </div>
      </div>
    </div>
  );
}
