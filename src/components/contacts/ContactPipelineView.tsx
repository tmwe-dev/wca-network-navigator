/**
 * ContactPipelineView — Kanban pipeline for contact lifecycle tracking.
 */
import * as React from "react";
import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  UserPlus, Send, Clock, MailCheck, Calendar, Star, Snowflake,
  ArrowRight, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";

// ── Stage definitions ──
interface Stage {
  id: string;
  label: string;
  icon: React.ReactNode;
  colorClass: string;
  bgClass: string;
  borderClass: string;
}

const STAGES: Stage[] = [
  { id: "nuovi", label: "Nuovi", icon: <UserPlus className="h-3.5 w-3.5" />, colorClass: "text-muted-foreground", bgClass: "bg-muted/30", borderClass: "border-border/40" },
  { id: "primo_contatto", label: "Primo Contatto", icon: <Send className="h-3.5 w-3.5" />, colorClass: "text-blue-400", bgClass: "bg-blue-500/10", borderClass: "border-blue-500/20" },
  { id: "in_attesa", label: "In Attesa", icon: <Clock className="h-3.5 w-3.5" />, colorClass: "text-yellow-400", bgClass: "bg-yellow-500/10", borderClass: "border-yellow-500/20" },
  { id: "risposta_ricevuta", label: "Risposta", icon: <MailCheck className="h-3.5 w-3.5" />, colorClass: "text-green-400", bgClass: "bg-green-500/10", borderClass: "border-green-500/20" },
  { id: "meeting", label: "Meeting", icon: <Calendar className="h-3.5 w-3.5" />, colorClass: "text-purple-400", bgClass: "bg-purple-500/10", borderClass: "border-purple-500/20" },
  { id: "convertito", label: "Convertito", icon: <Star className="h-3.5 w-3.5" />, colorClass: "text-yellow-300", bgClass: "bg-yellow-500/10", borderClass: "border-yellow-500/20" },
  { id: "freddo", label: "Freddo", icon: <Snowflake className="h-3.5 w-3.5" />, colorClass: "text-red-400", bgClass: "bg-red-500/10", borderClass: "border-red-500/20" },
];

interface PipelineContact {
  id: string;
  name: string | null;
  company_name: string | null;
  email: string | null;
  interaction_count: number;
  last_interaction_at: string | null;
  lead_status: string;
  stage: string;
  lastAction?: string;
  sentiment?: string;
  daysInStage: number;
}

function classifyStage(contact: Record<string, unknown>, activities: Record<string, unknown>[], classifications: Record<string, unknown>[]): string {
  const interactionCount = Number(contact.interaction_count) || 0;
  const leadStatus = String(contact.lead_status || "");

  if (leadStatus === "cliente" || leadStatus === "active") return "convertito";

  const contactClassifications = classifications.filter(
    (c) => c.email_address === contact.email && !["auto_reply", "spam"].includes(String(c.category))
  );
  const hasMeeting = contactClassifications.some((c) => c.category === "meeting_request");
  const hasNotInterested = contactClassifications.some((c) => c.category === "not_interested");
  const hasClassification = contactClassifications.length > 0;

  if (hasMeeting) return "meeting";
  if (hasNotInterested) return "freddo";
  if (interactionCount >= 3 && !hasClassification) return "freddo";
  if (hasClassification) return "risposta_ricevuta";

  const contactActivities = activities.filter((a) => String(a.partner_id) === String(contact.wca_partner_id));
  const hasOutbound = contactActivities.length > 0 || interactionCount > 0;

  if (!hasOutbound && interactionCount === 0) return "nuovi";
  if (interactionCount > 1) return "in_attesa";
  if (hasOutbound || interactionCount === 1) return "primo_contatto";

  return "nuovi";
}

