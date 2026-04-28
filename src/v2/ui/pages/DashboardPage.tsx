/**
 * DashboardPage V2 — Standalone V1 content migration (NO wrapper)
 */
import { useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Radar, Search, Kanban, Brain, ChevronDown } from "lucide-react";
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

const SmartActions = lazyRetry(() => import("@/components/home/SmartActions").then(m => ({ default: m.SmartActions })));
const OperativeMetricsGrid = lazyRetry(() => import("@/components/home/OperativeMetricsGrid").then(m => ({ default: m.OperativeMetricsGrid })));
const AgentStatusPanel = lazyRetry(() => import("@/components/home/AgentStatusPanel").then(m => ({ default: m.AgentStatusPanel })));
const DashboardCharts = lazyRetry(() => import("@/components/analytics/DashboardCharts").then(m => ({ default: m.DashboardCharts })));
const ResponseRateCard = lazyRetry(() => import("@/components/analytics/ResponseRateCard").then(m => ({ default: m.ResponseRateCard })));
const EmailObservabilityPanel = lazyRetry(() => import("@/v2/ui/components/dashboard/EmailObservabilityPanel").then(m => ({ default: m.EmailObservabilityPanel })));
const SystemDiagnosticsBadge = lazyRetry(() => import("@/v2/ui/components/admin/SystemDiagnosticsBadge").then(m => ({ default: m.SystemDiagnosticsBadge })));

function formatCompact(value: number) {
  return new Intl.NumberFormat("it-IT", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

const NAV_CARDS = [
  { key: "explore",      title: "Esplora",      description: "Network, mappa, ricerca",     route: "/v2/explore",      icon: Search },
  { key: "pipeline",     title: "Pipeline",     description: "Contatti, kanban, agenda",    route: "/v2/pipeline",     icon: Kanban },
  { key: "communicate",  title: "Comunica",     description: "Inbox, outreach, composer",   route: "/v2/communicate",  icon: Radar },
  { key: "intelligence", title: "Intelligence", description: "Agenti, KB, analytics",       route: "/v2/intelligence", icon: Brain },
] as const;

export function DashboardPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: dashData, isLoading: dashLoading } = useDashboardData();
  const { data: jobs = [] } = useDownloadJobs();

  const [briefingOpen, setBriefingOpen] = useState(false);
  const { data: briefing, isLoading: briefingLoading } = useDailyBriefing(briefingOpen);

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
      case "explore":      return `${formatCompact(dashData?.partnerCount ?? 0)} partner`;
      case "pipeline":     return `${formatCompact(dashData?.prospectTotal ?? 0)} prospect`;
      case "communicate":  return `${formatCompact(dashData?.readyContactsCount ?? 0)} pronti`;
      case "intelligence": return `${formatCompact(dashData?.openActivitiesCount ?? 0)} aperte`;
      default: return "";
    }
  };

  const handleBriefingAction = useCallback((action: BriefingAction) => {
    setActionPrompt(action.prompt);
  }, []);

  return (
    <div data-testid="page-dashboard" className="h-full min-h-0 overflow-hidden bg-background text-foreground">
      <ScrollArea className="h-full">
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-6 sm:px-6">

        <section className="space-y-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {greeting}. <span className="text-muted-foreground">Cosa vuoi fare oggi?</span>
          </h1>
          <Suspense fallback={null}>
            <SystemDiagnosticsBadge />
          </Suspense>
          <HomeAIPrompt
            systemStats={{ activeJobs, pendingActivities: dashData?.openActivitiesCount ?? 0, totalPartners: dashData?.partnerCount ?? 0 }}
            briefingActions={briefing?.actions}
            agents={briefing?.agentStatus}
            externalPrompt={actionPrompt}
            onExternalPromptConsumed={() => setActionPrompt(null)}
          />
        </section>

        <Suspense fallback={<Skeleton className="h-16 w-full" />}>
          <SmartActions />
        </Suspense>

        <div className="space-y-1">
          <div className="flex items-center gap-3 flex-wrap px-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Team Agenti</span>
            <Suspense fallback={<Skeleton className="h-5 w-64" />}>
              <OperativeMetricsGrid metrics={dashData?.operativeMetrics ?? undefined} isLoading={dashLoading} />
            </Suspense>
          </div>
          <Suspense fallback={<Skeleton className="h-24 w-full" />}>
            <AgentStatusPanel agents={briefing?.agentStatus ?? []} breakdowns={dashData?.agentBreakdowns} />
          </Suspense>
        </div>

        <ActiveJobsWidget jobs={jobs} />

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

        <DeferredOnVisible placeholder={<div className="h-48 animate-pulse bg-muted rounded-lg" />}>
          <Suspense fallback={<div className="h-48 animate-pulse bg-muted rounded-lg" />}>
            <EmailObservabilityPanel />
          </Suspense>
        </DeferredOnVisible>

      </div>
      </ScrollArea>
    </div>
  );
}
