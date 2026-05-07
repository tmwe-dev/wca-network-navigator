/**
 * AgendaPage V2 — Layout operativo: tabs giorni multipli + lista (1/3) + pannello azione (2/3).
 *
 * I filtri (giorni multipli, canale, stato risposta, priorità, search) vivono nella
 * **sidebar globale Filtri** del sistema (vedi AgendaFiltersSection). La pagina
 * legge solo dal GlobalFiltersContext e mostra:
 *  - una barra di tabs con i giorni selezionati + frecce per scorrere
 *  - chip "filtri attivi" (canale / stato risposta) quando diversi da "Tutti"
 *  - lista azioni del giorno attivo (AgendaDayDetail)
 *  - pannello azione (AgendaActionPanel)
 */
import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { ChevronLeft, ChevronRight, X, Mail, MessageCircle, Linkedin, Phone, StickyNote } from "lucide-react";
import { CalendarDays } from "lucide-react";
import { PageTitleHeader } from "@/v2/ui/templates/PageTitleHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import AgendaDayDetail from "@/components/agenda/AgendaDayDetail";
import AgendaActionPanel from "@/components/agenda/AgendaActionPanel";
import { useAgendaDayActivities } from "@/hooks/useAgendaDayActivities";
import { verbForActivity } from "@/components/agenda/agendaActionGroups";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import type { AllActivity } from "@/hooks/useActivities";
import type { ActivityTypeFilter, ResponseFilter } from "@/components/agenda/AgendaCalendarPage";

const VALID_CHANNELS: ActivityTypeFilter[] = ["all", "send_email", "whatsapp", "linkedin", "phone_call", "other"];
const VALID_RESPONSES: ResponseFilter[] = ["all", "responded", "no_response"];

const CHANNEL_META: Record<string, { label: string; icon: typeof Mail }> = {
  send_email: { label: "Email", icon: Mail },
  whatsapp:   { label: "WhatsApp", icon: MessageCircle },
  linkedin:   { label: "LinkedIn", icon: Linkedin },
  phone_call: { label: "Chiamate", icon: Phone },
  other:      { label: "Note", icon: StickyNote },
};

const RESPONSE_LABEL: Record<string, string> = {
  responded: "Ha risposto",
  no_response: "Non ha risposto",
};

