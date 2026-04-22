/**
 * AgendaPage V2 — Standalone V1 content migration (NO wrapper)
 */
import { useState } from "react";
import { Calendar } from "lucide-react";
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
      <div className="shrink-0 px-4 py-2 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="w-4 h-4 text-primary" />
            <div>
              <h1 className="text-sm font-semibold text-foreground">Agenda</h1>
              <p className="text-[10px] text-muted-foreground">Attività, follow-up e scadenze</p>
            </div>
          </div>
        </div>
      </div>

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
