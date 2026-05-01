/**
 * InUscitaTab — Redesigned with 4 sub-tabs and real count badges
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Send, CheckCircle2, Calendar, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DaInviareSubTab } from "./DaInviareSubTab";
import { InviatiSubTab } from "./InviatiSubTab";
import { ProgrammatiSubTab } from "./ProgrammatiSubTab";
import { FallitiSubTab } from "./FallitiSubTab";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import { TabIntroBanner } from "./TabIntroBanner";
import { ArrowUpFromLine } from "lucide-react";

interface InUscitaTabProps {
  readonly onNavigate?: (tab: string) => void;
}

export function InUscitaTab({ onNavigate }: InUscitaTabProps = {}) {
  const [sub, setSub] = useState("da-inviare");

  const { data: counts } = useQuery({
    queryKey: queryKeys.outreach.subCounts(),
    queryFn: async () => {
      const [pending, sent, scheduled, failed] = await Promise.all([
        supabase.from("cockpit_queue").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("activities").select("id", { count: "exact", head: true }).eq("status", "completed").eq("activity_type", "send_email"),
        supabase.from("cockpit_queue").select("id", { count: "exact", head: true }).eq("status", "scheduled"),
        supabase.from("cockpit_queue").select("id", { count: "exact", head: true }).eq("status", "failed"),
      ]);
      return {
        pending: pending.count || 0,
        sent: sent.count || 0,
        scheduled: scheduled.count || 0,
        failed: failed.count || 0,
      };
    },
    refetchInterval: 30000,
  });

  const pendingCount = counts?.pending || 0;
  const sentCount = counts?.sent || 0;
  const scheduledCount = counts?.scheduled || 0;
  const failedCount = counts?.failed || 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TabIntroBanner
        id="inuscita"
        icon={ArrowUpFromLine}
        title="In Uscita"
        purpose="Tutto ciò che sta per partire (email/WA/LinkedIn). Niente parte senza la tua autorizzazione."
        origin="Bozze manuali, Cockpit, agenti AI, campagne, sequenze"
        actions="Aprire l'anteprima, autorizzare l'invio, riprogrammare, annullare"
        relatedLink={onNavigate ? { label: "Vedi cadenze in Sequenze", onClick: () => onNavigate("programmazione") } : undefined}
        tone="primary"
      />
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
            <TabsTrigger value="programmati" className="gap-1.5 text-xs h-7">
              <Calendar className="w-3 h-3" /> Pianificati
              {scheduledCount > 0 && (
                <Badge variant="secondary" className="text-[9px] h-4 min-w-[16px] px-1 ml-1">
                  {scheduledCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="falliti" className="gap-1.5 text-xs h-7">
              <AlertTriangle className="w-3 h-3" /> Falliti
              {failedCount > 0 && (
                <Badge variant="destructive" className="text-[9px] h-4 min-w-[16px] px-1 ml-1">
                  {failedCount}
                </Badge>
              )}
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
