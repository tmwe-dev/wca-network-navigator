/**
 * TokenBudgetGauge — Visual gauge showing daily/monthly budget usage with color coding
 */
import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTokenCount } from "@/data/tokenUsage";

interface GaugeData {
  daily: { used: number; limit: number; percentage: number };
  monthly: { used: number; limit: number; percentage: number };
}

function GaugeBar({ percentage, label, used, limit }: { percentage: number; label: string; used: number; limit: number }) {
  const getColor = () => {
    if (percentage >= 100) return "bg-red-500";
    if (percentage >= 85) return "bg-amber-500";
    return "bg-green-500";
  };

  const getStatusColor = () => {
    if (percentage >= 100) return "destructive";
    if (percentage >= 85) return "secondary";
    return "default";
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <Badge variant={getStatusColor() as any}>
          {percentage.toFixed(1)}%
        </Badge>
      </div>
      <div className="w-full h-4 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${getColor()}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{formatTokenCount(used)} usati</span>
        <span>{formatTokenCount(limit)} limite</span>
      </div>
    </div>
  );
}

export function TokenBudgetGauge() {
  const { data: userData } = useQuery({
    queryKey: ["user"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user;
    },
  });

  const { data: gaugeData, isLoading } = useQuery({
    queryKey: ["tokenUsage", "gauge", userData?.id],
    queryFn: async (): Promise<GaugeData> => {
      if (!userData?.id) {
        return {
          daily: { used: 0, limit: 500000, percentage: 0 },
          monthly: { used: 0, limit: 10000000, percentage: 0 },
        };
      }

      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [{ data: dailyData }, { data: monthlyData }, { data: settingsData }] = await Promise.all([
        supabase
          .from("ai_token_usage")
          .select("total_tokens")
          .eq("user_id", userData.id)
          .gte("created_at", startOfDay.toISOString()),
        supabase
          .from("ai_token_usage")
          .select("total_tokens")
          .eq("user_id", userData.id)
          .gte("created_at", startOfMonth.toISOString()),
        supabase
          .from("app_settings")
          .select("key, value")
          .eq("user_id", userData.id)
          .in("key", ["ai_daily_token_limit", "ai_monthly_token_limit"]),
      ]);

      const dailyUsed = (dailyData || []).reduce((sum, row) => sum + (row.total_tokens || 0), 0);
      const monthlyUsed = (monthlyData || []).reduce((sum, row) => sum + (row.total_tokens || 0), 0);

      const settings = (settingsData || []).reduce((acc, row) => {
        acc[row.key] = row.value ?? "";
        return acc;
      }, {} as Record<string, string>);

      const dailyLimit = parseInt(settings["ai_daily_token_limit"] || "500000", 10);
      const monthlyLimit = parseInt(settings["ai_monthly_token_limit"] || "10000000", 10);

      return {
        daily: { used: dailyUsed, limit: dailyLimit, percentage: (dailyUsed / dailyLimit) * 100 },
        monthly: { used: monthlyUsed, limit: monthlyLimit, percentage: (monthlyUsed / monthlyLimit) * 100 },
      };
    },
    enabled: !!userData?.id,
  });

  const gaugeDataMemoized = useMemo(() => gaugeData, [gaugeData]);

  if (isLoading || !gaugeDataMemoized) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-6 text-foreground">Budget Token</h3>
        <Skeleton className="h-32 w-full" />
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-6 text-foreground">Budget Token</h3>
      <div className="space-y-6">
        <GaugeBar
          label="Utilizzo giornaliero"
          percentage={gaugeDataMemoized.daily.percentage}
          used={gaugeDataMemoized.daily.used}
          limit={gaugeDataMemoized.daily.limit}
        />
        <GaugeBar
          label="Utilizzo mensile"
          percentage={gaugeDataMemoized.monthly.percentage}
          used={gaugeDataMemoized.monthly.used}
          limit={gaugeDataMemoized.monthly.limit}
        />
      </div>
    </Card>
  );
}
