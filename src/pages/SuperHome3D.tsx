import { useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Radar, Network, Users, CalendarCheck, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { HomeAIPrompt } from "@/components/home/HomeAIPrompt";
import { OperativeBriefing } from "@/components/home/OperativeBriefing";
import { useDownloadJobs } from "@/hooks/useDownloadJobs";
import { useDailyBriefing, type BriefingAction } from "@/hooks/useDailyBriefing";
import { useDashboardData } from "@/v2/hooks/useDashboardData";
import { useQueryClient } from "@tanstack/react-query";
import { ActiveJobsWidget } from "@/components/home/ActiveJobsWidget";
import { Suspense } from "react";
import { lazyRetry } from "@/lib/lazyRetry";
import { Skeleton } from "@/components/ui/skeleton";
import { queryKeys } from "@/lib/queryKeys";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DeferredOnVisible } from "@/components/shared/DeferredOnVisible";

// ⚡ Perf: lazy-load widget pesanti per alleggerire il bundle iniziale della Dashboard.
// lazyRetry → resilient ai fallimenti intermittenti del proxy Preview di Lovable.
const SmartActions = lazyRetry(() => import("@/components/home/SmartActions").then(m => ({ default: m.SmartActions })));
const OperativeMetricsGrid = lazyRetry(() => import("@/components/home/OperativeMetricsGrid").then(m => ({ default: m.OperativeMetricsGrid })));
const AgentStatusPanel = lazyRetry(() => import("@/components/home/AgentStatusPanel").then(m => ({ default: m.AgentStatusPanel })));
const DashboardCharts = lazyRetry(() => import("@/components/analytics/DashboardCharts").then(m => ({ default: m.DashboardCharts })));
const ResponseRateCard = lazyRetry(() => import("@/components/analytics/ResponseRateCard").then(m => ({ default: m.ResponseRateCard })));

function formatCompact(value: number) {
  return new Intl.NumberFormat("it-IT", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

const NAV_CARDS = [
  { key: "outreach", title: "Outreach", description: "Cockpit AI e invio email", route: "/v2/outreach", icon: Radar },
  { key: "network", title: "Network", description: "Partner e directory", route: "/v2/network", icon: Network },
  { key: "crm", title: "CRM", description: "Prospect e contatti", route: "/v2/crm", icon: Users },
  { key: "agenda", title: "Agenda", description: "Attività e follow-up", route: "/v2/outreach/agenda", icon: CalendarCheck },
] as const;

export default function SuperHome3D() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  // Single consolidated query for all dashboard data
  const { data: dashData, isLoading: dashLoading } = useDashboardData();

  const { data: jobs = [] } = useDownloadJobs();

  // Briefing deferred — edge function (LLM call, ~2-5s) only runs when user opens the section.
  const [briefingOpen, setBriefingOpen] = useState(false);
  const { data: briefing, isLoading: briefingLoading } = useDailyBriefing(briefingOpen);
  // Note: useDailyBriefing has staleTime=15min so it won't refetch if already cached.

  const [actionPrompt, setActionPrompt] = useState<string | null>(null);

  const activeJobs = useMemo(() => jobs.filter((j) => ["pending", "running"].includes(j.status)).length, [jobs]);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 13) return "Buongiorno";
    if (h < 18) return "Buon pomeriggio";
    return "Buonasera";
  })();

  const statForCard = (key: string) => {
    switch (key) {
      case "outreach": return `${formatCompact(dashData?.readyContactsCount ?? 0)} pronti`;
      case "network": return `${formatCompact(dashData?.partnerCount ?? 0)} partner`;
      case "crm": return `${formatCompact(dashData?.prospectTotal ?? 0)} prospect`;
      case "agenda": return `${formatCompact(dashData?.openActivitiesCount ?? 0)} aperte`;
      default: return "";
    }
  };

  const handleBriefingAction = useCallback((action: BriefingAction) => {
    setActionPrompt(action.prompt);
  }, []);

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
            systemStats={{ activeJobs, pendingActivities: dashData?.openActivitiesCount ?? 0, totalPartners: dashData?.partnerCount ?? 0 }}
            briefingActions={briefing?.actions}
            agents={briefing?.agentStatus}
            externalPrompt={actionPrompt}
            onExternalPromptConsumed={() => setActionPrompt(null)}
          />
        </section>

        {/* Smart Actions */}
        <Suspense fallback={<Skeleton className="h-16 w-full" />}>
          <SmartActions />
        </Suspense>

        {/* Team Agenti with inline metrics */}
        <div className="space-y-1">
          <div className="flex items-center gap-3 flex-wrap px-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">👥 Team Agenti</span>
            <Suspense fallback={<Skeleton className="h-5 w-64" />}>
              <OperativeMetricsGrid metrics={dashData?.operativeMetrics ?? undefined} isLoading={dashLoading} />
            </Suspense>
          </div>
          <Suspense fallback={<Skeleton className="h-24 w-full" />}>
            <AgentStatusPanel agents={briefing?.agentStatus ?? []} breakdowns={dashData?.agentBreakdowns} />
          </Suspense>
        </div>

        {/* Active jobs */}
        <ActiveJobsWidget jobs={jobs} />

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

        {/* Charts — deferred until scrolled near viewport (Recharts ~80kb + 4 queries) */}
        <DeferredOnVisible placeholder={<div className="h-48 animate-pulse bg-muted rounded-lg" />}>
          <Suspense fallback={<div className="h-48 animate-pulse bg-muted rounded-lg" />}>
            <DashboardCharts />
          </Suspense>
        </DeferredOnVisible>
        <DeferredOnVisible placeholder={<div className="h-32 animate-pulse bg-muted rounded-lg" />}>
          <Suspense fallback={<div className="h-32 animate-pulse bg-muted rounded-lg" />}>
            <ResponseRateCard />
          </Suspense>
        </DeferredOnVisible>

      </div>
      </ScrollArea>
    </div>
  );
}
