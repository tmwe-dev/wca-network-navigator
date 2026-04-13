/**
 * ProgrammatiSubTab — Scheduled/future outreach actions (list + calendar toggle)
 */
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Mail, MessageCircle, Linkedin, Phone, Loader2, CalendarIcon, List, LayoutGrid, X, FastForward, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";
import { it } from "date-fns/locale";
import { toast } from "sonner";
import { findScheduledOutreach, cancelMissionAction, updateMissionActionSchedule, logAuditEntry } from "@/data/outreachPipeline";

const CHANNEL_COLORS: Record<string, string> = {
  send_email: "bg-primary/20 border-primary/30 text-primary",
  email: "bg-primary/20 border-primary/30 text-primary",
  send_whatsapp: "bg-emerald-500/20 border-emerald-500/30 text-emerald-500",
  whatsapp: "bg-emerald-500/20 border-emerald-500/30 text-emerald-500",
  linkedin: "bg-blue-500/20 border-blue-500/30 text-blue-400",
  phone: "bg-amber-500/20 border-amber-500/30 text-amber-500",
};

interface ScheduledItem {
  id: string;
  realId: string;
  type: "mission_action" | "pending_action" | "activity";
  email: string;
  label: string;
  channel: string;
  scheduled_at: string;
}

export function ProgrammatiSubTab() {
  const qc = useQueryClient();
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");

  const { data, isLoading } = useQuery({
    queryKey: ["outreach-scheduled"],
    queryFn: findScheduledOutreach,
  });

  const items = useMemo((): ScheduledItem[] => {
    if (!data) return [];
    const result: ScheduledItem[] = [];

    for (const ma of data.missionActions) {
      if (!ma.scheduled_at) continue;
      result.push({
        id: `ma-${ma.id}`, realId: ma.id, type: "mission_action",
        email: (ma.metadata as Record<string, string>)?.email || "",
        label: ma.action_label || (ma.metadata as Record<string, string>)?.company_name || "—",
        channel: ma.action_type, scheduled_at: ma.scheduled_at,
      });
    }
    for (const a of data.activities) {
      if (!a.scheduled_at) continue;
      result.push({
        id: `act-${a.id}`, realId: a.id, type: "activity",
        email: (a as Record<string, unknown>).source_meta ? ((a as Record<string, unknown>).source_meta as Record<string, string>).email || "" : "",
        label: (a.partners as Record<string, string>)?.company_name || a.title,
        channel: a.activity_type, scheduled_at: a.scheduled_at,
      });
    }

    return result.sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  }, [data]);

  const handleCancel = async (item: ScheduledItem) => {
    try {
      if (item.type === "mission_action") await cancelMissionAction(item.realId);
      else if (item.type === "activity") await cancelActivity(item.realId);
      await logAuditEntry({ action_category: "cadence_cancelled", action_detail: `Annullato programmato: ${item.label}`, decision_origin: "manual" });
      qc.invalidateQueries({ queryKey: ["outreach-scheduled"] });
      toast.success("Annullato");
    } catch { toast.error("Errore"); }
  };

  const handleMoveToToday = async (item: ScheduledItem) => {
    try {
      if (item.type === "mission_action") await updateMissionActionSchedule(item.realId, new Date().toISOString());
      else if (item.type === "activity") await updateActivitySchedule(item.realId, new Date().toISOString());
      await logAuditEntry({ action_category: "activity_updated", action_detail: `Anticipato a oggi: ${item.label}`, decision_origin: "manual" });
      qc.invalidateQueries({ queryKey: ["outreach-scheduled"] });
      toast.success("Spostato a oggi");
    } catch { toast.error("Errore"); }
  };

  // Calendar week view
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const isToday = (d: Date) => isSameDay(d, new Date());

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="shrink-0 px-4 py-2 border-b border-border/30 flex items-center gap-2">
        <CalendarIcon className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-medium">Programmati</span>
        <Badge variant="outline" className="text-[10px] h-5">{items.length}</Badge>
        <div className="ml-auto flex items-center gap-0.5 bg-muted/40 rounded-md p-0.5">
          <button className={cn("p-1 rounded text-xs", viewMode === "list" ? "bg-background shadow-sm" : "hover:bg-muted/60")} onClick={() => setViewMode("list")}>
            <List className="w-3.5 h-3.5" />
          </button>
          <button className={cn("p-1 rounded text-xs", viewMode === "calendar" ? "bg-background shadow-sm" : "hover:bg-muted/60")} onClick={() => setViewMode("calendar")}>
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center flex-1"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : viewMode === "list" ? (
        <ScrollArea className="flex-1 min-h-0">
          {items.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Nessuna azione programmata</div>
          ) : (
            <div className="p-2 space-y-1">
              {items.map((item) => {
                const channelColor = CHANNEL_COLORS[item.channel] || CHANNEL_COLORS.email;
                return (
                  <div key={item.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-muted/30 transition-colors">
                    <div className={cn("w-7 h-7 rounded-md flex items-center justify-center shrink-0 border", channelColor)}>
                      <Clock className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-medium text-foreground truncate block">{item.label}</span>
                      {item.email && <span className="text-[10px] text-muted-foreground truncate block">{item.email}</span>}
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {format(new Date(item.scheduled_at), "dd MMM HH:mm", { locale: it })}
                    </span>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => handleMoveToToday(item)} title="Anticipa a oggi">
                      <FastForward className="w-3 h-3 text-primary" />
                    </Button>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0"><CalendarIcon className="w-3 h-3 text-muted-foreground" /></Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="end">
                        <Calendar mode="single" onSelect={async (d) => {
                          if (!d) return;
                          try {
                            if (item.type === "mission_action") await updateMissionActionSchedule(item.realId, d.toISOString());
                            qc.invalidateQueries({ queryKey: ["outreach-scheduled"] });
                            toast.success(`Posticipato a ${format(d, "dd MMM", { locale: it })}`);
                          } catch { toast.error("Errore"); }
                        }} className="p-3 pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => handleCancel(item)}>
                      <X className="w-3 h-3 text-destructive" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      ) : (
        /* Calendar week view */
        <div className="flex-1 min-h-0 overflow-auto p-3">
          <div className="grid grid-cols-7 gap-2 min-h-[300px]">
            {weekDays.map((day) => {
              const dayItems = items.filter((i) => isSameDay(new Date(i.scheduled_at), day));
              return (
                <div key={day.toISOString()} className={cn("rounded-lg border p-2 min-h-[200px]", isToday(day) ? "border-primary/40 bg-primary/5" : "border-border/30 bg-card/30")}>
                  <p className={cn("text-[10px] font-medium mb-2", isToday(day) ? "text-primary" : "text-muted-foreground")}>
                    {format(day, "EEE dd", { locale: it })}
                  </p>
                  <div className="space-y-1">
                    {dayItems.map((item) => {
                      const channelColor = CHANNEL_COLORS[item.channel] || CHANNEL_COLORS.email;
                      return (
                        <div key={item.id} className={cn("px-1.5 py-1 rounded text-[9px] border truncate", channelColor)}>
                          {format(new Date(item.scheduled_at), "HH:mm")} {item.label}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
