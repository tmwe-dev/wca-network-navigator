/**
 * FunnemailMailCard — riga lista email del client Funnemail.
 *
 * Layout richiesto:
 *  - Riga 1: brand azienda (grassetto) + bandiera + data
 *  - Riga 2: nome persona mittente (no email completa)
 *  - Riga 3: oggetto pulito (senza Re:/R:/Fwd:)
 *  - Riga 4-5: snippet body 2-3 righe
 *  - Hover: azioni Rispondi / Inoltra / Assegna gruppo
 */
import { Forward, Plane, Reply, Tag } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { CompanyLogo, CountryFlag } from "@/components/ui/CompanyLogo";
import { extractSenderBrand } from "@/components/outreach/email/emailUtils";
import { InlineGroupAssigner } from "@/components/outreach/email/InlineGroupAssigner";
import { cn } from "@/lib/utils";
import type { ChannelMessage } from "@/hooks/useChannelMessages";
import { extractSenderName, makeSnippet, stripReplyPrefixes } from "./utils";

interface Props {
  message: ChannelMessage;
  selected: boolean;
  inHolding: boolean;
  groupName: string | null;
  groupColor: string | null;
  groupIcon: string | null;
  onSelect: () => void;
  onReply: () => void;
  onForward: () => void;
}

function formatListDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return format(d, "dd/MM HH:mm", { locale: it });
}

export function FunnemailMailCard({
  message,
  selected,
  inHolding,
  groupName,
  groupColor,
  groupIcon,
  onSelect,
  onReply,
  onForward,
}: Props) {
  const { brand } = extractSenderBrand(message.from_address || "");
  const senderName = extractSenderName(message.from_address);
  const cleanSubject = stripReplyPrefixes(message.subject) || "(nessun oggetto)";
  const snippet = makeSnippet(message.body_text, 220);
  const isUnread = !message.read_at;
  const displayDate = message.email_date || message.created_at;

  return (
    <div
      className={cn(
        "group relative w-full border-b border-border px-3 py-2.5 text-left transition-colors",
        selected && "bg-muted",
        !selected && isUnread && "bg-primary/5",
        !selected && !isUnread && "hover:bg-muted/50",
        inHolding && "border-l-2 border-l-warning",
      )}
    >
      <button type="button" onClick={onSelect} className="flex w-full items-start gap-2.5 text-left">
        <CompanyLogo
          email={message.from_address}
          name={brand}
          size={28}
          className="mt-0.5 flex-shrink-0"
        />
        <div className="min-w-0 flex-1">
          {/* Riga 1: brand + bandiera + data */}
          <div className="flex items-center justify-between gap-2">
            <span
              className={cn(
                "truncate text-sm",
                isUnread ? "font-semibold text-primary" : "font-medium",
              )}
            >
              {brand}
            </span>
            <div className="flex flex-shrink-0 items-center gap-1.5">
              {inHolding && <Plane className="h-3 w-3 animate-pulse text-warning" />}
              <CountryFlag email={message.from_address} size={18} />
              <span className="text-[10px] tabular-nums text-muted-foreground">
                {formatListDate(displayDate)}
              </span>
              {isUnread && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
            </div>
          </div>

          {/* Riga 2: nome persona */}
          <p className="truncate text-[11px] text-muted-foreground">{senderName}</p>

          {/* Riga 3: oggetto pulito */}
          <p
            className={cn(
              "mt-0.5 truncate text-xs",
              isUnread ? "font-medium text-foreground" : "text-foreground/90",
            )}
          >
            {cleanSubject}
          </p>

          {/* Righe 4-5: snippet body */}
          {snippet && (
            <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
              {snippet}
            </p>
          )}

          {/* Badge gruppo */}
          {groupName && (
            <div className="mt-1 flex items-center gap-1">
              <span
                className="inline-flex items-center gap-1 rounded-sm px-1 py-0 text-[9px] font-medium leading-tight"
                style={{
                  backgroundColor: `${groupColor ?? "#3B82F6"}20`,
                  color: groupColor ?? "#3B82F6",
                }}
                title={`Gruppo: ${groupName}`}
              >
                {groupIcon && <span>{groupIcon}</span>}
                <span className="truncate max-w-[140px]">{groupName}</span>
              </span>
            </div>
          )}
        </div>
      </button>

      {/* Azioni hover (in basso a destra) */}
      <div className="absolute bottom-1.5 right-2 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          title="Rispondi"
          onClick={(e) => {
            e.stopPropagation();
            onReply();
          }}
        >
          <Reply className="h-3 w-3" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          title="Inoltra"
          onClick={(e) => {
            e.stopPropagation();
            onForward();
          }}
        >
          <Forward className="h-3 w-3" />
        </Button>
        <span onClick={(e) => e.stopPropagation()}>
          <InlineGroupAssigner
            fromAddress={message.from_address}
            currentGroupName={groupName}
          />
        </span>
        {!groupName && (
          <Tag className="h-3 w-3 text-warning" aria-label="Non classificata" />
        )}
      </div>
    </div>
  );
}