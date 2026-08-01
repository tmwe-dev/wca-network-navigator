/**
 * useLogAction — Hook client-side per tracciare side-effect post-invio.
 *
 * LOVABLE-93: Sostituisce useTrackActivity per WhatsApp/LinkedIn/SMS.
 * Chiama la edge function "log-action" che esegue la pipeline unificata
 * server-side (activity + lead_status + interaction + follow-up +
 * touch_count + supervisor_audit_log).
 *
 * Per EMAIL: NON usare questo hook! L'invio email passa già per
 * send-email/process-email-queue che eseguono postSendPipeline internamente.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { queryKeys } from "@/lib/queryKeys";
import { createLogger } from "@/lib/log";

const log = createLogger("useLogAction");

export type LogActionChannel = "email" | "whatsapp" | "linkedin" | "sms";
export type LogActionSourceType = "partner" | "imported_contact" | "business_card";

export interface LogActionParams {
  channel: LogActionChannel;
  sourceType: LogActionSourceType;
  sourceId: string;
  to: string;
  partnerId?: string;
  contactId?: string;
  businessCardId?: string;
  subject?: string;
  body?: string;
  title?: string;
  agentId?: string;
  source?: "email_forge" | "agent" | "cadence" | "batch" | "pending_action" | "manual";
  meta?: Record<string, unknown>;
  messageIdExternal?: string;
  threadId?: string;
}

export function useLogAction() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (params: LogActionParams) => {
      const result = await invokeEdge<{
        success: boolean;
        pipeline: Record<string, boolean>;
        error?: string;
      }>("log-action", {
        body: {
          channel: params.channel,
          source_type: params.sourceType,
          source_id: params.sourceId,
          to: params.to,
          partner_id: params.partnerId,
          contact_id: params.contactId,
          business_card_id: params.businessCardId,
          subject: params.subject,
          body: params.body,
          title: params.title,
          agent_id: params.agentId,
          source: params.source || "manual",
          meta: params.meta,
          message_id_external: params.messageIdExternal,
          thread_id: params.threadId,
        },
        context: "useLogAction",
      });

      if (result?.error) {
        log.error("log-action failed", { error: result.error });
      }

      return result;
    },
    onSuccess: () => {
      // Invalidate same query keys as the old useTrackActivity
      qc.invalidateQueries({ queryKey: queryKeys.activities.today });
      qc.invalidateQueries({ queryKey: queryKeys.activities.allActivities });
      qc.invalidateQueries({ queryKey: queryKeys.activities.workedToday });
      qc.invalidateQueries({ queryKey: queryKeys.sorting.jobs });
      qc.invalidateQueries({ queryKey: queryKeys.partners.all });
      qc.invalidateQueries({ queryKey: queryKeys.contacts.paginated() });
      qc.invalidateQueries({ queryKey: queryKeys.contacts.contactsGroupCounts });
    },
    onError: (err) => {
      log.error("log-action mutation error", { error: err instanceof Error ? err.message : String(err) });
    },
  });
}
