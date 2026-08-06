import { useQuery } from "@tanstack/react-query";
import { getChannelMessageBodyById } from "@/data/channelMessages";
import { queryKeys } from "@/lib/queryKeys";

type InitialEmailMessageContent = {
  bodyHtml?: string | null;
  bodyText?: string | null;
};

export function useEmailMessageContent(messageId: string | null, initialContent?: InitialEmailMessageContent) {
  const fallbackBodyHtml = initialContent?.bodyHtml ?? null;
  const fallbackBodyText = initialContent?.bodyText ?? null;

  const query = useQuery({
    queryKey: queryKeys.email.messageContent(messageId),
    enabled: !!messageId,
    queryFn: async () => {
      const data = await getChannelMessageBodyById(messageId!);

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
