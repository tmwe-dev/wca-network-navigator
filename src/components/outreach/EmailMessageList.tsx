import { useEffect, useRef } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Building2, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CompanyLogo } from "@/components/ui/CompanyLogo";
import { extractSenderBrand } from "./email/emailUtils";
import type { ChannelMessage } from "@/hooks/useChannelMessages";
import { cn } from "@/lib/utils";
import { useVirtualizer } from "@tanstack/react-virtual";

type Props = {
  messages: ChannelMessage[];
  selectedId: string | null;
  onSelect: (msg: ChannelMessage) => void;
};

const ROW_HEIGHT = 72;

function formatListDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return format(date, "dd/MM HH:mm", { locale: it });
}

export function EmailMessageList({ messages, selectedId, onSelect }: Props) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5,
  });

  return (
    <div ref={parentRef} className="flex-1 min-h-0 overflow-auto">
      <div style={{ height: `${virtualizer.getTotalSize()}px`, width: "100%", position: "relative" }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const msg = messages[virtualRow.index];
          const isUnread = !msg.read_at;
          const isSelected = msg.id === selectedId;
          const { brand } = extractSenderBrand(msg.from_address || "");
          const displayDate = msg.email_date || msg.created_at;
          const secondaryLine = msg.from_address || msg.to_address || "(mittente sconosciuto)";

          return (
            <button
              key={msg.id}
              type="button"
              onClick={() => onSelect(msg)}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
              className={cn(
                "w-full p-3 text-left transition-colors hover:bg-muted/50 border-b border-border",
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
                      {formatListDate(displayDate)}
                    </span>
                  </div>
                  <p className={cn("truncate text-xs", isUnread ? "text-foreground" : "text-muted-foreground")}>{msg.subject || "(nessun oggetto)"}</p>
                  <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{secondaryLine}</p>
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
      </div>
    </div>
  );
}
