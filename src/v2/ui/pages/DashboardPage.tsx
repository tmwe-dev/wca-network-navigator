/**
 * DashboardPage — Home hub with greeting, live metrics, module navigation, activity feed
 */
import * as React from "react";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthV2 } from "@/v2/hooks/useAuthV2";
import { useDashboardMetrics } from "@/v2/hooks/useDashboardMetrics";
import { StatCard } from "../molecules/StatCard";
import { StatusBadge } from "../atoms/StatusBadge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Globe, Users, Mail, Bot, Megaphone, Settings,
  Activity, Upload, Clock, ArrowRight, Gauge,
  Calendar, Radar, Network, Target,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavCard {
  readonly key: string;
  readonly title: string;
  readonly description: string;
  readonly route: string;
  readonly icon: React.ElementType;
  readonly metricKey?: keyof NonNullable<ReturnType<typeof useDashboardMetrics>["data"]>;
  readonly metricLabel?: string;
}

const NAV_CARDS: readonly NavCard[] = [
  { key: "network", title: "Network", description: "Rubrica partner e directory", route: "/v2/network", icon: Globe, metricKey: "partners", metricLabel: "partner" },
  { key: "crm", title: "CRM", description: "Contatti e opportunità", route: "/v2/crm", icon: Users, metricKey: "contacts", metricLabel: "contatti" },
  { key: "outreach", title: "Outreach", description: "Email, attività e follow-up", route: "/v2/outreach", icon: Mail, metricKey: "pendingActivities", metricLabel: "in attesa" },
  { key: "agenda", title: "Agenda", description: "Scadenze e pianificazione", route: "/v2/agenda", icon: Calendar },
  { key: "agents", title: "Agenti AI", description: "Cockpit e missioni", route: "/v2/agents", icon: Bot, metricKey: "activeAgents", metricLabel: "attivi" },
  { key: "campaigns", title: "Campagne", description: "Email marketing e invii", route: "/v2/campaigns", icon: Megaphone, metricKey: "campaignJobs", metricLabel: "in coda" },
  { key: "prospects", title: "Prospect", description: "Pipeline commerciale", route: "/v2/prospects", icon: Target },
  { key: "research", title: "Research", description: "Analisi e scraping", route: "/v2/research", icon: Radar },
];

const QUICK_LINKS: readonly { label: string; path: string; icon: React.ElementType }[] = [
  { label: "Import", path: "/v2/import", icon: Upload },
  { label: "Diagnostica", path: "/v2/diagnostics", icon: Activity },
  { label: "Impostazioni", path: "/v2/settings", icon: Settings },
];

function formatCompact(value: number): string {
  return new Intl.NumberFormat("it-IT", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

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

  const { data: activeJobs } = useQuery({
    queryKey: ["v2-active-download-jobs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("download_jobs")
        .select("id, country_name, status, current_index, total_count")
        .in("status", ["pending", "running"])
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
  });

  const greeting = new Date().getHours() < 13 ? "Buongiorno" : "Buonasera";

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
        {/* Greeting */}
        <section>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {greeting}{profile?.displayName ? `, ${profile.displayName}` : ""}.{" "}
            <span className="text-muted-foreground">Cosa vuoi fare oggi?</span>
          </h1>
        </section>

        {/* Active jobs banner */}
        {activeJobs && activeJobs.length > 0 ? (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            <p className="text-sm text-foreground">
              <span className="font-medium">{activeJobs.length} download attivi</span>
              {" — "}
              {activeJobs.map((j) => `${j.country_name} (${j.current_index}/${j.total_count})`).join(", ")}
            </p>
          </div>
        ) : null}

        {/* Nav cards grid */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {NAV_CARDS.map((card) => {
            const metricValue = card.metricKey && metrics ? metrics[card.metricKey] : undefined;
            return (
              <button
                key={card.key}
                onClick={() => navigate(card.route)}
                className={cn(
                  "group flex flex-col justify-between rounded-xl border border-border/60 bg-card p-4 text-left transition-all hover:border-primary/40 hover:shadow-[0_0_20px_hsl(var(--primary)/0.08)]",
                  "min-h-[120px]",
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="rounded-lg border border-border/60 bg-muted/40 p-2">
                    <card.icon className="h-4 w-4 text-foreground/80" />
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                </div>
                <div className="mt-3 space-y-1">
                  <div className="text-sm font-semibold text-foreground">{card.title}</div>
                  <div className="text-[11px] leading-snug text-muted-foreground">{card.description}</div>
                </div>
                {metricValue !== undefined && !isLoading ? (
                  <div className="mt-2 text-xs font-medium text-primary/80">
                    {formatCompact(metricValue)} {card.metricLabel}
                  </div>
                ) : null}
              </button>
            );
          })}
        </section>

        {/* Quick links */}
        <div className="flex gap-2">
          {QUICK_LINKS.map((link) => (
            <button
              key={link.path}
              onClick={() => navigate(link.path)}
              className="flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <link.icon className="h-3 w-3" />
              {link.label}
            </button>
          ))}
        </div>

        {/* Activity feed + recent emails */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
    </ScrollArea>
  );
}
