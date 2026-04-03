import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Mail, User, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ChannelMessage } from "@/hooks/useChannelMessages";

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
      {messages.map(msg => {
        const isUnread = !msg.read_at;
        const isSelected = msg.id === selectedId;
        const senderName = msg.raw_payload?.sender_name || msg.from_address || "Sconosciuto";
        const displayDate = msg.email_date || msg.created_at;

        return (
          <button
            key={msg.id}
            onClick={() => onSelect(msg)}
            className={cn(
              "w-full text-left p-3 hover:bg-muted/50 transition-colors",
              isSelected && "bg-muted",
              isUnread && "bg-primary/5"
            )}
          >
            <div className="flex items-start gap-2">
              <Mail className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-500" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className={cn("text-sm truncate", isUnread ? "font-semibold" : "font-normal")}>
                    {senderName}
                  </span>
                  <span className="text-[10px] text-muted-foreground flex-shrink-0">
                    {format(new Date(displayDate), "dd/MM HH:mm", { locale: it })}
                  </span>
                </div>
                <p className={cn("text-xs truncate", isUnread ? "text-foreground" : "text-muted-foreground")}>
                  {msg.subject || "(nessun oggetto)"}
                </p>
                <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                  {msg.body_text?.slice(0, 80)}
                </p>
              </div>
              {isUnread && <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />}
            </div>
            {msg.source_type && msg.source_type !== "unknown" && (
              <div className="mt-1 ml-6">
                <Badge variant="outline" className="text-[9px] h-4 gap-0.5">
                  {msg.source_type === "partner" && <Building2 className="w-2.5 h-2.5" />}
                  {msg.source_type === "partner_contact" && <User className="w-2.5 h-2.5" />}
                  {msg.source_type.replace("_", " ")}
                </Badge>
              </div>
            )}
          </button>
        );
      })}
      {hasMore && (
        <button
          onClick={onLoadMore}
          className="w-full p-3 text-xs text-primary hover:bg-muted/50 font-medium"
        >
          Carica altre email...
        </button>
      )}
    </div>
  );
}
