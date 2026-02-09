import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { usePartnerStats } from "@/hooks/usePartners";
import { useContactCompleteness } from "@/hooks/useContactCompleteness";
import { Skeleton } from "@/components/ui/skeleton";

const COLORS = [
  "hsl(199, 89%, 48%)",
  "hsl(173, 80%, 40%)",
  "hsl(262, 83%, 58%)",
  "hsl(38, 92%, 50%)",
  "hsl(0, 84%, 60%)",
];

function QualityDot({ pct }: { pct: number }) {
  const color = pct >= 60 ? "bg-emerald-500" : pct >= 30 ? "bg-amber-500" : "bg-red-500";
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${color}`} title={`${pct}% con email personale`} />
  );
}

export function CountryChart() {
  const { data: stats, isLoading } = usePartnerStats();
  const { data: completeness } = useContactCompleteness();

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
        .map(([code, data]) => {
          const cStats = completeness?.byCountry[code];
          const emailPct = cStats && cStats.total_partners > 0
            ? Math.round((cStats.with_personal_email / cStats.total_partners) * 100)
            : 0;
          return {
            country: data.name,
            code,
            count: data.count,
            emailPct,
          };
        })
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
                formatter={(value: number, name: string) => {
                  if (name === "count") return [`${value} partners`, "Totale"];
                  return [`${value}%`, "Email personale"];
                }}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {chartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        {/* Quality summary per country */}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
          {chartData.map((c) => (
            <div key={c.code} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <QualityDot pct={c.emailPct} />
              <span>{c.code}</span>
              <span className="font-mono">{c.emailPct}%</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}