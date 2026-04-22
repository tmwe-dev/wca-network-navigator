/**
 * AIUsageChart — Bar chart of AI calls by type per day
 */
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface AIUsageChartProps {
  data: Array<{ date: string; calls: number }>;
  byType?: Record<string, number>;
  loading?: boolean;
}

const COLORS = [
  "#3b82f6", // blue
  "#22c55e", // emerald
  "#f59e0b", // amber
  "#8b5cf6", // violet
  "#ec4899", // pink
];

export function AIUsageChart({
  data,
  byType,
  loading = false,
}: AIUsageChartProps) {
  if (loading) {
    return (
      <Card className="p-4">
        <Skeleton className="h-64 w-full rounded" />
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">
          Utilizzo AI
        </h3>
        <p className="text-xs text-muted-foreground">Chiamate giornaliere</p>
      </div>

      {data.length === 0 ? (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          <p>Nessun dato disponibile</p>
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                opacity={0.5}
              />
              <XAxis
                dataKey="date"
                stroke="hsl(var(--muted-foreground))"
                style={{ fontSize: "12px" }}
                tick={{ fill: "hsl(var(--muted-foreground))" }}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                style={{ fontSize: "12px" }}
                tick={{ fill: "hsl(var(--muted-foreground))" }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
                formatter={(value) => {
                  if (typeof value === "number")
                    return value.toLocaleString("it-IT");
                  return value;
                }}
              />
              <Bar dataKey="calls" fill="#3b82f6" radius={[8, 8, 0, 0]}>
                {data.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Type breakdown */}
          {byType && Object.entries(byType).length > 0 && (
            <div className="mt-4 pt-4 border-t border-border/50">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Dettaglio per Tipo
              </p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(byType)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 6)
                  .map(([type, count]) => (
                    <div
                      key={type}
                      className="flex items-center justify-between rounded-lg bg-muted/50 p-2"
                    >
                      <span className="text-xs text-muted-foreground truncate">
                        {type}
                      </span>
                      <span className="text-xs font-semibold text-foreground ml-2">
                        {count}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
