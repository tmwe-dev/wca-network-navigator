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
import { Bell, Brain, CalendarClock, Gauge, Hand, MailOpen, Sparkles, Tag, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { extractSenderBrand } from "@/components/outreach/email/emailUtils";
import { InlineGroupAssigner } from "@/components/outreach/email/InlineGroupAssigner";
import { EmailMessageActions } from "@/components/outreach/EmailMessageActions";
import { useMarkAsRead } from "@/hooks/useEmailActions";
import { cn } from "@/lib/utils";
import type { ChannelMessage } from "@/hooks/useChannelMessages";
import type { FunnemailDecisionRow, FunnemailPartnerSnapshot, SenderIntelRow } from "@/data/funnemailInbox";
import { DeepSearchEmailButton } from "@/v2/ui/organisms/sherlock/DeepSearchEmailButton";
import { extractSenderName, stripReplyPrefixes } from "./utils";
import { AiSuggestionChip, type AiSuggestion } from "./AiSuggestionChip";
import type { FunnemailClaimWithOperator } from "@/data/funnemailClaims";
import {
  FUNNEMAIL_JOB_STATUSES,
  FUNNEMAIL_JOB_STATUS_CLASSES,
  FUNNEMAIL_JOB_STATUS_LABELS,
  type FunnemailJobStatus,
  type FunnemailStatusRow,
} from "@/data/funnemailStatuses";
import type { FunnemailReminderRow } from "@/data/funnemailReminders";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ReminderPopover } from "./ReminderPopover";
import { MailRowChrome } from "@/v2/ui/molecules/email/MailRowChrome";

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
  status?: FunnemailStatusRow | null;
  onSetStatus?: (status: FunnemailJobStatus) => void;
  reminder?: FunnemailReminderRow | null;
  onCreateReminder?: (remindAt: Date, note?: string) => void;
  onDismissReminder?: (id: string) => void;
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
  status,
  onSetStatus,
  reminder,
  onCreateReminder,
  onDismissReminder,
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
  const bodyPreview = (() => {
    const t = (message as ChannelMessage & { body_text?: string | null }).body_text || "";
    if (!t) return null;
    return t.replace(/\s+/g, " ").trim().slice(0, 220) || null;
  })();
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
  const currentStatus: FunnemailJobStatus = (status?.status ?? "nuovo") as FunnemailJobStatus;
  const reminderMinutes = reminder
    ? Math.round((new Date(reminder.remind_at).getTime() - Date.now()) / 60000)
    : null;
  const reminderLabel = (() => {
    if (reminderMinutes == null) return null;
    if (reminderMinutes <= 0) return "ora";
    if (reminderMinutes < 60) return `tra ${reminderMinutes}m`;
    if (reminderMinutes < 60 * 24) return `tra ${Math.round(reminderMinutes / 60)}h`;
    return `tra ${Math.round(reminderMinutes / (60 * 24))}g`;
  })();

  const chips = (
    <>
      {funnemailFolder && (
                <span className="inline-flex items-center gap-1 rounded border border-border bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground" title="Cartella Funny Mail Inbox">
                  <Tag className="h-3 w-3" />{meta.funnemail_folder_icon && <span>{meta.funnemail_folder_icon}</span>}<span className="max-w-[160px] truncate">{funnemailFolder}</span>
                </span>
              )}
              {category && (
                <span className="inline-flex items-center gap-1 rounded border border-border bg-muted px-2 py-0.5 text-xs text-foreground" title="Classificazione email">
                  <Sparkles className="h-3 w-3" />{category}
                </span>
              )}
              {partner?.lead_status && (
                <span className="inline-flex items-center gap-1 rounded border border-border bg-muted px-2 py-0.5 text-xs text-foreground" title="Stato commerciale">
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
                <span className="inline-flex items-center gap-1 rounded border border-border bg-muted px-2 py-0.5 text-xs text-foreground">{senderIntel.company_type}</span>
              )}
              {aiSuggestion && !groupName && <AiSuggestionChip suggestion={aiSuggestion} onAccept={onAcceptAiSuggestion} className="text-xs" />}
              {onSetStatus ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      onClick={(e) => e.stopPropagation()}
                      className={cn(
                        "inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium",
                        FUNNEMAIL_JOB_STATUS_CLASSES[currentStatus],
                      )}
                      title="Cambia stato lavorazione"
                    >
                      ● {FUNNEMAIL_JOB_STATUS_LABELS[currentStatus]}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenuLabel>Stato lavorazione</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {FUNNEMAIL_JOB_STATUSES.map((s) => (
                      <DropdownMenuItem key={s} onSelect={() => onSetStatus(s)} disabled={s === currentStatus}>
                        {FUNNEMAIL_JOB_STATUS_LABELS[s]}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium",
                    FUNNEMAIL_JOB_STATUS_CLASSES[currentStatus],
                  )}
                >
                  ● {FUNNEMAIL_JOB_STATUS_LABELS[currentStatus]}
                </span>
              )}
              {reminder && reminderLabel && (
                <span
                  className="inline-flex items-center gap-1 rounded border border-accent bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground"
                  title={reminder.note ?? `Reminder: ${new Date(reminder.remind_at).toLocaleString("it-IT")}`}
                >
                  <Bell className="h-3 w-3" />{reminderLabel}
                </span>
              )}
    </>
  );

  const groupBadge = groupName ? (
    <span
      className="inline-flex items-center gap-1 rounded border border-primary/40 bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-foreground"
      title={`Gruppo: ${groupName}`}
    >
      {groupIcon && <span>{groupIcon}</span>}
      <span className="max-w-[140px] truncate">{groupName}</span>
    </span>
  ) : aiSuggestion?.label ? (
    <span
      className="inline-flex items-center gap-1 rounded border border-dashed border-primary/40 bg-primary/5 px-2 py-0.5 text-[11px] font-medium text-foreground"
      title={aiSuggestion.reason ? `Suggerito AI · ${aiSuggestion.reason}` : "Suggerito dall'AI"}
    >
      <Sparkles className="h-3 w-3 opacity-70" />
      <span className="max-w-[140px] truncate">Suggerito: {aiSuggestion.label}</span>
    </span>
  ) : null;

  const trailing = (
    <>
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
    </>
  );

  const actions = (
    <>
      {onCreateReminder && (
          <ReminderPopover
            onCreate={(remindAt: Date, note?: string) => onCreateReminder(remindAt, note)}
            existing={reminder ?? null}
            onDismiss={onDismissReminder ? (id: string) => onDismissReminder(id) : undefined}
          />
        )}
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
    </>
  );

  const leading = showCheckbox ? (
    <div
      className="absolute left-1 top-3 z-10"
      onClick={(e) => { e.stopPropagation(); onToggleChecked?.(); }}
    >
      <Checkbox checked={!!checked} aria-label="Seleziona email" />
    </div>
  ) : null;

  return (
    <div className={cn("relative", showCheckbox && "pl-6")}>
      {leading}
      <MailRowChrome
        fromAddress={message.from_address}
        brand={displayBrand}
        subject={cleanSubject}
        secondaryLine={secondaryLine}
        date={displayDate}
        isUnread={isUnread}
        isSelected={selected}
        inHolding={inHolding}
        countryCode={countryCode}
        countryName={partner?.country_name ?? null}
        logoUrl={partner?.logo_url ?? null}
        size="md"
        previewText={bodyPreview}
        groupBadge={groupBadge}
        chips={chips}
        trailing={trailing}
        actions={actions}
        onClick={onSelect}
      />
    </div>
  );
}
