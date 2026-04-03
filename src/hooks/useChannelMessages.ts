import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEffect, useState, useCallback, useRef } from "react";

export type ChannelMessage = {
  id: string;
  user_id: string;
  channel: string;
  direction: string;
  source_type: string | null;
  source_id: string | null;
  partner_id: string | null;
  from_address: string | null;
  to_address: string | null;
  cc_addresses: string | null;
  bcc_addresses: string | null;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  raw_payload: any;
  message_id_external: string | null;
  in_reply_to: string | null;
  read_at: string | null;
  created_at: string;
  email_date: string | null;
  // RFC-compliant fields
  raw_storage_path: string | null;
  raw_sha256: string | null;
  raw_size_bytes: number | null;
  imap_uid: number | null;
  uidvalidity: number | null;
  imap_flags: string | null;
  internal_date: string | null;
  parse_status: string | null;
  parse_warnings: string[] | null;
};

export type EmailAttachment = {
  id: string;
  message_id: string;
  filename: string;
  content_type: string | null;
  size_bytes: number | null;
  storage_path: string;
};

const PAGE_SIZE = 50;

export function useChannelMessages(channel?: string) {
  const queryClient = useQueryClient();

  const query = useInfiniteQuery({
    queryKey: ["channel-messages", channel],
    queryFn: async ({ pageParam = 0 }) => {
      let q = supabase
        .from("channel_messages")
        .select("*")
        .order("email_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .range(pageParam * PAGE_SIZE, (pageParam + 1) * PAGE_SIZE - 1);

      if (channel && channel !== "all") {
        q = q.eq("channel", channel);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as ChannelMessage[];
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      return lastPage.length === PAGE_SIZE ? lastPageParam + 1 : undefined;
    },
  });

  // Realtime subscription
  useEffect(() => {
    const sub = supabase
      .channel("channel_messages_realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "channel_messages" }, () => {
        queryClient.invalidateQueries({ queryKey: ["channel-messages"] });
      })
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, [queryClient]);

  // Flatten pages into a single array
  const messages = query.data?.pages.flat() ?? [];

  return {
    ...query,
    data: messages,
    isLoading: query.isLoading,
  };
}

export function useMessageAttachments(messageId: string | null) {
  return useQuery({
    queryKey: ["email-attachments", messageId],
    queryFn: async () => {
      if (!messageId) return [];
      const { data, error } = await supabase
        .from("email_attachments")
        .select("*")
        .eq("message_id", messageId);
      if (error) throw error;
      return (data || []) as EmailAttachment[];
    },
    enabled: !!messageId,
  });
}

export function useUnreadCount(channel?: string) {
  return useQuery({
    queryKey: ["channel-messages-unread", channel],
    queryFn: async () => {
      let q = supabase
        .from("channel_messages")
        .select("*", { count: "exact", head: true })
        .eq("direction", "inbound")
        .is("read_at", null);
      if (channel) q = q.eq("channel", channel);
      const { count, error } = await q;
      if (error) throw error;
      return count || 0;
    },
    refetchInterval: 30000,
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

export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (messageId: string) => {
      const { error } = await supabase
        .from("channel_messages")
        .update({ read_at: new Date().toISOString() })
        .eq("id", messageId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["channel-messages"] });
      queryClient.invalidateQueries({ queryKey: ["channel-messages-unread"] });
    },
  });
}
