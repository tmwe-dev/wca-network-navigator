import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEffect } from "react";

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
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  raw_payload: any;
  message_id_external: string | null;
  in_reply_to: string | null;
  read_at: string | null;
  created_at: string;
};

export function useChannelMessages(channel?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["channel-messages", channel],
    queryFn: async () => {
      let q = supabase
        .from("channel_messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (channel && channel !== "all") {
        q = q.eq("channel", channel);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data as ChannelMessage[];
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

  return query;
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

export function useCheckInbox() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
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
    },
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
