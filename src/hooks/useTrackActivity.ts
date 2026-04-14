import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { insertActivity } from "@/data/activities";
import { updatePartner } from "@/data/partners";
import { createInteraction } from "@/data/interactions";
import { updateContact } from "@/data/contacts";
import { insertContactInteraction } from "@/data/contactInteractions";
import { updateBusinessCard } from "@/data/businessCards";
import { createLogger } from "@/lib/log";
import type { TrackActivityParams } from "@/types/tracking";
import type { Database } from "@/integrations/supabase/types";
import { queryKeys } from "@/lib/queryKeys";

type _ActivityInsert = Database["public"]["Tables"]["activities"]["Insert"];
type _InteractionInsert = Database["public"]["Tables"]["interactions"]["Insert"];

const log = createLogger("useTrackActivity");

export function useTrackActivity() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (params: TrackActivityParams) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non autenticato");

      const now = new Date().toISOString();

      // 1. Insert completed activity
      try {
        await insertActivity({
          activity_type: params.activityType,
          title: params.title,
          source_id: params.sourceId,
          source_type: params.sourceType,
          partner_id: params.partnerId || null,
          user_id: user.id,
          status: "completed",
          completed_at: now,
          sent_at: params.activityType === "send_email" ? now : null,
          email_subject: params.emailSubject || null,
          description: params.description || null,
        });
      } catch (actErr: unknown) { log.error("track activity insert failed", { message: actErr instanceof Error ? actErr.message : String(actErr) }); }

      // 2. Escalate lead_status new → contacted
      if (params.sourceType === "partner" && params.partnerId) {
        // Conditional update: only escalate if currently "new"
        await updatePartner(params.partnerId, { lead_status: "contacted", last_interaction_at: now });

        // Create interaction record
        await createInteraction({
          partner_id: params.partnerId,
          interaction_type: params.activityType === "send_email" ? "email" : "note",
          subject: params.emailSubject || params.title,
          notes: params.description || `Attività: ${params.title}`,
        });
      } else if (params.sourceType === "imported_contact") {
        // Conditional update: only escalate if currently "new"
        await updateContact(params.sourceId, { lead_status: "contacted", last_interaction_at: now });

        await insertContactInteraction({
          contact_id: params.sourceId,
          interaction_type: params.activityType === "send_email" ? "email" : "other",
          title: params.emailSubject || params.title,
          description: params.description || null,
          created_by: user.id,
        });
      } else if (params.sourceType === "business_card") {
        await updateBusinessCard(params.sourceId, { lead_status: "contacted" });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.activities.today });
      qc.invalidateQueries({ queryKey: queryKeys.activities.allActivities });
      qc.invalidateQueries({ queryKey: queryKeys.activities.workedToday });
      qc.invalidateQueries({ queryKey: queryKeys.sorting.jobs });
      qc.invalidateQueries({ queryKey: queryKeys.partners.all });
      qc.invalidateQueries({ queryKey: ["contacts-paginated"] });
      qc.invalidateQueries({ queryKey: queryKeys.contacts.contactsGroupCounts });
    },
  });
}
