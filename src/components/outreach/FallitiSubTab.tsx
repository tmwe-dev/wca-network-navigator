/**
 * FallitiSubTab — Failed outreach actions with retry controls.
 * @deprecated 2026-04-30 — Non più montato in InUscitaTab. Leggeva da
 * `cockpit_queue` che non è una coda di invio reale. Mantenuto in archivio.
 */
import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, Loader2, RotateCcw, X } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { toast } from "sonner";
import { findFailedOutreach, retryMissionAction, cancelMissionAction, logAuditEntry } from "@/data/outreachPipeline";
import { queryKeys } from "@/lib/queryKeys";

interface FailedItem {
  id: string;
  realId: string;
  type: "mission_action" | "activity";
  email: string;
  label: string;
  channel: string;
  error: string;
  retry_count: number;
  updated_at: string;
}

export function FallitiSubTab() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.outreach.failed(),
    queryFn: findFailedOutreach,
  });

  const items = useMemo((): FailedItem[] => {
    if (!data) return [];
    const result: FailedItem[] = [];

    for (const ma of data.missionActions) {
      result.push({
        id: `ma-${ma.id}`, realId: ma.id, type: "mission_action",
        email: (ma.metadata as Record<string, string>)?.email || "",
        label: ma.action_label || (ma.metadata as Record<string, string>)?.company_name || "—",
        channel: ma.action_type, error: ma.last_error || "Errore sconosciuto",
        retry_count: ma.retry_count || 0, updated_at: ma.updated_at || ma.created_at,
      });
    }
    for (const a of data.activities) {
      result.push({
        id: `act-${a.id}`, realId: a.id, type: "activity",
        email: (a as Record<string, unknown>).source_meta ? ((a as Record<string, unknown>).source_meta as Record<string, string>).email || "" : "",
        label: (a.partners as Record<string, string>)?.company_name || a.title,
        channel: a.activity_type, error: a.description || "Annullato",
        retry_count: 0, updated_at: a.created_at,
      });
    }

    return result.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }, [data]);

  const handleRetry = async (item: FailedItem) => {
    try {
      if (item.type === "mission_action") await retryMissionAction(item.realId);
      await logAuditEntry({ action_category: "activity_updated", action_detail: `Retry: ${item.label}`, decision_origin: "manual" });
      qc.invalidateQueries({ queryKey: queryKeys.outreach.failed() });
      toast.success("Rimesso in coda");
    } catch { toast.error("Errore retry"); }
  };

  const handleDismiss = async (item: FailedItem) => {
    try {
      if (item.type === "mission_action") await cancelMissionAction(item.realId);
      qc.invalidateQueries({ queryKey: queryKeys.outreach.failed() });
      toast.info("Rimosso");
    } catch { toast.error("Errore"); }
  };

  // Stats
  const byChannel = items.reduce((acc, i) => { acc[i.channel] = (acc[i.channel] || 0) + 1; return acc; }, {} as Record<string, number>);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="shrink-0 px-4 py-2 border-b border-border/30 flex items-center gap-2">
        <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
        <span className="text-xs font-medium">Falliti</span>
        <Badge variant="destructive" className="text-[10px] h-5">{items.length}</Badge>
        {Object.entries(byChannel).map(([ch, cnt]) => (
          <Badge key={ch} variant="outline" className="text-[9px] h-4 px-1.5">{ch}: {cnt}</Badge>
        ))}
      </div>

      <ScrollArea className="flex-1 min-h-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Nessun errore — ottimo lavoro!</div>
        ) : (
          <div className="p-2 space-y-1">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-muted/30 transition-colors border border-destructive/10">
                <div className="w-7 h-7 rounded-md bg-destructive/10 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-foreground truncate">{item.label}</span>
                    {item.email && <span className="text-[10px] text-muted-foreground truncate">{item.email}</span>}
                  </div>
                  <p className="text-[10px] text-destructive/80 truncate">{item.error}</p>
                  <div className="flex items-center gap-2 mt-0.5 text-[9px] text-muted-foreground">
                    <span>Tentativi: {item.retry_count}</span>
                    <span>Ultimo: {format(new Date(item.updated_at), "dd MMM HH:mm", { locale: it })}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1 border-primary/20" onClick={() => handleRetry(item)}>
                    <RotateCcw className="w-3 h-3" /> Riprova
                  </Button>
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => handleDismiss(item)}>
                    <X className="w-3 h-3 text-muted-foreground" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
