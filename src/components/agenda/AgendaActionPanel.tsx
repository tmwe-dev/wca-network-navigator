/**
 * AgendaActionPanel — Pannello operativo destro dell'Agenda.
 *
 * Quando l'utente seleziona una card a sinistra, qui appare il "tavolo di lavoro":
 *   - Header partner + canale + età + status
 *   - Contesto (titolo/oggetto, snippet)
 *   - Azioni rapide (primaria contestuale + secondarie)
 *
 * Per la versione iniziale il pannello mostra contesto + azioni; il composer
 * inline (rispondi via email) viene aperto navigando al partner per riusare il
 * flusso esistente. Iterazioni future possono inlineare il composer qui.
 */
import { Link } from "react-router-dom";
import * as React from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Mail, MessageCircle, Linkedin, Phone, StickyNote,
  Reply, Send, PhoneCall, HelpCircle, Clock, Archive,
  ArrowUpRight, MailX, CalendarPlus, Plane,
} from "lucide-react";
import { useUpdateActivity } from "@/hooks/useActivities";
import { insertActivity, activityKeys } from "@/data/activities";
import { findInboundPreview } from "@/data/channelMessages";
import { queryKeys } from "@/lib/queryKeys";
import { useAuth } from "@/providers/AuthProvider";
import { isInHoldingPattern } from "@/constants/holdingPattern";
import { getCountryFlag } from "@/lib/countries";
import { format, addDays } from "date-fns";
import { it as itLocale } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { AllActivity } from "@/hooks/useActivities";

const channelIcon: Record<string, typeof Mail> = {
  send_email: Mail,
  follow_up: Mail,
  whatsapp: MessageCircle,
  linkedin: Linkedin,
  phone_call: Phone,
  note: StickyNote,
};

const channelLabel: Record<string, string> = {
  send_email: "Email",
  follow_up: "Email (follow-up)",
  whatsapp: "WhatsApp",
  linkedin: "LinkedIn",
  phone_call: "Chiamata",
  note: "Nota",
  meeting: "Meeting",
  other: "Attività",
};

