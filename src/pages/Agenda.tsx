import { useState } from "react";
import { Calendar, TestTube2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { useOutreachMock } from "@/hooks/useOutreachMock";
import AgendaCalendarPage, { type ActivityTypeFilter, type ResponseFilter } from "@/components/agenda/AgendaCalendarPage";
import AgendaDayDetail from "@/components/agenda/AgendaDayDetail";
import { cn } from "@/lib/utils";

export default function Agenda() {
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [filters, setFilters] = useState<{
    activityType: ActivityTypeFilter;
    responseStatus: ResponseFilter;
  }>({
    activityType: "all",
    responseStatus: "all",
  });
  const { mockEnabled, toggleMock } = useOutreachMock();

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="shrink-0 px-4 py-2 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="w-4 h-4 text-primary" />
            <div>
              <h1 className="text-sm font-semibold text-foreground">Agenda</h1>
              <p className="text-[10px] text-muted-foreground">Attività, follow-up e scadenze</p>
            </div>
          </div>
          <InfoTooltip content="Mostra/nascondi dati demo per visualizzare la grafica finale">
            <Button
              variant={mockEnabled ? "default" : "outline"}
              size="sm"
              className={cn("h-7 gap-1.5 text-[10px]", mockEnabled && "bg-amber-600 hover:bg-amber-700")}
              onClick={toggleMock}
            >
              <TestTube2 className="w-3 h-3" />
              {mockEnabled ? "Mock ON" : "Mock"}
            </Button>
          </InfoTooltip>
        </div>
      </div>

      {/* Book layout */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left page - Calendar + Filters */}
        <div className="w-[240px] shrink-0 border-r border-border/30 bg-card/30 overflow-auto">
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
