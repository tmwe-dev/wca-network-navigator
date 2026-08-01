/**
 * TokenBudgetGauge — Visual gauge showing daily/monthly budget usage with color coding
 */
import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTokenCockpitUser, useTokenGauge } from "@/hooks/useTokenCockpitData";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTokenCount } from "@/lib/tokenFormat";

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
        <Badge variant={getStatusColor()}>
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
  const { data: userData } = useTokenCockpitUser();
  const { data: gaugeData, isLoading } = useTokenGauge(userData?.id);

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