function relativeAge(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "appena ora";
  if (min < 60) return `${min}m fa`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h fa`;
  const d = Math.floor(h / 24);
  return `${d}g fa`;
}

function urgencyOf(iso: string): { label: string; cls: string } {
  const h = (Date.now() - new Date(iso).getTime()) / 3_600_000;
  if (h > 24) return { label: "in ritardo", cls: "text-rose-500 border-rose-500/30 bg-rose-500/10" };
  if (h > 4) return { label: "oggi", cls: "text-amber-500 border-amber-500/30 bg-amber-500/10" };
  return { label: "ok", cls: "text-emerald-500 border-emerald-500/30 bg-emerald-500/10" };
}

function cleanTitle(title: string | null): string {
  if (!title) return "—";
  return title
    .replace(/^reply received\s*\([^)]+\)\s*:?\s*/i, "")
    .replace(/^risposta\s+(email|whatsapp|linkedin|sms)\s*:?\s*/i, "")
    .replace(/^re:\s*/i, "")
    .replace(/^fwd:\s*/i, "")
    .trim() || "—";
}

/** Estrae il dominio del mittente da una description tipo "Messaggio in arrivo da x@y.com (...)". */
function senderFromDescription(desc: string | null | undefined): { email: string; domain: string } | null {
  if (!desc) return null;
  const m = desc.match(/([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/);
  if (!m) return null;
  const email = m[1];
  const domain = email.split("@")[1] ?? email;
  return { email, domain };
}

interface AgendaActionPanelProps {
  activity: AllActivity | null;
  primaryVerb: string;
  /** Quando l'azione viene completata via menu. Permette al parent di deselezionare. */
  onActionDone?: () => void;
}

export default function AgendaActionPanel({ activity, primaryVerb, onActionDone }: AgendaActionPanelProps) {
  const updateActivity = useUpdateActivity();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [futureDate, setFutureDate] = React.useState<Date | undefined>(addDays(new Date(), 1));
  const [popoverOpen, setPopoverOpen] = React.useState(false);
  const [scheduling, setScheduling] = React.useState(false);

  if (!activity) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8 text-muted-foreground/60">
        <MailX className="w-10 h-10 mb-3 opacity-30" />
        <p className="text-sm">Seleziona un'attività a sinistra</p>
        <p className="text-[11px] mt-1 opacity-70">
          Qui appariranno il contesto e le azioni rapide per gestirla.
        </p>
      </div>
    );
  }

  const ChannelIcon = channelIcon[activity.activity_type] || Mail;
  const sender = senderFromDescription(activity.description);
  const partnerName =
    activity.partners?.company_name ||
    sender?.domain ||
    "Mittente sconosciuto";
  const senderEmail = sender?.email ?? null;
  const isUnknownSender = !activity.partners?.company_name && !!sender;
  const flag = activity.partners?.country_code ? getCountryFlag(activity.partners.country_code) : null;
  const city = activity.partners?.city;
  const country = activity.partners?.country_name;
  const subject = cleanTitle(activity.title);
  const urgency = urgencyOf(activity.created_at);
  const description = activity.description ?? null;
  const inHolding = isInHoldingPattern((activity.partners as { lead_status?: string } | undefined)?.lead_status);

  // Anteprima reale del corpo email inbound (solo per activity email).
  const isEmailActivity =
    activity.activity_type === "send_email" || activity.activity_type === "follow_up";
  const previewQuery = useQuery({
    queryKey: queryKeys.channelMessages.inboundPreview(
      activity.partner_id,
      senderEmail,
      activity.title,
    ),
    queryFn: () =>
      findInboundPreview({
        partnerId: activity.partner_id,
        fromAddress: senderEmail,
        subject: activity.title,
      }),
    enabled: isEmailActivity,
    staleTime: 60_000,
  });
  const inboundPreview = previewQuery.data?.bodyText ?? null;

  const handleStatus = (status: "completed" | "cancelled") => {
    updateActivity.mutate(
      {
        id: activity.id,
        status,
        completed_at: status === "completed" ? new Date().toISOString() : null,
      },
      { onSuccess: () => onActionDone?.() },
    );
  };

  const partnerHref = activity.partner_id ? `/v2/network?partnerId=${activity.partner_id}` : null;
  const PrimaryIcon =
    primaryVerb === "Rispondi" ? Reply :
    primaryVerb === "Chiama" ? PhoneCall :
    primaryVerb === "Invia" ? Send : HelpCircle;

  const handleScheduleFuture = async () => {
    if (!futureDate || !activity.partner_id) return;
    setScheduling(true);
    try {
      const dueDate = format(futureDate, "yyyy-MM-dd");
      await insertActivity({
        partner_id: activity.partner_id,
        source_type: "partner",
        source_id: activity.partner_id,
        activity_type: "follow_up",
        title: `Follow-up: ${subject}`,
        description: description ?? null,
        priority: "medium",
        due_date: dueDate,
        user_id: user?.id ?? null,
        assigned_to: user?.id ?? null,
        status: "pending",
        completed_at: null,
        reviewed: false,
      });
      qc.invalidateQueries({ queryKey: activityKeys.all });
      qc.invalidateQueries({ queryKey: ["agenda-day"] });
      toast.success(`Programmata per ${format(futureDate, "d MMM yyyy", { locale: itLocale })}`);
      setPopoverOpen(false);
      onActionDone?.();
    } catch (e) {
      toast.error("Errore: " + (e instanceof Error ? e.message : "sconosciuto"));
    } finally {
      setScheduling(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="shrink-0 px-5 py-4 border-b border-border/30">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            {flag && <span className="text-2xl shrink-0 mt-0.5">{flag}</span>}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-semibold truncate">{partnerName}</h2>
                <Badge variant="outline" className={cn("text-[10px]", urgency.cls)}>
                  {urgency.label}
                </Badge>
                {inHolding && (
                  <Badge variant="outline" className="text-[10px] gap-1 border-sky-500/40 text-sky-500 bg-sky-500/10 animate-pulse">
                    <Plane className="w-3 h-3" /> In attesa
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                <ChannelIcon className="inline w-3 h-3 mr-1 -mt-0.5" />
                {channelLabel[activity.activity_type] || activity.activity_type}
                {(city || country) && <> · {[city, country].filter(Boolean).join(", ")}</>}
                <> · </>
                <Clock className="inline w-3 h-3 mr-0.5 -mt-0.5" />
                {relativeAge(activity.created_at)}
              </p>
            </div>
          </div>
          {partnerHref && (
            <Button asChild variant="ghost" size="sm" className="shrink-0 h-7 text-[11px]">
              <Link to={partnerHref}>
                Apri partner <ArrowUpRight className="w-3 h-3 ml-1" />
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Contesto */}
      <ScrollArea className="flex-1">
        <div className="p-5 space-y-4">
          <section>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
              Oggetto
            </p>
            <p className="text-sm font-medium leading-snug">{subject}</p>
          </section>

          {isEmailActivity ? (
            <section>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                Anteprima email
                {senderEmail && (
                  <span className="ml-2 font-normal normal-case tracking-normal text-muted-foreground/70">
                    da <span className="text-foreground/80">{senderEmail}</span>
                  </span>
                )}
              </p>
              {previewQuery.isLoading ? (
                <div className="space-y-1.5">
                  <div className="h-3 w-full animate-pulse bg-muted/40 rounded" />
                  <div className="h-3 w-11/12 animate-pulse bg-muted/40 rounded" />
                  <div className="h-3 w-2/3 animate-pulse bg-muted/40 rounded" />
                </div>
              ) : inboundPreview ? (
                <p className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed line-clamp-[14]">
                  {inboundPreview.slice(0, 1200)}
                  {inboundPreview.length > 1200 && "…"}
                </p>
              ) : description ? (
                <p className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed">
                  {description}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  Anteprima non disponibile. Apri il partner per il messaggio completo.
                </p>
              )}
            </section>
          ) : description ? (
            <section>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                Contesto
              </p>
              <p className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed">
                {description}
              </p>
            </section>
          ) : null}

          {activity.selected_contact && (
            <section>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                Contatto coinvolto
              </p>
              <p className="text-xs">{activity.selected_contact.name}</p>
            </section>
          )}

          {!isEmailActivity && !description && !activity.selected_contact && (
            <p className="text-xs text-muted-foreground italic">
              Nessun contesto aggiuntivo. Apri il partner per la cronologia completa.
            </p>
          )}
        </div>
      </ScrollArea>

      {/* Azioni */}
      <div className="shrink-0 border-t border-border/30 p-3 bg-card/30">
        <div className="flex items-center gap-2 flex-wrap">
          {partnerHref ? (
            <Button asChild size="sm" className="h-9 text-xs gap-1.5">
              <Link to={partnerHref}>
                <PrimaryIcon className="w-3.5 h-3.5" />
                {primaryVerb} ora
              </Link>
            </Button>
          ) : (
            <Button size="sm" disabled className="h-9 text-xs gap-1.5">
              <PrimaryIcon className="w-3.5 h-3.5" />
              {primaryVerb} ora
            </Button>
          )}
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-9 text-xs gap-1.5"
                disabled={!activity.partner_id}
                title="Crea un'attività futura per questo partner"
              >
                <CalendarPlus className="w-3.5 h-3.5" /> Programma futuro
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={futureDate}
                onSelect={setFutureDate}
                disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
              <div className="flex items-center justify-end gap-2 p-2 border-t border-border/30">
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setPopoverOpen(false)}>
                  Annulla
                </Button>
                <Button size="sm" className="h-7 text-xs" disabled={!futureDate || scheduling} onClick={handleScheduleFuture}>
                  Programma
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          <Button
            variant="outline"
            size="sm"
            className="h-9 text-xs gap-1.5 ml-auto"
            onClick={() => handleStatus("cancelled")}
          >
            <Archive className="w-3.5 h-3.5" /> Archivia
          </Button>
        </div>
      </div>
    </div>
  );
}