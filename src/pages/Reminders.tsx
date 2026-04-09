import { useState } from "react";
import { Calendar } from "lucide-react";
import AgendaCalendarPage, { type ActivityTypeFilter, type ResponseFilter } from "@/components/agenda/AgendaCalendarPage";
import AgendaDayDetail from "@/components/agenda/AgendaDayDetail";

export default function Reminders() {
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [filters, setFilters] = useState<{
    activityType: ActivityTypeFilter;
    responseStatus: ResponseFilter;
  }>({
    activityType: "all",
    responseStatus: "all",
  });

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="shrink-0 px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-3">
          <Calendar className="w-4.5 h-4.5 text-primary" />
          <div>
            <h1 className="text-sm font-semibold text-foreground">Agenda</h1>
            <p className="text-[11px] text-muted-foreground">Attività, follow-up e scadenze</p>
          </div>
        </div>
      </div>

      {/* Book layout */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left page - Calendar + Filters */}
        <div className="w-[280px] shrink-0 border-r border-border/30 bg-card/30 overflow-auto">
          <AgendaCalendarPage
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
            filters={filters}
            onFiltersChange={setFilters}
          />
        </div>

        {/* Right page - Day detail */}
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
