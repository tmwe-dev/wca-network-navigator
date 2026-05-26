import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Mail, MessageCircle, Linkedin, Phone, StickyNote, MoreVertical, CheckCircle2,
  Calendar as CalendarIcon, ArrowUpRight,
  Check, Clock, Archive, Plane,
} from "lucide-react";
import { useAgendaDayActivities } from "@/hooks/useAgendaDayActivities";
import { useUpdateActivity } from "@/hooks/useActivities";
import { getCountryFlag } from "@/lib/countries";
import { isInHoldingPattern } from "@/constants/holdingPattern";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import type { ActivityTypeFilter, ResponseFilter } from "./AgendaCalendarPage";
import type { AllActivity } from "@/hooks/useActivities";
import {
  ACTION_GROUPS,
  classifyAction,
  type ActionGroupDef,
  type ActionGroupKey,
} from "./agendaActionGroups";
export { ACTION_GROUPS, classifyAction, verbForActivity } from "./agendaActionGroups";

interface AgendaDayDetailProps {
  selectedDay: Date;
  filters: {
    activityType: ActivityTypeFilter;
    responseStatus: ResponseFilter;
  };
  /** Testo libero: cerca in titolo, nome partner, nome contatto. */
  search?: string;
  /** ID dell'attività attualmente selezionata nel pannello destro. */
  selectedActivityId?: string | null;
  /** Callback chiamata quando l'utente seleziona una card. */
  onSelectActivity?: (activity: AllActivity) => void;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Channel icons (per il canale di comunicazione, NON per il tipo di azione).
 * Sostituiscono il vecchio prefisso testuale "Reply received (email):".
 * ─────────────────────────────────────────────────────────────────────────── */
const channelIcon: Record<string, typeof Mail> = {
  send_email: Mail,
  follow_up: Mail,
  whatsapp: MessageCircle,
  linkedin: Linkedin,
  phone_call: Phone,
  note: StickyNote,
};

/* ─────────────────────────────────────────────────────────────────────────────
 * Priority by waiting time. La priorità nasce dal "da quanto aspetta", non da
 * un campo arbitrario nel DB — così è sempre attuale.
 * ─────────────────────────────────────────────────────────────────────────── */
type Urgency = "overdue" | "today" | "normal";

function urgencyFromAge(createdAt: string): Urgency {
  const created = new Date(createdAt).getTime();
  const now = Date.now();
  const hoursAgo = (now - created) / 3_600_000;
  if (hoursAgo > 24) return "overdue";
  if (hoursAgo > 4)  return "today";
  return "normal";
}

const URGENCY_BORDER: Record<Urgency, string> = {
  overdue: "border-l-rose-500",
  today:   "border-l-amber-500",
  normal:  "border-l-emerald-500/60",
};

/** Es: "2g fa" / "5h fa" / "appena ora". Italiano, brevissimo. */
function relativeAge(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1)  return "appena ora";
  if (min < 60) return `${min}m fa`;
  const h = Math.floor(min / 60);
  if (h < 24)   return `${h}h fa`;
  const d = Math.floor(h / 24);
  return `${d}g fa`;
}

/** Pulisce il titolo dai prefissi tecnici tipo "Reply received (email):". */
function cleanTitle(title: string | null): string {
  if (!title) return "—";
  return title
    .replace(/^reply received\s*\([^)]+\)\s*:?\s*/i, "")
    .replace(/^risposta\s+(email|whatsapp|linkedin|sms)\s*:?\s*/i, "")
    .replace(/^re:\s*/i, "")
    .replace(/^fwd:\s*/i, "")
    .trim() || "—";
}

