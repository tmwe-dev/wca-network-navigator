import { useEffect, useRef, useMemo } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Building2, User, Plane, MailOpen, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CompanyLogo, CompanyLogoInline, CountryFlag } from "@/components/ui/CompanyLogo";
import { extractSenderBrand } from "./email/emailUtils";
import type { ChannelMessage } from "@/hooks/useChannelMessages";
import { cn } from "@/lib/utils";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useHoldingPatternEmails } from "@/hooks/useHoldingPatternEmails";
import { useEmailAddressGroups } from "@/hooks/useEmailAddressGroups";
import { useMarkAsRead } from "@/hooks/useEmailActions";
import { EmailMessageActions } from "./EmailMessageActions";
import { InlineGroupAssigner } from "./email/InlineGroupAssigner";
import { DeepSearchEmailButton } from "@/v2/ui/organisms/sherlock/DeepSearchEmailButton";

type Props = {
  messages: ChannelMessage[];
  selectedId: string | null;
  onSelect: (msg: ChannelMessage) => void;
  holdingFilter?: boolean;
};

const ROW_HEIGHT = 132;

function formatListDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return format(date, "dd/MM HH:mm", { locale: it });
}

export function EmailMessageList({ messages, selectedId, onSelect, holdingFilter = false }: Props) {
  const parentRef = useRef<HTMLDivElement>(null);
  
  const sourceIds = useMemo(() => {
    const ids: { partnerId?: string; contactId?: string }[] = [];
    messages.forEach(msg => {
      if (msg.partner_id) ids.push({ partnerId: msg.partner_id });
      if (msg.source_type === "imported_contact" && msg.source_id) ids.push({ contactId: msg.source_id });
    });
    return ids;
  }, [messages]);
  
  const holdingSet = useHoldingPatternEmails(sourceIds);
  const { getGroup } = useEmailAddressGroups();
  const markRead = useMarkAsRead();

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

  useEffect(() => {
    if (!selectedId) return;
    const idx = displayMessages.findIndex((m) => m.id === selectedId);
    if (idx >= 0) {
      virtualizer.scrollToIndex(idx, { align: "auto" });
    }
  }, [selectedId, displayMessages, virtualizer]);

  return (
    <div ref={parentRef} className="flex-1 min-h-0 overflow-auto">
      <div style={{ height: `${virtualizer.getTotalSize()}px`, width: "100%", position: "relative" }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const msg = displayMessages[virtualRow.index];
          const isUnread = !msg.read_at;
          const isSelected = msg.id === selectedId;
          const { brand } = extractSenderBrand(msg.from_address || "");
          const displayDate = msg.email_date || msg.created_at;
          const secondaryLine = msg.from_address || msg.to_address || "(mittente sconosciuto)";
          
          const isInHolding = msg.partner_id 
            ? holdingSet.has(`p:${msg.partner_id}`)
            : (msg.source_type === "imported_contact" && msg.source_id)
              ? holdingSet.has(`c:${msg.source_id}`)
              : false;

          const group = getGroup(msg.from_address);

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
                <CompanyLogo email={msg.from_address} name={brand} size={36} className="mt-0.5 flex-shrink-0" showFlag />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className={cn("truncate text-sm flex items-center gap-1.5", isUnread ? "font-semibold text-primary" : "font-medium")}>
                      {brand}
                      <CompanyLogoInline email={msg.from_address} size={16} />
                    </span>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {isInHolding && (
                        <Plane className="w-3 h-3 text-warning animate-pulse" />
                      )}
                      <CountryFlag email={msg.from_address} size={20} />
                      <span className="text-[10px] text-muted-foreground">
                        {formatListDate(displayDate)}
                      </span>
                    </div>
                  </div>
                  <p className={cn("truncate text-xs", isUnread ? "text-foreground" : "text-muted-foreground")}>{msg.subject || "(nessun oggetto)"}</p>
                  <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{secondaryLine}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    {group?.groupName ? (
                      <span
                        className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-medium leading-tight"
                        style={{
                          backgroundColor: `${group.groupColor ?? "#3B82F6"}20`,
                          color: group.groupColor ?? "#3B82F6",
                        }}
                        title={`Gruppo: ${group.groupName}`}
                      >
                        {group.groupIcon && <span>{group.groupIcon}</span>}
                        <span className="truncate max-w-[140px]">{group.groupName}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-medium leading-tight text-muted-foreground/70 border border-dashed border-border">
                        <span>Senza gruppo</span>
                      </span>
                    )}
                    <span
                      className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-medium leading-tight text-muted-foreground/70"
                      title="Suggerimento AI: in arrivo"
                    >
                      <Sparkles className="h-2.5 w-2.5" />
                      <span>AI: —</span>
                    </span>
                  </div>
                </div>
                {isUnread && (
                  <button
                    type="button"
                    title="Segna come letta"
                    onClick={(e) => {
                      e.stopPropagation();
                      markRead.mutate({ id: msg.id, channel: msg.channel, user_id: msg.user_id });
                    }}
                    className="mt-1 inline-flex h-5 items-center gap-0.5 rounded-md border border-primary/30 bg-primary/10 px-1.5 text-[9px] font-medium text-primary hover:bg-primary/20"
                  >
                    <MailOpen className="h-3 w-3" />
                  </button>
                )}
              </div>

              {msg.source_type && msg.source_type !== "unknown" && (
                <div className="ml-9 mt-1 flex items-center justify-end gap-1">
                  <Badge variant="outline" className="h-4 gap-0.5 text-[9px]">
                    {msg.source_type === "partner" && <Building2 className="h-2.5 w-2.5" />}
                    {msg.source_type === "partner_contact" && <User className="h-2.5 w-2.5" />}
                    {msg.source_type === "imported_contact" && <User className="h-2.5 w-2.5" />}
                    {msg.source_type.replace("_", " ")}
                  </Badge>
                </div>
              )}

              <div
                className="ml-9 mt-1.5 flex flex-wrap items-center justify-end gap-1"
                onClick={(e) => e.stopPropagation()}
              >
                <DeepSearchEmailButton
                  email={(msg.from_address?.match(/<(.+?)>/)?.[1] || msg.from_address || "")}
                  source={{ displayName: brand, partnerId: msg.partner_id ?? null }}
                  size="sm"
                  variant="outline"
                  label="Deep Search"
                  className="h-6 gap-1 text-[10px]"
                />
                <EmailMessageActions message={msg} />
                <InlineGroupAssigner
                  fromAddress={msg.from_address}
                  currentGroupName={group?.groupName ?? null}
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
