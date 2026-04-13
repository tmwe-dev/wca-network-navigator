/**
 * ResponseRateCard — Global response rate with channel breakdown and trend
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChannelRate {
  channel: string;
  rate: number;
  sent: number;
  color: string;
}

export function ResponseRateCard() {
  const { data } = useQuery({
    queryKey: ["response-rate-card"],
    queryFn: async () => {
      const { data: patterns } = await supabase
        .from("response_patterns")
        .select("channel, response_rate, total_sent, total_responses, updated_at")
        .gt("total_sent", 0);

      if (!patterns?.length) return null;

      let totalSent = 0, totalResponses = 0;
      const channelMap = new Map<string, { sent: number; responses: number }>();

      for (const p of patterns) {
        totalSent += p.total_sent || 0;
        totalResponses += p.total_responses || 0;
        const ch = p.channel || "email";
        const c = channelMap.get(ch) || { sent: 0, responses: 0 };
        c.sent += p.total_sent || 0;
        c.responses += p.total_responses || 0;
        channelMap.set(ch, c);
      }

      const colorMap: Record<string, string> = {
        email: "#3b82f6",
        whatsapp: "#22c55e",
        linkedin: "#6366f1",
        phone: "#f59e0b",
      };

      const channels: ChannelRate[] = Array.from(channelMap.entries()).map(([ch, v]) => ({
        channel: ch,
        rate: v.sent > 0 ? Math.round((v.responses / v.sent) * 100) : 0,
        sent: v.sent,
        color: colorMap[ch] || "#8b5cf6",
      }));

      const globalRate = totalSent > 0 ? Math.round((totalResponses / totalSent) * 100) : 0;

      // Simple trend: compare recent vs older patterns
      const sorted = [...patterns].sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""));
      const half = Math.ceil(sorted.length / 2);
      const recentAvg = sorted.slice(0, half).reduce((s, p) => s + (p.response_rate || 0), 0) / half;
      const olderAvg = sorted.slice(half).reduce((s, p) => s + (p.response_rate || 0), 0) / Math.max(sorted.length - half, 1);
      const trendDelta = Math.round((recentAvg - olderAvg) * 100);

      return { globalRate, channels, trendDelta };
    },
    staleTime: 120_000,
  });

  if (!data) {
    return (
      <div className="rounded-xl border border-border/60 bg-card/50 p-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Tasso Risposta</h3>
        <p className="text-xs text-muted-foreground text-center py-4">Nessun dato disponibile</p>
      </div>
    );
  }

  const TrendIcon = data.trendDelta > 0 ? TrendingUp : data.trendDelta < 0 ? TrendingDown : Minus;
  const trendColor = data.trendDelta > 0 ? "text-green-500" : data.trendDelta < 0 ? "text-red-500" : "text-muted-foreground";

  return (
    <div className="rounded-xl border border-border/60 bg-card/50 p-4 space-y-3">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tasso Risposta</h3>

      <div className="flex items-end gap-3">
        <span className="text-3xl font-bold text-foreground">{data.globalRate}%</span>
        <div className={cn("flex items-center gap-1 text-xs font-medium pb-1", trendColor)}>
          <TrendIcon className="w-3.5 h-3.5" />
          {data.trendDelta > 0 ? "+" : ""}{data.trendDelta}%
        </div>
      </div>

      <div className="space-y-2">
        {data.channels.map(ch => (
          <div key={ch.channel} className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground capitalize">{ch.channel}</span>
              <span className="font-medium text-foreground">{ch.rate}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${Math.min(ch.rate, 100)}%`, backgroundColor: ch.color }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
