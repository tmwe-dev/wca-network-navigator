/**
 * DashboardCharts — 4 Recharts graphs for SuperHome3D
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

const CHANNEL_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6"];
const SCORE_COLORS = ["#ef4444", "#f59e0b", "#22c55e", "#16a34a"];

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/50 p-4 space-y-3">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</h3>
      {children}
    </div>
  );
}

function useActivityTrend() {
  return useQuery({
    queryKey: queryKeys.dashboard.activityTrend(),
    queryFn: async () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
      const { data } = await supabase
        .from("activities")
        .select("created_at, activity_type")
        .gte("created_at", thirtyDaysAgo);

      const dayMap = new Map<string, { email: number; phone: number; whatsapp: number; total: number }>();
      for (let i = 0; i < 30; i++) {
        const d = new Date(Date.now() - i * 86400000).toISOString().split("T")[0];
        dayMap.set(d, { email: 0, phone: 0, whatsapp: 0, total: 0 });
      }
      for (const a of data || []) {
        const day = a.created_at.split("T")[0];
        const bucket = dayMap.get(day);
        if (bucket) {
          bucket.total++;
          if (a.activity_type?.includes("email")) bucket.email++;
          else if (a.activity_type?.includes("phone") || a.activity_type?.includes("call")) bucket.phone++;
          else if (a.activity_type?.includes("whatsapp")) bucket.whatsapp++;
        }
      }
      return Array.from(dayMap.entries())
        .map(([date, v]) => ({ date: date.slice(5), ...v }))
        .reverse();
    },
    staleTime: 120_000,
  });
}

function useChannelDistribution() {
  return useQuery({
    queryKey: queryKeys.dashboard.channelDist,
    queryFn: async () => {
      const { data } = await supabase
        .from("activities")
        .select("activity_type")
        .limit(1000);

      const counts: Record<string, number> = {};
      for (const a of data || []) {
        const t = a.activity_type || "altro";
        let ch = "Altro";
        if (t.includes("email")) ch = "Email";
        else if (t.includes("phone") || t.includes("call")) ch = "Telefono";
        else if (t.includes("whatsapp")) ch = "WhatsApp";
        else if (t.includes("linkedin")) ch = "LinkedIn";
        counts[ch] = (counts[ch] || 0) + 1;
      }
      return Object.entries(counts).map(([name, value]) => ({ name, value }));
    },
    staleTime: 120_000,
  });
}

function useResponseByCountry() {
  return useQuery({
    queryKey: queryKeys.dashboard.responseCountry(),
    queryFn: async () => {
      const { data } = await supabase
        .from("response_patterns")
        .select("country_code, response_rate, total_sent")
        .not("country_code", "is", null)
        .gt("total_sent", 0)
        .order("total_sent", { ascending: false })
        .limit(10);

      return (data || []).map(r => ({
        country: r.country_code || "??",
        rate: Math.round((r.response_rate || 0) * 100),
        sent: r.total_sent || 0,
      }));
    },
    staleTime: 120_000,
  });
}

function useLeadScoreDist() {
  return useQuery({
    queryKey: queryKeys.dashboard.leadScoreDist,
    queryFn: async () => {
      const { data } = await supabase
        .from("imported_contacts")
        .select("lead_score")
        .not("lead_score", "is", null);

      const buckets = [
        { range: "0-25", min: 0, max: 25, count: 0 },
        { range: "26-50", min: 26, max: 50, count: 0 },
        { range: "51-75", min: 51, max: 75, count: 0 },
        { range: "76-100", min: 76, max: 100, count: 0 },
      ];
      for (const c of data || []) {
        const s = c.lead_score ?? 0;
        const b = buckets.find(b => s >= b.min && s <= b.max);
        if (b) b.count++;
      }
      return buckets;
    },
    staleTime: 120_000,
  });
}

const tooltipStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 11,
  color: "hsl(var(--foreground))",
};

export function DashboardCharts() {
  const { data: trend } = useActivityTrend();
  const { data: channels } = useChannelDistribution();
  const { data: responseCountry } = useResponseByCountry();
  const { data: leadDist } = useLeadScoreDist();

  return (
    <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Area Chart — Activity Trend */}
      <ChartCard title="Attività ultimi 30 giorni">
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={trend || []}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
            <Tooltip contentStyle={tooltipStyle} />
            <Area type="monotone" dataKey="email" stackId="1" fill="#3b82f6" stroke="#3b82f6" fillOpacity={0.3} name="Email" />
            <Area type="monotone" dataKey="whatsapp" stackId="1" fill="#22c55e" stroke="#22c55e" fillOpacity={0.3} name="WhatsApp" />
            <Area type="monotone" dataKey="phone" stackId="1" fill="#f59e0b" stroke="#f59e0b" fillOpacity={0.3} name="Telefono" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Pie Chart — Channel Distribution */}
      <ChartCard title="Distribuzione canali">
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie data={channels || []} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
              {(channels || []).map((_, i) => (
                <Cell key={i} fill={CHANNEL_COLORS[i % CHANNEL_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Bar Chart — Response Rate by Country */}
      <ChartCard title="Tasso risposta per paese">
        {(responseCountry?.length ?? 0) > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={responseCountry} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis type="number" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" unit="%" />
              <YAxis type="category" dataKey="country" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" width={40} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v}%`} />
              <Bar dataKey="rate" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Tasso %" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-xs text-muted-foreground py-8 text-center">Nessun dato response patterns disponibile</p>
        )}
      </ChartCard>

      {/* Bar Chart — Lead Score Distribution */}
      <ChartCard title="Distribuzione lead score">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={leadDist || []}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
            <XAxis dataKey="range" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="count" name="Contatti" radius={[4, 4, 0, 0]}>
              {(leadDist || []).map((_, i) => (
                <Cell key={i} fill={SCORE_COLORS[i % SCORE_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </section>
  );
}
