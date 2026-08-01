/**
 * EmailChart — Line chart showing emails sent/received over time
 */
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface EmailChartProps {
  data: Array<{ date: string; sent: number; received: number }>;
  loading?: boolean;
}

export function EmailChart({ data, loading = false }: EmailChartProps) {
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
          Email Inviate e Ricevute
        </h3>
        <p className="text-xs text-muted-foreground">Ultimi 30 giorni</p>
      </div>

      {data.length === 0 ? (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          <p>Nessun dato disponibile</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
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
                if (typeof value === "number") return value.toLocaleString("it-IT");
                return value;
              }}
            />
            <Legend
              wrapperStyle={{ paddingTop: "20px" }}
              iconType="line"
            />
            <Line
              type="monotone"
              dataKey="sent"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              name="Inviate"
              isAnimationActive
            />
            <Line
              type="monotone"
              dataKey="received"
              stroke="#22c55e"
              strokeWidth={2}
              dot={false}
              name="Ricevute"
              isAnimationActive
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
