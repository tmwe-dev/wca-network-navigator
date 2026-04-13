/**
 * BCAQualityDashboard — Collapsible stats bar + funnel for BusinessCardsView
 */
import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, CreditCard, Mail, Handshake, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BusinessCardWithPartner } from "@/hooks/useBusinessCards";

interface Props {
  cards: BusinessCardWithPartner[];
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-card/50 border border-border/30">
      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", color)}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-lg font-bold text-foreground leading-none">{value}</p>
        <p className="text-[10px] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function FunnelStep({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-muted-foreground truncate">{label}</span>
        <span className="text-[10px] font-medium text-foreground">{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-500", color)} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[9px] text-muted-foreground mt-0.5">{count} / {total}</p>
    </div>
  );
}

export function BCAQualityDashboard({ cards }: Props) {
  const [expanded, setExpanded] = useState(false);

  const stats = useMemo(() => {
    const total = cards.length;
    const withEmail = cards.filter((c) => c.email).length;
    const matched = cards.filter((c) => c.matched_partner_id).length;
    // "Contattati" — cards where match_status indicates active contact
    const contacted = cards.filter((c) => c.lead_status && c.lead_status !== "new").length;
    return { total, withEmail, matched, contacted };
  }, [cards]);

  if (cards.length === 0) return null;

  return (
    <div className="border border-border/30 rounded-xl bg-muted/10 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2 hover:bg-muted/20 transition-colors"
      >
        <span className="text-xs font-medium text-foreground">Qualità Portfolio BCA</span>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-muted-foreground">
            {stats.total} biglietti · {stats.matched} matchati · {stats.withEmail} con email
          </span>
          {expanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-3 space-y-3 border-t border-border/20 pt-3">
          <div className="grid grid-cols-4 gap-2">
            <StatCard icon={CreditCard} label="Totale Biglietti" value={stats.total} color="bg-primary/10 text-primary" />
            <StatCard icon={Mail} label="Con Email" value={stats.withEmail} color="bg-blue-500/10 text-blue-400" />
            <StatCard icon={Handshake} label="Collegati a Partner" value={stats.matched} color="bg-emerald-500/10 text-emerald-400" />
            <StatCard icon={MessageCircle} label="Contattati" value={stats.contacted} color="bg-amber-500/10 text-amber-400" />
          </div>

          <div className="flex items-center gap-3">
            <FunnelStep label="Scansione" count={stats.total} total={stats.total} color="bg-primary" />
            <span className="text-muted-foreground/30 text-lg">→</span>
            <FunnelStep label="Con Email" count={stats.withEmail} total={stats.total} color="bg-blue-500" />
            <span className="text-muted-foreground/30 text-lg">→</span>
            <FunnelStep label="Partner" count={stats.matched} total={stats.total} color="bg-emerald-500" />
            <span className="text-muted-foreground/30 text-lg">→</span>
            <FunnelStep label="Contattato" count={stats.contacted} total={stats.total} color="bg-amber-500" />
          </div>
        </div>
      )}
    </div>
  );
}
