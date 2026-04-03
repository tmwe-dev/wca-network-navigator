import { useMemo, useRef, useEffect, useState } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { User, Building2, Paperclip, FileText, Image, Download, Users, Eye, Shield, ChevronDown, ChevronUp, ImageOff } from "lucide-react";
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

function decodeRfc2047(input: string): string {
  if (!input) return input;
  const joined = input.replace(/\?=\s+=\?/g, "?==?");
  return joined.replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_match, charset, encoding, text) => {
    try {
      const cs = (charset || "utf-8").trim().toLowerCase();
      if (encoding.toUpperCase() === "B") {
        const binary = atob(text);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        try { return new TextDecoder(cs).decode(bytes); }
        catch { return new TextDecoder("utf-8", { fatal: false }).decode(bytes); }
      }
      const decoded = text.replace(/_/g, " ")
        .replace(/=([0-9A-Fa-f]{2})/g, (_: string, hex: string) => String.fromCharCode(parseInt(hex, 16)));
      const bytes = new Uint8Array(decoded.length);
      for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
      try { return new TextDecoder(cs).decode(bytes); }
      catch { return decoded; }
    } catch { return text; }
  });
}

/**
 * Block remote images in HTML by replacing external src/url with placeholders.
 * Preserves data: URIs and cid: references (already resolved).
 */
function blockRemoteImages(html: string): string {
  // Replace img src with external URLs
  return html.replace(
    /(<img[^>]*\s+src\s*=\s*["'])(https?:\/\/[^"']+)(["'][^>]*>)/gi,
    '$1data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2248%22 height=%2248%22%3E%3Crect width=%2248%22 height=%2248%22 fill=%22%23e5e7eb%22/%3E%3Ctext x=%2224%22 y=%2228%22 text-anchor=%22middle%22 fill=%22%239ca3af%22 font-size=%2210%22%3E🖼%3C/text%3E%3C/svg%3E$3'
  );
}

/**
 * Vista A — Original Faithful View (iframe sandboxed, no sanitization)
 * Vista B — Safe Normalized View (DOMPurify, forced white bg)
 */
