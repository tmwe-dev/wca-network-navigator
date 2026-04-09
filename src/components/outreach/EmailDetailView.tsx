/**
 * Email detail view — orchestrates subcomponents for header, body, and attachments.
 */

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { AlertCircle, Building2, Eye, Image, ImageOff, Loader2, Paperclip, Reply, ReplyAll, Forward, Shield, User, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import DOMPurify from "dompurify";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMessageAttachments, type ChannelMessage } from "@/hooks/useChannelMessages";
import { useEmailMessageContent } from "@/hooks/useEmailMessageContent";
import { supabase } from "@/integrations/supabase/client";
import { CompanyLogo } from "@/components/ui/CompanyLogo";
import { normalizeEmailContent } from "@/components/outreach/email/emailContentNormalization";
import { decodeRfc2047, extractSenderBrand } from "./email/emailUtils";
import { EmailHtmlFrame } from "./email/EmailHtmlFrame";
import { AttachmentThumbnail } from "./email/AttachmentThumbnail";
import { EmailTechnicalHeaders } from "./email/EmailTechnicalHeaders";

type Props = {
  message: ChannelMessage;
  onClose: () => void;
};

function formatDisplayDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Data non disponibile";
  }

  return format(date, "dd MMM yyyy HH:mm", { locale: it });
}

