/**
 * InUscitaTab — 2 sotto-tab attivi (Da Inviare, Inviati).
 * 2026-04-30: rimossi sotto-tab "Programmati" e "Falliti" perché leggevano
 * dalla tabella sbagliata (cockpit_queue non è una coda di invio).
 * Componenti ProgrammatiSubTab/FallitiSubTab restano nel codice (deprecati).
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Send, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DaInviareSubTab } from "./DaInviareSubTab";
import { InviatiSubTab } from "./InviatiSubTab";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

export function InUscitaTab() {
  const [sub, setSub] = useState("da-inviare");

  const { data: counts } = useQuery({
    queryKey: queryKeys.outreach.subCounts(),
    queryFn: async () => {
      // Badge contatori riallineati alle stesse fonti dei sotto-tab attivi:
      // - Da Inviare: activities pending send_email + email_campaign_queue pending
      //   (4th source: email Command/Campagne — risolve "9 email Malta invisibili")
      // - Inviati:    activities completed send_email + email_campaign_queue sent
      const [pending, sent, cqPending, cqSent] = await Promise.all([
        supabase.from("activities").select("id", { count: "exact", head: true }).eq("status", "pending").eq("activity_type", "send_email"),
        supabase.from("activities").select("id", { count: "exact", head: true }).eq("status", "completed").eq("activity_type", "send_email"),
        supabase.from("email_campaign_queue").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("email_campaign_queue").select("id", { count: "exact", head: true }).eq("status", "sent"),
      ]);
      return {
        pending: (pending.count || 0) + (cqPending.count || 0),
        sent: (sent.count || 0) + (cqSent.count || 0),
      };
    },
    refetchInterval: 30000,
  });

  const pendingCount = counts?.pending || 0;
  const sentCount = counts?.sent || 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 px-4 pt-2 pb-1 border-b border-border/40 flex items-center justify-between">
        <Tabs value={sub} onValueChange={setSub}>
          <TabsList className="bg-muted/40 h-8">
            <TabsTrigger value="da-inviare" className="gap-1.5 text-xs h-7">
              <Send className="w-3 h-3" /> Da Inviare
              {pendingCount > 0 && (
                <Badge variant="destructive" className="text-[9px] h-4 min-w-[16px] px-1 ml-1">
                  {pendingCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="inviati" className="gap-1.5 text-xs h-7">
              <CheckCircle2 className="w-3 h-3" /> Inviati
              <Badge variant="outline" className="text-[9px] h-4 min-w-[16px] px-1 ml-1">
                {sentCount}
              </Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        {sub === "da-inviare" && <DaInviareSubTab />}
        {sub === "inviati" && <InviatiSubTab />}
      </div>
    </div>
  );
}
