/**
 * OperativeMetricsGrid — Instant structured dashboard metrics
 */
import { Users, Send, MessageSquare, Clock, CheckCircle2, AlertCircle, Mail, Reply, Loader2 } from "lucide-react";
import type { OperativeMetrics } from "@/v2/hooks/useDashboardOperativeMetrics";

interface Props {
  metrics: OperativeMetrics | undefined;
  isLoading: boolean;
}

interface MetricItem {
  icon: React.ElementType;
  label: string;
  value: number;
  color: string;
}

function MetricCell({ icon: Icon, label, value, color }: MetricItem) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border/50 bg-card/60 px-3 py-2.5 transition-colors hover:bg-card/80">
      <Icon className={`h-4 w-4 shrink-0 ${color}`} />
      <div className="min-w-0 flex-1">
        <div className="text-lg font-bold leading-none">{value.toLocaleString("it-IT")}</div>
        <div className="text-[10px] text-muted-foreground truncate mt-0.5">{label}</div>
      </div>
    </div>
  );
}

function SectionHeader({ title, emoji }: { title: string; emoji: string }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground col-span-full">
      {emoji} {title}
    </div>
  );
}

export function OperativeMetricsGrid({ metrics, isLoading }: Props) {
  if (isLoading) {
    return (
      <section className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xl p-5">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Caricamento metriche…
        </div>
      </section>
    );
  }

  if (!metrics) return null;

  const { contacts, outreach, messages } = metrics;

  return (
    <section className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xl p-5 space-y-4">
      {/* Contacts */}
      <div className="space-y-2">
        <SectionHeader title="Contatti" emoji="👥" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <MetricCell icon={Users} label="Totale" value={contacts.total} color="text-primary" />
          <MetricCell icon={Clock} label="Da contattare" value={contacts.toContact} color="text-amber-500" />
          <MetricCell icon={Send} label="Contattati" value={contacts.contacted} color="text-blue-500" />
          <MetricCell icon={Reply} label="Hanno risposto" value={contacts.replied} color="text-emerald-500" />
        </div>
      </div>

      {/* Outreach Pipeline */}
      <div className="space-y-2">
        <SectionHeader title="Pipeline Outreach" emoji="🚀" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <MetricCell icon={MessageSquare} label="Creati" value={outreach.created} color="text-primary" />
          <MetricCell icon={Clock} label="Programmati" value={outreach.scheduled} color="text-amber-500" />
          <MetricCell icon={CheckCircle2} label="Autorizzati" value={outreach.authorized} color="text-emerald-500" />
          <MetricCell icon={AlertCircle} label="Da autorizzare" value={outreach.pendingApproval} color="text-orange-500" />
        </div>
      </div>

      {/* Messages */}
      <div className="space-y-2">
        <SectionHeader title="Messaggi" emoji="📧" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <MetricCell icon={Mail} label="Inviati oggi" value={messages.sentToday} color="text-primary" />
          <MetricCell icon={Clock} label="In attesa risposta" value={messages.awaitingReply} color="text-amber-500" />
          <MetricCell icon={Reply} label="Risposte ricevute" value={messages.repliesReceived} color="text-emerald-500" />
        </div>
      </div>
    </section>
  );
}
