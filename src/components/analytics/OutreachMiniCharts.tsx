/**
 * OutreachMiniCharts — Sparklines and donut for Outreach stats header
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area } from "recharts";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { queryKeys } from "@/lib/queryKeys";

const STATUS_COLORS: Record<string, string> = {
  pending: "#f59e0b",
  sent: "#3b82f6",
  completed: "#22c55e",
  failed: "#ef4444",
  cancelled: "#6b7280",
};

export function OutreachMiniCharts() {
  const { data } = useQuery({
    queryKey: queryKeys.outreach.miniCharts,
    queryFn: async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000).toISOString();

      // Sparkline last 7 days
      const { data: recent } = await supabase
        .from("activities")
        .select("created_at")
        .gte("created_at", sevenDaysAgo)
        .in("activity_type", ["send_email", "follow_up"]);

      const dayMap = new Map<string, number>();
      for (let i = 0; i < 7; i++) {
        const d = new Date(Date.now() - i * 86400000).toISOString().split("T")[0];
        dayMap.set(d, 0);
      }
      for (const a of recent || []) {
        const d = a.created_at.split("T")[0];
        if (dayMap.has(d)) dayMap.set(d, (dayMap.get(d) || 0) + 1);
      }
      const sparkline = Array.from(dayMap.entries())
        .map(([, v]) => ({ v }))
        .reverse();

      // Status donut
      const { data: statusData } = await supabase
        .from("activities")
        .select("status")
        .gte("created_at", sevenDaysAgo);

      const statusCounts = new Map<string, number>();
      for (const a of statusData || []) {
        const s = a.status || "pending";
        statusCounts.set(s, (statusCounts.get(s) || 0) + 1);
      }
      const donut = Array.from(statusCounts.entries()).map(([name, value]) => ({ name, value }));

      // Response trend: this week vs last week
      const { count: thisWeek } = await supabase
        .from("activities")
        .select("*", { count: "exact", head: true })
        .gte("created_at", sevenDaysAgo)
        .eq("response_received", true);

      const { count: lastWeek } = await supabase
        .from("activities")
        .select("*", { count: "exact", head: true })
        .gte("created_at", fourteenDaysAgo)
        .lt("created_at", sevenDaysAgo)
        .eq("response_received", true);

      const thisW = thisWeek || 0;
      const lastW = lastWeek || 0;
      const responseTrend = thisW - lastW;

      return { sparkline, donut, thisW, lastW, responseTrend };
    },
    staleTime: 120_000,
  });

  if (!data) return null;

  const TrendIcon = data.responseTrend > 0 ? TrendingUp : data.responseTrend < 0 ? TrendingDown : Minus;
  const trendColor = data.responseTrend > 0 ? "text-green-500" : data.responseTrend < 0 ? "text-red-500" : "text-muted-foreground";

  return (
    <div className="flex items-center gap-4 px-3 py-2 border-b border-border/30 bg-muted/5">
      {/* Sparkline */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground">Invii 7gg</span>
        <div className="w-20 h-6">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.sparkline}>
              <Area type="monotone" dataKey="v" fill="#3b82f6" stroke="#3b82f6" fillOpacity={0.2} strokeWidth={1.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Donut */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground">Status</span>
        <div className="w-8 h-8">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data.donut} dataKey="value" cx="50%" cy="50%" innerRadius={8} outerRadius={14} strokeWidth={0}>
                {data.donut.map((d, i) => (
                  <Cell key={i} fill={STATUS_COLORS[d.name] || "#6b7280"} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Response trend */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-muted-foreground">Risposte</span>
        <span className="text-xs font-semibold text-foreground">{data.thisW}</span>
        <TrendIcon className={cn("w-3 h-3", trendColor)} />
        <span className={cn("text-[10px] font-medium", trendColor)}>
          {data.responseTrend > 0 ? "+" : ""}{data.responseTrend}
        </span>
      </div>
    </div>
  );
}
