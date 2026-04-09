/**
 * Email sync hooks: single-batch inbox check and reset.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { callCheckInbox } from "@/lib/checkInbox";

export function useResetSync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Non autenticato");

      const { error } = await supabase
        .from("email_sync_state")
        .update({ last_uid: 0, stored_uidvalidity: null })
        .eq("user_id", session.user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["channel-messages"] });
      toast.success("🔄 Sync resettata — premi 'Scarica Tutto' per riscaricare tutta la inbox");
    },
    onError: (err: Error) => {
      toast.error(`Errore reset: ${err.message}`);
    },
  });
}

export function useCheckInbox() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: callCheckInbox,
    onSuccess: (raw) => {
      // Realtime handles list updates; only refresh count
      queryClient.invalidateQueries({ queryKey: ["email-count"] });

      // callCheckInbox restituisce `unknown` (Vol. II §5.1 strangler).
      // Qui facciamo narrowing difensivo invece di assumere lo shape.
      const data = raw as { total?: number; matched?: number } | null;
      const total = typeof data?.total === "number" ? data.total : 0;
      const matched = typeof data?.matched === "number" ? data.matched : 0;

      if (total > 0) {
        toast.success(`📬 ${total} email scaricate (${matched} con contatto)`);
      }
      window.dispatchEvent(new CustomEvent("channel-sync-done", { detail: { channel: "email" } }));
    },
    onError: (err: Error) => {
      toast.error(`Errore scaricamento posta: ${err.message}`);
    },
  });
}
