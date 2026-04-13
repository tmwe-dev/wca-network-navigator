import { useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Radar, Network, Users, CalendarCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { HomeAIPrompt } from "@/components/home/HomeAIPrompt";
import { OperativeBriefing } from "@/components/home/OperativeBriefing";
import { AgentStatusPanel } from "@/components/home/AgentStatusPanel";
import { useAllActivities } from "@/hooks/useActivities";
import { useDownloadJobs, type DownloadJob } from "@/hooks/useDownloadJobs";
import { useProspectStats } from "@/hooks/useProspectStats";
import { useCockpitContacts } from "@/hooks/useCockpitContacts";
import { useDailyBriefing, type BriefingAction } from "@/hooks/useDailyBriefing";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ActiveJobsWidget } from "@/components/home/ActiveJobsWidget";
import { Suspense, lazy } from "react";

const DashboardCharts = lazy(() => import("@/components/analytics/DashboardCharts").then(m => ({ default: m.DashboardCharts })));
const ResponseRateCard = lazy(() => import("@/components/analytics/ResponseRateCard").then(m => ({ default: m.ResponseRateCard })));

function useCount(table: "partners" | "partner_contacts" | "email_drafts") {
  return useQuery({
    queryKey: ["super-home-count", table],
    queryFn: async () => {
      const { count, error } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 60_000,
  });
}

function formatCompact(value: number) {
  return new Intl.NumberFormat("it-IT", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

const NAV_CARDS = [
  { key: "outreach", title: "Outreach", description: "Cockpit AI, workspace e invio email", route: "/v2/outreach", icon: Radar },
  { key: "network", title: "Network", description: "Rubrica partner e download directory", route: "/v2/network", icon: Network },
  { key: "crm", title: "CRM", description: "Prospect, contatti e opportunità", route: "/v2/crm", icon: Users },
  { key: "agenda", title: "Agenda", description: "Attività, scadenze e follow-up", route: "/v2/agenda", icon: CalendarCheck },
] as const;

export default function SuperHome3D() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: hasSetup, isLoading: setupLoading } = useQuery({
    queryKey: ["onboarding-check"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return true;
      const { data } = await supabase.from("app_settings")
        .select("value").eq("key", "ai_company_name").eq("user_id", user.id).maybeSingle();
      return !!data?.value;
    },
    staleTime: 5 * 60_000,
  });

  const { data: activities = [] } = useAllActivities();
  const { data: jobs = [] } = useDownloadJobs();
  const { data: prospectStats } = useProspectStats();
  const { contacts = [] } = useCockpitContacts();
  const { data: partnerCount = 0 } = useCount("partners");
  const { data: briefing, isLoading: briefingLoading } = useDailyBriefing();

  const [actionPrompt, setActionPrompt] = useState<string | null>(null);

  const readyContacts = useMemo(() => contacts.filter((c) => Boolean(c.email)).length, [contacts]);
  const openActivities = useMemo(() => activities.filter((a) => !["completed", "cancelled"].includes(a.status)).length, [activities]);
  const activeJobs = useMemo(() => jobs.filter((j) => ["pending", "running"].includes(j.status)).length, [jobs]);

  const greeting = new Date().getHours() < 13 ? "Buongiorno" : "Buonasera";

  const statForCard = (key: string) => {
    switch (key) {
      case "outreach": return `${formatCompact(readyContacts)} contatti pronti`;
      case "network": return `${formatCompact(partnerCount)} partner`;
      case "crm": return `${formatCompact(prospectStats?.total ?? 0)} prospect`;
      case "agenda": return `${formatCompact(openActivities)} attività aperte`;
      default: return "";
    }
  };

  const signals = useMemo(() => {
    const s: { label: string; value: string }[] = [];
    if (activeJobs > 0) s.push({ label: "Job download attivi", value: String(activeJobs) });
    if (readyContacts > 0) s.push({ label: "Contatti pronti all'outreach", value: formatCompact(readyContacts) });
    if (openActivities > 0) s.push({ label: "Attività aperte", value: formatCompact(openActivities) });
    return s;
  }, [activeJobs, readyContacts, openActivities]);

  const handleBriefingAction = useCallback((action: BriefingAction) => {
    setActionPrompt(action.prompt);
  }, []);

  // Redirect to onboarding if not set up
  if (!setupLoading && hasSetup === false) {
    navigate("/onboarding", { replace: true });
    return null;
  }

  return (
    <div className="h-[calc(100vh-3.5rem)] overflow-hidden bg-background text-foreground">
      <ScrollArea className="h-full">
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">

        {/* Greeting + AI Prompt */}
        <section className="space-y-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {greeting}. <span className="text-muted-foreground">Cosa vuoi fare oggi?</span>
          </h1>
          <HomeAIPrompt
            systemStats={{ activeJobs, pendingActivities: openActivities, totalPartners: partnerCount }}
            briefingActions={briefing?.actions}
            agents={briefing?.agentStatus}
            externalPrompt={actionPrompt}
            onExternalPromptConsumed={() => setActionPrompt(null)}
          />
        </section>

        {/* Command Center: Briefing + Agents side by side on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3">
            <OperativeBriefing
              completed={briefing?.completed}
              todo={briefing?.todo}
              suspended={briefing?.suspended}
              summary={briefing?.summary}
              actions={briefing?.actions ?? []}
              stats={briefing?.stats}
              isLoading={briefingLoading}
              onRefresh={() => qc.invalidateQueries({ queryKey: ["daily-briefing"] })}
              onAction={handleBriefingAction}
            />
          </div>
          <div className="lg:col-span-2">
            <AgentStatusPanel agents={briefing?.agentStatus ?? []} />
          </div>
        </div>

        {/* Active downloads */}
        <ActiveJobsWidget jobs={jobs} />

        {/* Charts */}
        <Suspense fallback={<div className="h-48 animate-pulse bg-muted rounded-lg" />}>
          <DashboardCharts />
        </Suspense>

        {/* Response Rate */}
        <Suspense fallback={<div className="h-32 animate-pulse bg-muted rounded-lg" />}>
          <ResponseRateCard />
        </Suspense>

        {/* Navigation cards */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {NAV_CARDS.map((card) => (
            <button
              key={card.key}
              onClick={() => navigate(card.route)}
              className={cn(
                "glass-panel group flex flex-col justify-between rounded-xl border border-border/60 p-4 text-left transition-all hover:border-primary/40 hover:shadow-[0_0_20px_hsl(var(--primary)/0.1)]",
                "min-h-[130px]"
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
              <div className="mt-2 text-xs font-medium text-primary/80">{statForCard(card.key)}</div>
            </button>
          ))}
        </section>

      </div>
      </ScrollArea>
    </div>
  );
}
