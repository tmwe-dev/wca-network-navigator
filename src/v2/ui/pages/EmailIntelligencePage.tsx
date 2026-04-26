/**
 * EmailIntelligencePage V2 — 4-tab flow: Manual → AI Suggestions → Auto-Classify → Rules
 */
import * as React from "react";
import { Suspense, lazy } from "react";
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
    <div data-testid="page-email-intelligence" className="flex flex-col h-screen overflow-hidden p-3 md:p-4 gap-3">
      <Tabs defaultValue="manual" className="flex-1 flex flex-col overflow-hidden">
        {/* Single header row: title (left) + tabs (right) */}
        <div className="flex items-center justify-between gap-4 flex-shrink-0 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <BrainCircuit className="h-4.5 w-4.5 text-primary" />
            </div>
            <h1 className="text-lg font-bold text-foreground leading-none">Email Intelligence</h1>
          </div>

          <TabsList className="bg-muted/60 border border-border rounded-lg p-1 h-auto gap-0.5 overflow-x-auto">
            <TabsTrigger
              value="manual"
              className="gap-1.5 text-xs px-3 py-1.5 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-border"
            >
              <HandMetal className="h-3.5 w-3.5" />
              Gestione Manuale
              {uncategorizedCount > 0 && <Badge variant="secondary" className="ml-1 h-4 min-w-[1rem] px-1 text-[10px]">{uncategorizedCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger
              value="ai-suggestions"
              className="gap-1.5 text-xs px-3 py-1.5 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-border"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Suggerimenti AI
              {aiSuggestionsCount > 0 && <Badge variant="secondary" className="ml-1 h-4 min-w-[1rem] px-1 text-[10px]">{aiSuggestionsCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger
              value="auto-classify"
              className="gap-1.5 text-xs px-3 py-1.5 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-border"
            >
              <BrainCircuit className="h-3.5 w-3.5" />
              Auto-Classificazione
              {classifyTodayCount > 0 && <Badge variant="secondary" className="ml-1 h-4 min-w-[1rem] px-1 text-[10px]">{classifyTodayCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger
              value="rules"
              className="gap-1.5 text-xs px-3 py-1.5 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-border"
            >
              <Settings2 className="h-3.5 w-3.5" />
              Regole & Azioni
              {activeRulesCount > 0 && <Badge variant="secondary" className="ml-1 h-4 min-w-[1rem] px-1 text-[10px]">{activeRulesCount}</Badge>}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="manual" className="flex-1 mt-3 overflow-hidden min-h-0 data-[state=active]:flex data-[state=active]:flex-col">
          <Suspense fallback={<TabFallback />}><ManualGroupingTab /></Suspense>
        </TabsContent>
        <TabsContent value="ai-suggestions" className="flex-1 mt-3 overflow-hidden min-h-0 data-[state=active]:flex data-[state=active]:flex-col">
          <Suspense fallback={<TabFallback />}><AISuggestionsTab /></Suspense>
        </TabsContent>
        <TabsContent value="auto-classify" className="flex-1 mt-3 overflow-hidden min-h-0 data-[state=active]:flex data-[state=active]:flex-col">
          <Suspense fallback={<TabFallback />}><SmartInboxView /></Suspense>
        </TabsContent>
        <TabsContent value="rules" className="flex-1 mt-3 overflow-hidden min-h-0 data-[state=active]:flex data-[state=active]:flex-col">
          <Suspense fallback={<TabFallback />}><RulesAndActionsTab /></Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