export function EmailDetailView({ message, onClose }: Props) {
  const navigate = useNavigate();
  const { data: attachments = [] } = useMessageAttachments(message.id);
  const [viewMode, setViewMode] = useState<"safe" | "faithful">("safe");
  const [blockRemote, setBlockRemote] = useState(false);
  const displayDate = message.email_date || message.created_at;
  const { bodyHtml, bodyText, isLoading: isContentLoading, isError: isContentError } = useEmailMessageContent(message.id, {
    bodyHtml: message.body_html,
    bodyText: message.body_text,
  });

  const decodedSubject = useMemo(() => decodeRfc2047(message.subject || "(nessun oggetto)"), [message.subject]);
  const { brand, detail: senderDetail } = useMemo(() => extractSenderBrand(message.from_address || ""), [message.from_address]);
  const normalizedContent = useMemo(
    () => normalizeEmailContent({ bodyHtml, bodyText }),
    [bodyHtml, bodyText],
  );
  const hasContent = Boolean(normalizedContent.bodyHtml || normalizedContent.bodyText);

  const sanitizedHtml = useMemo(() => {
    if (!normalizedContent.bodyHtml) return null;
    if (viewMode === "faithful") return normalizedContent.bodyHtml;

    return DOMPurify.sanitize(normalizedContent.bodyHtml, {
      USE_PROFILES: { html: true },
      ADD_TAGS: ["style", "center"],
      ADD_ATTR: ["target", "style", "class", "bgcolor", "background", "align", "valign", "width", "height", "cellpadding", "cellspacing", "border", "color", "face", "size"],
      ALLOW_DATA_ATTR: true,
      FORBID_TAGS: ["script", "form", "input", "textarea", "select", "button"],
      FORBID_ATTR: ["onload", "onerror", "onclick", "onmouseover", "onfocus", "onblur"],
    });
  }, [normalizedContent.bodyHtml, viewMode]);

  const handleDownload = async (attachment: typeof attachments[0]) => {
    if (attachment.storage_path.startsWith("data:")) {
      const win = window.open();
      if (win) win.document.write(`<img src="${attachment.storage_path}" />`);
      return;
    }

    const { data } = supabase.storage.from("import-files").getPublicUrl(attachment.storage_path);
    if (data?.publicUrl) window.open(data.publicUrl, "_blank");
  };

  const regularAttachments = attachments.filter((attachment) => !attachment.is_inline);
  const inlineAttachments = attachments.filter((attachment) => attachment.is_inline);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex-shrink-0 space-y-1 border-b border-border p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <CompanyLogo email={message.from_address} name={brand} size={36} className="flex-shrink-0" showFlag />
            <div className="min-w-0 flex-1">
              <div className="truncate text-base font-bold text-primary">{brand}</div>
              <h3 className="truncate text-sm font-semibold">{decodedSubject}</h3>
            </div>
          </div>

          <div className="flex flex-shrink-0 items-center gap-1">
            <Button
              size="sm"
              variant={blockRemote ? "secondary" : "ghost"}
              onClick={() => setBlockRemote((prev) => !prev)}
              className="h-7 gap-1 px-2 text-xs"
              title={blockRemote ? "Immagini remote bloccate" : "Immagini remote caricate"}
            >
              <ImageOff className="h-3 w-3" />
            </Button>
            <Button size="sm" variant={viewMode === "safe" ? "secondary" : "ghost"} onClick={() => setViewMode("safe")} className="h-7 gap-1 px-2 text-xs" title="Vista sicura (normalizzata)">
              <Shield className="h-3 w-3" />
            </Button>
            <Button size="sm" variant={viewMode === "faithful" ? "secondary" : "ghost"} onClick={() => setViewMode("faithful")} className="h-7 gap-1 px-2 text-xs" title="Vista fedele (originale)">
              <Eye className="h-3 w-3" />
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose} className="text-xs">Chiudi</Button>
          </div>
        </div>

        <div className="ml-12 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{senderDetail || message.from_address}</span>
          <span>→</span>
          <span>{message.to_address}</span>
          <span>·</span>
          <span>{formatDisplayDate(displayDate)}</span>
        </div>

        {message.cc_addresses && (
          <div className="ml-12 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Users className="h-3 w-3" />
            <span className="font-medium">CC:</span>
            <span className="truncate">{message.cc_addresses}</span>
          </div>
        )}

        {blockRemote && sanitizedHtml && normalizedContent.bodyHtml?.match(/https?:\/\//i) && (
          <button onClick={() => setBlockRemote(false)} className="ml-12 flex items-center gap-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground">
            <ImageOff className="h-3 w-3" />
            Immagini remote bloccate — clicca per caricare
          </button>
        )}

        <EmailTechnicalHeaders message={message} />

        {message.source_type && message.source_type !== "unknown" && (
          <Badge variant="secondary" className="ml-12 gap-1 text-xs">
            {message.source_type === "partner" ? <Building2 className="h-3 w-3" /> : <User className="h-3 w-3" />}
            Associato: {brand}
          </Badge>
        )}

        {/* Reply / Forward actions */}
        <div className="ml-12 flex items-center gap-1 mt-2">
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 text-xs"
            onClick={() => {
              const replySubject = decodedSubject.startsWith("Re:") ? decodedSubject : `Re: ${decodedSubject}`;
              const quoteText = normalizedContent.bodyText
                ? `\n\n---\nDa: ${message.from_address}\nData: ${formatDisplayDate(displayDate)}\n\n${normalizedContent.bodyText}`
                : "";
              navigate("/email-composer", {
                state: {
                  prefilledRecipient: {
                    email: message.from_address?.match(/<(.+?)>/)?.[1] || message.from_address || "",
                    name: brand,
                    company: brand,
                  },
                  prefilledSubject: replySubject,
                  prefilledBody: quoteText,
                },
              });
            }}
          >
            <Reply className="h-3 w-3" /> Rispondi
          </Button>
          {message.cc_addresses && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1.5 text-xs"
              onClick={() => {
                const replySubject = decodedSubject.startsWith("Re:") ? decodedSubject : `Re: ${decodedSubject}`;
                navigate("/email-composer", {
                  state: {
                    prefilledRecipient: {
                      email: message.from_address?.match(/<(.+?)>/)?.[1] || message.from_address || "",
                      name: brand,
                      company: brand,
                    },
                    prefilledSubject: replySubject,
                  },
                });
              }}
            >
              <ReplyAll className="h-3 w-3" /> Tutti
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1.5 text-xs"
            onClick={() => {
              const fwdSubject = decodedSubject.startsWith("Fwd:") ? decodedSubject : `Fwd: ${decodedSubject}`;
              navigate("/email-composer", {
                state: {
                  prefilledSubject: fwdSubject,
                  prefilledBody: normalizedContent.bodyText
                    ? `\n\n--- Forwarded ---\nDa: ${message.from_address}\nData: ${formatDisplayDate(displayDate)}\nOggetto: ${decodedSubject}\n\n${normalizedContent.bodyText}`
                    : "",
                },
              });
            }}
          >
            <Forward className="h-3 w-3" /> Inoltra
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="space-y-4 p-4">
          {isContentError && (
            <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <AlertCircle className="mr-1 inline h-3.5 w-3.5" />
              Contenuto caricato in modo parziale: sto mostrando la versione disponibile.
            </div>
          )}

          {isContentLoading && !hasContent ? (
            <div className="flex h-40 items-center justify-center rounded-md border border-border bg-background">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : sanitizedHtml ? (
            <EmailHtmlFrame html={sanitizedHtml} mode={viewMode} blockRemote={blockRemote} />
          ) : (
            <div className="rounded-md border border-border bg-background p-4 text-sm leading-relaxed text-foreground whitespace-pre-wrap">
              {normalizedContent.bodyText || "(corpo vuoto)"}
            </div>
          )}

          {regularAttachments.length > 0 && (
            <div className="border-t border-border pt-4">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Paperclip className="h-3.5 w-3.5" />
                {regularAttachments.length} allegat{regularAttachments.length === 1 ? "o" : "i"}
              </div>
              <div className="flex flex-wrap gap-2">
                {regularAttachments.map((attachment) => (
                  <AttachmentThumbnail key={attachment.id} att={attachment} onDownload={() => handleDownload(attachment)} />
                ))}
              </div>
            </div>
          )}

          {inlineAttachments.length > 0 && (
            <div className="text-[11px] text-muted-foreground">
              <Image className="mr-1 inline h-3 w-3" />
              {inlineAttachments.length} immagin{inlineAttachments.length === 1 ? "e" : "i"} inline
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
