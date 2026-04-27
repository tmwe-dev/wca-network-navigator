/**
 * AgendaPage V2 — Standalone V1 content migration (NO wrapper)
 */
import { useState } from "react";
import AgendaCalendarPage, { type ActivityTypeFilter, type ResponseFilter } from "@/components/agenda/AgendaCalendarPage";
import AgendaDayDetail from "@/components/agenda/AgendaDayDetail";

export function AgendaPage() {
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [filters, setFilters] = useState<{
    activityType: ActivityTypeFilter;
    responseStatus: ResponseFilter;
  }>({
    activityType: "all",
    responseStatus: "all",
  });

  return (
    <div data-testid="page-agenda" className="flex flex-col h-full">
      <div className="flex-1 flex min-h-0 overflow-hidden">
        <div className="w-[240px] shrink-0 border-r border-border/30 bg-card/30 overflow-auto">
          <AgendaCalendarPage
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
            filters={filters}
            onFiltersChange={setFilters}
          />
        </div>

        <div className="flex-1 min-w-0 bg-card/10">
          <AgendaDayDetail
            selectedDay={selectedDay}
            filters={filters}
          />
        </div>
      </div>
    </div>
  );
}
