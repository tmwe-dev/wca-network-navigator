/**
 * Email sync hooks: check inbox (single batch), continuous sync (full download), and reset.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState, useCallback, useRef } from "react";

/** Reset last_uid to 0 so next sync re-downloads all emails from the server */
export function useResetSync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
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
      toast.error("Errore reset: " + err.message);
    },
  });
}

async function callCheckInbox(): Promise<any> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Non autenticato");

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const res = await fetch(
    `https://${projectId}.supabase.co/functions/v1/check-inbox`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({}),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Errore sconosciuto" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return await res.json();
}

export function useCheckInbox() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: callCheckInbox,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["channel-messages"] });
      queryClient.invalidateQueries({ queryKey: ["channel-messages-unread"] });
      if (data.total > 0) {
        toast.success(`📬 ${data.total} email scaricate (${data.matched} con contatto)`);
      } else {
        toast.info("Nessuna nuova email");
      }
    },
    onError: (err: Error) => {
      toast.error("Errore scaricamento posta: " + err.message);
    },
  });
}

export function useContinuousSync() {
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);
  const [progress, setProgress] = useState({ downloaded: 0, batch: 0, lastSubject: "" });
  const abortRef = useRef(false);

  const startSync = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    abortRef.current = false;
    let totalDownloaded = 0;
    let batchNum = 0;

    const toastId = toast.loading("📬 Sincronizzazione completa in corso...", { duration: Infinity });

    try {
      while (!abortRef.current) {
        batchNum++;
        const result = await callCheckInbox();

        if (result.total === 0) break;

        totalDownloaded += result.total;
        const lastMsg = result.messages?.[result.messages.length - 1];
        setProgress({
          downloaded: totalDownloaded,
          batch: batchNum,
          lastSubject: lastMsg?.subject || "",
        });

        toast.loading(
          `📬 Blocco ${batchNum}: ${result.total} email | Totale: ${totalDownloaded}`,
          { id: toastId, duration: Infinity }
        );

        queryClient.invalidateQueries({ queryKey: ["channel-messages"] });
        await new Promise(r => setTimeout(r, 1500));
      }

      toast.success(
        totalDownloaded > 0
          ? `✅ Sync completa! ${totalDownloaded} email scaricate in ${batchNum} blocchi`
          : "✅ Posta già aggiornata",
        { id: toastId, duration: 5000 }
      );
    } catch (err: any) {
      toast.error(`❌ Errore al blocco ${batchNum}: ${err.message}`, { id: toastId, duration: 8000 });
    } finally {
      setIsSyncing(false);
      queryClient.invalidateQueries({ queryKey: ["channel-messages"] });
      queryClient.invalidateQueries({ queryKey: ["channel-messages-unread"] });
    }
  }, [isSyncing, queryClient]);

  const stopSync = useCallback(() => {
    abortRef.current = true;
    toast.info("⏹ Sincronizzazione interrotta");
  }, []);

  return { startSync, stopSync, isSyncing, progress };
}
