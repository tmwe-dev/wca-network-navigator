import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { CompanyLogo } from "@/components/ui/CompanyLogo";
import { EmailHtmlFrame } from "@/components/outreach/email/EmailHtmlFrame";
import {
  normalizeEmailContent,
  renderEmailTextAsHtml,
} from "@/components/outreach/email/emailContentNormalization";
import { extractSenderBrand } from "@/components/outreach/email/emailUtils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import type { DownloadedEmail } from "@/lib/backgroundSync";

function formatTime(iso: string): string {
  try {
    const date = new Date(iso);
    return date.toLocaleString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function DownloadedEmailPreview({ email }: { email: DownloadedEmail }) {
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState(() =>
    normalizeEmailContent({ bodyHtml: email.bodyHtml, bodyText: email.bodyText }),
  );
  const { brand, detail } = extractSenderBrand(email.from);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    supabase
      .from("channel_messages")
      .select("body_html, body_text")
      .eq("id", email.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setContent(
          normalizeEmailContent({
            bodyHtml: data?.body_html ?? email.bodyHtml,
            bodyText: data?.body_text ?? email.bodyText,
          }),
        );
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [email.bodyHtml, email.bodyText, email.id]);

  const htmlContent = content.bodyHtml ?? renderEmailTextAsHtml(content.bodyText);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex flex-shrink-0 items-center gap-3 border-b border-border bg-card px-5 py-3">
        <CompanyLogo email={email.from} name={brand} size={36} className="flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-bold text-primary">{brand}</div>
          <div className="mt-0.5 truncate text-sm font-semibold text-foreground">{email.subject}</div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">
            {detail || email.from} — {formatTime(email.date)}
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0 bg-background">
        <div className="min-h-full">
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <EmailHtmlFrame html={htmlContent} mode="faithful" blockRemote={false} />
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
