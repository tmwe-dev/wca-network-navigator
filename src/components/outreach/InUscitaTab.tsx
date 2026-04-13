/**
 * InUscitaTab — Redesigned with 4 sub-tabs: Da Inviare, Inviati, Programmati, Falliti
 */
import { lazy, Suspense, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Send, CheckCircle2, Calendar, AlertTriangle } from "lucide-react";
import { DaInviareSubTab } from "./DaInviareSubTab";
import { InviatiSubTab } from "./InviatiSubTab";
import { ProgrammatiSubTab } from "./ProgrammatiSubTab";
import { FallitiSubTab } from "./FallitiSubTab";

function TabFallback() {
  return <div className="h-full animate-pulse bg-muted/20 rounded-lg" />;
}

export function InUscitaTab() {
  const [sub, setSub] = useState("da-inviare");

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 px-4 pt-2 pb-1 border-b border-border/40">
        <Tabs value={sub} onValueChange={setSub}>
          <TabsList className="bg-muted/40 h-8">
            <TabsTrigger value="da-inviare" className="gap-1.5 text-xs h-7">
              <Send className="w-3 h-3" /> Da Inviare
            </TabsTrigger>
            <TabsTrigger value="inviati" className="gap-1.5 text-xs h-7">
              <CheckCircle2 className="w-3 h-3" /> Inviati
            </TabsTrigger>
            <TabsTrigger value="programmati" className="gap-1.5 text-xs h-7">
              <Calendar className="w-3 h-3" /> Programmati
            </TabsTrigger>
            <TabsTrigger value="falliti" className="gap-1.5 text-xs h-7">
              <AlertTriangle className="w-3 h-3" /> Falliti
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        {sub === "da-inviare" && <DaInviareSubTab />}
        {sub === "inviati" && <InviatiSubTab />}
        {sub === "programmati" && <ProgrammatiSubTab />}
        {sub === "falliti" && <FallitiSubTab />}
      </div>
    </div>
  );
}