export function AgendaPage() {
  const g = useGlobalFilters();
  const [selectedActivity, setSelectedActivity] = useState<AllActivity | null>(null);

  // Lista giorni selezionati: se vuota → solo oggi.
  const todayKey = format(new Date(), "yyyy-MM-dd");
  const dayKeys = useMemo<string[]>(() => {
    const keys = g.filters.agendaDays.length > 0 ? g.filters.agendaDays : [todayKey];
    return [...keys].sort();
  }, [g.filters.agendaDays, todayKey]);

  // Indice del giorno attivo (default: primo)
  const [activeIdx, setActiveIdx] = useState(0);
  useEffect(() => {
    // se cambia la lista, resta nei limiti
    setActiveIdx(idx => Math.min(idx, dayKeys.length - 1));
  }, [dayKeys.length]);

  const activeKey = dayKeys[Math.min(activeIdx, dayKeys.length - 1)] ?? todayKey;
  const activeDay = useMemo(() => parseISO(activeKey), [activeKey]);

  const filters = useMemo(() => ({
    activityType: (VALID_CHANNELS.includes(g.filters.agendaChannel as ActivityTypeFilter)
      ? g.filters.agendaChannel
      : "all") as ActivityTypeFilter,
    responseStatus: (VALID_RESPONSES.includes(g.filters.agendaResponse as ResponseFilter)
      ? g.filters.agendaResponse
      : "all") as ResponseFilter,
  }), [g.filters.agendaChannel, g.filters.agendaResponse]);

  const { data } = useAgendaDayActivities(activeDay);
  const respondedIds = data?.respondedPartnerIds || new Set<string>();

  const primaryVerb = useMemo(() => {
    if (!selectedActivity) return "Apri";
    const responded = selectedActivity.partner_id ? respondedIds.has(selectedActivity.partner_id) : false;
    return verbForActivity(selectedActivity, responded);
  }, [selectedActivity, respondedIds]);

  // Quando cambia il giorno attivo, deseleziono l'attività corrente
  useEffect(() => {
    setSelectedActivity(null);
  }, [activeKey]);

  // ── Filtri attivi (chip) ────────────────────────────────────────────────
  const channelMeta = CHANNEL_META[g.filters.agendaChannel];
  const responseLabel = RESPONSE_LABEL[g.filters.agendaResponse];
  const searchTerm = g.filters.search.trim();
  const hasActiveFilters = !!channelMeta || !!responseLabel || !!searchTerm;

  // ── Frecce navigazione tabs ────────────────────────────────────────────
  const prev = () => setActiveIdx(i => Math.max(0, i - 1));
  const next = () => setActiveIdx(i => Math.min(dayKeys.length - 1, i + 1));

  return (
    <div data-testid="page-agenda" className="flex flex-col h-full">
      <PageTitleHeader icon={CalendarDays} title="Agenda" subtitle="Azioni del giorno" />
      {/* ── Barra superiore: tabs giorni + filtri attivi ─────────────────── */}
      <div className="shrink-0 border-b border-border/30 bg-card/20">
        <div className="flex items-center gap-2 px-3 py-2">
          <Button
            variant="ghost" size="icon" className="h-7 w-7 shrink-0"
            onClick={prev} disabled={activeIdx === 0} aria-label="Giorno precedente"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

          <div className="flex-1 flex items-center gap-1 overflow-x-auto scrollbar-none">
            {dayKeys.map((key, idx) => {
              const d = parseISO(key);
              const isActive = idx === activeIdx;
              const isToday = key === todayKey;
              return (
                <button
                  key={key}
                  onClick={() => setActiveIdx(idx)}
                  className={cn(
                    "shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all",
                    "border border-transparent",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted/30 hover:bg-muted/60 text-foreground/80",
                    !isActive && isToday && "border-primary/40",
                  )}
                  title={format(d, "EEEE d MMMM yyyy", { locale: it })}
                >
                  {format(d, "EEE d MMM", { locale: it })}
                  {isToday && (
                    <span className={cn(
                      "ml-1.5 text-[9px] uppercase tracking-wide opacity-70",
                      isActive ? "" : "text-primary"
                    )}>oggi</span>
                  )}
                </button>
              );
            })}
          </div>

          <Button
            variant="ghost" size="icon" className="h-7 w-7 shrink-0"
            onClick={next} disabled={activeIdx >= dayKeys.length - 1} aria-label="Giorno successivo"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {hasActiveFilters && (
          <div className="flex items-center gap-1.5 px-3 pb-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground mr-1">
              Filtri attivi:
            </span>

            {channelMeta && (
              <Badge
                variant="secondary"
                className="gap-1 text-[10px] cursor-pointer hover:bg-secondary/70"
                onClick={() => g.setFilter("agendaChannel", "all")}
              >
                <channelMeta.icon className="w-3 h-3" />
                {channelMeta.label}
                <X className="w-3 h-3 opacity-60" />
              </Badge>
            )}

            {responseLabel && (
              <Badge
                variant="secondary"
                className="gap-1 text-[10px] cursor-pointer hover:bg-secondary/70"
                onClick={() => g.setFilter("agendaResponse", "all")}
              >
                {responseLabel}
                <X className="w-3 h-3 opacity-60" />
              </Badge>
            )}

            {searchTerm && (
              <Badge
                variant="secondary"
                className="gap-1 text-[10px] cursor-pointer hover:bg-secondary/70"
                onClick={() => g.setSearch("")}
              >
                "{searchTerm}"
                <X className="w-3 h-3 opacity-60" />
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* ── Body: lista (1/3) + pannello azione (2/3) ─────────────────── */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        <div className="w-full md:w-1/3 md:min-w-[320px] md:max-w-[480px] h-1/2 md:h-auto shrink-0 border-b md:border-b-0 md:border-r border-border/30 bg-card/10 overflow-hidden">
          <AgendaDayDetail
            selectedDay={activeDay}
            filters={filters}
            search={searchTerm}
            selectedActivityId={selectedActivity?.id ?? null}
            onSelectActivity={setSelectedActivity}
          />
        </div>

        <div className="flex-1 min-w-0 min-h-0 bg-background">
          <AgendaActionPanel
            activity={selectedActivity}
            primaryVerb={primaryVerb}
            onActionDone={() => setSelectedActivity(null)}
          />
        </div>
      </div>
    </div>
  );
}