import { useMemo, useRef, useEffect } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { User, Building2, Paperclip, FileText, Image, Download, Users } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import DOMPurify from "dompurify";
import { useMessageAttachments, type ChannelMessage } from "@/hooks/useChannelMessages";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  message: ChannelMessage;
  onClose: () => void;
};

function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getAttachmentIcon(contentType: string | null) {
  if (contentType?.startsWith("image/")) return Image;
  return FileText;
}

/**
 * RFC 2047 — Decode encoded-words in email headers.
 * Handles =?charset?Q?text?= and =?charset?B?text?=
 */
function decodeRfc2047(input: string): string {
  if (!input) return input;
  const joined = input.replace(/\?=\s+=\?/g, "?==?");
  return joined.replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_match, _charset, encoding, text) => {
    try {
      if (encoding.toUpperCase() === "B") {
        return atob(text);
      }
      return text
        .replace(/_/g, " ")
        .replace(/=([0-9A-Fa-f]{2})/g, (_: string, hex: string) => String.fromCharCode(parseInt(hex, 16)));
    } catch {
      return text;
    }
  });
}

/**
 * Render HTML email body inside a sandboxed iframe.
 * Uses adaptive background detection: if the email HTML sets its own background,
 * we respect it; otherwise we default to white with dark text for maximum readability.
 * All images are constrained to max-width:100% to prevent overflow.
 */
function EmailHtmlFrame({ html }: { html: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const doc = iframe.contentDocument;
    if (!doc) return;

    const wrappedHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    html, body {
      margin: 0;
      padding: 8px;
      background: #ffffff;
      color: #1a1a1a;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      line-height: 1.5;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    /* Adaptive: if email sets its own bg, auto-adjust text contrast */
    body[style*="background"], body[bgcolor],
    div[style*="background"], table[style*="background"],
    table[bgcolor] {
      color: inherit;
    }
    img {
      max-width: 100% !important;
      height: auto !important;
      display: inline-block;
    }
    /* Handle all image types including SVG, WebP, BMP */
    img[src$=".svg"], img[src$=".webp"], img[src$=".bmp"],
    img[src$=".gif"], img[src$=".png"], img[src$=".jpg"], img[src$=".jpeg"] {
      max-width: 100% !important;
      height: auto !important;
    }
    /* Data URI images */
    img[src^="data:"] {
      max-width: 100% !important;
      height: auto !important;
    }
    a { color: #2563eb; }
    blockquote {
      border-left: 3px solid #d1d5db;
      margin: 8px 0;
      padding: 4px 12px;
      color: #6b7280;
    }
    pre, code {
      background: #f3f4f6;
      border-radius: 4px;
      padding: 2px 4px;
      font-size: 13px;
      overflow-x: auto;
    }
    table { border-collapse: collapse; max-width: 100%; }
    td, th { word-break: break-word; }
    /* Prevent horizontal overflow from wide tables */
    .email-wrapper { overflow-x: auto; max-width: 100%; }
  </style>
</head>
<body><div class="email-wrapper">${html}</div></body>
</html>`;

    doc.open();
    doc.write(wrappedHtml);
    doc.close();

    const resizeObserver = new ResizeObserver(() => {
      const h = doc.documentElement?.scrollHeight || doc.body?.scrollHeight || 300;
      iframe.style.height = `${h}px`;
    });

    setTimeout(() => {
      if (doc.body) resizeObserver.observe(doc.body);
      const h = doc.documentElement?.scrollHeight || doc.body?.scrollHeight || 300;
      iframe.style.height = `${h}px`;
    }, 100);

    return () => resizeObserver.disconnect();
  }, [html]);

  return (
    <iframe
      ref={iframeRef}
      sandbox="allow-same-origin"
      className="w-full border-0 min-h-[200px]"
      style={{ height: "300px" }}
      title="Email content"
    />
  );
}

export function EmailDetailView({ message, onClose }: Props) {
  const { data: attachments = [] } = useMessageAttachments(message.id);
  const displayDate = message.email_date || message.created_at;

  const decodedSubject = useMemo(() => decodeRfc2047(message.subject || "(nessun oggetto)"), [message.subject]);
  const decodedSender = useMemo(() => decodeRfc2047(message.raw_payload?.sender_name || message.from_address || ""), [message.raw_payload?.sender_name, message.from_address]);

  const sanitizedHtml = useMemo(() => {
    if (!message.body_html) return null;
    return DOMPurify.sanitize(message.body_html, {
      USE_PROFILES: { html: true },
      ADD_TAGS: ["style", "center"],
      ADD_ATTR: ["target", "style", "class", "bgcolor", "background", "align", "valign", "width", "height", "cellpadding", "cellspacing", "border", "color", "face", "size"],
      ALLOW_DATA_ATTR: true,
    });
  }, [message.body_html]);

  const handleDownload = async (att: typeof attachments[0]) => {
    const { data } = supabase.storage
      .from("import-files")
      .getPublicUrl(att.storage_path);
    if (data?.publicUrl) {
      window.open(data.publicUrl, "_blank");
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="flex-shrink-0 p-4 border-b border-border space-y-1">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold truncate">
            {decodedSubject}
          </h3>
          <Button size="sm" variant="ghost" onClick={onClose} className="text-xs">
            Chiudi
          </Button>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
          <span className="font-medium text-foreground">
            {decodedSender}
          </span>
          <span>→</span>
          <span>{message.to_address}</span>
          <span>·</span>
          <span>{format(new Date(displayDate), "dd MMM yyyy HH:mm", { locale: it })}</span>
        </div>
        {/* CC recipients */}
        {message.cc_addresses && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Users className="w-3 h-3" />
            <span className="font-medium">CC:</span>
            <span className="truncate">{message.cc_addresses}</span>
          </div>
        )}
        {message.source_type && message.source_type !== "unknown" && (
          <Badge variant="secondary" className="text-xs gap-1">
            {message.source_type === "partner" ? <Building2 className="w-3 h-3" /> : <User className="w-3 h-3" />}
            Associato: {decodedSender}
          </Badge>
        )}
      </div>

      <ScrollArea className="flex-1 p-4">
        {sanitizedHtml ? (
          <EmailHtmlFrame html={sanitizedHtml} />
        ) : (
          <div className="bg-white text-gray-900 rounded-md p-4 whitespace-pre-wrap text-sm leading-relaxed">
            {message.body_text || "(corpo vuoto)"}
          </div>
        )}

        {attachments.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-2">
              <Paperclip className="w-3.5 h-3.5" />
              {attachments.length} allegat{attachments.length === 1 ? "o" : "i"}
            </div>
            <div className="flex flex-wrap gap-2">
              {attachments.map(att => {
                const Icon = getAttachmentIcon(att.content_type);
                return (
                  <button
                    key={att.id}
                    onClick={() => handleDownload(att)}
                    className="flex items-center gap-2 px-3 py-2 border border-border rounded-md hover:bg-muted/50 transition-colors text-xs max-w-[220px]"
                  >
                    <Icon className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                    <span className="truncate">{att.filename}</span>
                    {att.size_bytes && (
                      <span className="text-muted-foreground flex-shrink-0">
                        {formatBytes(att.size_bytes)}
                      </span>
                    )}
                    <Download className="w-3 h-3 flex-shrink-0 text-muted-foreground" />
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
