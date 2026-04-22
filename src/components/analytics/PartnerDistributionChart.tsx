/**
 * PartnerDistributionChart — Donut chart of partners by status
 */
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface PartnerDistributionChartProps {
  data: Array<{ name: string; value: number }>;
  loading?: boolean;
}

const COLORS = [
  "#3b82f6", // blue
  "#22c55e", // emerald
  "#f59e0b", // amber
  "#8b5cf6", // violet
  "#ef4444", // red
  "#ec4899", // pink
];

export function PartnerDistributionChart({
  data,
  loading = false,
}: PartnerDistributionChartProps) {
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
          Distribuzione Partner per Stato
        </h3>
        <p className="text-xs text-muted-foreground">Composizione attuale</p>
      </div>

      {data.length === 0 ? (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          <p>Nessun dato disponibile</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              dataKey="value"
              isAnimationActive
            >
              {data.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
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
              layout="horizontal"
              align="center"
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
