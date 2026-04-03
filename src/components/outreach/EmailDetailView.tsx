import { useMemo } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { User, Building2, Paperclip, FileText, Image, Download } from "lucide-react";
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

export function EmailDetailView({ message, onClose }: Props) {
  const { data: attachments = [] } = useMessageAttachments(message.id);
  const displayDate = message.email_date || message.created_at;

  const sanitizedHtml = useMemo(() => {
    if (!message.body_html) return null;
    return DOMPurify.sanitize(message.body_html, {
      USE_PROFILES: { html: true },
      ADD_TAGS: ["style"],
      ADD_ATTR: ["target", "style"],
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
            {message.subject || "(nessun oggetto)"}
          </h3>
          <Button size="sm" variant="ghost" onClick={onClose} className="text-xs">
            Chiudi
          </Button>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            {message.raw_payload?.sender_name || message.from_address}
          </span>
          <span>→</span>
          <span>{message.to_address}</span>
          <span>·</span>
          <span>{format(new Date(displayDate), "dd MMM yyyy HH:mm", { locale: it })}</span>
        </div>
        {message.source_type && message.source_type !== "unknown" && (
          <Badge variant="secondary" className="text-xs gap-1">
            {message.source_type === "partner" ? <Building2 className="w-3 h-3" /> : <User className="w-3 h-3" />}
            Associato: {message.raw_payload?.sender_name}
          </Badge>
        )}
      </div>

      <ScrollArea className="flex-1 p-4">
        {/* Email body — prefer HTML with sanitization, fallback to plain text */}
        {sanitizedHtml ? (
          <div
            className="prose prose-sm max-w-none text-sm"
            dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
          />
        ) : (
          <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm">
            {message.body_text || "(corpo vuoto)"}
          </div>
        )}

        {/* Attachments */}
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
