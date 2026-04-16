/**
 * OperativeMetricsGrid — Inline summary next to section title
 */
import type { OperativeMetrics } from "@/v2/hooks/useDashboardOperativeMetrics";

interface Props {
  metrics: OperativeMetrics | undefined;
  isLoading: boolean;
}

function Chip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px]">
      <span className={`font-bold ${value > 0 ? color : "text-muted-foreground/40"}`}>
        {value.toLocaleString("it-IT")}
      </span>
      <span className="text-muted-foreground/60">{label}</span>
    </span>
  );
}

export function OperativeMetricsGrid({ metrics, isLoading }: Props) {
  if (isLoading || !metrics) return null;

  const { contacts, outreach, messages } = metrics;

  return (
    <div className="flex items-center gap-3 flex-wrap text-xs px-1">
      <Chip label="contatti" value={contacts.total} color="text-primary" />
      <span className="text-border">·</span>
      <Chip label="da contattare" value={contacts.toContact} color="text-amber-500" />
      <span className="text-border">·</span>
      <Chip label="risposte" value={contacts.replied} color="text-emerald-500" />
      <span className="text-border">·</span>
      <Chip label="da autorizzare" value={outreach.pendingApproval} color="text-orange-500" />
      <span className="text-border">·</span>
      <Chip label="inviati oggi" value={messages.sentToday} color="text-blue-500" />
    </div>
  );
}
