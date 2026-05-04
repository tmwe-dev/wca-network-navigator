/**
 * FunnemailMailList — virtualizer della lista email del client Funnemail.
 */
import { useEffect, useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useNavigate } from "react-router-dom";
import { useHoldingPatternEmails } from "@/hooks/useHoldingPatternEmails";
import { useEmailAddressGroups } from "@/hooks/useEmailAddressGroups";
import type { ChannelMessage } from "@/hooks/useChannelMessages";
import { extractSenderBrand } from "@/components/outreach/email/emailUtils";
import { stripReplyPrefixes } from "./utils";
import { FunnemailMailCard } from "./FunnemailMailCard";

const ROW_HEIGHT = 132;

interface Props {
  messages: ChannelMessage[];
  selectedId: string | null;
  onSelect: (msg: ChannelMessage) => void;
}

export function FunnemailMailList({ messages, selectedId, onSelect }: Props) {
  const parentRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { getGroup } = useEmailAddressGroups();

  const sourceIds = useMemo(() => {
    const ids: { partnerId?: string; contactId?: string }[] = [];
    messages.forEach((msg) => {
      if (msg.partner_id) ids.push({ partnerId: msg.partner_id });
      if (msg.source_type === "imported_contact" && msg.source_id) ids.push({ contactId: msg.source_id });
    });
    return ids;
  }, [messages]);

  const holdingSet = useHoldingPatternEmails(sourceIds);

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5,
  });

  useEffect(() => {
    if (!selectedId) return;
    const idx = messages.findIndex((m) => m.id === selectedId);
    if (idx >= 0) virtualizer.scrollToIndex(idx, { align: "auto" });
  }, [selectedId, messages, virtualizer]);

  const goCompose = (msg: ChannelMessage, mode: "reply" | "forward") => {
    const { brand } = extractSenderBrand(msg.from_address || "");
    const cleanSubject = stripReplyPrefixes(msg.subject) || "(nessun oggetto)";
    const subject = mode === "reply" ? `Re: ${cleanSubject}` : `Fwd: ${cleanSubject}`;
    navigate("/v2/email-composer", {
      state: {
        prefilledRecipient:
          mode === "reply"
            ? {
                email: msg.from_address?.match(/<(.+?)>/)?.[1] || msg.from_address || "",
                name: brand,
                company: brand,
              }
            : undefined,
        prefilledSubject: subject,
        prefilledBody:
          mode === "forward" && msg.body_text
            ? `\n\n--- Forwarded ---\nDa: ${msg.from_address}\nOggetto: ${cleanSubject}\n\n${msg.body_text}`
            : "",
      },
    });
  };

  if (messages.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-xs text-muted-foreground">
        Nessuna email in questa cartella
      </div>
    );
  }

  return (
    <div ref={parentRef} className="min-h-0 flex-1 overflow-auto">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((row) => {
          const msg = messages[row.index];
          const inHolding = msg.partner_id
            ? holdingSet.has(`p:${msg.partner_id}`)
            : msg.source_type === "imported_contact" && msg.source_id
              ? holdingSet.has(`c:${msg.source_id}`)
              : false;
          const group = getGroup(msg.from_address);
          return (
            <div
              key={msg.id}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: `${row.size}px`,
                transform: `translateY(${row.start}px)`,
              }}
            >
              <FunnemailMailCard
                message={msg}
                selected={msg.id === selectedId}
                inHolding={inHolding}
                groupName={group?.groupName ?? null}
                groupColor={group?.groupColor ?? null}
                groupIcon={group?.groupIcon ?? null}
                onSelect={() => onSelect(msg)}
                onReply={() => goCompose(msg, "reply")}
                onForward={() => goCompose(msg, "forward")}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}