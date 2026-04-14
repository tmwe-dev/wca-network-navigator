/**
 * ContactPipelineView — Kanban pipeline for contact lifecycle tracking.
 * Drag-and-drop updates lead_status in the database.
 */
import * as React from "react";
import { useState, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { UserPlus, Send, Clock, Handshake, Star, Snowflake, ArrowRight, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { queryKeys } from "@/lib/queryKeys";

// ── Stage definitions mapped to lead_status ──
interface Stage {
  id: string;
  label: string;
  icon: React.ReactNode;
  colorClass: string;
  bgClass: string;
  borderClass: string;
}

const STAGES: Stage[] = [
  { id: "new", label: "Nuovo", icon: <UserPlus className="h-3.5 w-3.5" />, colorClass: "text-muted-foreground", bgClass: "bg-muted/30", borderClass: "border-border/40" },
  { id: "contacted", label: "Contattato", icon: <Send className="h-3.5 w-3.5" />, colorClass: "text-blue-400", bgClass: "bg-blue-500/10", borderClass: "border-blue-500/20" },
  { id: "in_progress", label: "In Corso", icon: <Clock className="h-3.5 w-3.5" />, colorClass: "text-yellow-400", bgClass: "bg-yellow-500/10", borderClass: "border-yellow-500/20" },
  { id: "negotiation", label: "Trattativa", icon: <Handshake className="h-3.5 w-3.5" />, colorClass: "text-purple-400", bgClass: "bg-purple-500/10", borderClass: "border-purple-500/20" },
  { id: "converted", label: "Cliente", icon: <Star className="h-3.5 w-3.5" />, colorClass: "text-yellow-300", bgClass: "bg-yellow-500/10", borderClass: "border-yellow-500/20" },
  { id: "lost", label: "Perso", icon: <Snowflake className="h-3.5 w-3.5" />, colorClass: "text-red-400", bgClass: "bg-red-500/10", borderClass: "border-red-500/20" },
];

interface PipelineContact {
  id: string;
  name: string | null;
  company_name: string | null;
  email: string | null;
  interaction_count: number;
  lead_status: string;
}

export function ContactPipelineView(): React.ReactElement {
  const qc = useQueryClient();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

  const { data: contacts, isLoading } = useQuery({
    queryKey: queryKeys.contacts.pipeline(),
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user?.id) return [];
      const { data } = await supabase
        .from("imported_contacts")
        .select("id, name, company_name, email, interaction_count, lead_status")
        .eq("user_id", session.session.user.id)
        .or("company_name.not.is.null,name.not.is.null,email.not.is.null")
        .order("company_name")
        .limit(500);
      return (data || []) as PipelineContact[];
    },
  });

  const stageGroups = useMemo(() => {
    const groups: Record<string, PipelineContact[]> = {};
    STAGES.forEach((s) => { groups[s.id] = []; });
    for (const c of contacts || []) {
      const status = c.lead_status || "new";
      if (groups[status]) groups[status].push(c);
      else groups["new"].push(c);
    }
    return groups;
  }, [contacts]);

  const handleDragStart = useCallback((e: React.DragEvent, contactId: string) => {
    setDraggedId(contactId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", contactId);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverStage(stageId);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverStage(null);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    setDragOverStage(null);
    const contactId = e.dataTransfer.getData("text/plain");
    setDraggedId(null);
    if (!contactId) return;

    const contact = contacts?.find((c) => c.id === contactId);
    if (!contact || contact.lead_status === newStatus) return;

    // Optimistic update
    qc.setQueryData<PipelineContact[]>(["pipeline-contacts"], (old) =>
      (old || []).map((c) => c.id === contactId ? { ...c, lead_status: newStatus } : c)
    );

    const { error } = await supabase
      .from("imported_contacts")
      .update({ lead_status: newStatus })
      .eq("id", contactId);

    if (error) {
      toast.error("Errore aggiornamento stato");
      qc.invalidateQueries({ queryKey: queryKeys.contacts.pipeline() });
    } else {
      toast.success(`Stato aggiornato a "${STAGES.find((s) => s.id === newStatus)?.label}"`);
    }
  }, [contacts, qc]);

  const totalContacts = contacts?.length || 0;

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Stats bar */}
      <div className="px-4 py-2 border-b border-border/30 flex items-center gap-4 text-xs text-muted-foreground shrink-0 bg-muted/10">
        <span className="font-medium text-foreground">{totalContacts} contatti</span>
        <span className="text-border/60">|</span>
        {STAGES.map((s) => (
          <span key={s.id} className={cn("flex items-center gap-1", s.colorClass)}>
            {s.icon} {stageGroups[s.id]?.length || 0}
          </span>
        ))}
      </div>

      {/* Funnel bar */}
      <div className="px-4 py-2 border-b border-border/30 flex items-center gap-1 text-[10px] shrink-0">
        {STAGES.map((s, i) => {
          const count = stageGroups[s.id]?.length || 0;
          const pct = totalContacts > 0 ? Math.round((count / totalContacts) * 100) : 0;
          return (
            <React.Fragment key={s.id}>
              <div className={cn("flex items-center gap-1 px-2 py-1 rounded-md", s.bgClass, s.borderClass, "border")}>
                <span className={cn("font-medium", s.colorClass)}>{count}</span>
                <span className="text-muted-foreground">({pct}%)</span>
              </div>
              {i < STAGES.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground/30 shrink-0" />}
            </React.Fragment>
          );
        })}
      </div>

      {/* Kanban columns */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden min-h-0">
        <div className="flex h-full gap-2 p-3" style={{ minWidth: `${STAGES.length * 240}px` }}>
          {STAGES.map((stage) => {
            const items = stageGroups[stage.id] || [];
            const isOver = dragOverStage === stage.id;
            return (
              <div
                key={stage.id}
                className={cn(
                  "flex flex-col w-[220px] shrink-0 rounded-xl border bg-card/30 transition-colors",
                  isOver ? "border-primary/50 bg-primary/5" : "border-border/30"
                )}
                onDragOver={(e) => handleDragOver(e, stage.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, stage.id)}
              >
                {/* Column header */}
                <div className={cn("flex items-center gap-2 px-3 py-2 rounded-t-xl", stage.bgClass)}>
                  <span className={stage.colorClass}>{stage.icon}</span>
                  <span className="text-xs font-medium text-foreground">{stage.label}</span>
                  <Badge variant="outline" className="ml-auto text-[9px] h-5 px-1.5 border-border/40">{items.length}</Badge>
                </div>

                {/* Cards */}
                <ScrollArea className="flex-1 px-2 py-2">
                  <div className="space-y-1.5">
                    {items.map((contact) => (
                      <div
                        key={contact.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, contact.id)}
                        onDragEnd={() => setDraggedId(null)}
                        className={cn(
                          "rounded-lg border p-2.5 space-y-1 cursor-grab active:cursor-grabbing transition-all",
                          stage.borderClass, "hover:bg-muted/30",
                          draggedId === contact.id && "opacity-40 scale-95"
                        )}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-foreground truncate">{contact.name || "—"}</p>
                            {contact.company_name && (
                              <p className="text-[10px] text-muted-foreground truncate">{contact.company_name}</p>
                            )}
                          </div>
                          <GripVertical className="w-3 h-3 text-muted-foreground/30 shrink-0 mt-0.5" />
                        </div>
                        <p className="text-[10px] text-muted-foreground/70 font-mono truncate">{contact.email || "—"}</p>
                        <div className="flex items-center justify-between text-[9px] text-muted-foreground/60">
                          <span>{contact.interaction_count || 0} interazioni</span>
                        </div>
                      </div>
                    ))}
                    {items.length === 0 && (
                      <p className="text-[10px] text-muted-foreground/50 text-center py-4">
                        {isOver ? "Rilascia qui" : "Vuoto"}
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
