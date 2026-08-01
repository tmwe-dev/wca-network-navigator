/**
 * TokenTrendCard — Card showing trend comparing today vs yesterday, this week vs last week
 */
import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTokenCockpitUser, useTokenTrend } from "@/hooks/useTokenCockpitData";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTokenCount } from "@/lib/tokenFormat";
import { TrendingUp, TrendingDown } from "lucide-react";

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
  const { data: userData } = useTokenCockpitUser();
  const { data: trendData, isLoading } = useTokenTrend(userData?.id);

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
