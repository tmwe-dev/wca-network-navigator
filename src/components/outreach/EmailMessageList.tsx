import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Building2, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CompanyLogo } from "@/components/ui/CompanyLogo";
import { normalizeEmailContent } from "@/components/outreach/email/emailContentNormalization";
import { extractSenderBrand } from "./email/emailUtils";
import type { ChannelMessage } from "@/hooks/useChannelMessages";
import { cn } from "@/lib/utils";

type Props = {
  messages: ChannelMessage[];
  selectedId: string | null;
  onSelect: (msg: ChannelMessage) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
};

export function EmailMessageList({ messages, selectedId, onSelect, onLoadMore, hasMore }: Props) {
  return (
    <div className="divide-y divide-border">
      {messages.map((msg) => {
        const isUnread = !msg.read_at;
        const isSelected = msg.id === selectedId;
        const { brand } = extractSenderBrand(msg.from_address || "");
        const displayDate = msg.email_date || msg.created_at;
        const { previewText } = normalizeEmailContent({ bodyHtml: msg.body_html, bodyText: msg.body_text });

        return (
          <button
            key={msg.id}
            onClick={() => onSelect(msg)}
            className={cn(
              "w-full p-3 text-left transition-colors hover:bg-muted/50",
              isSelected && "bg-muted",
              isUnread && "bg-primary/5",
            )}
          >
            <div className="flex items-start gap-2.5">
              <CompanyLogo email={msg.from_address} name={brand} size={28} className="mt-0.5 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className={cn("truncate text-sm", isUnread ? "font-semibold text-primary" : "font-medium")}>{brand}</span>
                  <span className="flex-shrink-0 text-[10px] text-muted-foreground">
                    {format(new Date(displayDate), "dd/MM HH:mm", { locale: it })}
                  </span>
                </div>
                <p className={cn("truncate text-xs", isUnread ? "text-foreground" : "text-muted-foreground")}>{msg.subject || "(nessun oggetto)"}</p>
                <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{previewText.slice(0, 120) || "(nessun contenuto)"}</p>
              </div>
              {isUnread && <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-primary" />}
            </div>

            {msg.source_type && msg.source_type !== "unknown" && (
              <div className="ml-9 mt-1">
                <Badge variant="outline" className="h-4 gap-0.5 text-[9px]">
                  {msg.source_type === "partner" && <Building2 className="h-2.5 w-2.5" />}
                  {msg.source_type === "partner_contact" && <User className="h-2.5 w-2.5" />}
                  {msg.source_type.replace("_", " ")}
                </Badge>
              </div>
            )}
          </button>
        );
      })}

      {hasMore && (
        <button onClick={onLoadMore} className="w-full p-3 text-xs font-medium text-primary hover:bg-muted/50">
          Carica altre email...
        </button>
      )}
    </div>
  );
}
