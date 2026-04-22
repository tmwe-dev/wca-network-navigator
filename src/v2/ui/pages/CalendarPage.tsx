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
    <div className="h-full flex flex-col bg-gray-950">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900 px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-white">Calendario</h1>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => setCreateDialogOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nuovo Evento
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Calendar View - Main Content */}
        <div className="flex-1 overflow-auto p-6">
          <CalendarView
            onEventClick={handleSelectEvent}
            onCreateEvent={handleCreateEvent}
            eventTypeFilter={eventTypeFilter}
          />
        </div>

        {/* Sidebar */}
        <div className="w-80 border-l border-gray-800 bg-gray-900 overflow-auto p-6 space-y-6">
          {/* Upcoming Events Widget */}
          <UpcomingEventsWidget
            limit={5}
            onEventClick={handleSelectEvent}
          />

          {/* Filters */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="w-4 h-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-300">Filtra per tipo</h3>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => setEventTypeFilter(null)}
                className={`w-full px-3 py-2 rounded text-sm font-medium text-left transition-colors ${
                  eventTypeFilter === null
                    ? "bg-blue-600 text-white"
                    : "bg-gray-800 text-gray-300 hover:bg-gray-700"
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
                      ? "bg-blue-600 text-white"
                      : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="border-t border-gray-800 pt-6 space-y-3">
            <h3 className="text-sm font-semibold text-gray-300">Legenda</h3>

            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-blue-500" />
                <span className="text-gray-400">Riunioni</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-green-500" />
                <span className="text-gray-400">Chiamate</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-yellow-500" />
                <span className="text-gray-400">Attività</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-purple-500" />
                <span className="text-gray-400">Promemoria</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-orange-500" />
                <span className="text-gray-400">Follow-up</span>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="border-t border-gray-800 pt-6 space-y-3">
            <h3 className="text-sm font-semibold text-gray-300">Statistiche</h3>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-gray-800 rounded p-3">
                <p className="text-gray-400">Programmati</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {eventTypeFilter
                    ? new Date().getTime() // Placeholder
                    : "—"}
                </p>
              </div>

              <div className="bg-gray-800 rounded p-3">
                <p className="text-gray-400">Completati</p>
                <p className="text-2xl font-bold text-white mt-1">—</p>
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
