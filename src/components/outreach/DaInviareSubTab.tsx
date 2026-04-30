/**
 * DaInviareSubTab — Pending outreach items with actions
 */
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Mail, MessageCircle, Linkedin, Phone, Loader2, CalendarIcon, X, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { toast } from "sonner";
import { findPendingOutreach, cancelActivity, cancelMissionAction, cancelPendingAction, cancelCampaignQueueItem, updateActivitySchedule, updateMissionActionSchedule, updateCampaignQueueSchedule, logAuditEntry } from "@/data/outreachPipeline";
import { queryKeys } from "@/lib/queryKeys";

const CHANNEL_ICON: Record<string, typeof Mail> = { send_email: Mail, email: Mail, outreach: Mail, send_whatsapp: MessageCircle, whatsapp: MessageCircle, linkedin: Linkedin, phone: Phone };
const SOURCE_BADGE: Record<string, { label: string; color: string }> = {
  partner: { label: "Manuale", color: "bg-muted text-muted-foreground" },
  ai_agent: { label: "AI", color: "bg-primary/15 text-primary" },
  campaign: { label: "Campagna", color: "bg-blue-500/15 text-blue-400" },
  mission: { label: "Missione", color: "bg-amber-500/15 text-amber-500" },
  cadence: { label: "Cadence", color: "bg-purple-500/15 text-purple-400" },
};

interface UnifiedItem {
  id: string;
  type: "activity" | "mission_action" | "pending_action" | "campaign_queue";
  email: string;
  partner_name: string;
  channel: string;
  subject: string;
  source: string;
  scheduled_at: string | null;
  status: string;
  created_at: string;
}

