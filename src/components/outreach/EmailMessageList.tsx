import { useEffect, useRef, useMemo } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Building2, User, Plane } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CompanyLogo } from "@/components/ui/CompanyLogo";
import { extractSenderBrand } from "./email/emailUtils";
import type { ChannelMessage } from "@/hooks/useChannelMessages";
import { cn } from "@/lib/utils";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useHoldingPatternEmails } from "@/hooks/useHoldingPatternEmails";

type Props = {
  messages: ChannelMessage[];
  selectedId: string | null;
  onSelect: (msg: ChannelMessage) => void;
  holdingFilter?: boolean;
};

const ROW_HEIGHT = 72;

function formatListDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return format(date, "dd/MM HH:mm", { locale: it });
}

export function EmailMessageList({ messages, selectedId, onSelect, holdingFilter = false }: Props) {
  const parentRef = useRef<HTMLDivElement>(null);
  
  // Collect all source IDs to check holding pattern status
  const sourceIds = useMemo(() => {
    const ids: { partnerId?: string; contactId?: string }[] = [];
    messages.forEach(msg => {
      if (msg.partner_id) ids.push({ partnerId: msg.partner_id });
      if (msg.source_type === "imported_contact" && msg.source_id) ids.push({ contactId: msg.source_id });
    });
    return ids;
  }, [messages]);
  
  const holdingSet = useHoldingPatternEmails(sourceIds);

  // Filter messages if holdingFilter is active
  const displayMessages = useMemo(() => {
    if (!holdingFilter) return messages;
    return messages.filter(msg => {
      if (msg.partner_id && holdingSet.has(`p:${msg.partner_id}`)) return true;
      if (msg.source_type === "imported_contact" && msg.source_id && holdingSet.has(`c:${msg.source_id}`)) return true;
      return false;
    });
  }, [messages, holdingFilter, holdingSet]);

  const virtualizer = useVirtualizer({
    count: displayMessages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5,
  });

  // Scroll to selected item when selection changes
  useEffect(() => {
    if (!selectedId) return;
    const idx = messages.findIndex((m) => m.id === selectedId);
    if (idx >= 0) {
      virtualizer.scrollToIndex(idx, { align: "auto" });
    }
  }, [selectedId, messages, virtualizer]);

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
          
          // Check if this message sender is in the holding pattern
          const isInHolding = msg.partner_id 
            ? holdingSet.has(`p:${msg.partner_id}`)
            : (msg.source_type === "imported_contact" && msg.source_id)
              ? holdingSet.has(`c:${msg.source_id}`)
              : false;

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
                isInHolding && "border-l-2 border-l-warning",
              )}
            >
              <div className="flex items-start gap-2.5">
                <CompanyLogo email={msg.from_address} name={brand} size={28} className="mt-0.5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className={cn("truncate text-sm", isUnread ? "font-semibold text-primary" : "font-medium")}>{brand}</span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {isInHolding && (
                        <Plane className="w-3 h-3 text-warning animate-pulse" />
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        {formatListDate(displayDate)}
                      </span>
                    </div>
                  </div>
                  <p className={cn("truncate text-xs", isUnread ? "text-foreground" : "text-muted-foreground")}>{msg.subject || "(nessun oggetto)"}</p>
                  <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{secondaryLine}</p>
                </div>
                {isUnread && <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-primary" />}
              </div>

              {(msg.source_type && msg.source_type !== "unknown" || isInHolding) && (
                <div className="ml-9 mt-1 flex items-center gap-1">
                  {msg.source_type && msg.source_type !== "unknown" && (
                    <Badge variant="outline" className="h-4 gap-0.5 text-[9px]">
                      {msg.source_type === "partner" && <Building2 className="h-2.5 w-2.5" />}
                      {msg.source_type === "partner_contact" && <User className="h-2.5 w-2.5" />}
                      {msg.source_type === "imported_contact" && <User className="h-2.5 w-2.5" />}
                      {msg.source_type.replace("_", " ")}
                    </Badge>
                  )}
                  {isInHolding && (
                    <Badge variant="outline" className="h-4 gap-0.5 text-[9px] border-warning/50 text-warning bg-warning/10">
                      <Plane className="h-2.5 w-2.5" />
                      Circuito
                    </Badge>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