function EmailHtmlFrame({ html, mode, blockRemote }: { html: string; mode: "faithful" | "safe"; blockRemote: boolean }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument;
    if (!doc) return;

    let processedHtml = html;
    if (blockRemote) processedHtml = blockRemoteImages(processedHtml);

    const baseStyles = mode === "safe" ? `
      html, body {
        margin: 0; padding: 8px;
        background: #ffffff !important;
        color: #1a1a1a !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px; line-height: 1.5;
        word-wrap: break-word; overflow-wrap: break-word;
      }
      a { color: #2563eb !important; }
    ` : `
      html, body {
        margin: 0; padding: 8px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px; line-height: 1.5;
        word-wrap: break-word; overflow-wrap: break-word;
      }
    `;

    const wrappedHtml = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  ${baseStyles}
  img, svg, video, canvas, picture {
    max-width: 100% !important; height: auto !important; display: inline-block;
  }
  blockquote { border-left: 3px solid #d1d5db; margin: 8px 0; padding: 4px 12px; color: #6b7280; }
  pre, code { background: #f3f4f6; border-radius: 4px; padding: 2px 4px; font-size: 13px; overflow-x: auto; }
  table { border-collapse: collapse; max-width: 100%; }
  td, th { word-break: break-word; }
  .email-wrapper { overflow-x: auto; max-width: 100%; }
</style>
</head>
<body><div class="email-wrapper">${processedHtml}</div></body>
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
  }, [html, mode, blockRemote]);

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

function AttachmentThumbnail({ att, onDownload }: { att: any; onDownload: () => void }) {
  const isImage = att.content_type?.startsWith("image/");
  const [imgUrl, setImgUrl] = useState<string | null>(null);

  useEffect(() => {
    if (isImage && att.storage_path) {
      // Check if it's a data URI stored as path
      if (att.storage_path.startsWith("data:")) {
        setImgUrl(att.storage_path);
      } else {
        const { data } = supabase.storage.from("import-files").getPublicUrl(att.storage_path);
        if (data?.publicUrl) setImgUrl(data.publicUrl);
      }
    }
  }, [att.storage_path, isImage]);

  const Icon = getAttachmentIcon(att.content_type);

  return (
    <button onClick={onDownload}
      className="flex flex-col items-center gap-1.5 p-2 border border-border rounded-lg hover:bg-muted/50 transition-colors text-xs w-[140px]">
      {isImage && imgUrl ? (
        <img src={imgUrl} alt={att.filename} className="w-full h-16 object-cover rounded" />
      ) : (
        <div className="w-full h-16 flex items-center justify-center bg-muted/30 rounded">
          <Icon className="w-8 h-8 text-muted-foreground" />
        </div>
      )}
      <span className="truncate w-full text-center">{att.filename}</span>
      <div className="flex items-center gap-1 text-muted-foreground">
        {att.size_bytes && <span>{formatBytes(att.size_bytes)}</span>}
        <Download className="w-3 h-3" />
      </div>
    </button>
  );
}

export function EmailDetailView({ message, onClose }: Props) {
  const { data: attachments = [] } = useMessageAttachments(message.id);
  const [viewMode, setViewMode] = useState<"safe" | "faithful">("safe");
  const [blockRemote, setBlockRemote] = useState(true);
  const [showHeaders, setShowHeaders] = useState(false);
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
      // Data URI — open in new tab
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
            {/* Remote images toggle */}
            <Button
              size="sm" variant={blockRemote ? "secondary" : "ghost"}
              onClick={() => setBlockRemote(!blockRemote)} className="text-xs gap-1 h-7 px-2"
              title={blockRemote ? "Immagini remote bloccate" : "Immagini remote caricate"}
            >
              <ImageOff className="w-3 h-3" />
            </Button>
            {/* View mode toggle */}
            <Button
              size="sm" variant={viewMode === "safe" ? "secondary" : "ghost"}
              onClick={() => setViewMode("safe")} className="text-xs gap-1 h-7 px-2"
              title="Vista sicura (normalizzata)"
            >
              <Shield className="w-3 h-3" />
            </Button>
            <Button
              size="sm" variant={viewMode === "faithful" ? "secondary" : "ghost"}
              onClick={() => setViewMode("faithful")} className="text-xs gap-1 h-7 px-2"
              title="Vista fedele (originale)"
            >
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
        {/* Remote images warning */}
        {blockRemote && sanitizedHtml && message.body_html?.match(/https?:\/\//i) && (
          <button
            onClick={() => setBlockRemote(false)}
            className="flex items-center gap-1.5 text-[11px] text-amber-600 hover:text-amber-700 transition-colors"
          >
            <ImageOff className="w-3 h-3" />
            Immagini remote bloccate — clicca per caricare
          </button>
        )}
        {/* Expandable headers */}
        <button
          onClick={() => setShowHeaders(!showHeaders)}
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          {showHeaders ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          Dettagli tecnici
        </button>
        {showHeaders && (
          <div className="text-[10px] text-muted-foreground space-y-0.5 bg-muted/30 rounded p-2 font-mono">
            <div><span className="font-semibold">Message-ID:</span> {message.message_id_external}</div>
            {message.in_reply_to && <div><span className="font-semibold">In-Reply-To:</span> {message.in_reply_to}</div>}
            {message.raw_sha256 && <div><span className="font-semibold">SHA-256:</span> {message.raw_sha256}</div>}
            {message.imap_uid && <div><span className="font-semibold">IMAP UID:</span> {message.imap_uid}</div>}
            {message.uidvalidity && <div><span className="font-semibold">UIDVALIDITY:</span> {message.uidvalidity}</div>}
            {message.imap_flags && <div><span className="font-semibold">FLAGS:</span> {message.imap_flags}</div>}
            {message.internal_date && <div><span className="font-semibold">Internal Date:</span> {message.internal_date}</div>}
            {message.raw_size_bytes && <div><span className="font-semibold">Size:</span> {formatBytes(message.raw_size_bytes)}</div>}
            {message.parse_status && <div><span className="font-semibold">Parse:</span> {message.parse_status}</div>}
            {message.parse_warnings && message.parse_warnings.length > 0 && (
              <div><span className="font-semibold">Warnings:</span> {message.parse_warnings.join("; ")}</div>
            )}
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
          <EmailHtmlFrame html={sanitizedHtml} mode={viewMode} blockRemote={blockRemote} />
        ) : (
          <div className="bg-background text-foreground rounded-md p-4 whitespace-pre-wrap text-sm leading-relaxed border border-border">
            {message.body_text || "(corpo vuoto)"}
          </div>
        )}

        {/* Regular attachments with thumbnails */}
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

        {/* Inline images listed separately */}
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
