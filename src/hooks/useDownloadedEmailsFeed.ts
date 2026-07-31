import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { findDownloadedEmailsFeedRows } from "@/data/channelMessages";
import type { DownloadedEmail } from "@/lib/backgroundSync";
import { queryKeys } from "@/lib/queryKeys";

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
    queryKey: queryKeys.email.downloadedFeed(),
    queryFn: async () => {
      const data = await findDownloadedEmailsFeedRows(FEED_LIMIT);
      return data.map(mapRowToDownloadedEmail);
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
          const row = payload.new as Record<string, unknown>;
          const newEmail = mapRowToDownloadedEmail({
            id: row.id as string,
            subject: row.subject as string | null,
            from_address: row.from_address as string | null,
            email_date: row.email_date as string | null,
            created_at: row.created_at as string,
          });
          queryClient.setQueryData<DownloadedEmail[]>(["downloaded-emails-feed"], (old) => {
            if (!old) return [newEmail];
            if (old.some(e => e.id === newEmail.id)) return old;
            return [newEmail, ...old].slice(0, FEED_LIMIT);
          });
          queryClient.invalidateQueries({ queryKey: queryKeys.email.count });
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
