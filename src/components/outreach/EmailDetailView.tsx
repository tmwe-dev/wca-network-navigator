/**
 * Email detail view — orchestrates subcomponents for header, body, and attachments.
 */

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { User, Building2, Paperclip, Image, Users, Eye, Shield, ImageOff } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import DOMPurify from "dompurify";
import { useMessageAttachments, type ChannelMessage } from "@/hooks/useChannelMessages";
import { supabase } from "@/integrations/supabase/client";
import { decodeRfc2047 } from "./email/emailUtils";
import { EmailHtmlFrame } from "./email/EmailHtmlFrame";
import { AttachmentThumbnail } from "./email/AttachmentThumbnail";
import { EmailTechnicalHeaders } from "./email/EmailTechnicalHeaders";

type Props = {
  message: ChannelMessage;
  onClose: () => void;
};

export function EmailDetailView({ message, onClose }: Props) {
  const { data: attachments = [] } = useMessageAttachments(message.id);
  const [viewMode, setViewMode] = useState<"safe" | "faithful">("safe");
  const [blockRemote, setBlockRemote] = useState(false);
  const displayDate = message.email_date || message.created_at;

  const decodedSubject = useMemo(() => decodeRfc2047(message.subject || "(nessun oggetto)"), [message.subject]);
  const decodedSender = useMemo(() => decodeRfc2047(message.raw_payload?.sender_name || message.from_address || ""), [message.raw_payload?.sender_name, message.from_address]);

  const sanitizedHtml = useMemo(() => {
    if (!message.body_html) return null;
    if (viewMode === "faithful") return message.body_html;
    return DOMPurify.sanitize(message.body_html, {
      USE_PROFILES: { html: true },
      ADD_TAGS: ["style", "center"],
      ADD_ATTR: ["target", "style", "class", "bgcolor", "background", "align", "valign", "width", "height", "cellpadding", "cellspacing", "border", "color", "face", "size"],
      ALLOW_DATA_ATTR: true,
      FORBID_TAGS: ["script", "form", "input", "textarea", "select", "button"],
      FORBID_ATTR: ["onload", "onerror", "onclick", "onmouseover", "onfocus", "onblur"],
    });
  }, [message.body_html, viewMode]);

  const handleDownload = async (att: typeof attachments[0]) => {
    if (att.storage_path.startsWith("data:")) {
      const w = window.open();
      if (w) { w.document.write(`<img src="${att.storage_path}" />`); }
      return;
    }
    const { data } = supabase.storage.from("import-files").getPublicUrl(att.storage_path);
    if (data?.publicUrl) window.open(data.publicUrl, "_blank");
  };

  const regularAttachments = attachments.filter(a => !a.is_inline);
  const inlineAttachments = attachments.filter(a => a.is_inline);

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-border space-y-1">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold truncate">{decodedSubject}</h3>
          <div className="flex items-center gap-1">
            <Button size="sm" variant={blockRemote ? "secondary" : "ghost"}
              onClick={() => setBlockRemote(!blockRemote)} className="text-xs gap-1 h-7 px-2"
              title={blockRemote ? "Immagini remote bloccate" : "Immagini remote caricate"}>
              <ImageOff className="w-3 h-3" />
            </Button>
            <Button size="sm" variant={viewMode === "safe" ? "secondary" : "ghost"}
              onClick={() => setViewMode("safe")} className="text-xs gap-1 h-7 px-2"
              title="Vista sicura (normalizzata)">
              <Shield className="w-3 h-3" />
            </Button>
            <Button size="sm" variant={viewMode === "faithful" ? "secondary" : "ghost"}
              onClick={() => setViewMode("faithful")} className="text-xs gap-1 h-7 px-2"
              title="Vista fedele (originale)">
              <Eye className="w-3 h-3" />
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose} className="text-xs">Chiudi</Button>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
          <span className="font-medium text-foreground">{decodedSender}</span>
          <span>→</span>
          <span>{message.to_address}</span>
          <span>·</span>
          <span>{format(new Date(displayDate), "dd MMM yyyy HH:mm", { locale: it })}</span>
        </div>
        {message.cc_addresses && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Users className="w-3 h-3" />
            <span className="font-medium">CC:</span>
            <span className="truncate">{message.cc_addresses}</span>
          </div>
        )}
        {blockRemote && sanitizedHtml && message.body_html?.match(/https?:\/\//i) && (
          <button onClick={() => setBlockRemote(false)}
            className="flex items-center gap-1.5 text-[11px] text-amber-600 hover:text-amber-700 transition-colors">
            <ImageOff className="w-3 h-3" />
            Immagini remote bloccate — clicca per caricare
          </button>
        )}
        <EmailTechnicalHeaders message={message} />
        {message.source_type && message.source_type !== "unknown" && (
          <Badge variant="secondary" className="text-xs gap-1">
            {message.source_type === "partner" ? <Building2 className="w-3 h-3" /> : <User className="w-3 h-3" />}
            Associato: {decodedSender}
          </Badge>
        )}
      </div>

      <ScrollArea className="flex-1 p-4">
        {sanitizedHtml ? (
          <EmailHtmlFrame html={sanitizedHtml} mode={viewMode} blockRemote={blockRemote} />
        ) : (
          <div className="bg-background text-foreground rounded-md p-4 whitespace-pre-wrap text-sm leading-relaxed border border-border">
            {message.body_text || "(corpo vuoto)"}
          </div>
        )}

        {regularAttachments.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-2">
              <Paperclip className="w-3.5 h-3.5" />
              {regularAttachments.length} allegat{regularAttachments.length === 1 ? "o" : "i"}
            </div>
            <div className="flex flex-wrap gap-2">
              {regularAttachments.map(att => (
                <AttachmentThumbnail key={att.id} att={att} onDownload={() => handleDownload(att)} />
              ))}
            </div>
          </div>
        )}

        {inlineAttachments.length > 0 && (
          <div className="mt-2 text-[11px] text-muted-foreground">
            <Image className="w-3 h-3 inline mr-1" />
            {inlineAttachments.length} immagin{inlineAttachments.length === 1 ? "e" : "i"} inline
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
