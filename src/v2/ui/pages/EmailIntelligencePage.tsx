/**
 * EmailIntelligencePage V2 — 4-tab flow: Manual → AI Suggestions → Auto-Classify → Rules
 */
import * as React from "react";
import { Suspense, lazy, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BrainCircuit, HandMetal, Sparkles, Settings2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { queryKeys } from "@/lib/queryKeys";

const ManualGroupingTab = lazy(() => import("@/components/email-intelligence/ManualGroupingTab"));
const AISuggestionsTab = lazy(() => import("@/components/email-intelligence/AISuggestionsTab"));
const SmartInboxView = lazy(() => import("@/components/email-intelligence/SmartInboxView").then(m => ({ default: m.SmartInboxView })));
const RulesAndActionsTab = lazy(() => import("@/components/email-intelligence/RulesAndActionsTab"));

function TabFallback() {
  return <div className="flex items-center justify-center h-64"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
}

export function EmailIntelligencePage(): React.ReactElement {
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
    queryKey: queryKeys.emailIntel.uncategorizedCount,
    queryFn: async () => {
      const { count } = await supabase
        .from("email_address_rules")
        .select("id", { count: "exact", head: true })
        .is("group_id", null);
      return count ?? 0;
    },
    staleTime: 60_000,
  });

  const { data: aiSuggestionsCount = 0 } = useQuery({
    queryKey: queryKeys.emailIntel.aiSuggestionsCount,
    queryFn: async () => {
      const { count } = await supabase
        .from("email_address_rules")
        .select("id", { count: "exact", head: true })
        .is("group_id", null)
        .not("ai_suggested_group", "is", null)
        .is("ai_suggestion_accepted", null);
      return count ?? 0;
    },
    staleTime: 60_000,
  });

  const { data: classifyTodayCount = 0 } = useQuery({
    queryKey: queryKeys.emailIntel.classifyToday,
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { count } = await supabase
        .from("email_classifications")
        .select("id", { count: "exact", head: true })
        .gte("classified_at", today);
      return count ?? 0;
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
      <Tabs defaultValue="manual" className="flex-1 flex flex-col overflow-hidden">
        {/* Riga unica: titolo a sinistra + tab a destra (recupero verticale) */}
        <div className="flex items-center gap-3 px-3 py-1.5 border-b border-border/40 bg-card/30 flex-shrink-0 flex-wrap">
          <h1 className="text-sm font-semibold text-foreground flex items-center gap-1.5 mr-1">
            <BrainCircuit className="h-4 w-4 text-primary" />
            Email Intelligence
          </h1>
          <TabsList className="bg-transparent border-0 h-auto p-0 gap-0.5">
            <TabsTrigger value="manual" className="gap-1.5 text-xs h-7 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <HandMetal className="h-3.5 w-3.5" />
              Gestione Manuale
              {uncategorizedCount > 0 && <Badge variant="secondary" className="ml-1 h-4 min-w-[1rem] px-1 text-[10px]">{uncategorizedCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="ai-suggestions" className="gap-1.5 text-xs h-7 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Suggerimenti AI
              {aiSuggestionsCount > 0 && <Badge variant="secondary" className="ml-1 h-4 min-w-[1rem] px-1 text-[10px]">{aiSuggestionsCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="auto-classify" className="gap-1.5 text-xs h-7 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <BrainCircuit className="h-3.5 w-3.5" />
              Auto-Classificazione
              {classifyTodayCount > 0 && <Badge variant="secondary" className="ml-1 h-4 min-w-[1rem] px-1 text-[10px]">{classifyTodayCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="rules" className="gap-1.5 text-xs h-7 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Settings2 className="h-3.5 w-3.5" />
              Regole & Azioni
              {activeRulesCount > 0 && <Badge variant="secondary" className="ml-1 h-4 min-w-[1rem] px-1 text-[10px]">{activeRulesCount}</Badge>}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="manual" className="flex-1 mt-0 overflow-hidden min-h-0 data-[state=active]:flex data-[state=active]:flex-col">
          <Suspense fallback={<TabFallback />}><ManualGroupingTab /></Suspense>
        </TabsContent>
        <TabsContent value="ai-suggestions" className="flex-1 mt-0 overflow-hidden min-h-0 data-[state=active]:flex data-[state=active]:flex-col">
          <Suspense fallback={<TabFallback />}><AISuggestionsTab /></Suspense>
        </TabsContent>
        <TabsContent value="auto-classify" className="flex-1 mt-0 overflow-hidden min-h-0 data-[state=active]:flex data-[state=active]:flex-col">
          <Suspense fallback={<TabFallback />}><SmartInboxView /></Suspense>
        </TabsContent>
        <TabsContent value="rules" className="flex-1 mt-0 overflow-hidden min-h-0 data-[state=active]:flex data-[state=active]:flex-col">
          <Suspense fallback={<TabFallback />}><RulesAndActionsTab /></Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
