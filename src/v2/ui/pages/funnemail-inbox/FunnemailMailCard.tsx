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
import { Brain, CalendarClock, Gauge, Hand, MailOpen, Plane, Sparkles, Tag, Undo2 } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CompanyLogo, CompanyLogoInline, CountryFlag } from "@/components/ui/CompanyLogo";
import { extractSenderBrand } from "@/components/outreach/email/emailUtils";
import { InlineGroupAssigner } from "@/components/outreach/email/InlineGroupAssigner";
import { EmailMessageActions } from "@/components/outreach/EmailMessageActions";
import { useMarkAsRead } from "@/hooks/useEmailActions";
import { cn } from "@/lib/utils";
import { getCountryFlag } from "@/lib/countries";
import type { ChannelMessage } from "@/hooks/useChannelMessages";
import type { FunnemailDecisionRow, FunnemailPartnerSnapshot, SenderIntelRow } from "@/data/funnemailInbox";
import { DeepSearchEmailButton } from "@/v2/ui/organisms/sherlock/DeepSearchEmailButton";
import { extractSenderName, stripReplyPrefixes } from "./utils";
import { AiSuggestionChip, type AiSuggestion } from "./AiSuggestionChip";
import type { FunnemailClaimWithOperator } from "@/data/funnemailClaims";

type DecoratedMessage = ChannelMessage & {
  category?: string | null;
  folder?: string | null;
  funnemail_folder_label?: string | null;
  funnemail_folder_icon?: string | null;
  funnemail_decision?: FunnemailDecisionRow | null;
  sender_intel?: SenderIntelRow | null;
  partner_snapshot?: FunnemailPartnerSnapshot | null;
};

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
  onReclassify?: () => void;
  reclassifying?: boolean;
  checked?: boolean;
  onToggleChecked?: () => void;
  showCheckbox?: boolean;
  claim?: FunnemailClaimWithOperator | null;
  myUserId?: string | null;
  claimPending?: boolean;
  onClaim?: () => void;
  onRelease?: () => void;
}

function formatListDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return format(d, "dd/MM HH:mm", { locale: it });
}

const ACTION_LABELS: Record<string, string> = {
  none: "Nessuna azione",
  archive: "Archivia",
  draft_reply: "Bozza risposta",
  forward: "Inoltra",
  escalate: "Escala",
  notify_human: "Operatore",
};

const URGENCY_LABELS: Record<string, string> = {
  critical: "Critica",
  high: "Alta",
  normal: "Normale",
  low: "Bassa",
};

