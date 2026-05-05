/**
 * FunnemailMailCard — riga lista email del client Funnemail.
 *
 * Layout uniformato alla Inbox principale (`EmailMessageList`):
 *  - Riga 1: brand azienda (grassetto) + logo inline + bandiera + data
 *  - Riga 2: oggetto pulito
 *  - Riga 3: nome/email mittente
 *  - Riga 4: chip gruppo (se presente) + chip suggerimento AI
 *
 * Niente snippet body, niente toolbar inline: stesse altezze e tipografie
 * della inbox standard. Le azioni rapide ("Azioni", "Assegna gruppo")
 * compaiono in overlay sull'hover, e la checkbox di bulk è opzionale.
 */
import { Plane, MailOpen } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Checkbox } from "@/components/ui/checkbox";
import { CompanyLogo, CompanyLogoInline, CountryFlag } from "@/components/ui/CompanyLogo";
import { extractSenderBrand } from "@/components/outreach/email/emailUtils";
import { InlineGroupAssigner } from "@/components/outreach/email/InlineGroupAssigner";
import { EmailMessageActions } from "@/components/outreach/EmailMessageActions";
import { useMarkAsRead } from "@/hooks/useEmailActions";
import { cn } from "@/lib/utils";
import type { ChannelMessage } from "@/hooks/useChannelMessages";
import { extractSenderName, stripReplyPrefixes } from "./utils";
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
  checked?: boolean;
  onToggleChecked?: () => void;
  showCheckbox?: boolean;
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
  checked,
  onToggleChecked,
  showCheckbox,
}: Props) {
  const { brand } = extractSenderBrand(message.from_address || "");
  const senderName = extractSenderName(message.from_address);
  const cleanSubject = stripReplyPrefixes(message.subject) || "(nessun oggetto)";
  const isUnread = !message.read_at;
  const displayDate = message.email_date || message.created_at;
  const markRead = useMarkAsRead();
  const secondaryLine = senderName || message.from_address || "(mittente sconosciuto)";

  return (
    <div
      className={cn(
        "group relative w-full border-b border-border p-3 text-left transition-colors",
        selected && "bg-muted",
        !selected && isUnread && "bg-primary/5",
        !selected && !isUnread && "hover:bg-muted/50",
        inHolding && "border-l-2 border-l-warning",
      )}
    >
      <div className="flex w-full items-start gap-2.5">
        {showCheckbox && (
          <div
            className="mt-0.5 flex-shrink-0"
            onClick={(e) => { e.stopPropagation(); onToggleChecked?.(); }}
          >
            <Checkbox checked={!!checked} aria-label="Seleziona email" />
          </div>
        )}
        <button
          type="button"
          onClick={onSelect}
          className="flex flex-1 items-start gap-2.5 text-left min-w-0"
        >
          <CompanyLogo
            email={message.from_address}
            name={brand}
            size={28}
            className="mt-0.5 flex-shrink-0"
          />
          <div className="min-w-0 flex-1">
            {/* Riga 1: brand + logo inline + bandiera + data */}
            <div className="flex items-center justify-between gap-1">
              <span
                className={cn(
                  "truncate text-sm flex items-center gap-1.5",
                  isUnread ? "font-semibold text-primary" : "font-medium",
                )}
              >
                {brand}
                <CompanyLogoInline email={message.from_address} size={16} />
              </span>
              <div className="flex flex-shrink-0 items-center gap-1.5">
                {inHolding && <Plane className="h-3 w-3 animate-pulse text-warning" />}
                <CountryFlag email={message.from_address} size={20} />
                <span className="text-[10px] text-muted-foreground">
                  {formatListDate(displayDate)}
                </span>
              </div>
            </div>

            {/* Riga 2: oggetto */}
            <p
              className={cn(
                "truncate text-xs",
                isUnread ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {cleanSubject}
            </p>

            {/* Riga 3: mittente */}
            <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
              {secondaryLine}
            </p>

            {/* Riga 4: chip gruppo + suggerimento AI (se presenti) */}
            {(groupName || aiSuggestion) && (
              <div className="mt-0.5 flex items-center gap-1">
                {groupName && (
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
                )}
                {aiSuggestion && (
                  <AiSuggestionChip
                    suggestion={aiSuggestion}
                    onAccept={onAcceptAiSuggestion}
                  />
                )}
              </div>
            )}
          </div>
        </button>
        {isUnread && (
          <button
            type="button"
            title="Segna come letta"
            onClick={(e) => {
              e.stopPropagation();
              markRead.mutate({ id: message.id, channel: message.channel, user_id: message.user_id });
            }}
            className="mt-1 inline-flex h-5 items-center gap-0.5 rounded-md border border-primary/30 bg-primary/10 px-1.5 text-[9px] font-medium text-primary hover:bg-primary/20"
          >
            <MailOpen className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Azioni rapide in overlay (visibili in hover) — non occupano altezza fissa */}
      <div
        className="pointer-events-none absolute bottom-1 right-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100"
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
