import { Building2, Globe, Star, Calendar, UserCheck } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { RecentPartners } from "@/components/dashboard/RecentPartners";
import { UpcomingReminders } from "@/components/dashboard/UpcomingReminders";
import { CountryChart } from "@/components/dashboard/CountryChart";
import { TypeChart } from "@/components/dashboard/TypeChart";
import { usePartnerStats } from "@/hooks/usePartners";
import { usePendingReminders } from "@/hooks/useReminders";
import { useContactCompleteness } from "@/hooks/useContactCompleteness";

const Dashboard = () => {
  const { data: stats, isLoading: statsLoading } = usePartnerStats();
  const { data: reminders } = usePendingReminders();
  const { data: completeness } = useContactCompleteness();

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Welcome to WCA Partners CRM — manage your global logistics network
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Partners"
          value={statsLoading ? "..." : stats?.totalPartners || 0}
          description="Active network members"
          icon={<Building2 className="w-6 h-6" />}
        />
        <StatCard
          title="Countries"
          value={statsLoading ? "..." : stats?.uniqueCountries || 0}
          description="Global coverage"
          icon={<Globe className="w-6 h-6" />}
        />
        <StatCard
          title="Qualità Contatti"
          value={completeness ? `${completeness.global.pct}%` : "..."}
          description={completeness ? `${completeness.global.missingEmail} senza email personale` : "Contatti di valore"}
          icon={<UserCheck className="w-6 h-6" />}
          className={completeness ? (completeness.global.pct >= 60 ? "border-l-2 border-l-emerald-500" : completeness.global.pct >= 30 ? "border-l-2 border-l-amber-500" : "border-l-2 border-l-destructive") : ""}
        />
        <StatCard
          title="Pending Reminders"
          value={reminders?.length || 0}
          description="Tasks due soon"
          icon={<Calendar className="w-6 h-6" />}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <CountryChart />
        <TypeChart />
      </div>

      {/* Lists */}
      <div className="grid gap-6 lg:grid-cols-2">
        <RecentPartners />
        <UpcomingReminders />
      </div>
    </div>
  );
};

export default Dashboard;
