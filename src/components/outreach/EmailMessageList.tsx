import { useEffect, useRef, useMemo } from "react";
import { Building2, User, MailOpen, HelpCircle } from "lucide-react";
import { extractSenderBrand } from "./email/emailUtils";
import type { ChannelMessage } from "@/hooks/useChannelMessages";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useHoldingPatternEmails } from "@/hooks/useHoldingPatternEmails";
import { useEmailAddressGroups } from "@/hooks/useEmailAddressGroups";
import { useMarkAsRead } from "@/hooks/useEmailActions";
import { EmailMessageActions } from "./EmailMessageActions";
import { InlineGroupAssigner } from "./email/InlineGroupAssigner";
import { DeepSearchEmailButton } from "@/v2/ui/organisms/sherlock/DeepSearchEmailButton";
import { MailRowChrome } from "@/v2/ui/molecules/email/MailRowChrome";

type Props = {
  messages: ChannelMessage[];
  selectedId: string | null;
  onSelect: (msg: ChannelMessage) => void;
  holdingFilter?: boolean;
};

const ROW_HEIGHT = 168;

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
    measureElement: (el) => el.getBoundingClientRect().height,
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
          const groupColor = group?.groupColor ?? null;

          // Sorgente (partner / contact) mostrata come piccolo chip in alto a destra,
          // sopra al group badge — niente più chip “buttati al centro card”.
          const sourceChip = (msg.source_type && msg.source_type !== "unknown") ? (
            <span
              className="inline-flex items-center gap-1 rounded border border-border/60 bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
              title={msg.source_type.replace("_", " ")}
            >
              {msg.source_type === "partner"
                ? <Building2 className="h-2.5 w-2.5" />
                : <User className="h-2.5 w-2.5" />}
            </span>
          ) : null;

          const groupBadge = (
            <div className="flex items-center gap-1">
              {sourceChip}
              {group?.groupName ? (
                <span
                  className="inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-semibold text-foreground"
                  style={{
                    backgroundColor: groupColor ? `${groupColor}26` : undefined,
                    borderColor: groupColor ? `${groupColor}80` : undefined,
                  }}
                  title={`Gruppo: ${group.groupName}`}
                >
                  {groupColor && (
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: groupColor }}
                    />
                  )}
                  {group.groupIcon && <span>{group.groupIcon}</span>}
                  <span className="max-w-[140px] truncate">{group.groupName}</span>
                </span>
              ) : (
                <span
                  className="inline-flex items-center gap-1 rounded border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400"
                  title="Email non ancora assegnata a un gruppo"
                >
                  <HelpCircle className="h-3 w-3" />
                  Non classificata
                </span>
              )}
            </div>
          );

          const trailing = isUnread ? (
            <button
              type="button"
              title="Segna come letta"
              onClick={(e) => {
                e.stopPropagation();
                markRead.mutate({ id: msg.id, channel: msg.channel, user_id: msg.user_id });
              }}
              className="mt-1 inline-flex h-7 items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 text-xs font-medium text-primary hover:bg-primary/20"
            >
              <MailOpen className="h-3 w-3" />
            </button>
          ) : null;

          const actions = (
            <>
              <DeepSearchEmailButton
                email={(msg.from_address?.match(/<(.+?)>/)?.[1] || msg.from_address || "")}
                source={{ displayName: brand, partnerId: msg.partner_id ?? null }}
                size="sm"
                variant="outline"
                label="Deep Search"
                className="h-7 gap-1 text-[10px]"
              />
              <EmailMessageActions message={msg} />
              <InlineGroupAssigner
                fromAddress={msg.from_address}
                currentGroupName={group?.groupName ?? null}
              />
            </>
          );

          return (
            <div
              key={msg.id}
              ref={virtualizer.measureElement}
              data-index={virtualRow.index}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <MailRowChrome
                fromAddress={msg.from_address}
                brand={brand}
                subject={msg.subject || "(nessun oggetto)"}
                secondaryLine={secondaryLine}
                date={displayDate}
                isUnread={isUnread}
                isSelected={isSelected}
                inHolding={isInHolding}
                size="sm"
                previewText={(msg.body_text || "").replace(/\s+/g, " ").trim().slice(0, 220) || null}
                groupBadge={groupBadge}
                groupColor={groupColor}
                trailing={trailing}
                actions={actions}
                onClick={() => onSelect(msg)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