/** Estrae un nome leggibile dal mittente in description (es. "leo@aerolog.net" → "aerolog.net"). */
function senderFromDescription(desc: string | null | undefined): string | null {
  if (!desc) return null;
  const m = desc.match(/([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/);
  if (!m) return null;
  const email = m[1];
  const domain = email.split("@")[1] ?? "";
  return domain || email;
}

/** Estrae l'email completa del mittente dalla description del trigger on_inbound_message. */
function senderEmailFromDescription(desc: string | null | undefined): string | null {
  if (!desc) return null;
  const m = desc.match(/([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/);
  return m ? m[1] : null;
}

export default function AgendaDayDetail({
  selectedDay,
  filters,
  search = "",
  selectedActivityId = null,
  onSelectActivity,
}: AgendaDayDetailProps) {
  const { data, isLoading } = useAgendaDayActivities(selectedDay);
  const activities = data?.activities || [];
  const reminders = data?.reminders || [];
  const respondedIds = data?.respondedPartnerIds || new Set<string>();

  // Apply filters (canale + stato risposta) — invariati per backward compat
  // con il pannello sinistro AgendaCalendarPage.
  const filteredActivities = useMemo(() => {
    let list = activities;
    if (filters.activityType !== "all") {
      list = list.filter(a => a.activity_type === filters.activityType);
    }
    if (filters.responseStatus === "responded") {
      list = list.filter(a => a.partner_id && respondedIds.has(a.partner_id));
    } else if (filters.responseStatus === "no_response") {
      list = list.filter(a => a.partner_id && !respondedIds.has(a.partner_id));
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(a => {
        const company = (a.partners?.company_name || "").toLowerCase();
        const alias = (a.partners?.company_alias || "").toLowerCase();
        const contact = (a.selected_contact?.name || "").toLowerCase();
        const title = (a.title || "").toLowerCase();
        return company.includes(q) || alias.includes(q) || contact.includes(q) || title.includes(q);
      });
    }
    return list;
  }, [activities, filters, respondedIds, search]);

  // Raggruppa per tipo di azione
  const grouped = useMemo(() => {
    const buckets: Record<ActionGroupKey, AllActivity[]> = {
      reply: [], send: [], call: [], decide: [],
    };
    for (const a of filteredActivities) {
      const responded = a.partner_id ? respondedIds.has(a.partner_id) : false;
      buckets[classifyAction(a, responded)].push(a);
    }
    // Dentro ciascun gruppo: prima i più vecchi (più urgenti).
    for (const k of Object.keys(buckets) as ActionGroupKey[]) {
      buckets[k].sort((x, y) => new Date(x.created_at).getTime() - new Date(y.created_at).getTime());
    }
    return buckets;
  }, [filteredActivities, respondedIds]);

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-8 w-48" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Day header — pulito, niente badge di metriche tecniche */}
      <div className="shrink-0 px-4 py-3 border-b border-border/30">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold capitalize">
              {format(selectedDay, "EEEE d MMMM yyyy", { locale: it })}
            </h2>
            <p className="text-[10px] text-muted-foreground">
              {filteredActivities.length} {filteredActivities.length === 1 ? "azione" : "azioni"} oggi
              {reminders.length > 0 && ` · ${reminders.length} reminder`}
            </p>
          </div>
          {/* Legenda priorità — 3 puntini colorati senza testo, leggera */}
          <div className="flex items-center gap-3 text-[9px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-rose-500" />in ritardo</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" />oggi</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80" />ok</span>
          </div>
        </div>
      </div>

      {/* Lista raggruppata per tipo di azione */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-5">
          {ACTION_GROUPS.map(group => {
            const items = grouped[group.key];
            if (items.length === 0) return null;
            return (
              <ActionGroup
                key={group.key}
                def={group}
                activities={items}
                selectedActivityId={selectedActivityId}
                onSelectActivity={onSelectActivity}
              />
            );
          })}

          {filteredActivities.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/50">
              <CheckCircle2 className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-xs">Nessuna azione richiesta oggi</p>
              <p className="text-[10px] mt-1">Tutto in ordine ✨</p>
            </div>
          )}

          {reminders.length > 0 && <ReminderList reminders={reminders} />}
        </div>
      </ScrollArea>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * ActionGroup — intestazione di sezione + righe attività
 * ─────────────────────────────────────────────────────────────────────────── */
function ActionGroup({
  def,
  activities,
  selectedActivityId,
  onSelectActivity,
}: {
  def: ActionGroupDef;
  activities: AllActivity[];
  selectedActivityId: string | null;
  onSelectActivity?: (activity: AllActivity) => void;
}) {
  const Icon = def.icon;
  return (
    <section>
      <header className="flex items-center gap-2 mb-2 px-1">
        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-foreground/80">
          {def.label}
        </h3>
        <span className="text-[10px] text-muted-foreground">· {activities.length}</span>
      </header>
      <div className="space-y-1">
        {activities.map(a => (
          <ActivityRow
            key={a.id}
            activity={a}
            verb={def.verb}
            isSelected={selectedActivityId === a.id}
            onSelect={onSelectActivity}
          />
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * ActivityRow — riga compatta, niente subject ripetuto, niente checkbox legacy.
 * Layout: [bordo colore] icona-canale · partner · "X tempo fa" · CTA azione · ⋯
 * ─────────────────────────────────────────────────────────────────────────── */
function ActivityRow({
  activity,
  verb,
  isSelected,
  onSelect,
}: {
  activity: AllActivity;
  verb: string;
  isSelected: boolean;
  onSelect?: (activity: AllActivity) => void;
}) {
  const ChannelIcon = channelIcon[activity.activity_type] || Mail;
  const urgency = urgencyFromAge(activity.created_at);
  const updateActivity = useUpdateActivity();

  const partnerName =
    activity.partners?.company_name ||
    senderFromDescription(activity.description) ||
    "Mittente sconosciuto";
  const senderEmail = senderEmailFromDescription(activity.description);
  const flag = activity.partners?.country_code
    ? getCountryFlag(activity.partners.country_code)
    : null;
  const inHolding = isInHoldingPattern(
    (activity.partners as { lead_status?: string } | undefined)?.lead_status
  );

  const handleStatus = (status: "completed" | "cancelled") => {
    updateActivity.mutate({
      id: activity.id,
      status,
      completed_at: status === "completed" ? new Date().toISOString() : null,
    });
  };

  return (
    <div
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onClick={onSelect ? () => onSelect(activity) : undefined}
      onKeyDown={onSelect ? (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(activity);
        }
      } : undefined}
      className={cn(
        "group flex items-center gap-2.5 pl-3 pr-2 py-2 rounded-xl border border-border/30",
        "bg-card/40 hover:bg-card/60 transition-all border-l-2",
        onSelect && "cursor-pointer",
        isSelected && "ring-1 ring-primary border-primary/40 bg-primary/5",
        URGENCY_BORDER[urgency],
      )}
    >
      <ChannelIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />

      {flag && <span className="text-sm shrink-0">{flag}</span>}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium truncate">{partnerName}</span>
          {inHolding && (
            <span
              title="In circuito di attesa"
              className="inline-flex items-center gap-0.5 px-1 py-0 rounded text-[9px] border border-sky-500/40 text-sky-500 bg-sky-500/10 animate-pulse shrink-0"
            >
              <Plane className="w-2.5 h-2.5" />
            </span>
          )}
          {activity.selected_contact && (
            <span className="text-[10px] text-muted-foreground truncate">· {activity.selected_contact.name}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5 truncate">
          <Clock className="w-2.5 h-2.5 shrink-0" />
          <span>{relativeAge(activity.created_at)}</span>
          {senderEmail && (
            <>
              <span className="opacity-30">·</span>
              <span className="truncate font-mono">{senderEmail}</span>
            </>
          )}
          <span className="opacity-30">·</span>
          <span className="truncate">{cleanTitle(activity.title)}</span>
        </div>
      </div>

      {/* CTA azione primaria — quando la riga è selezionabile, l'azione vive nel
          pannello destro: qui mostriamo solo un badge con il verbo per chiarezza. */}
      {onSelect ? (
        <Badge variant="outline" className="text-[9px] shrink-0 opacity-70">{verb}</Badge>
      ) : activity.partner_id ? (
        <Button asChild size="sm" variant="ghost" className="h-7 px-2.5 text-[10px] shrink-0">
          <Link to={`/v2/network?partnerId=${activity.partner_id}`}>
            {verb} <ArrowUpRight className="w-3 h-3 ml-1" />
          </Link>
        </Button>
      ) : (
        <Badge variant="outline" className="text-[9px] shrink-0">{verb}</Badge>
      )}

      {/* Menu rapido: Fatto / Rimanda / Delega / Archivia */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            aria-label="Altre azioni"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem className="text-xs gap-2" onClick={() => handleStatus("completed")}>
            <Check className="w-3 h-3 text-emerald-500" /> Fatto
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-xs gap-2" onClick={() => handleStatus("cancelled")}>
            <Archive className="w-3 h-3" /> Archivia
          </DropdownMenuItem>
          {activity.partner_id && (
            <DropdownMenuItem asChild>
              <Link to={`/v2/network?partnerId=${activity.partner_id}`} className="text-xs gap-2">
                <ArrowUpRight className="w-3 h-3" /> Vai al partner
              </Link>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function ReminderList({ reminders }: { reminders: Array<Record<string, any>> }) {
  if (reminders.length === 0) return null;
  return (
    <section className="pt-2">
      <header className="flex items-center gap-2 mb-2 px-1">
        <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground" />
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-foreground/80">Reminder</h3>
        <span className="text-[10px] text-muted-foreground">· {reminders.length}</span>
      </header>
      <div className="space-y-1">
        {reminders.map((r) => (
          <Link
            key={r.id}
            to={`/v2/network?partnerId=${r.partner_id}`}
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl border bg-card/40 border-border/30 hover:bg-card/60 transition-all"
          >
            <CalendarIcon className="w-3.5 h-3.5 text-primary shrink-0" />
            {r.partners && (
              <span className="text-sm shrink-0">{getCountryFlag(r.partners.country_code)}</span>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{r.title}</p>
              <p className="text-[10px] text-muted-foreground truncate">{r.partners?.company_name}</p>
            </div>
            <Badge
              variant="outline"
              className={cn(
                "text-[8px] shrink-0",
                r.status === "completed" ? "border-emerald-500/20 text-emerald-500" : "border-amber-500/20 text-amber-500"
              )}
            >
              {r.status === "completed" ? "Completato" : "In attesa"}
            </Badge>
          </Link>
        ))}
      </div>
    </section>
  );
}
