/**
 * TokenCockpitPage — Token Usage Cockpit Dashboard
 * Grid layout with rich visual dashboards showing token consumption and analytics
 */
import { Suspense } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { TokenUsageChart } from "@/components/token-cockpit/TokenUsageChart";
import { TokenByFunctionPie } from "@/components/token-cockpit/TokenByFunctionPie";
import { TokenBudgetGauge } from "@/components/token-cockpit/TokenBudgetGauge";
import { TokenUsageTable } from "@/components/token-cockpit/TokenUsageTable";
import { TokenTrendCard } from "@/components/token-cockpit/TokenTrendCard";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatTokenCount } from "@/data/tokenUsage";
import { Card } from "@/components/ui/card";
import { BarChart3, Activity, TrendingUp } from "lucide-react";
import { PermissionGate } from "@/components/auth/PermissionGate";

function StatCard({
  icon: Icon,
  label,
  value,
  subtext,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  subtext?: string;
}) {
  return (
    <Card className="p-6">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          {subtext && <p className="text-xs text-muted-foreground mt-2">{subtext}</p>}
        </div>
        <Icon className="h-8 w-8 text-primary opacity-50" />
      </div>
    </Card>
  );
}

function TokenCockpitContent() {
  const { data: userData } = useQuery({
    queryKey: ["user"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession().then(r => ({ data: { user: r.data.session?.user ?? null } }));
      return data.user;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["tokenUsage", "stats", userData?.id],
    queryFn: async () => {
      if (!userData?.id) {
        return { today: 0, month: 0, dailyLimit: 500000, monthlyLimit: 10000000 };
      }

      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [{ data: dailyData }, { data: monthlyData }, { data: settingsData }] = await Promise.all([
        supabase
          .from("ai_token_usage")
          .select("total_tokens")
          .eq("user_id", userData.id)
          .gte("created_at", startOfDay.toISOString()),
        supabase
          .from("ai_token_usage")
          .select("total_tokens")
          .eq("user_id", userData.id)
          .gte("created_at", startOfMonth.toISOString()),
        supabase
          .from("app_settings")
          .select("key, value")
          .eq("user_id", userData.id)
          .in("key", ["ai_daily_token_limit", "ai_monthly_token_limit"]),
      ]);

      const today = (dailyData || []).reduce((sum, row) => sum + (row.total_tokens || 0), 0);
      const month = (monthlyData || []).reduce((sum, row) => sum + (row.total_tokens || 0), 0);

      const settings = (settingsData || []).reduce((acc, row) => {
        if (row.key) acc[row.key] = String(row.value ?? "");
        return acc;
      }, {} as Record<string, string>);

      const dailyLimit = parseInt(settings["ai_daily_token_limit"] || "500000", 10);
      const monthlyLimit = parseInt(settings["ai_monthly_token_limit"] || "10000000", 10);

      return { today, month, dailyLimit, monthlyLimit };
    },
    enabled: !!userData?.id,
  });

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={Activity}
          label="Token oggi"
          value={formatTokenCount(stats?.today || 0)}
          subtext={`di ${formatTokenCount(stats?.dailyLimit || 500000)}`}
        />
        <StatCard
          icon={BarChart3}
          label="Token questo mese"
          value={formatTokenCount(stats?.month || 0)}
          subtext={`di ${formatTokenCount(stats?.monthlyLimit || 10000000)}`}
        />
        <StatCard
          icon={TrendingUp}
          label="Utilizzo medio"
          value={stats && stats.today > 0 ? (stats.today / (stats.dailyLimit || 1) * 100).toFixed(1) + "%" : "0%"}
          subtext="del budget giornaliero"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Suspense fallback={<Skeleton className="h-96 w-full" />}>
          <TokenUsageChart />
        </Suspense>
        <Suspense fallback={<Skeleton className="h-96 w-full" />}>
          <TokenByFunctionPie />
        </Suspense>
      </div>

      {/* Gauge + Trend */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Suspense fallback={<Skeleton className="h-80 w-full" />}>
          <TokenBudgetGauge />
        </Suspense>
        <Suspense fallback={<Skeleton className="h-80 w-full" />}>
          <TokenTrendCard />
        </Suspense>
      </div>

      {/* Table */}
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <TokenUsageTable />
      </Suspense>
    </div>
  );
}

export function TokenCockpitPage() {
  return (
    <PermissionGate permission="analytics.view" fallback={
      <div data-testid="page-token-cockpit" className="h-[calc(100vh-3.5rem)] overflow-hidden bg-background text-foreground">
        <ScrollArea className="h-full">
          <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
            <p className="text-muted-foreground">Non hai il permesso per visualizzare il cockpit dei token.</p>
          </div>
        </ScrollArea>
      </div>
    }>
      <div data-testid="page-token-cockpit" className="h-[calc(100vh-3.5rem)] overflow-hidden bg-background text-foreground">
        <ScrollArea className="h-full">
          <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-foreground">Cockpit Token</h1>
              <p className="text-muted-foreground">
                Monitora l'utilizzo dei token e il consumo del budget AI in tempo reale
              </p>
            </div>

            <Suspense fallback={<Skeleton className="h-96 w-full" />}>
              <TokenCockpitContent />
            </Suspense>
          </div>
        </ScrollArea>
      </div>
    </PermissionGate>
  );
}