export function ContactPipelineView(): React.ReactElement {
  // Fetch contacts
  const { data: contacts, isLoading: loadingContacts } = useQuery({
    queryKey: ["pipeline-contacts"],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user?.id) return [];
      const { data } = await supabase
        .from("imported_contacts")
        .select("id, name, company_name, email, interaction_count, last_interaction_at, lead_status, wca_partner_id, created_at")
        .eq("user_id", session.session.user.id)
        .order("created_at", { ascending: false })
        .limit(500);
      return data || [];
    },
  });

  // Fetch activities for stage detection
  const { data: activities } = useQuery({
    queryKey: ["pipeline-activities"],
    queryFn: async () => {
      const { data } = await supabase
        .from("activities")
        .select("id, partner_id, activity_type, status, created_at")
        .in("activity_type", ["send_email", "email", "outreach", "linkedin_message", "whatsapp"])
        .limit(1000);
      return data || [];
    },
  });

  // Fetch classifications
  const { data: classifications } = useQuery({
    queryKey: ["pipeline-classifications"],
    queryFn: async () => {
      const { data } = await supabase
        .from("email_classifications")
        .select("id, email_address, category, confidence, sentiment, classified_at")
        .limit(500);
      return data || [];
    },
  });

  // Classify contacts into stages
  const stageGroups = useMemo(() => {
    if (!contacts) return {};
    const groups: Record<string, PipelineContact[]> = {};
    STAGES.forEach((s) => { groups[s.id] = []; });

    for (const c of contacts as Record<string, unknown>[]) {
      const stage = classifyStage(c, (activities || []) as Record<string, unknown>[], (classifications || []) as Record<string, unknown>[]);
      const createdAt = c.created_at ? new Date(c.created_at as string) : new Date();
      const daysInStage = Math.floor((Date.now() - createdAt.getTime()) / 86400000);
      
      const contactClassifications = ((classifications || []) as Record<string, unknown>[]).filter(
        (cl) => cl.email_address === c.email
      );
      const lastClassification = contactClassifications[0];

      groups[stage]?.push({
        id: c.id as string,
        name: c.name as string | null,
        company_name: c.company_name as string | null,
        email: c.email as string | null,
        interaction_count: Number(c.interaction_count) || 0,
        last_interaction_at: c.last_interaction_at as string | null,
        lead_status: c.lead_status as string,
        stage,
        sentiment: lastClassification?.sentiment as string | undefined,
        daysInStage,
      });
    }
    return groups;
  }, [contacts, activities, classifications]);

  // Stats
  const totalContacts = contacts?.length || 0;
  const blockedCount = useMemo(() => {
    let count = 0;
    Object.values(stageGroups).forEach((list) => {
      list.forEach((c) => { if (c.daysInStage > 14) count++; });
    });
    return count;
  }, [stageGroups]);

  if (loadingContacts) {
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
        <span className="text-border/60">|</span>
        {blockedCount > 0 && (
          <span className="flex items-center gap-1 text-orange-400">
            <AlertTriangle className="h-3 w-3" /> {blockedCount} bloccati (&gt;14gg)
          </span>
        )}
      </div>

      {/* Funnel */}
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
            return (
              <div key={stage.id} className="flex flex-col w-[220px] shrink-0 rounded-xl border border-border/30 bg-card/30">
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
                      <PipelineCard key={contact.id} contact={contact} stage={stage} />
                    ))}
                    {items.length === 0 && (
                      <p className="text-[10px] text-muted-foreground/50 text-center py-4">Vuoto</p>
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

function PipelineCard({ contact, stage }: { contact: PipelineContact; stage: Stage }): React.ReactElement {
  const sentimentDot = contact.sentiment === "positive" ? "bg-green-400"
    : contact.sentiment === "negative" ? "bg-red-400"
    : contact.sentiment === "mixed" ? "bg-yellow-400"
    : "bg-muted-foreground/30";

  return (
    <div className={cn(
      "rounded-lg border p-2.5 space-y-1 cursor-pointer transition-colors hover:bg-muted/30",
      stage.borderClass
    )}>
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0">
          <p className="text-xs font-medium text-foreground truncate">{contact.name || "—"}</p>
          {contact.company_name && (
            <p className="text-[10px] text-muted-foreground truncate">{contact.company_name}</p>
          )}
        </div>
        <div className={cn("h-2 w-2 rounded-full shrink-0 mt-1", sentimentDot)} title={contact.sentiment || "unknown"} />
      </div>
      <p className="text-[10px] text-muted-foreground/70 font-mono truncate">{contact.email || "—"}</p>
      <div className="flex items-center justify-between text-[9px] text-muted-foreground/60">
        <span>{contact.interaction_count} interazioni</span>
        {contact.daysInStage > 14 && (
          <span className="text-orange-400 font-medium">{contact.daysInStage}gg</span>
        )}
        {contact.daysInStage <= 14 && contact.daysInStage > 0 && (
          <span>{contact.daysInStage}gg</span>
        )}
      </div>
    </div>
  );
}
