/**
 * useEnqueueAction — punto unico di enqueue di un'azione "send" in
 * `ai_pending_actions`, in coda di approvazione umana.
 *
 * Tutto il cockpit (email/WA/LI singoli) passa da qui invece di chiamare
 * direttamente bridge / send-email. L'invio reale avviene solo dopo
 * l'approvazione esplicita in `PendingActionsPanel` via `useApproveAndDispatch`.
 */
import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { createLogger } from "@/lib/log";

const log = createLogger("useEnqueueAction");

export type EnqueueActionType =
  | "send_email"
  | "send_whatsapp"
  | "send_linkedin"
  | "linkedin_connect";

export interface EnqueueActionArgs {
  action_type: EnqueueActionType;
  payload: Record<string, unknown>;
  partner_id?: string | null;
  contact_id?: string | null;
  email_address?: string | null;
  suggested_content?: string | null;
  reasoning?: string;
  source?: string;
  decision_origin?: "user_manual" | "ai_proposed";
}

export interface EnqueueActionResult {
  id: string | null;
  ok: boolean;
  error?: string;
}

export function useEnqueueAction() {
  const [enqueuing, setEnqueuing] = useState(false);

  const enqueue = async (args: EnqueueActionArgs): Promise<EnqueueActionResult> => {
    setEnqueuing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) {
        toast({ title: "Sessione non valida", variant: "destructive" });
        return { id: null, ok: false, error: "no_session" };
      }

      const { data, error } = await supabase
        .from("ai_pending_actions")
        .insert({
          user_id: userId,
          action_type: args.action_type,
          action_payload: args.payload as never,
          partner_id: args.partner_id ?? null,
          contact_id: args.contact_id ?? null,
          email_address: args.email_address ?? null,
          suggested_content: args.suggested_content ?? null,
          reasoning: args.reasoning ?? `Manual ${args.action_type} dal cockpit. In attesa di autorizzazione.`,
          confidence: 1.0,
          source: args.source ?? "manual",
          status: "pending",
        })
        .select("id")
        .maybeSingle();

      if (error) {
        log.error("enqueue.failed", { error: error.message, action_type: args.action_type });
        toast({ title: "Errore in coda", description: error.message, variant: "destructive" });
        return { id: null, ok: false, error: error.message };
      }

      toast({
        title: "📥 In coda di approvazione",
        description: "Apri il pannello AI Control per approvare e inviare.",
      });
      return { id: data?.id ?? null, ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error("enqueue.exception", { error: msg, action_type: args.action_type });
      toast({ title: "Errore in coda", description: msg, variant: "destructive" });
      return { id: null, ok: false, error: msg };
    } finally {
      setEnqueuing(false);
    }
  };

  return { enqueue, enqueuing };
}