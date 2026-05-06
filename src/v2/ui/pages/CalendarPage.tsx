/**
 * CalendarPage Component
 * Main calendar view with sidebar and event management
 */
import React, { useState } from "react";
import { Plus, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CalendarView } from "@/components/calendar/CalendarView";
import { CreateEventDialog } from "@/components/calendar/CreateEventDialog";
import { EventDetailSheet } from "@/components/calendar/EventDetailSheet";
import { UpcomingEventsWidget } from "@/components/calendar/UpcomingEventsWidget";
import type { CalendarEvent, EventType } from "@/data/calendar";

export function CalendarPage() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createDialogDate, setCreateDialogDate] = useState<Date | undefined>();
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [eventTypeFilter, setEventTypeFilter] = useState<EventType | null>(null);

  const handleCreateEvent = (date: Date) => {
    setCreateDialogDate(date);
    setCreateDialogOpen(true);
  };

  const handleSelectEvent = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setDetailSheetOpen(true);
  };

  const eventTypeOptions: { value: EventType; label: string }[] = [
    { value: "meeting", label: "Riunioni" },
    { value: "call", label: "Chiamate" },
    { value: "task", label: "Attività" },
    { value: "reminder", label: "Promemoria" },
    { value: "follow_up", label: "Follow-up" },
  ];

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="border-b border-border bg-card/40 backdrop-blur-sm px-4 sm:px-6 py-3 flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">Calendario</h1>
        <Button onClick={() => setCreateDialogOpen(true)} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Nuovo Evento
        </Button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Calendar View - Main Content */}
        <div className="flex-1 overflow-auto p-6">
          <CalendarView
            onEventClick={handleSelectEvent}
            onCreateEvent={handleCreateEvent}
            eventTypeFilter={eventTypeFilter}
          />
        </div>

        {/* Sidebar */}
        <div className="w-full lg:w-80 lg:border-l border-t lg:border-t-0 border-border bg-card/40 overflow-auto p-4 sm:p-6 space-y-6">
          {/* Upcoming Events Widget */}
          <UpcomingEventsWidget
            limit={5}
            onEventClick={handleSelectEvent}
          />

          {/* Filters */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Filtra per tipo</h3>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => setEventTypeFilter(null)}
                className={`w-full px-3 py-2 rounded text-sm font-medium text-left transition-colors ${
                  eventTypeFilter === null
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-foreground hover:bg-accent"
                }`}
              >
                Tutti gli eventi
              </button>

              {eventTypeOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setEventTypeFilter(opt.value)}
                  className={`w-full px-3 py-2 rounded text-sm font-medium text-left transition-colors ${
                    eventTypeFilter === opt.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-foreground hover:bg-accent"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="border-t border-border pt-6 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Legenda</h3>

            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-blue-500" />
                <span className="text-muted-foreground">Riunioni</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-green-500" />
                <span className="text-muted-foreground">Chiamate</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-yellow-500" />
                <span className="text-muted-foreground">Attività</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-purple-500" />
                <span className="text-muted-foreground">Promemoria</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-orange-500" />
                <span className="text-muted-foreground">Follow-up</span>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="border-t border-border pt-6 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Statistiche</h3>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-card rounded p-3">
                <p className="text-muted-foreground">Programmati</p>
                <p className="text-2xl font-bold text-primary-foreground mt-1">
                  {eventTypeFilter
                    ? new Date().getTime() // Placeholder
                    : "—"}
                </p>
              </div>

              <div className="bg-card rounded p-3">
                <p className="text-muted-foreground">Completati</p>
                <p className="text-2xl font-bold text-primary-foreground mt-1">—</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <CreateEventDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        initialDate={createDialogDate}
      />

      <EventDetailSheet
        eventId={selectedEvent?.id || null}
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
        onEdit={() => {
          // Implement edit functionality
        }}
      />
    </div>
  );
}

export default CalendarPage;
