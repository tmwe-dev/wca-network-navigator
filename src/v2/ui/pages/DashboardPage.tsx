/**
 * DashboardPage — Live metrics + module navigation
 */
import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useAuthV2 } from "@/v2/hooks/useAuthV2";
import { useDashboardMetrics } from "@/v2/hooks/useDashboardMetrics";
import { StatCard } from "../molecules/StatCard";
import {
  Globe, Users, Mail, Bot, Megaphone,
  Settings, Activity, FileText, Upload,
} from "lucide-react";

interface ModuleCard {
  readonly title: string;
  readonly path: string;
  readonly icon: React.ReactNode;
  readonly metricKey?: "partners" | "contacts" | "pendingActivities" | "activeAgents" | "campaignJobs" | "emailDrafts";
  readonly metricLabel?: string;
}

const modules: readonly ModuleCard[] = [
  { title: "Network", path: "/v2/network", icon: <Globe className="h-5 w-5" />, metricKey: "partners", metricLabel: "partner" },
  { title: "CRM", path: "/v2/crm", icon: <Users className="h-5 w-5" />, metricKey: "contacts", metricLabel: "contatti" },
  { title: "Outreach", path: "/v2/outreach", icon: <Mail className="h-5 w-5" />, metricKey: "pendingActivities", metricLabel: "in attesa" },
  { title: "Agenti AI", path: "/v2/agents", icon: <Bot className="h-5 w-5" />, metricKey: "activeAgents", metricLabel: "attivi" },
  { title: "Campagne", path: "/v2/campaigns", icon: <Megaphone className="h-5 w-5" />, metricKey: "campaignJobs", metricLabel: "in coda" },
  { title: "Email Drafts", path: "/v2/outreach", icon: <FileText className="h-5 w-5" />, metricKey: "emailDrafts", metricLabel: "bozze" },
  { title: "Import", path: "/v2/import", icon: <Upload className="h-5 w-5" /> },
  { title: "Diagnostica", path: "/v2/diagnostics", icon: <Activity className="h-5 w-5" /> },
  { title: "Impostazioni", path: "/v2/settings", icon: <Settings className="h-5 w-5" /> },
];

export function DashboardPage(): React.ReactElement {
  const { profile } = useAuthV2();
  const navigate = useNavigate();
  const { data: metrics, isLoading } = useDashboardMetrics();

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {profile?.displayName ? `Ciao, ${profile.displayName}` : "Dashboard"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">WCA Network Navigator v2.0</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {modules.map((mod) => {
          const metricValue = mod.metricKey && metrics
            ? metrics[mod.metricKey]
            : undefined;

          return (
            <button
              key={mod.path + mod.title}
              onClick={() => navigate(mod.path)}
              className="text-left"
            >
              <StatCard
                title={mod.title}
                value={
                  isLoading
                    ? "..."
                    : metricValue !== undefined
                      ? `${metricValue.toLocaleString("it-IT")} ${mod.metricLabel ?? ""}`
                      : "→"
                }
                icon={mod.icon}
                className="hover:border-primary/50 transition-colors cursor-pointer h-full"
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
