import { useMemo, useState } from "react";
import { sanitizeHtml } from "@/lib/security/htmlSanitizer";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Clock, AlertTriangle, Loader2, ListTodo, ChevronDown, CalendarIcon, StickyNote } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { EmptyState } from "@/components/shared/EmptyState";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { updateActivitySchedule, logAuditEntry } from "@/data/outreachPipeline";
import { queryKeys } from "@/lib/queryKeys";
import { TabIntroBanner } from "./TabIntroBanner";
import { OutreachRow } from "./shared/OutreachRow";
import { resolveActionKind } from "./shared/ActionIcon";
import { resolveSource } from "./shared/SourcePill";

type Activity = Database["public"]["Tables"]["activities"]["Row"];

export function AttivitaTab() {
  const qc = useQueryClient();
  const { filters: gf } = useGlobalFilters();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [rescheduleDate, setRescheduleDate] = useState<Date | undefined>();

  // Local filter state
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  const searchTerm = gf.search || "";

  const { data: activities, isLoading } = useQuery({
    queryKey: queryKeys.activities.outreach(),
    queryFn: async () => {
      const { data } = await supabase
        .from("activities")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      return data || [];
    },
  });

  const all: Activity[] = activities || [];

  const filtered = useMemo(() => {
    let result = all;
    if (statusFilter !== "all") result = result.filter(a => a.status === statusFilter);
    if (typeFilter !== "all") result = result.filter(a => a.activity_type === typeFilter);
    if (priorityFilter !== "all") result = result.filter(a => a.priority === priorityFilter);
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      result = result.filter(a =>
        a.title.toLowerCase().includes(q) ||
        (a.description && a.description.toLowerCase().includes(q))
      );
    }
    return result;
  }, [all, statusFilter, typeFilter, priorityFilter, searchTerm]);

  const stats = {
    total: all.length,
    pending: all.filter((a) => a.status === "pending").length,
    in_progress: all.filter((a) => a.status === "in_progress").length,
    completed: all.filter((a) => a.status === "completed").length,
  };

  const priorityColor = (p: string) => {
    if (p === "high" || p === "urgent") return "text-destructive";
    if (p === "medium") return "text-primary";
    return "text-muted-foreground";
  };

  const statusConfig: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
    pending: { label: "In attesa", color: "text-primary", bg: "bg-primary/15", icon: Clock },
    in_progress: { label: "In corso", color: "text-primary", bg: "bg-primary/15", icon: AlertTriangle },
    completed: { label: "Completata", color: "text-emerald-500", bg: "bg-emerald-500/15", icon: CheckCircle2 },
    approved: { label: "Approvata", color: "text-emerald-500", bg: "bg-emerald-500/15", icon: CheckCircle2 },
    cancelled: { label: "Annullata", color: "text-destructive", bg: "bg-destructive/15", icon: AlertTriangle },
  };

  const handleToggle = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
    setNoteText("");
    setRescheduleDate(undefined);
  };

  const handleComplete = async (id: string) => {
    try {
      const { error } = await supabase.from("activities")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: queryKeys.activities.outreach() });
      toast.success("Attività completata");
    } catch { toast.error("Errore"); }
  };

  const handleSaveNote = async (id: string) => {
    if (!noteText.trim()) return;
    try {
      const { error } = await supabase.from("activities")
        .update({ description: noteText.trim() })
        .eq("id", id);
      if (error) throw error;
      await logAuditEntry({ action_category: "activity_updated", action_detail: `Nota aggiunta`, decision_origin: "manual", target_type: "activity", target_id: id });
      qc.invalidateQueries({ queryKey: queryKeys.activities.outreach() });
      toast.success("Nota salvata");
      setNoteText("");
    } catch { toast.error("Errore salvataggio nota"); }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TabIntroBanner
        id="attivita"
        icon={ListTodo}
        title="Attività"
        purpose="Diario di bordo. Ogni email partita, chiamata fatta, meeting fissato, follow‑up dovuto. Per capire cosa hai fatto e cosa ti resta da fare."
        origin="Cockpit, agenti AI, campagne, azioni manuali"
        actions="Filtrare per tipo/stato, completare, riprogrammare, aggiungere note"
        tone="neutral"
      />
      {/* Stats header */}
      <div className="shrink-0 px-4 py-2 border-b border-border/40 flex items-center gap-2">
        <ListTodo className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-semibold">Attività</span>
        <div className="flex items-center gap-1.5 ml-auto">
          <Badge variant="outline" className="text-[9px] px-1.5 h-4">{stats.total} totali</Badge>
          <Badge variant="outline" className="text-[9px] px-1.5 h-4 text-primary border-primary/30">{stats.pending} attesa</Badge>
          <Badge variant="outline" className="text-[9px] px-1.5 h-4 text-emerald-500 border-emerald-500/30">{stats.completed} fatte</Badge>
        </div>
      </div>

      {/* Filter bar */}
      <div className="shrink-0 px-4 py-1.5 border-b border-border/30 flex items-center gap-2 flex-wrap">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-7 w-[120px] text-[11px]"><SelectValue placeholder="Stato" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti gli stati</SelectItem>
            <SelectItem value="pending">In attesa</SelectItem>
            <SelectItem value="in_progress">In corso</SelectItem>
            <SelectItem value="completed">Completata</SelectItem>
            <SelectItem value="approved">Approvata</SelectItem>
            <SelectItem value="cancelled">Annullata</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-7 w-[120px] text-[11px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti i tipi</SelectItem>
            <SelectItem value="send_email">Email</SelectItem>
            <SelectItem value="phone_call">Telefono</SelectItem>
            <SelectItem value="meeting">Meeting</SelectItem>
            <SelectItem value="follow_up">Follow-up</SelectItem>
            <SelectItem value="other">Altro</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="h-7 w-[110px] text-[11px]"><SelectValue placeholder="Priorità" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte</SelectItem>
            <SelectItem value="high">Alta</SelectItem>
            <SelectItem value="medium">Media</SelectItem>
            <SelectItem value="low">Bassa</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="outline" className="text-[10px] h-5">{filtered.length} risultati</Badge>
      </div>

      {/* List */}
      <ScrollArea className="flex-1 min-h-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title={statusFilter === "all" && typeFilter === "all" ? "Nessuna attività" : "Nessuna attività con questi filtri"}
            description="Le attività verranno create automaticamente quando lavori dal Cockpit"
          />
        ) : (
          <div className="p-2 space-y-1.5">
            {filtered.map((item) => {
              const sc = statusConfig[item.status] || statusConfig.pending;
              const isOverdue = !!(item.due_date && new Date(item.due_date) < new Date() && item.status !== "completed");
              const isExpanded = expandedId === item.id;
              const isAI = !!item.executed_by_agent_id;
              const partner = (item as unknown as { partners?: { company_name?: string; country?: string } }).partners;
              const meta = (item as unknown as { source_meta?: Record<string, unknown> }).source_meta || {};
              const contactEmail = String((meta as Record<string, string>).email || (meta as Record<string, string>).recipient_email || "");
              const contactName = String((meta as Record<string, string>).contact_name || (meta as Record<string, string>).recipient_name || "");
              const company = partner?.company_name || (meta as Record<string, string>).company_name || item.title;
              const kind = resolveActionKind({
                activityType: item.activity_type,
                direction: item.activity_type?.includes("received") ? "inbound" : "outbound",
                isAi: isAI,
              });
              const source = resolveSource({
                sourceType: item.source_type,
                executedByAgentId: item.executed_by_agent_id,
              });
              const statusLine =
                item.status === "completed" ? "Completata" :
                item.status === "in_progress" ? "In corso" :
                isOverdue ? "Scaduta" :
                item.scheduled_at ? `Programmata` :
                "In attesa";

              return (
                <Collapsible key={item.id} open={isExpanded} onOpenChange={() => handleToggle(item.id)}>
                  <CollapsibleTrigger asChild>
                    <div className={cn(isExpanded && "bg-muted/20 rounded-b-none rounded-lg")}>
                      <OutreachRow
                        companyName={company}
                        contactName={contactName || undefined}
                        contactEmail={contactEmail || undefined}
                        country={partner?.country}
                        subject={item.email_subject || item.title}
                        statusLine={`${sc.label} · ${item.priority.toUpperCase()}`}
                        actionKind={kind}
                        source={source}
                        date={item.due_date || item.scheduled_at || item.created_at}
                        relativeDate={item.due_date || item.scheduled_at || null}
                        relativePrefix={item.due_date ? "scade" : item.scheduled_at ? "parte" : undefined}
                        overdue={isOverdue}
                        onClick={() => handleToggle(item.id)}
                        rightSlot={
                          <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform", isExpanded && "rotate-180")} />
                        }
                      />
                      {/* hidden helpers per evitare unused import */}
                      <span className="hidden">{statusLine}</span>
                    </div>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div className="px-3 pb-3 pt-1 bg-muted/10 rounded-b-lg border-t border-border/20 space-y-3">
                      {/* Email content */}
                      {(item.activity_type === "send_email" || (item.activity_type as string) === "email") && item.email_subject && (
                        <div className="space-y-1">
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase">Email</p>
                          <p className="text-xs font-medium">{item.email_subject}</p>
                          {item.email_body && (
                            <div
                              className="text-xs border rounded-md p-2.5 max-h-[180px] overflow-auto bg-background"
                              dangerouslySetInnerHTML={{ __html: sanitizeHtml(item.email_body) }}
                            />
                          )}
                        </div>
                      )}

                      {/* Description */}
                      {item.description && item.activity_type !== "send_email" && (item.activity_type as string) !== "email" && (
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase">Descrizione</p>
                          <p className="text-xs text-foreground mt-0.5">{item.description}</p>
                        </div>
                      )}

                      {/* Scheduled date */}
                      {item.scheduled_at && (
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <CalendarIcon className="w-3 h-3" />
                          Programmato: {format(new Date(item.scheduled_at), "dd MMM yyyy HH:mm", { locale: it })}
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 pt-1 border-t border-border/20 flex-wrap">
                        {item.status !== "completed" && (
                          <Button size="sm" variant="default" className="h-7 text-[10px] gap-1" onClick={() => handleComplete(item.id)}>
                            <CheckCircle2 className="w-3 h-3" /> Completa
                          </Button>
                        )}

                        {/* Reschedule */}
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1">
                              <CalendarIcon className="w-3 h-3" /> Riprogramma
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={rescheduleDate}
                              onSelect={async (d) => {
                                setRescheduleDate(d);
                                if (d && item.id) {
                                  try {
                                    await updateActivitySchedule(item.id, d.toISOString());
                                    await logAuditEntry({ action_category: "activity_updated", action_detail: `Riprogrammato per ${format(d, "dd MMM yyyy", { locale: it })}`, decision_origin: "manual", target_type: "activity", target_id: item.id });
                                    qc.invalidateQueries({ queryKey: queryKeys.activities.outreach() });
                                    toast.success(`Riprogrammato per ${format(d, "dd MMM yyyy", { locale: it })}`);
                                  } catch { toast.error("Errore salvataggio"); }
                                }
                              }}
                              className="p-3 pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>

                        {/* Add note */}
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1">
                              <StickyNote className="w-3 h-3" /> Aggiungi nota
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-72" align="start">
                            <div className="space-y-2">
                              <p className="text-xs font-semibold">Nota</p>
                              <Textarea
                                value={noteText}
                                onChange={(e) => setNoteText(e.target.value)}
                                placeholder="Scrivi una nota..."
                                className="text-xs min-h-[80px] resize-none"
                              />
                              <Button size="sm" className="w-full h-7 text-xs" onClick={() => handleSaveNote(item.id)}>
                                Salva
                              </Button>
                            </div>
                          </PopoverContent>
                        </Popover>

                        {/* Source badge */}
                        <Badge variant="outline" className="text-[8px] ml-auto h-4">
                          {item.source_type === "ai_agent" ? "🤖 AI" : item.source_type === "campaign" ? "📧 Campagna" : "👤 Manuale"}
                        </Badge>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
