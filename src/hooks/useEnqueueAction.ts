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
import { insertPendingActionReturningId } from "@/data/aiPendingActions";
import { createLogger } from "@/lib/log";
import { toJsonValue } from "@/lib/typedJson";

const log = createLogger("useEnqueueAction");

export type EnqueueActionType = "send_email" | "send_whatsapp" | "send_linkedin" | "linkedin_connect";

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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * I contatti del cockpit usano id sintetici con prefisso sorgente
 * (`pc-`, `ic-`, `bc-`, `prc-`, `act-`). Le colonne uuid di
 * `ai_pending_actions` accettano solo l'uuid puro: qui normalizziamo,
 * e scartiamo (null) qualunque valore che non sia un uuid valido.
 */
function normalizeUuid(value?: string | null): string | null {
  if (!value) return null;
  const raw = value.replace(/^(pc-|ic-|bc-|prc-|act-)/, "");
  return UUID_RE.test(raw) ? raw : null;
}

export function useEnqueueAction() {

  const [enqueuing, setEnqueuing] = useState(false);

  const enqueue = async (args: EnqueueActionArgs): Promise<EnqueueActionResult> => {
    setEnqueuing(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) {
        toast({ title: "Sessione non valida", variant: "destructive" });
        return { id: null, ok: false, error: "no_session" };
      }

      const { id, error } = await insertPendingActionReturningId({
        user_id: userId,
        action_type: args.action_type,
        action_payload: toJsonValue(args.payload),
        partner_id: normalizeUuid(args.partner_id),
        contact_id: normalizeUuid(args.contact_id),

        email_address: args.email_address ?? null,
        suggested_content: args.suggested_content ?? null,
        reasoning: args.reasoning ?? `Manual ${args.action_type} dal cockpit. In attesa di autorizzazione.`,
        confidence: 1.0,
        source: args.source ?? "manual",
        status: "pending",
      });

      if (error) {
        log.error("enqueue.failed", { error: error.message, action_type: args.action_type });
        toast({ title: "Errore in coda", description: error.message, variant: "destructive" });
        return { id: null, ok: false, error: error.message };
      }

      toast({
        title: "📥 In coda di approvazione",
        description: "Apri Menu → Approvazioni Invii (/v2/approvazioni) per approvare e inviare.",
      });
      return { id, ok: true };
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
