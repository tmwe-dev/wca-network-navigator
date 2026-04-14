import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ContactInteractionTimeline } from "@/components/contacts/ContactInteractionTimeline";
import { Loader2, History } from "lucide-react";
import type { RecordSourceType } from "@/contexts/ContactDrawerContext";
import type { ContactInteraction } from "@/hooks/useContacts";

interface Props {
  sourceType: RecordSourceType;
  sourceId: string;
  partnerId: string | null;
}

export function ContactRecordInteractions({ sourceType, sourceId, partnerId }: Props) {
  const { data: interactions, isLoading } = useQuery({
    queryKey: ["record-interactions", sourceType, sourceId],
    queryFn: async (): Promise<ContactInteraction[]> => {
      if (sourceType === "partner" && partnerId) {
        const { data } = await supabase
          .from("interactions")
          .select("*")
          .eq("partner_id", partnerId)
          .order("interaction_date", { ascending: false })
          .limit(20);
        return (data || []).map((i): ContactInteraction => ({
          id: i.id,
          contact_id: partnerId,
          interaction_type: i.interaction_type,
          title: i.subject,
          description: i.notes,
          outcome: null,
          created_by: null,
          created_at: i.interaction_date || i.created_at || new Date().toISOString(),
        }));
      }
      if (sourceType === "contact") {
        const { data } = await supabase
          .from("contact_interactions")
          .select("*")
          .eq("contact_id", sourceId)
          .order("created_at", { ascending: false })
          .limit(20);
        return (data || []) as ContactInteraction[];
      }
      if (sourceType === "prospect") {
        const { data } = await supabase
          .from("prospect_interactions")
          .select("*")
          .eq("prospect_id", sourceId)
          .order("created_at", { ascending: false })
          .limit(20);
        return (data || []).map((i) => ({
          id: i.id,
          contact_id: sourceId,
          interaction_type: i.interaction_type,
          title: i.title,
          description: i.description,
          outcome: i.outcome,
          created_by: i.created_by || null,
          created_at: i.created_at,
        }));
      }
      return [];
    },
    enabled: !!sourceId,
  });

  // Also load activities
  const { data: activities } = useQuery({
    queryKey: ["record-activities", sourceType, sourceId],
    queryFn: async () => {
      const { data } = await supabase
        .from("activities")
        .select("*")
        .eq("source_id", sourceId)
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!sourceId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasData = (interactions && interactions.length > 0) || (activities && activities.length > 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
        <History className="w-3.5 h-3.5 text-primary" />
        Circuito di Attesa — Interazioni
      </div>

      {interactions && interactions.length > 0 ? (
        <ContactInteractionTimeline contactId={sourceId} />
      ) : (
        <p className="text-xs text-muted-foreground text-center py-3">Nessuna interazione registrata</p>
      )}

      {activities && activities.length > 0 && (
        <div className="space-y-2 mt-3">
          <div className="text-[11px] font-medium text-muted-foreground">Attività programmate</div>
          {activities.map((a) => (
            <div key={a.id} className="flex items-center gap-2 text-xs bg-muted/30 rounded-lg p-2">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                a.status === "completed" ? "bg-success" :
                a.status === "in_progress" ? "bg-warning" :
                a.status === "cancelled" ? "bg-destructive" : "bg-muted-foreground"
              }`} />
              <span className="font-medium truncate flex-1">{a.title}</span>
              <span className="text-muted-foreground text-[10px] flex-shrink-0">
                {a.due_date || a.scheduled_at ? new Date((a.due_date || a.scheduled_at)!).toLocaleDateString("it-IT") : ""}
              </span>
            </div>
          ))}
        </div>
      )}

      {!hasData && (
        <p className="text-xs text-muted-foreground/60 text-center py-4">
          Il contatto non ha ancora interazioni nel circuito
        </p>
      )}
    </div>
  );
}