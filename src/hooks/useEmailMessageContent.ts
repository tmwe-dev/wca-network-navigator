import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

type InitialEmailMessageContent = {
  bodyHtml?: string | null;
  bodyText?: string | null;
};

export function useEmailMessageContent(
  messageId: string | null,
  initialContent?: InitialEmailMessageContent,
) {
  const fallbackBodyHtml = initialContent?.bodyHtml ?? null;
  const fallbackBodyText = initialContent?.bodyText ?? null;

  const query = useQuery({
    queryKey: queryKeys.email.messageContent(messageId),
    enabled: !!messageId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("channel_messages")
        .select("body_html, body_text")
        .eq("id", messageId!)
        .maybeSingle();

      if (error) throw error;

      return {
        body_html: data?.body_html ?? fallbackBodyHtml,
        body_text: data?.body_text ?? fallbackBodyText,
      };
    },
    staleTime: 60_000,
    retry: 1,
  });

  return {
    ...query,
    bodyHtml: query.data?.body_html ?? fallbackBodyHtml,
    bodyText: query.data?.body_text ?? fallbackBodyText,
  };
}