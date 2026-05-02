/**
 * AgendaPage V2 — Layout operativo: filtri in sidebar a scomparsa,
 * lista attività (1/3) + pannello azione (2/3).
 */
import { useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import AgendaCalendarPage, {
  type ActivityTypeFilter,
  type ResponseFilter,
} from "@/components/agenda/AgendaCalendarPage";
import AgendaDayDetail from "@/components/agenda/AgendaDayDetail";
import AgendaActionPanel from "@/components/agenda/AgendaActionPanel";
import AgendaFiltersTab from "@/components/agenda/AgendaFiltersTab";
import AgendaActiveFiltersBar from "@/components/agenda/AgendaActiveFiltersBar";
import { useAgendaDayActivities } from "@/hooks/useAgendaDayActivities";
import { verbForActivity } from "@/components/agenda/agendaActionGroups";
import type { AllActivity } from "@/hooks/useActivities";
import { isToday } from "date-fns";

export function AgendaPage() {
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
  const [filters, setFilters] = useState<{
    activityType: ActivityTypeFilter;
    responseStatus: ResponseFilter;
  }>({
    activityType: "all",
    responseStatus: "all",
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<AllActivity | null>(null);

  // Per derivare il verbo primario corretto per l'azione selezionata,
  // ci serve sapere se il partner ha risposto.
  const { data } = useAgendaDayActivities(selectedDay);
  const respondedIds = data?.respondedPartnerIds || new Set<string>();

  const primaryVerb = useMemo(() => {
    if (!selectedActivity) return "Apri";
    const responded = selectedActivity.partner_id
      ? respondedIds.has(selectedActivity.partner_id)
      : false;
    return verbForActivity(selectedActivity, responded);
  }, [selectedActivity, respondedIds]);

  const hasActiveFilters =
    filters.activityType !== "all" ||
    filters.responseStatus !== "all" ||
    !isToday(selectedDay);

  const handleSelectDay = (day: Date) => {
    setSelectedDay(day);
    setSelectedActivity(null); // il contesto cambia, deseleziono
  };

  return (
    <div data-testid="page-agenda" className="flex flex-col h-full">
      <div className="flex-1 flex min-h-0 relative">
        {/* Linguetta laterale per aprire i filtri */}
        <AgendaFiltersTab
          onClick={() => setFiltersOpen(true)}
          hasActiveFilters={hasActiveFilters}
        />

        {/* Sheet filtri (calendario + tipo + stato risposta) */}
        <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
          <SheetContent side="left" className="w-[320px] sm:w-[320px] p-0 flex flex-col">
            <SheetHeader className="px-4 py-3 border-b border-border/30">
              <SheetTitle className="text-sm">Filtri agenda</SheetTitle>
            </SheetHeader>
            <div className="flex-1 min-h-0">
              <AgendaCalendarPage
                selectedDay={selectedDay}
                onSelectDay={(d) => {
                  handleSelectDay(d);
                  // chiudo lo Sheet quando l'utente sceglie un giorno
                  setFiltersOpen(false);
                }}
                filters={filters}
                onFiltersChange={setFilters}
              />
            </div>
          </SheetContent>
        </Sheet>

        {/* Pannello sinistro — lista card (1/3) */}
        <div className="w-1/3 min-w-[320px] max-w-[480px] shrink-0 border-r border-border/30 bg-card/10 flex flex-col pl-7">
          <AgendaActiveFiltersBar
            selectedDay={selectedDay}
            filters={filters}
            onResetActivityType={() => setFilters((f) => ({ ...f, activityType: "all" }))}
            onResetResponse={() => setFilters((f) => ({ ...f, responseStatus: "all" }))}
            onResetDay={() => handleSelectDay(new Date())}
          />
          <div className="flex-1 min-h-0">
            <AgendaDayDetail
              selectedDay={selectedDay}
              filters={filters}
              selectedActivityId={selectedActivity?.id ?? null}
              onSelectActivity={setSelectedActivity}
            />
          </div>
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
