/**
 * TokenByFunctionPie — Pie chart showing token distribution by function
 */
import { useMemo } from "react";
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from "recharts";
import { Card } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { getFunctionDisplayName } from "@/data/tokenUsage";

interface PieData {
  name: string;
  value: number;
  displayValue: string;
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--secondary))",
  "hsl(var(--accent))",
  "#8b5cf6",
  "#ec4899",
  "#f59e0b",
];

export function TokenByFunctionPie() {
  const { data: userData } = useQuery({
    queryKey: ["user"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession().then(r => ({ data: { user: r.data.session?.user ?? null } }));
      return data.user;
    },
  });

  const { data: pieData = [], isLoading } = useQuery({
    queryKey: ["tokenUsage", "byFunction", userData?.id],
    queryFn: async () => {
      if (!userData?.id) return [];

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data, error } = await supabase
        .from("ai_token_usage")
        .select("function_name, total_tokens")
        .eq("user_id", userData.id)
        .gte("created_at", sevenDaysAgo.toISOString());

      if (error) {
        console.error("Error fetching function breakdown:", error);
        return [];
      }

      // Aggregate by function
      const functionData: Record<string, number> = {};
      for (const row of data || []) {
        const fn = row.function_name || "Altro";
        functionData[fn] = (functionData[fn] || 0) + (row.total_tokens || 0);
      }

      return Object.entries(functionData)
        .map(([fn, tokens]) => ({
          name: getFunctionDisplayName(fn),
          value: tokens,
          displayValue: tokens >= 1000000 ? (tokens / 1000000).toFixed(1) + "M" : (tokens / 1000).toFixed(1) + "K",
        }))
        .sort((a, b) => b.value - a.value);
    },
    enabled: !!userData?.id,
  });

  const pieDataMemoized = useMemo(() => pieData, [pieData]);

  if (isLoading) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 text-foreground">Token per funzione (ultimi 7 giorni)</h3>
        <Skeleton className="h-64 w-full" />
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4 text-foreground">Token per funzione (ultimi 7 giorni)</h3>
      {pieDataMemoized.length > 0 ? (
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={pieDataMemoized}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, displayValue }) => `${name}: ${displayValue}`}
              outerRadius={100}
              fill="#8884d8"
              dataKey="value"
            >
              {pieDataMemoized.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
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
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-64 flex items-center justify-center text-muted-foreground">
          Nessun dato disponibile
        </div>
      )}
    </Card>
  );
}
