import { Building2, Globe, Star, Calendar } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { RecentPartners } from "@/components/dashboard/RecentPartners";
import { UpcomingReminders } from "@/components/dashboard/UpcomingReminders";
import { CountryChart } from "@/components/dashboard/CountryChart";
import { TypeChart } from "@/components/dashboard/TypeChart";
import { usePartnerStats } from "@/hooks/usePartners";
import { usePendingReminders } from "@/hooks/useReminders";

const Dashboard = () => {
  const { data: stats, isLoading: statsLoading } = usePartnerStats();
  const { data: reminders } = usePendingReminders();

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
          title="Favorites"
          value="—"
          description="Key partners"
          icon={<Star className="w-6 h-6" />}
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
