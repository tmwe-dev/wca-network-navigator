/**
 * TokenUsageChart — Line chart showing daily token usage over last 30 days
 */
import { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Card } from "@/components/ui/card";
import { useTokenCockpitUser, useTokenSeries } from "@/hooks/useTokenCockpitData";
import { Skeleton } from "@/components/ui/skeleton";


export function TokenUsageChart() {
  const { data: userData } = useTokenCockpitUser();
  const { data: chartData = [], isLoading } = useTokenSeries(userData?.id);

  const chartDataMemoized = useMemo(() => chartData, [chartData]);

  if (isLoading) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 text-foreground">Utilizzo giornaliero (ultimi 30 giorni)</h3>
        <Skeleton className="h-64 w-full" />
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4 text-foreground">Utilizzo giornaliero (ultimi 30 giorni)</h3>
      {chartDataMemoized.length > 0 ? (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartDataMemoized} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="displayDate"
              tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
              interval={Math.floor(chartDataMemoized.length / 6) || 0}
            />
            <YAxis tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--background)",
                border: "1px solid var(--border)",
                borderRadius: "6px",
              }}
              formatter={(value: number) => {
                if (value >= 1000000) return [(value / 1000000).toFixed(1) + "M", "Token"];
                if (value >= 1000) return [(value / 1000).toFixed(1) + "K", "Token"];
                return [value.toString(), "Token"];
              }}
            />
            <Line
              type="monotone"
              dataKey="tokens"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-64 flex items-center justify-center text-muted-foreground">
          Nessun dato disponibile
        </div>
      )}
    </Card>
  );
}
