/**
 * AgendaPage V2 — Layout operativo: lista attività (1/3) + pannello azione (2/3).
 *
 * I filtri (giorno, canale, stato risposta, tipo, priorità, search) vivono nella
 * **sidebar globale Filtri** del sistema (vedi AgendaFiltersSection). Qui leggiamo
 * solo dal GlobalFiltersContext — nessun pannello locale dedicato ai filtri.
 */
import { useMemo, useState } from "react";
import { parseISO } from "date-fns";
import AgendaDayDetail from "@/components/agenda/AgendaDayDetail";
import AgendaActionPanel from "@/components/agenda/AgendaActionPanel";
import { useAgendaDayActivities } from "@/hooks/useAgendaDayActivities";
import { verbForActivity } from "@/components/agenda/agendaActionGroups";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import type { AllActivity } from "@/hooks/useActivities";
import type { ActivityTypeFilter, ResponseFilter } from "@/components/agenda/AgendaCalendarPage";

const VALID_CHANNELS: ActivityTypeFilter[] = ["all", "send_email", "whatsapp", "linkedin", "phone_call", "note"];
const VALID_RESPONSES: ResponseFilter[] = ["all", "responded", "no_response"];

export function AgendaPage() {
  const g = useGlobalFilters();
  const [selectedActivity, setSelectedActivity] = useState<AllActivity | null>(null);

  const selectedDay = useMemo<Date>(
    () => (g.filters.agendaDay ? parseISO(g.filters.agendaDay) : new Date()),
    [g.filters.agendaDay],
  );

  const filters = useMemo(() => ({
    activityType: (VALID_CHANNELS.includes(g.filters.agendaChannel as ActivityTypeFilter)
      ? g.filters.agendaChannel
      : "all") as ActivityTypeFilter,
    responseStatus: (VALID_RESPONSES.includes(g.filters.agendaResponse as ResponseFilter)
      ? g.filters.agendaResponse
      : "all") as ResponseFilter,
  }), [g.filters.agendaChannel, g.filters.agendaResponse]);

  const { data } = useAgendaDayActivities(selectedDay);
  const respondedIds = data?.respondedPartnerIds || new Set<string>();

  const primaryVerb = useMemo(() => {
    if (!selectedActivity) return "Apri";
    const responded = selectedActivity.partner_id ? respondedIds.has(selectedActivity.partner_id) : false;
    return verbForActivity(selectedActivity, responded);
  }, [selectedActivity, respondedIds]);

  // Quando cambia il giorno via sidebar globale, deseleziono l'attività corrente
  // (il contesto è cambiato).
  useMemo(() => {
    setSelectedActivity(null);
  }, [g.filters.agendaDay]);

  return (
    <div data-testid="page-agenda" className="flex flex-col h-full">
      <div className="flex-1 flex min-h-0">
        {/* Pannello sinistro — lista card (1/3) */}
        <div className="w-1/3 min-w-[320px] max-w-[480px] shrink-0 border-r border-border/30 bg-card/10">
          <AgendaDayDetail
            selectedDay={selectedDay}
            filters={filters}
            selectedActivityId={selectedActivity?.id ?? null}
            onSelectActivity={setSelectedActivity}
          />
        </div>

        {/* Pannello destro — azione operativa (2/3) */}
        <div className="flex-1 min-w-0 bg-background">
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
