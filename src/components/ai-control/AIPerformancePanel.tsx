/**
 * AIPerformancePanel — KPIs, per-type stats, and critical contacts
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Brain, Zap, CheckCircle, Target, AlertTriangle } from "lucide-react";

interface KPI {
  total: number;
  autoExecuted: number;
  approved: number;
  rejected: number;
  accuracy: number;
}

interface TypeStat {
  type: string;
  total: number;
  auto: number;
  approved: number;
  rejected: number;
  accuracy: number;
}

export function AIPerformancePanel() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

  const { data: kpi, isLoading: kpiLoading } = useQuery<KPI>({
    queryKey: ["ai-performance-kpi"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_decision_log")
        .select("was_auto_executed, user_review")
        .gte("created_at", thirtyDaysAgo);
      if (error) throw error;
      const rows = data ?? [];
      const total = rows.length;
      const autoExecuted = rows.filter(r => r.was_auto_executed).length;
      const approved = rows.filter(r => r.user_review === "approved").length;
      const rejected = rows.filter(r => r.user_review === "rejected").length;
      const reviewed = approved + rejected;
      return { total, autoExecuted, approved, rejected, accuracy: reviewed > 0 ? (approved / reviewed) * 100 : 0 };
    },
  });

  const { data: typeStats = [] } = useQuery<TypeStat[]>({
    queryKey: ["ai-performance-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_decision_log")
        .select("decision_type, was_auto_executed, user_review")
        .gte("created_at", thirtyDaysAgo);
      if (error) throw error;
      const map = new Map<string, { total: number; auto: number; approved: number; rejected: number }>();
      for (const r of data ?? []) {
        const s = map.get(r.decision_type) ?? { total: 0, auto: 0, approved: 0, rejected: 0 };
        s.total++;
        if (r.was_auto_executed) s.auto++;
        if (r.user_review === "approved") s.approved++;
        if (r.user_review === "rejected") s.rejected++;
        map.set(r.decision_type, s);
      }
      return Array.from(map.entries()).map(([type, s]) => ({
        type,
        ...s,
        accuracy: (s.approved + s.rejected) > 0 ? (s.approved / (s.approved + s.rejected)) * 100 : 0,
      })).sort((a, b) => b.total - a.total);
    },
  });

  const { data: criticalContacts = [] } = useQuery({
    queryKey: ["ai-performance-critical"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_decision_log")
        .select("email_address, user_review, partner_id, partners(company_name)")
        .not("email_address", "is", null)
        .gte("created_at", thirtyDaysAgo);
      if (error) throw error;
      const map = new Map<string, { email: string; partner: string | null; approved: number; rejected: number; total: number }>();
      for (const r of data ?? []) {
        if (!r.email_address) continue;
        const s = map.get(r.email_address) ?? { email: r.email_address, partner: (r as Record<string, any>).partners?.company_name ?? null, approved: 0, rejected: 0, total: 0 };
        s.total++;
        if (r.user_review === "approved") s.approved++;
        if (r.user_review === "rejected") s.rejected++;
        map.set(r.email_address, s);
      }
      return Array.from(map.values())
        .filter(s => (s.approved + s.rejected) > 0)
        .map(s => ({ ...s, accuracy: (s.approved / (s.approved + s.rejected)) * 100 }))
        .filter(s => s.accuracy < 70)
        .sort((a, b) => a.accuracy - b.accuracy)
        .slice(0, 10);
    },
  });

  if (kpiLoading) {
    return <div className="flex items-center justify-center h-40"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  }

  const kpiCards = [
    { label: "Decisioni Totali", value: kpi?.total ?? 0, sub: "ultimi 30g", icon: Brain, color: "text-blue-400" },
    { label: "Auto-Eseguite", value: kpi?.autoExecuted ?? 0, sub: kpi?.total ? `${Math.round((kpi.autoExecuted / kpi.total) * 100)}%` : "0%", icon: Zap, color: "text-amber-400" },
    { label: "Approvate", value: kpi?.approved ?? 0, sub: kpi?.total ? `${Math.round((kpi.approved / kpi.total) * 100)}%` : "0%", icon: CheckCircle, color: "text-emerald-400" },
    { label: "Accuracy", value: `${Math.round(kpi?.accuracy ?? 0)}%`, sub: "approvate / revisionate", icon: Target, color: "text-primary" },
  ];

  return (
    <ScrollArea className="h-[calc(100vh-280px)]">
      <div className="space-y-6 pr-2">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {kpiCards.map((k) => (
            <div key={k.label} className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <k.icon className={`h-4 w-4 ${k.color}`} />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{k.label}</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{k.value}</p>
              <p className="text-[10px] text-muted-foreground">{k.sub}</p>
            </div>
          ))}
        </div>

        {/* Per-type stats */}
        <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Per Tipo Decisione</h3>
          {typeStats.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nessun dato disponibile</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="text-muted-foreground border-b border-border/30">
                  <th className="text-left py-1.5 font-medium">Tipo</th>
                  <th className="text-right py-1.5 font-medium">Totale</th>
                  <th className="text-right py-1.5 font-medium">Auto</th>
                  <th className="text-right py-1.5 font-medium">Approvate</th>
                  <th className="text-right py-1.5 font-medium">Rifiutate</th>
                  <th className="text-right py-1.5 font-medium">Accuracy</th>
                </tr></thead>
                <tbody>
                  {typeStats.map((s) => (
                    <tr key={s.type} className="border-b border-border/20">
                      <td className="py-1.5 text-foreground">{s.type.replace(/_/g, " ")}</td>
                      <td className="py-1.5 text-right">{s.total}</td>
                      <td className="py-1.5 text-right">{s.auto}</td>
                      <td className="py-1.5 text-right text-emerald-400">{s.approved}</td>
                      <td className="py-1.5 text-right text-red-400">{s.rejected}</td>
                      <td className="py-1.5 text-right"><Badge variant="outline" className="text-[10px]">{Math.round(s.accuracy)}%</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Critical contacts */}
        <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-foreground">Contatti Critici</h3>
            <span className="text-[10px] text-muted-foreground">accuracy &lt; 70%</span>
          </div>
          {criticalContacts.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nessun contatto critico — ottimo lavoro! 🎉</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="text-muted-foreground border-b border-border/30">
                  <th className="text-left py-1.5 font-medium">Email</th>
                  <th className="text-left py-1.5 font-medium">Partner</th>
                  <th className="text-right py-1.5 font-medium">Totale</th>
                  <th className="text-right py-1.5 font-medium">Accuracy</th>
                </tr></thead>
                <tbody>
                  {criticalContacts.map((c) => (
                    <tr key={c.email} className="border-b border-border/20">
                      <td className="py-1.5 text-foreground truncate max-w-[200px]">{c.email}</td>
                      <td className="py-1.5 text-muted-foreground">{c.partner ?? "—"}</td>
                      <td className="py-1.5 text-right">{c.total}</td>
                      <td className="py-1.5 text-right text-red-400">{Math.round(c.accuracy)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </ScrollArea>
  );
}
