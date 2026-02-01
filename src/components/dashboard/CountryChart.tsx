import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { usePartnerStats } from "@/hooks/usePartners";
import { Skeleton } from "@/components/ui/skeleton";

const COLORS = [
  "hsl(199, 89%, 48%)",
  "hsl(173, 80%, 40%)",
  "hsl(262, 83%, 58%)",
  "hsl(38, 92%, 50%)",
  "hsl(0, 84%, 60%)",
];

export function CountryChart() {
  const { data: stats, isLoading } = usePartnerStats();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Partners by Country</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const chartData = stats?.countryCounts
    ? Object.entries(stats.countryCounts)
        .map(([code, data]) => ({
          country: data.name,
          code,
          count: data.count,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8)
    : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Partners by Country</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 20 }}>
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="country"
                width={120}
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
                labelStyle={{ fontWeight: 600 }}
                formatter={(value: number) => [`${value} partners`, "Count"]}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {chartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
