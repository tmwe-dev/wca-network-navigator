/**
 * FunnemailMailCard — riga lista email del client Funnemail.
 *
 * Layout:
 *  - Riga 1: brand azienda (grassetto) + bandiera + data
 *  - Riga 2: nome persona mittente (no email completa)
 *  - Riga 3: oggetto pulito (senza Re:/R:/Fwd:)
 *  - Riga 4-5: snippet body 2-3 righe
 *  - Riga 6 (in basso a destra, sempre visibile): slot suggerimento AI +
 *    pulsanti standard "Azioni" e "Assegna gruppo" (stessi delle altre maschere).
 */
import { Plane } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { CompanyLogo, CountryFlag } from "@/components/ui/CompanyLogo";
import { extractSenderBrand } from "@/components/outreach/email/emailUtils";
import { InlineGroupAssigner } from "@/components/outreach/email/InlineGroupAssigner";
import { EmailMessageActions } from "@/components/outreach/EmailMessageActions";
import { cn } from "@/lib/utils";
import type { ChannelMessage } from "@/hooks/useChannelMessages";
import { extractSenderName, makeSnippet, stripReplyPrefixes } from "./utils";
import { AiSuggestionChip, type AiSuggestion } from "./AiSuggestionChip";

interface Props {
  message: ChannelMessage;
  selected: boolean;
  inHolding: boolean;
  groupName: string | null;
  groupColor: string | null;
  groupIcon: string | null;
  aiSuggestion?: AiSuggestion | null;
  onSelect: () => void;
  onAcceptAiSuggestion?: () => void;
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
  aiSuggestion,
  onSelect,
  onAcceptAiSuggestion,
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
        "relative w-full border-b border-border px-3 py-2.5 text-left transition-colors",
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

          {/* Riga 6: slot suggerimento AI (a sinistra) — sempre presente */}
          <div className="mt-1.5 flex items-center gap-1.5">
            <AiSuggestionChip suggestion={aiSuggestion} onAccept={onAcceptAiSuggestion} />
            {groupName && (
              <span
                className="inline-flex items-center gap-1 rounded-sm px-1 py-0 text-[9px] font-medium leading-tight opacity-60"
                style={{
                  backgroundColor: `${groupColor ?? "#3B82F6"}15`,
                  color: groupColor ?? "#3B82F6",
                }}
                title={`Gruppo assegnato: ${groupName}`}
              >
                {groupIcon && <span>{groupIcon}</span>}
                <span className="truncate max-w-[120px]">{groupName}</span>
              </span>
            )}
          </div>
        </div>
      </button>

      {/* Azioni stabili in basso a destra (stesso pattern delle altre maschere) */}
      <div
        className="absolute bottom-1 right-2 flex items-center gap-1"
        onClick={(e) => e.stopPropagation()}
      >
        <EmailMessageActions message={message} />
        <InlineGroupAssigner
          fromAddress={message.from_address}
          currentGroupName={groupName}
        />
      </div>
    </div>
  );
}
