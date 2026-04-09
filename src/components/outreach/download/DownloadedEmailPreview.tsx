import { useMemo } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { CompanyLogo, CompanyLogoInline, CountryFlag } from "@/components/ui/CompanyLogo";
import { EmailHtmlFrame } from "@/components/outreach/email/EmailHtmlFrame";
import {
  normalizeEmailContent,
  renderEmailTextAsHtml,
} from "@/components/outreach/email/emailContentNormalization";
import { extractSenderBrand } from "@/components/outreach/email/emailUtils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEmailMessageContent } from "@/hooks/useEmailMessageContent";
import type { DownloadedEmail } from "@/lib/backgroundSync";

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function DownloadedEmailPreview({ email }: { email: DownloadedEmail }) {
  const { brand, detail } = extractSenderBrand(email.from);
  const { bodyHtml, bodyText, isLoading, isError } = useEmailMessageContent(email.id, {
    bodyHtml: email.bodyHtml,
    bodyText: email.bodyText,
  });

  const content = useMemo(
    () => normalizeEmailContent({ bodyHtml, bodyText }),
    [bodyHtml, bodyText],
  );
  const hasContent = Boolean(content.bodyHtml || content.bodyText);
  const htmlContent = content.bodyHtml ?? renderEmailTextAsHtml(content.bodyText);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex flex-shrink-0 items-center gap-3 border-b border-border bg-card px-5 py-3">
        <CompanyLogo email={email.from} name={brand} size={36} className="flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-base font-bold text-primary">{brand}</span>
            <CompanyLogoInline email={email.from} size={20} />
          </div>
          <div className="mt-0.5 truncate text-sm font-semibold text-foreground">{email.subject}</div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">
            {detail || email.from} — {formatTime(email.date)}
          </div>
        </div>
        <CountryFlag email={email.from} size={24} className="flex-shrink-0" />
      </div>

      <ScrollArea className="flex-1 min-h-0 bg-background">
        <div className="min-h-full">
          {isLoading && !hasContent ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {isError && (
                <div className="border-b border-border bg-muted/40 px-5 py-2 text-xs text-muted-foreground">
                  <AlertCircle className="mr-1 inline h-3.5 w-3.5" />
                  Anteprima parziale: sto mostrando il contenuto già disponibile.
                </div>
              )}
              <EmailHtmlFrame html={htmlContent} mode="safe" blockRemote={false} />
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
