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
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["channel-messages"] });
      queryClient.invalidateQueries({ queryKey: ["channel-messages-unread"] });
      queryClient.invalidateQueries({ queryKey: ["email-count"] });

      if (data.total > 0) {
        toast.success(`📬 ${data.total} email scaricate (${data.matched} con contatto)`);
      } else {
        toast.info("Nessuna nuova email");
      }
    },
    onError: (err: Error) => {
      toast.error(`Errore scaricamento posta: ${err.message}`);
    },
  });
}
