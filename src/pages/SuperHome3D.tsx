import { useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Radar, Network, Users, CalendarCheck, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { HomeAIPrompt } from "@/components/home/HomeAIPrompt";
import { OperativeBriefing } from "@/components/home/OperativeBriefing";
import { AgentStatusPanel } from "@/components/home/AgentStatusPanel";
import { OperativeMetricsGrid } from "@/components/home/OperativeMetricsGrid";
import { SmartActions } from "@/components/home/SmartActions";
import { useAllActivities } from "@/hooks/useActivities";
import { useDownloadJobs } from "@/hooks/useDownloadJobs";
import { useProspectStats } from "@/hooks/useProspectStats";
import { useCockpitContacts } from "@/hooks/useCockpitContacts";
import { useDailyBriefing, type BriefingAction } from "@/hooks/useDailyBriefing";
import { useDashboardOperativeMetrics } from "@/v2/hooks/useDashboardOperativeMetrics";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ActiveJobsWidget } from "@/components/home/ActiveJobsWidget";
import { Suspense, lazy } from "react";
import { queryKeys } from "@/lib/queryKeys";
import { fetchAgentTaskBreakdowns } from "@/v2/io/supabase/queries/dashboard";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const DashboardCharts = lazy(() => import("@/components/analytics/DashboardCharts").then(m => ({ default: m.DashboardCharts })));
const ResponseRateCard = lazy(() => import("@/components/analytics/ResponseRateCard").then(m => ({ default: m.ResponseRateCard })));

function useCount(table: "partners" | "partner_contacts" | "email_drafts") {
  return useQuery({
    queryKey: queryKeys.superHome.count,
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
  { key: "outreach", title: "Outreach", description: "Cockpit AI e invio email", route: "/v2/outreach", icon: Radar },
  { key: "network", title: "Network", description: "Partner e directory", route: "/v2/network", icon: Network },
  { key: "crm", title: "CRM", description: "Prospect e contatti", route: "/v2/crm", icon: Users },
  { key: "agenda", title: "Agenda", description: "Attività e follow-up", route: "/v2/agenda", icon: CalendarCheck },
] as const;

export default function SuperHome3D() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: hasSetup, isLoading: setupLoading } = useQuery({
    queryKey: queryKeys.onboarding.check,
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
  const { data: opMetrics, isLoading: opMetricsLoading } = useDashboardOperativeMetrics();

  const { data: agentBreakdowns } = useQuery({
    queryKey: ["v2", "agent-task-breakdowns"],
    queryFn: async () => {
      const result = await fetchAgentTaskBreakdowns();
      if (result._tag === "Err") return [];
      return result.value;
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const [actionPrompt, setActionPrompt] = useState<string | null>(null);
  const [briefingOpen, setBriefingOpen] = useState(false);

  const readyContacts = useMemo(() => contacts.filter((c) => Boolean(c.email)).length, [contacts]);
  const openActivities = useMemo(() => activities.filter((a) => !["completed", "cancelled"].includes(a.status)).length, [activities]);
  const activeJobs = useMemo(() => jobs.filter((j) => ["pending", "running"].includes(j.status)).length, [jobs]);

  const greeting = new Date().getHours() < 13 ? "Buongiorno" : "Buonasera";

  const statForCard = (key: string) => {
    switch (key) {
      case "outreach": return `${formatCompact(readyContacts)} pronti`;
      case "network": return `${formatCompact(partnerCount)} partner`;
      case "crm": return `${formatCompact(prospectStats?.total ?? 0)} prospect`;
      case "agenda": return `${formatCompact(openActivities)} aperte`;
      default: return "";
    }
  };

  const handleBriefingAction = useCallback((action: BriefingAction) => {
    setActionPrompt(action.prompt);
  }, []);

  if (!setupLoading && hasSetup === false) {
    navigate("/onboarding", { replace: true });
    return null;
  }

  return (
    <div className="h-[calc(100vh-3.5rem)] overflow-hidden bg-background text-foreground">
      <ScrollArea className="h-full">
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-6 sm:px-6">

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

        {/* Metrics bar (compact) */}
        <OperativeMetricsGrid metrics={opMetrics} isLoading={opMetricsLoading} />

        {/* Smart Actions + Agents side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <SmartActions />
            <ActiveJobsWidget jobs={jobs} />
          </div>
          <div className="lg:col-span-3">
            <AgentStatusPanel agents={briefing?.agentStatus ?? []} breakdowns={agentBreakdowns} />
          </div>
        </div>

        {/* Navigation cards */}
        <section className="grid grid-cols-4 gap-2">
          {NAV_CARDS.map((card) => (
            <button
              key={card.key}
              onClick={() => navigate(card.route)}
              className="glass-panel group flex flex-col justify-between rounded-xl border border-border/60 p-3 text-left transition-all hover:border-primary/40 min-h-[90px]"
            >
              <div className="flex items-center justify-between">
                <card.icon className="h-4 w-4 text-foreground/80" />
                <ArrowRight className="h-3 w-3 text-muted-foreground/50 group-hover:text-primary transition-colors" />
              </div>
              <div className="mt-2">
                <div className="text-xs font-semibold text-foreground">{card.title}</div>
                <div className="text-[10px] text-muted-foreground">{card.description}</div>
              </div>
              <div className="mt-1 text-[10px] font-medium text-primary/80">{statForCard(card.key)}</div>
            </button>
          ))}
        </section>

        {/* AI Briefing (collapsible) */}
        <Collapsible open={briefingOpen} onOpenChange={setBriefingOpen}>
          <CollapsibleTrigger className="flex items-center gap-2 w-full text-left px-1 py-1.5 text-xs font-medium text-muted-foreground/60 hover:text-foreground transition-colors">
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", briefingOpen && "rotate-180")} />
            Briefing AI
            {briefingLoading && <span className="text-[10px] ml-1">caricamento…</span>}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <OperativeBriefing
              completed={briefing?.completed}
              todo={briefing?.todo}
              suspended={briefing?.suspended}
              summary={briefing?.summary}
              actions={briefing?.actions ?? []}
              stats={briefing?.stats}
              isLoading={briefingLoading}
              onRefresh={() => qc.invalidateQueries({ queryKey: queryKeys.dailyBriefing.all })}
              onAction={handleBriefingAction}
            />
          </CollapsibleContent>
        </Collapsible>

        {/* Charts */}
        <Suspense fallback={<div className="h-48 animate-pulse bg-muted rounded-lg" />}>
          <DashboardCharts />
        </Suspense>
        <Suspense fallback={<div className="h-32 animate-pulse bg-muted rounded-lg" />}>
          <ResponseRateCard />
        </Suspense>

      </div>
      </ScrollArea>
    </div>
  );
}