export function DaInviareSubTab() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [channelFilter, setChannelFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.outreach.pending(),
    queryFn: findPendingOutreach,
  });

  const items = useMemo((): UnifiedItem[] => {
    if (!data) return [];
    const result: UnifiedItem[] = [];

    for (const a of data.activities) {
      result.push({
        id: `act-${a.id}`, type: "activity",
        email: (a as Record<string, unknown>).source_meta ? ((a as Record<string, unknown>).source_meta as Record<string, string>).email || "" : "",
        partner_name: (a.partners as Record<string, string>)?.company_name || "—",
        channel: a.activity_type, subject: a.email_subject || a.title,
        source: a.source_type || "partner", scheduled_at: a.scheduled_at, status: a.status, created_at: a.created_at,
      });
    }
    for (const ma of data.missionActions) {
      result.push({
        id: `ma-${ma.id}`, type: "mission_action",
        email: (ma.metadata as Record<string, string>)?.email || (ma.metadata as Record<string, string>)?.target_email || "",
        partner_name: (ma.metadata as Record<string, string>)?.company_name || ma.action_label || "—",
        channel: ma.action_type, subject: ma.action_label || "",
        source: "mission", scheduled_at: ma.scheduled_at, status: ma.status, created_at: ma.created_at,
      });
    }
    for (const pa of data.pendingActions) {
      result.push({
        id: `pa-${pa.id}`, type: "pending_action",
        email: pa.email_address || "",
        partner_name: (pa.action_payload as Record<string, string>)?.company_name || "—",
        channel: pa.action_type, subject: pa.suggested_content?.slice(0, 80) || pa.reasoning || "",
        source: pa.source || "ai_agent", scheduled_at: null, status: pa.status || "pending", created_at: pa.created_at || "",
      });
    }
    // 4th source: email_campaign_queue (Command-generated + manual campaigns)
    for (const cq of (data.campaignQueue ?? []) as Array<Record<string, unknown>>) {
      result.push({
        id: `cq-${cq.id as string}`, type: "campaign_queue",
        email: (cq.recipient_email as string) || "",
        partner_name: (cq.recipient_name as string) || (cq.recipient_email as string) || "—",
        channel: "send_email",
        subject: (cq.subject as string) || "",
        source: "campaign",
        scheduled_at: (cq.scheduled_at as string | null) ?? null,
        status: (cq.status as string) || "pending",
        created_at: (cq.created_at as string) || "",
      });
    }

    return result.sort((a, b) => {
      if (a.scheduled_at && b.scheduled_at) return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
      if (a.scheduled_at) return -1;
      if (b.scheduled_at) return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [data]);

  const filtered = useMemo(() => {
    let list = items;
    if (channelFilter !== "all") list = list.filter(i => i.channel.includes(channelFilter));
    if (sourceFilter !== "all") list = list.filter(i => i.source === sourceFilter);
    return list;
  }, [items, channelFilter, sourceFilter]);

  const toggleSelect = (id: string) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const handleCancel = async (item: UnifiedItem) => {
    const realId = item.id.split("-").slice(1).join("-");
    try {
      if (item.type === "activity") await cancelActivity(realId);
      else if (item.type === "mission_action") await cancelMissionAction(realId);
      else if (item.type === "pending_action") await cancelPendingAction(realId);
      else await cancelCampaignQueueItem(realId);
      await logAuditEntry({ action_category: "activity_deleted", action_detail: `Annullato: ${item.subject}`, decision_origin: "manual", target_type: item.type === "activity" ? "activity" : "mission" });
      qc.invalidateQueries({ queryKey: queryKeys.outreach.pending() });
      toast.success("Annullato");
    } catch { toast.error("Errore annullamento"); }
  };

  const handleSchedule = async (item: UnifiedItem, date: Date) => {
    const realId = item.id.split("-").slice(1).join("-");
    const isoDate = date.toISOString();
    try {
      if (item.type === "activity") await updateActivitySchedule(realId, isoDate);
      else if (item.type === "mission_action") await updateMissionActionSchedule(realId, isoDate);
      else if (item.type === "campaign_queue") await updateCampaignQueueSchedule(realId, isoDate);
      await logAuditEntry({ action_category: "activity_updated", action_detail: `Riprogrammato per ${format(date, "dd MMM yyyy", { locale: it })}: ${item.subject}`, decision_origin: "manual", target_type: "activity" });
      qc.invalidateQueries({ queryKey: queryKeys.outreach.pending() });
      toast.success(`Programmato per ${format(date, "dd MMM yyyy", { locale: it })}`);
    } catch { toast.error("Errore programmazione"); }
  };

  const handleBulkCancel = async () => {
    for (const id of selected) {
      const item = items.find(i => i.id === id);
      if (item) await handleCancel(item);
    }
    setSelected(new Set());
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Filters + bulk */}
      <div className="shrink-0 px-4 py-2 border-b border-border/30 flex items-center gap-2 flex-wrap">
        <Select value={channelFilter} onValueChange={setChannelFilter}>
          <SelectTrigger className="h-7 w-[110px] text-[11px]"><SelectValue placeholder="Canale" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="whatsapp">WhatsApp</SelectItem>
            <SelectItem value="linkedin">LinkedIn</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="h-7 w-[110px] text-[11px]"><SelectValue placeholder="Sorgente" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte</SelectItem>
            <SelectItem value="partner">Manuale</SelectItem>
            <SelectItem value="mission">Missione</SelectItem>
            <SelectItem value="ai_agent">AI</SelectItem>
            <SelectItem value="campaign">Campagna</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="outline" className="text-[10px] h-5">{filtered.length} in coda</Badge>

        {selected.size > 0 && (
          <div className="flex items-center gap-1.5 ml-auto">
            <Badge className="text-[10px] bg-primary/15 text-primary">{selected.size} sel.</Badge>
            <Button size="sm" variant="destructive" className="h-6 text-[10px] gap-1" onClick={handleBulkCancel}>
              <X className="w-3 h-3" /> Annulla
            </Button>
            <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => setSelected(new Set())}>Deseleziona</Button>
          </div>
        )}
      </div>

      <ScrollArea className="flex-1 min-h-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Nessun invio in attesa</div>
        ) : (
          <div className="p-2 space-y-1">
            {filtered.map((item) => {
              const ChannelIcon = CHANNEL_ICON[item.channel] || Mail;
              const sourceBadge = SOURCE_BADGE[item.source] || SOURCE_BADGE.partner;

              return (
                <div key={item.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-muted/30 transition-colors">
                  <Checkbox checked={selected.has(item.id)} onCheckedChange={() => toggleSelect(item.id)} className="shrink-0" />
                  <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                    <ChannelIcon className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-foreground truncate">{item.partner_name}</span>
                      <span className={cn("text-[8px] px-1.5 py-0.5 rounded-full font-medium", sourceBadge.color)}>{sourceBadge.label}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">{item.email || item.subject}</p>
                  </div>
                  {item.scheduled_at && (
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1 shrink-0">
                      <Clock className="w-3 h-3" />
                      {format(new Date(item.scheduled_at), "dd MMM HH:mm", { locale: it })}
                    </span>
                  )}
                  <div className="flex items-center gap-1 shrink-0">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0"><CalendarIcon className="w-3 h-3 text-muted-foreground" /></Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="end">
                        <Calendar mode="single" onSelect={(d) => d && handleSchedule(item, d)} className="p-3 pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => handleCancel(item)}>
                      <X className="w-3 h-3 text-destructive" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
