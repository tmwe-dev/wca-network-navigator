/**
 * TokenTrendCard — Card showing trend comparing today vs yesterday, this week vs last week
 */
import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTokenCount } from "@/data/tokenUsage";
import { TrendingUp, TrendingDown } from "lucide-react";

interface TrendData {
  today: number;
  yesterday: number;
  thisWeek: number;
  lastWeek: number;
}

function TrendRow({
  label,
  current,
  previous,
}: {
  label: string;
  current: number;
  previous: number;
}) {
  const change = current - previous;
  const changePercent = previous === 0 ? 0 : (change / previous) * 100;
  const isPositive = change >= 0;

  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-b-0">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-foreground">
          {formatTokenCount(current)}
        </span>
        <div className="flex items-center gap-1">
          {isPositive ? (
            <TrendingUp className="h-4 w-4 text-amber-500" />
          ) : (
            <TrendingDown className="h-4 w-4 text-green-500" />
          )}
          <Badge
            variant={isPositive ? "secondary" : "default"}
            className="text-xs"
          >
            {isPositive ? "+" : ""}{changePercent.toFixed(1)}%
          </Badge>
        </div>
      </div>
    </div>
  );
}

export function TokenTrendCard() {
  const { data: userData } = useQuery({
    queryKey: ["user"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user;
    },
  });

  const { data: trendData, isLoading } = useQuery({
    queryKey: ["tokenUsage", "trend", userData?.id],
    queryFn: async (): Promise<TrendData> => {
      if (!userData?.id) {
        return { today: 0, yesterday: 0, thisWeek: 0, lastWeek: 0 };
      }

      const now = new Date();

      // Today
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      // Yesterday
      const startOfYesterday = new Date(startOfToday);
      startOfYesterday.setDate(startOfYesterday.getDate() - 1);
      const endOfYesterday = new Date(startOfToday);

      // This week (Monday to today)
      const startOfThisWeek = new Date(startOfToday);
      startOfThisWeek.setDate(startOfThisWeek.getDate() - startOfThisWeek.getDay() + 1);

      // Last week (Monday to Sunday)
      const startOfLastWeek = new Date(startOfThisWeek);
      startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);
      const endOfLastWeek = new Date(startOfLastWeek);
      endOfLastWeek.setDate(endOfLastWeek.getDate() + 7);

      const [todayRes, yesterdayRes, thisWeekRes, lastWeekRes] = await Promise.all([
        supabase
          .from("ai_token_usage")
          .select("total_tokens")
          .eq("user_id", userData.id)
          .gte("created_at", startOfToday.toISOString()),
        supabase
          .from("ai_token_usage")
          .select("total_tokens")
          .eq("user_id", userData.id)
          .gte("created_at", startOfYesterday.toISOString())
          .lt("created_at", endOfYesterday.toISOString()),
        supabase
          .from("ai_token_usage")
          .select("total_tokens")
          .eq("user_id", userData.id)
          .gte("created_at", startOfThisWeek.toISOString()),
        supabase
          .from("ai_token_usage")
          .select("total_tokens")
          .eq("user_id", userData.id)
          .gte("created_at", startOfLastWeek.toISOString())
          .lt("created_at", endOfLastWeek.toISOString()),
      ]);

      const today = (todayRes.data || []).reduce((sum, row) => sum + (row.total_tokens || 0), 0);
      const yesterday = (yesterdayRes.data || []).reduce((sum, row) => sum + (row.total_tokens || 0), 0);
      const thisWeek = (thisWeekRes.data || []).reduce((sum, row) => sum + (row.total_tokens || 0), 0);
      const lastWeek = (lastWeekRes.data || []).reduce((sum, row) => sum + (row.total_tokens || 0), 0);

      return { today, yesterday, thisWeek, lastWeek };
    },
    enabled: !!userData?.id,
  });

  const trendDataMemoized = useMemo(() => trendData, [trendData]);

  if (isLoading || !trendDataMemoized) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 text-foreground">Tendenza utilizzo</h3>
        <Skeleton className="h-32 w-full" />
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4 text-foreground">Tendenza utilizzo</h3>
      <div>
        <TrendRow
          label="Oggi vs Ieri"
          current={trendDataMemoized.today}
          previous={trendDataMemoized.yesterday}
        />
        <TrendRow
          label="Questa settimana vs Scorsa"
          current={trendDataMemoized.thisWeek}
          previous={trendDataMemoized.lastWeek}
        />
      </div>
    </Card>
  );
}
