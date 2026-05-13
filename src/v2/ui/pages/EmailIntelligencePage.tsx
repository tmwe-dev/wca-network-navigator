/**
 * EmailIntelligencePage V2 — 4-tab flow: Manual → AI Suggestions → Auto-Classify → Rules
 */
import * as React from "react";
import { Suspense, lazy, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import { cn } from "@/lib/utils";
import { PageTitleHeader } from "@/v2/ui/templates/PageTitleHeader";
import { Brain } from "lucide-react";
import { useMailboxSenderAllowlist } from "@/hooks/useMailboxSenderAllowlist";

const ManualGroupingTab = lazy(() => import("@/components/email-intelligence/ManualGroupingTab"));
const AISuggestionsTab = lazy(() => import("@/components/email-intelligence/AISuggestionsTab"));
const SmartInboxView = lazy(() => import("@/components/email-intelligence/SmartInboxView").then(m => ({ default: m.SmartInboxView })));
const RulesAndActionsTab = lazy(() => import("@/components/email-intelligence/RulesAndActionsTab"));
const FunnemailTab = lazy(() => import("@/components/email-intelligence/FunnemailTab"));
const JobLedgerTab = lazy(() => import("@/components/email-intelligence/JobLedgerTab"));
const RoutingRulesTab = lazy(() => import("@/components/email-intelligence/RoutingRulesTab"));
const ScoutCacheTab = lazy(() => import("@/components/email-intelligence/ScoutCacheTab"));
const EvalSetTab = lazy(() => import("@/components/email-intelligence/EvalSetTab"));
const FunnemailEvalTab = lazy(() => import("@/v2/ui/pages/funnemail-inbox/FunnemailEvalTab").then(m => ({ default: m.FunnemailEvalTab })));

function TabFallback() {
  return <div className="flex items-center justify-center h-64"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
}

export function EmailIntelligencePage(): React.ReactElement {
  // Mailbox attiva: i KPI "Da classificare" / "Suggerimenti AI" devono
  // riferirsi solo ai mittenti della casella corrente, non al totale globale.
  const { allowlist, mailboxKey, activeMailbox } = useMailboxSenderAllowlist();

  useEffect(() => {
    let restoringFromBrowserGesture = false;
    const blockBrowserHistoryGesture = () => {
      if (restoringFromBrowserGesture) {
        restoringFromBrowserGesture = false;
        return;
      }
      if (!window.location.pathname.startsWith("/v2/email-intelligence")) {
        restoringFromBrowserGesture = true;
        window.history.forward();
      }
    };

    window.addEventListener("popstate", blockBrowserHistoryGesture);
    return () => window.removeEventListener("popstate", blockBrowserHistoryGesture);
  }, []);

  // Badge counts
  const { data: uncategorizedCount = 0 } = useQuery({
    queryKey: [...queryKeys.emailIntel.uncategorizedCount, mailboxKey],
    enabled: !!allowlist,
    queryFn: async () => {
      if (!allowlist || allowlist.size === 0) return 0;
      // Carichiamo solo l'email_address (paginato) per intersecare client-side
      // con l'allowlist mailbox-scoped. Le regole restano shared.
      const { data } = await supabase
        .from("email_address_rules")
        .select("email_address")
        .is("group_id", null);
      const seen = new Set<string>();
      for (const r of (data ?? []) as Array<{ email_address: string }>) {
        const k = (r.email_address || "").toLowerCase();
        if (allowlist.has(k)) seen.add(k);
      }
      return seen.size;
    },
    staleTime: 60_000,
  });

  const { data: aiSuggestionsCount = 0 } = useQuery({
    queryKey: [...queryKeys.emailIntel.aiSuggestionsCount, mailboxKey],
    enabled: !!allowlist,
    queryFn: async () => {
      if (!allowlist || allowlist.size === 0) return 0;
      const { data } = await supabase
        .from("email_address_rules")
        .select("email_address")
        .is("group_id", null)
        .not("ai_suggested_group", "is", null)
        .is("ai_suggestion_accepted", null);
      const seen = new Set<string>();
      for (const r of (data ?? []) as Array<{ email_address: string }>) {
        const k = (r.email_address || "").toLowerCase();
        if (allowlist.has(k)) seen.add(k);
      }
      return seen.size;
    },
    staleTime: 60_000,
  });

  const { data: classifyTodayCount = 0 } = useQuery({
    queryKey: queryKeys.emailIntel.classifyToday,
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      // Conta sia la pipeline legacy (email_classifications) sia quella nuova
      // Funnemail (funnemail_decisions) per dare un totale coerente con quanto
      // l'AI ha effettivamente classificato oggi.
      const [legacy, funnemail] = await Promise.all([
        supabase
          .from("email_classifications")
          .select("id", { count: "exact", head: true })
          .gte("classified_at", today),
        supabase
          .from("funnemail_decisions" as unknown as never)
          .select("id", { count: "exact", head: true })
          .gte("created_at", today),
      ]);
      return (legacy.count ?? 0) + (funnemail.count ?? 0);
    },
    staleTime: 60_000,
  });

  const { data: activeRulesCount = 0 } = useQuery({
    queryKey: queryKeys.emailIntel.activeRules,
    queryFn: async () => {
      const { count } = await supabase
        .from("email_address_rules")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true);
      return count ?? 0;
    },
    staleTime: 60_000,
  });

  return (
    <div data-testid="page-email-intelligence" className="flex h-full min-h-0 flex-col overflow-hidden">
      <PageTitleHeader
        icon={Brain}
        title="Email Intelligence"
        subtitle={
          activeMailbox
            ? `mittenti di ${activeMailbox.label}`
            : "classificazione mittenti"
        }
        right={
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <KpiPill label="Da classificare" value={uncategorizedCount} tone="primary" />
            <KpiPill label="Suggerimenti AI" value={aiSuggestionsCount} tone="amber" />
            <KpiPill label="Classificate oggi" value={classifyTodayCount} tone="emerald" />
            <KpiPill label="Regole attive" value={activeRulesCount} tone="muted" />
          </div>
        }
      />

      <Tabs defaultValue="manual" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="h-auto p-0 bg-transparent border-b border-border/40 rounded-none justify-start gap-0.5 px-2 overflow-x-auto flex w-full flex-shrink-0">
          <FlatTabTrigger value="manual">Gestione Manuale</FlatTabTrigger>
          <FlatTabTrigger value="ai-suggestions">Suggerimenti AI</FlatTabTrigger>
          <FlatTabTrigger value="auto-classify">Auto-Classificazione</FlatTabTrigger>
          <FlatTabTrigger value="rules">Regole &amp; Azioni</FlatTabTrigger>
          <FlatTabTrigger value="funnemail">Funnemail</FlatTabTrigger>
          <FlatTabTrigger value="job-ledger">Job Ledger</FlatTabTrigger>
          <FlatTabTrigger value="routing-rules">Routing Rules</FlatTabTrigger>
          <FlatTabTrigger value="scout-cache">Scout Cache</FlatTabTrigger>
          <FlatTabTrigger value="eval-set">Eval Set</FlatTabTrigger>
          <FlatTabTrigger value="eval-accuracy">Eval Accuracy</FlatTabTrigger>
        </TabsList>

        <TabsContent value="manual" className="flex-1 mt-2 overflow-hidden min-h-0 data-[state=active]:flex data-[state=active]:flex-col px-2 md:px-3">
          <Suspense fallback={<TabFallback />}><ManualGroupingTab /></Suspense>
        </TabsContent>
        <TabsContent value="ai-suggestions" className="flex-1 mt-2 overflow-hidden min-h-0 data-[state=active]:flex data-[state=active]:flex-col px-2 md:px-3">
          <Suspense fallback={<TabFallback />}><AISuggestionsTab /></Suspense>
        </TabsContent>
        <TabsContent value="auto-classify" className="flex-1 mt-2 overflow-hidden min-h-0 data-[state=active]:flex data-[state=active]:flex-col px-2 md:px-3">
          <Suspense fallback={<TabFallback />}><SmartInboxView /></Suspense>
        </TabsContent>
        <TabsContent value="rules" className="flex-1 mt-2 overflow-hidden min-h-0 data-[state=active]:flex data-[state=active]:flex-col px-2 md:px-3">
          <Suspense fallback={<TabFallback />}><RulesAndActionsTab /></Suspense>
        </TabsContent>
        <TabsContent value="funnemail" className="flex-1 mt-2 overflow-hidden min-h-0 data-[state=active]:flex data-[state=active]:flex-col px-2 md:px-3">
          <Suspense fallback={<TabFallback />}><FunnemailTab /></Suspense>
        </TabsContent>
        <TabsContent value="job-ledger" className="flex-1 mt-2 overflow-hidden min-h-0 data-[state=active]:flex data-[state=active]:flex-col px-2 md:px-3">
          <Suspense fallback={<TabFallback />}><JobLedgerTab /></Suspense>
        </TabsContent>
        <TabsContent value="routing-rules" className="flex-1 mt-2 overflow-hidden min-h-0 data-[state=active]:flex data-[state=active]:flex-col px-2 md:px-3">
          <Suspense fallback={<TabFallback />}><RoutingRulesTab /></Suspense>
        </TabsContent>
        <TabsContent value="scout-cache" className="flex-1 mt-2 overflow-hidden min-h-0 data-[state=active]:flex data-[state=active]:flex-col px-2 md:px-3">
          <Suspense fallback={<TabFallback />}><ScoutCacheTab /></Suspense>
        </TabsContent>
        <TabsContent value="eval-set" className="flex-1 mt-2 overflow-hidden min-h-0 data-[state=active]:flex data-[state=active]:flex-col px-2 md:px-3">
          <Suspense fallback={<TabFallback />}><EvalSetTab /></Suspense>
        </TabsContent>
        <TabsContent value="eval-accuracy" className="flex-1 mt-2 overflow-hidden min-h-0 data-[state=active]:flex data-[state=active]:flex-col px-2 md:px-3">
          <Suspense fallback={<TabFallback />}><FunnemailEvalTab /></Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------- helpers locali (presentational) ---------- */

function FlatTabTrigger({
  value,
  children,
}: {
  value: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <TabsTrigger
      value={value}
      className={cn(
        "relative px-3 py-2 text-xs font-medium rounded-none whitespace-nowrap",
        "bg-transparent border-0 shadow-none",
        "text-muted-foreground hover:text-foreground transition-colors",
        "data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none",
        "data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-2 data-[state=active]:after:right-2",
        "data-[state=active]:after:h-0.5 data-[state=active]:after:bg-primary data-[state=active]:after:rounded-full",
      )}
    >
      {children}
    </TabsTrigger>
  );
}

function KpiPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "primary" | "amber" | "emerald" | "muted";
}): React.ReactElement {
  const toneCls = {
    primary: "text-primary",
    amber: "text-warning dark:text-warning",
    emerald: "text-success dark:text-success",
    muted: "text-muted-foreground",
  }[tone];
  return (
    <span className="inline-flex items-baseline gap-1 whitespace-nowrap">
      <span className={cn("font-semibold tabular-nums", toneCls)}>
        {value.toLocaleString("it-IT")}
      </span>
      <span className="text-muted-foreground/80">{label}</span>
    </span>
  );
}
