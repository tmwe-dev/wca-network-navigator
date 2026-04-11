import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { createLogger } from "@/lib/log";
import type { TrackActivityParams } from "@/types/tracking";
import type { Database } from "@/integrations/supabase/types";

type ActivityInsert = Database["public"]["Tables"]["activities"]["Insert"];
type InteractionInsert = Database["public"]["Tables"]["interactions"]["Insert"];

const log = createLogger("useTrackActivity");

export function useTrackActivity() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (params: TrackActivityParams) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non autenticato");

      const now = new Date().toISOString();

      // 1. Insert completed activity
      const { error: actErr } = await supabase.from("activities").insert({
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
      } satisfies ActivityInsert);
      if (actErr) log.error("track activity insert failed", { message: actErr.message, code: actErr.code });

      // 2. Escalate lead_status new → contacted
      if (params.sourceType === "partner" && params.partnerId) {
        const { updatePartner } = await import("@/data/partners");
        await updatePartner(params.partnerId, { lead_status: "contacted", last_interaction_at: now });
          .eq("lead_status", "new");

        // Create interaction record
        await supabase.from("interactions").insert({
          partner_id: params.partnerId,
          interaction_type: params.activityType === "send_email" ? "email" : "note",
          subject: params.emailSubject || params.title,
          notes: params.description || `Attività: ${params.title}`,
        });
      } else if (params.sourceType === "imported_contact") {
        const { updateContact } = await import("@/data/contacts");
        // Only update if currently "new" — we can't do conditional update via DAL, so use supabase directly
        await supabase
          .from("imported_contacts")
          .update({ lead_status: "contacted", last_interaction_at: now })
          .eq("id", params.sourceId)
          .eq("lead_status", "new");

        await supabase.from("contact_interactions").insert({
          contact_id: params.sourceId,
          interaction_type: params.activityType === "send_email" ? "email" : "other",
          title: params.emailSubject || params.title,
          description: params.description || null,
          created_by: user.id,
        });
      } else if (params.sourceType === "business_card") {
        await supabase
          .from("business_cards")
          .update({ lead_status: "contacted" })
          .eq("id", params.sourceId)
          .eq("lead_status", "new");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["today-activities"] });
      qc.invalidateQueries({ queryKey: ["all-activities"] });
      qc.invalidateQueries({ queryKey: ["worked-today"] });
      qc.invalidateQueries({ queryKey: ["sorting-jobs"] });
      qc.invalidateQueries({ queryKey: ["partners"] });
      qc.invalidateQueries({ queryKey: ["contacts-paginated"] });
      qc.invalidateQueries({ queryKey: ["contacts-group-counts"] });
    },
  });
}
