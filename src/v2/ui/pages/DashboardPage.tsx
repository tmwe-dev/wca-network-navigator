/**
 * DashboardPage — Live metrics, module navigation, recent activity feed
 */
import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthV2 } from "@/v2/hooks/useAuthV2";
import { useDashboardMetrics } from "@/v2/hooks/useDashboardMetrics";
import { StatCard } from "../molecules/StatCard";
import { StatusBadge } from "../atoms/StatusBadge";
import {
  Globe, Users, Mail, Bot, Megaphone,
  Settings, Activity, FileText, Upload,
  Clock, ArrowRight,
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

  const { data: recentActivities } = useQuery({
    queryKey: ["v2-recent-activities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activities")
        .select("id, title, activity_type, status, created_at, priority")
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: recentEmails } = useQuery({
    queryKey: ["v2-recent-emails"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("channel_messages")
        .select("id, from_address, subject, direction, created_at, read_at")
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {profile?.displayName ? `Ciao, ${profile.displayName}` : "Dashboard"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">WCA Network Navigator v2.0</p>
      </div>

      {/* Module cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {modules.map((mod) => {
          const metricValue = mod.metricKey && metrics ? metrics[mod.metricKey] : undefined;
          return (
            <button key={mod.path + mod.title} onClick={() => navigate(mod.path)} className="text-left">
              <StatCard
                title={mod.title}
                value={isLoading ? "..." : metricValue !== undefined ? `${metricValue.toLocaleString("it-IT")} ${mod.metricLabel ?? ""}` : "→"}
                icon={mod.icon}
                className="hover:border-primary/50 transition-colors cursor-pointer h-full"
              />
            </button>
          );
        })}
      </div>

      {/* Activity feed + recent emails */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent activities */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" /> Attività recenti
            </h3>
            <button onClick={() => navigate("/v2/outreach")} className="text-xs text-primary hover:underline flex items-center gap-1">
              Vedi tutte <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          {recentActivities?.map((a) => (
            <div key={a.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{a.title}</p>
                <p className="text-xs text-muted-foreground">{a.activity_type.replace(/_/g, " ")} • {new Date(a.created_at).toLocaleDateString("it")}</p>
              </div>
              <StatusBadge
                status={a.status === "completed" ? "success" : a.status === "pending" ? "warning" : "info"}
                label={a.status}
              />
            </div>
          ))}
          {!recentActivities?.length ? <p className="text-sm text-muted-foreground py-4 text-center">Nessuna attività recente</p> : null}
        </div>

        {/* Recent emails */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Mail className="h-4 w-4" /> Email recenti
            </h3>
            <button onClick={() => navigate("/v2/inreach")} className="text-xs text-primary hover:underline flex items-center gap-1">
              Vedi tutte <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          {recentEmails?.map((e) => (
            <div key={e.id} className={`flex items-center justify-between p-3 rounded-lg border bg-card ${!e.read_at ? "border-l-4 border-l-primary" : ""}`}>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{e.subject ?? "(Senza oggetto)"}</p>
                <p className="text-xs text-muted-foreground">{e.from_address ?? "—"} • {new Date(e.created_at).toLocaleDateString("it")}</p>
              </div>
              <StatusBadge
                status={e.direction === "inbound" ? "info" : "neutral"}
                label={e.direction === "inbound" ? "↓ In" : "↑ Out"}
              />
            </div>
          ))}
          {!recentEmails?.length ? <p className="text-sm text-muted-foreground py-4 text-center">Nessuna email recente</p> : null}
        </div>
      </div>
    </div>
  );
}
