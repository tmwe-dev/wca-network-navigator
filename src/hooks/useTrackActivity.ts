import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { createLogger } from "@/lib/log";
import type { TrackActivityParams } from "@/types/tracking";

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
        activity_type: params.activityType as any,
        title: params.title,
        source_id: params.sourceId,
        source_type: params.sourceType,
        partner_id: params.partnerId || null,
        user_id: user.id,
        status: "completed" as any,
        completed_at: now,
        sent_at: params.activityType === "send_email" ? now : null,
        email_subject: params.emailSubject || null,
        description: params.description || null,
      } as any);
      if (actErr) log.error("track activity insert failed", { message: actErr.message, code: actErr.code });

      // 2. Escalate lead_status new → contacted
      if (params.sourceType === "partner" && params.partnerId) {
        await supabase
          .from("partners")
          .update({ lead_status: "contacted", last_interaction_at: now } as any)
          .eq("id", params.partnerId)
          .eq("lead_status", "new");

        // Create interaction record
        await supabase.from("interactions").insert({
          partner_id: params.partnerId,
          interaction_type: params.activityType === "send_email" ? "email" : "other" as any,
          subject: params.emailSubject || params.title,
          notes: params.description || `Attività: ${params.title}`,
        } as any);
      } else if (params.sourceType === "imported_contact") {
        await supabase
          .from("imported_contacts")
          .update({ lead_status: "contacted", last_interaction_at: now } as any)
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
          .update({ lead_status: "contacted" } as any)
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