export function FunnemailMailCard({
  message,
  selected,
  inHolding,
  groupName,
  groupIcon,
  aiSuggestion,
  onSelect,
  onAcceptAiSuggestion,
  onReclassify,
  reclassifying,
  checked,
  onToggleChecked,
  showCheckbox,
  claim,
  myUserId,
  claimPending,
  onClaim,
  onRelease,
}: Props) {
  const meta = message as DecoratedMessage;
  const partner = meta.partner_snapshot ?? null;
  const decision = meta.funnemail_decision ?? null;
  const { brand } = extractSenderBrand(message.from_address || "");
  const displayBrand = partner?.company_alias || partner?.company_name || brand;
  const senderName = extractSenderName(message.from_address);
  const cleanSubject = stripReplyPrefixes(message.subject) || "(nessun oggetto)";
  const isUnread = !message.read_at;
  const displayDate = message.email_date || message.created_at;
  const markRead = useMarkAsRead();
  const secondaryLine = senderName || message.from_address || "(mittente sconosciuto)";
  const countryCode = partner?.country_code ?? null;
  const emailAddress = message.from_address?.match(/<(.+?)>/)?.[1] || message.from_address || "";
  const funnemailFolder = meta.funnemail_folder_label ?? meta.folder ?? meta.category ?? null;
  const category = meta.category ?? null;
  const senderIntel = meta.sender_intel ?? null;
  const claimedByMe = !!claim && !!myUserId && claim.claimed_by === myUserId;
  const claimedByOther = !!claim && !claimedByMe;
  const claimMinutes = claim ? Math.max(0, Math.round((Date.now() - new Date(claim.claimed_at).getTime()) / 60000)) : 0;

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
        <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-start gap-3 text-left">
          {partner?.logo_url ? (
            <img src={partner.logo_url} alt={displayBrand} className="mt-0.5 h-10 w-10 flex-shrink-0 rounded-md object-contain" loading="lazy" />
          ) : (
            <CompanyLogo email={message.from_address} name={displayBrand} size={40} className="mt-0.5 flex-shrink-0" showFlag />
          )}
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className={cn("truncate text-base", isUnread ? "font-semibold text-primary" : "font-semibold text-foreground")}>{displayBrand}</span>
                  <CompanyLogoInline email={message.from_address} size={18} />
                  {countryCode ? <span className="text-base leading-none" title={partner?.country_name ?? countryCode}>{getCountryFlag(countryCode)}</span> : <CountryFlag email={message.from_address} size={18} />}
                  {inHolding && <Plane className="h-4 w-4 animate-pulse text-warning" />}
                </div>
                <p className="truncate text-sm text-muted-foreground">{secondaryLine}</p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">{formatListDate(displayDate)}</span>
            </div>

            <p className={cn("truncate text-sm", isUnread ? "font-medium text-foreground" : "text-muted-foreground")}>{cleanSubject}</p>

            <div className="flex flex-wrap items-center gap-1.5">
              {funnemailFolder && (
                <span className="inline-flex items-center gap-1 rounded border border-border bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground" title="Cartella Funny Mail Inbox">
                  <Tag className="h-3 w-3" />{meta.funnemail_folder_icon && <span>{meta.funnemail_folder_icon}</span>}<span className="max-w-[160px] truncate">{funnemailFolder}</span>
                </span>
              )}
              {category && (
                <span className="inline-flex items-center gap-1 rounded border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground" title="Classificazione email">
                  <Sparkles className="h-3 w-3" />{category}
                </span>
              )}
              {groupName && (
                <span className="inline-flex items-center gap-1 rounded border border-border bg-muted px-2 py-0.5 text-xs text-foreground" title={`Gruppo: ${groupName}`}>
                  {groupIcon && <span>{groupIcon}</span>}<span className="max-w-[140px] truncate">{groupName}</span>
                </span>
              )}
              {partner?.lead_status && (
                <span className="inline-flex items-center gap-1 rounded border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground" title="Stato commerciale">
                  <Gauge className="h-3 w-3" />{partner.lead_status.replace(/_/g, " ")}
                </span>
              )}
              {decision && (
                <span className="inline-flex items-center gap-1 rounded border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary" title={decision.reasoning ?? "Decisione AI Funnemail"}>
                  <Brain className="h-3 w-3" />{ACTION_LABELS[decision.suggested_action] ?? decision.suggested_action} · {URGENCY_LABELS[decision.urgency] ?? decision.urgency} · {Math.round(decision.confidence * 100)}%
                </span>
              )}
              {decision?.goes_to_agenda && (
                <span className="inline-flex items-center gap-1 rounded border border-warning/30 bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
                  <CalendarClock className="h-3 w-3" />Agenda
                </span>
              )}
              {senderIntel?.company_type && (
                <span className="inline-flex items-center gap-1 rounded border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">{senderIntel.company_type}</span>
              )}
              {aiSuggestion && <AiSuggestionChip suggestion={aiSuggestion} onAccept={onAcceptAiSuggestion} className="text-xs" />}
            </div>
          </div>
        </button>
        {claimedByOther && (
          <span
            className="mt-1 inline-flex h-7 items-center gap-1 rounded-md border border-warning/40 bg-warning/10 px-2 text-xs font-medium text-warning"
            title={`Preso da ${claim?.operator_display_name ?? "operatore"} ${claimMinutes} min fa`}
          >
            <Hand className="h-3 w-3" />
            {claim?.operator_display_name ?? "preso"}
          </span>
        )}
        {claimedByMe && (
          <span
            className="mt-1 inline-flex h-7 items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2 text-xs font-medium text-primary"
            title={`In carico a te da ${claimMinutes} min`}
          >
            <Hand className="h-3 w-3" />tu
          </span>
        )}
        {isUnread && (
          <button
            type="button"
            title="Segna come letta"
            onClick={(e) => {
              e.stopPropagation();
              markRead.mutate({ id: message.id, channel: message.channel, user_id: message.user_id });
            }}
            className="mt-1 inline-flex h-7 items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 text-xs font-medium text-primary hover:bg-primary/20"
          >
            <MailOpen className="h-3 w-3" />
          </button>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
        {!claim && onClaim && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs"
            onClick={onClaim}
            disabled={claimPending}
            title="Prendi in carico questo messaggio"
          >
            <Hand className="h-3.5 w-3.5" />Lo prendo io
          </Button>
        )}
        {claimedByMe && onRelease && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs"
            onClick={onRelease}
            disabled={claimPending}
            title="Rilascia presa in carico"
          >
            <Undo2 className="h-3.5 w-3.5" />Rilascia
          </Button>
        )}
        <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={onReclassify} disabled={reclassifying} title="Riclassifica con AI">
          <Brain className="h-3.5 w-3.5" />AI classifica
        </Button>
        <DeepSearchEmailButton
          email={emailAddress}
          source={{ displayName: displayBrand, partnerId: message.partner_id ?? partner?.id ?? null }}
          size="sm"
          variant="outline"
          label="AI Search"
          className="h-8 gap-1.5 text-xs"
        />
        <EmailMessageActions message={message} />
        <InlineGroupAssigner
          fromAddress={message.from_address}
          currentGroupName={groupName}
        />
      </div>
    </div>
  );
}
