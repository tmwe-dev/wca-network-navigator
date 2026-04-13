/**
 * CampaignAnalyticsTab — Stats + charts for campaign performance
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { Send, CheckCircle2, XCircle, Percent } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

const tooltipStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 11,
  color: "hsl(var(--foreground))",
};

function StatCard({ icon: Icon, label, value, color }: { icon: typeof Send; label: string; value: string | number; color: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/50 p-3 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-lg font-bold text-foreground leading-none">{value}</p>
        <p className="text-[10px] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export function CampaignAnalyticsTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["campaign-analytics"],
    queryFn: async () => {
      const { data: jobs } = await supabase
        .from("campaign_jobs")
        .select("id, status, country_code, country_name, created_at, completed_at")
        .order("created_at", { ascending: false });

      const all = jobs || [];
      const stats = {
        total: all.length,
        completed: all.filter(j => j.status === "completed").length,
        failed: all.filter(j => j.status === "skipped").length,
        pending: all.filter(j => j.status === "pending").length,
        rate: 0,
      };
      stats.rate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

      // By country
      const countryMap = new Map<string, { country: string; sent: number; completed: number }>();
      for (const j of all) {
        const key = j.country_code || "??";
        const c = countryMap.get(key) || { country: key, sent: 0, completed: 0 };
        c.sent++;
        if (j.status === "completed") c.completed++;
        countryMap.set(key, c);
      }
      const byCountry = Array.from(countryMap.values()).sort((a, b) => b.sent - a.sent).slice(0, 15);

      // By day (last 30)
      const dayMap = new Map<string, number>();
      for (let i = 0; i < 30; i++) {
        const d = new Date(Date.now() - i * 86400000).toISOString().split("T")[0];
        dayMap.set(d, 0);
      }
      for (const j of all) {
        const d = j.created_at.split("T")[0];
        if (dayMap.has(d)) dayMap.set(d, (dayMap.get(d) || 0) + 1);
      }
      const byDay = Array.from(dayMap.entries())
        .map(([date, count]) => ({ date: date.slice(5), count }))
        .reverse();

      return { stats, byCountry, byDay };
    },
    staleTime: 60_000,
  });

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;

  const d = data;

  return (
    <ScrollArea className="h-full">
      <div className="space-y-6 p-4 max-w-5xl mx-auto">
        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard icon={Send} label="Totale job" value={d?.stats.total ?? 0} color="bg-blue-500/20 text-blue-400" />
          <StatCard icon={CheckCircle2} label="Completati" value={d?.stats.completed ?? 0} color="bg-green-500/20 text-green-400" />
          <StatCard icon={XCircle} label="Saltati" value={d?.stats.failed ?? 0} color="bg-red-500/20 text-red-400" />
          <StatCard icon={Percent} label="Tasso completamento" value={`${d?.stats.rate ?? 0}%`} color="bg-purple-500/20 text-purple-400" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Bar chart by country */}
          <div className="rounded-xl border border-border/60 bg-card/50 p-4 space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Job per paese (top 15)</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={d?.byCountry || []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis type="number" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis type="category" dataKey="country" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" width={40} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="sent" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Inviati" />
                <Bar dataKey="completed" fill="#22c55e" radius={[0, 4, 4, 0]} name="Completati" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Line chart over time */}
          <div className="rounded-xl border border-border/60 bg-card/50 p-4 space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Job ultimi 30 giorni</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={d?.byDay || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={false} name="Job" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}
