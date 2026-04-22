/**
 * PipelineValueChart — Stacked bar chart of deal values by stage
 */
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface PipelineValueChartProps {
  data: Array<{
    stage: string;
    value: number;
    count: number;
  }>;
  loading?: boolean;
}

const STAGE_COLORS: Record<string, string> = {
  lead: "#94a3b8",
  prospect: "#3b82f6",
  qualified: "#0ea5e9",
  negotiation: "#8b5cf6",
  won: "#22c55e",
  lost: "#ef4444",
};

export function PipelineValueChart({ data, loading = false }: PipelineValueChartProps) {
  if (loading) {
    return (
      <Card className="p-4">
        <Skeleton className="h-64 w-full rounded" />
      </Card>
    );
  }

  const totalValue = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <Card className="p-4">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">
          Valore Pipeline per Stadio
        </h3>
        <p className="text-xs text-muted-foreground">
          Totale: {formatCurrency(totalValue)}
        </p>
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
                dataKey="stage"
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
                  if (typeof value === "number") return formatCurrency(value);
                  return value;
                }}
              />
              <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                {data.map((item) => (
                  <Cell
                    key={item.stage}
                    fill={STAGE_COLORS[item.stage] || "#64748b"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Stage breakdown */}
          <div className="mt-4 pt-4 border-t border-border/50">
            <div className="space-y-2">
              {data.map((item) => (
                <div key={item.stage} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: STAGE_COLORS[item.stage] || "#64748b" }}
                    />
                    <span className="text-sm text-muted-foreground capitalize">
                      {item.stage}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-foreground">
                      {formatCurrency(item.value)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.count} {item.count === 1 ? "affare" : "affari"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </Card>
  );
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    notation: value > 999999 ? "compact" : "standard",
    maximumFractionDigits: value > 100 ? 0 : 2,
  }).format(value);
}
