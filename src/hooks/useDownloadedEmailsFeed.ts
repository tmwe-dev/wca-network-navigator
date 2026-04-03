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
  body_html: string | null;
  body_text: string | null;
};

function mapRowToDownloadedEmail(row: DownloadedEmailRow): DownloadedEmail {
  return {
    id: row.id,
    subject: row.subject || "(senza oggetto)",
    from: row.from_address || "",
    date: row.email_date || row.created_at,
    bodyHtml: row.body_html || undefined,
    bodyText: row.body_text || undefined,
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
        .select("id, subject, from_address, email_date, created_at, body_html, body_text")
        .eq("channel", "email")
        .order("email_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(FEED_LIMIT);

      if (error) throw error;

      return ((data || []) as DownloadedEmailRow[]).map(mapRowToDownloadedEmail);
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("downloaded-emails-feed")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "channel_messages",
          filter: "channel=eq.email",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["downloaded-emails-feed"] });
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