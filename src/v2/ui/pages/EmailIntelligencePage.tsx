/**
 * EmailIntelligencePage V2 — Email Intelligence with 3 tabs
 */
import * as React from "react";
import { Suspense, lazy } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BrainCircuit, Inbox, BookOpen, UserCircle } from "lucide-react";

const SmartInboxView = lazy(() => import("@/components/email-intelligence/SmartInboxView").then(m => ({ default: m.SmartInboxView })));
const AddressRulesManager = lazy(() => import("@/components/email-intelligence/AddressRulesManager").then(m => ({ default: m.AddressRulesManager })));
const SenderProfilesView = lazy(() => import("@/components/email-intelligence/SenderProfilesView").then(m => ({ default: m.SenderProfilesView })));

function TabFallback() {
  return <div className="flex items-center justify-center h-64"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
}

export function EmailIntelligencePage(): React.ReactElement {
  return (
    <div className="flex flex-col h-full p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <BrainCircuit className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Email Intelligence</h1>
          <p className="text-xs text-muted-foreground">Classificazione AI, regole per indirizzo e profili sender</p>
        </div>
      </div>

      <Tabs defaultValue="inbox" className="flex-1 flex flex-col">
        <TabsList className="bg-card/80 backdrop-blur-sm border border-border/50">
          <TabsTrigger value="inbox" className="gap-1.5 text-xs"><Inbox className="h-3.5 w-3.5" />Smart Inbox</TabsTrigger>
          <TabsTrigger value="rules" className="gap-1.5 text-xs"><BookOpen className="h-3.5 w-3.5" />Regole Indirizzi</TabsTrigger>
          <TabsTrigger value="profiles" className="gap-1.5 text-xs"><UserCircle className="h-3.5 w-3.5" />Profili Sender</TabsTrigger>
        </TabsList>
        <TabsContent value="inbox" className="flex-1 mt-4">
          <Suspense fallback={<TabFallback />}><SmartInboxView /></Suspense>
        </TabsContent>
        <TabsContent value="rules" className="flex-1 mt-4">
          <Suspense fallback={<TabFallback />}><AddressRulesManager /></Suspense>
        </TabsContent>
        <TabsContent value="profiles" className="flex-1 mt-4">
          <Suspense fallback={<TabFallback />}><SenderProfilesView /></Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
