import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { DownloadedEmail } from "@/lib/backgroundSync";

const FEED_LIMIT = 50;

type DownloadedEmailRow = {
  id: string;
  subject: string | null;
  from_address: string | null;
  email_date: string | null;
  created_at: string;
};

function mapRowToDownloadedEmail(row: DownloadedEmailRow): DownloadedEmail {
  return {
    id: row.id,
    subject: row.subject || "(senza oggetto)",
    from: row.from_address || "",
    date: row.email_date || row.created_at,
    timestamp: new Date(row.created_at).getTime(),
  };
}

export function useDownloadedEmailsFeed() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["downloaded-emails-feed"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("channel_messages")
        .select("id, subject, from_address, email_date, created_at")
        .eq("channel", "email")
        .order("email_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(FEED_LIMIT);

      if (error) throw error;

      return ((data || []) as DownloadedEmailRow[]).map(mapRowToDownloadedEmail);
    },
    staleTime: 10_000,
  });

  // Realtime: prepend new row directly into cache instead of full re-fetch
  useEffect(() => {
    const channel = supabase
      .channel("downloaded-emails-feed")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "channel_messages",
          filter: "channel=eq.email",
        },
        (payload) => {
          const row = payload.new as unknown;
          const newEmail = mapRowToDownloadedEmail({
            id: row.id,
            subject: row.subject,
            from_address: row.from_address,
            email_date: row.email_date,
            created_at: row.created_at,
          });
          queryClient.setQueryData<DownloadedEmail[]>(["downloaded-emails-feed"], (old) => {
            if (!old) return [newEmail];
            if (old.some(e => e.id === newEmail.id)) return old;
            return [newEmail, ...old].slice(0, FEED_LIMIT);
          });
          queryClient.invalidateQueries({ queryKey: ["email-count"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return {
    ...query,
    emails: query.data || [],
  };
}
