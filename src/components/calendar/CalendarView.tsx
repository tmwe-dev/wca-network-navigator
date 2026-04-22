/**
 * CalendarView Component
 * Monthly calendar grid with event display and navigation
 */
import React, { useState } from "react";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCalendarEvents } from "@/hooks/useCalendar";
import { CalendarEventCard } from "./CalendarEventCard";
import type { CalendarEvent, EventType } from "@/data/calendar";

interface CalendarViewProps {
  onEventClick?: (event: CalendarEvent) => void;
  onCreateEvent?: (date: Date) => void;
  eventTypeFilter?: EventType | null;
}

export function CalendarView({
  onEventClick,
  onCreateEvent,
  eventTypeFilter,
}: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Calculate date range for the month
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - firstDay.getDay());

  const monthStart = firstDay.toISOString().split("T")[0];
  const monthEnd = lastDay.toISOString().split("T")[0];

  const { data: events = [] } = useCalendarEvents(monthStart, monthEnd);

  // Filter events by type if specified
  const filteredEvents = eventTypeFilter
    ? events.filter((e) => e.event_type === eventTypeFilter)
    : events;

  // Create a map of events by date
  const eventsByDate = new Map<string, CalendarEvent[]>();
  filteredEvents.forEach((event) => {
    const dateKey = event.start_at.split("T")[0];
    if (!eventsByDate.has(dateKey)) {
      eventsByDate.set(dateKey, []);
    }
    eventsByDate.get(dateKey)!.push(event);
  });

  // Generate calendar days
  const days: (Date | null)[] = [];
  for (let i = 0; i < 42; i++) {
    const day = new Date(startDate);
    day.setDate(day.getDate() + i);
    if (i < startDate.getDay() + new Date(year, month + 1, 0).getDate()) {
      days.push(day);
    } else {
      days.push(null);
    }
  }

  const previousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const monthNames = [
    "Gennaio",
    "Febbraio",
    "Marzo",
    "Aprile",
    "Maggio",
    "Giugno",
    "Luglio",
    "Agosto",
    "Settembre",
    "Ottobre",
    "Novembre",
    "Dicembre",
  ];

  const dayNames = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];

  const getEventColor = (eventType: EventType): string => {
    const colors: Record<EventType, string> = {
      meeting: "bg-blue-100 text-blue-900 border-blue-300",
      call: "bg-green-100 text-green-900 border-green-300",
      task: "bg-yellow-100 text-yellow-900 border-yellow-300",
      reminder: "bg-purple-100 text-purple-900 border-purple-300",
      follow_up: "bg-orange-100 text-orange-900 border-orange-300",
    };
    return colors[eventType];
  };

  return (
    <div className="w-full h-full bg-gray-900 rounded-lg border border-gray-800 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-blue-400" />
          <h2 className="text-2xl font-bold text-white">
            {monthNames[month]} {year}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={previousMonth}
            className="border-gray-700 hover:bg-gray-800"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={goToToday}
            className="border-gray-700 hover:bg-gray-800"
          >
            Oggi
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={nextMonth}
            className="border-gray-700 hover:bg-gray-800"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Day headers */}
        {dayNames.map((dayName) => (
          <div
            key={dayName}
            className="p-2 text-center text-sm font-semibold text-gray-400"
          >
            {dayName}
          </div>
        ))}

        {/* Calendar cells */}
        {days.map((day, index) => {
          const dateKey = day ? day.toISOString().split("T")[0] : null;
          const dayEvents = dateKey ? eventsByDate.get(dateKey) || [] : [];
          const isCurrentMonth = day && day.getMonth() === month;
          const isToday =
            day &&
            day.getDate() === new Date().getDate() &&
            day.getMonth() === new Date().getMonth() &&
            day.getFullYear() === new Date().getFullYear();

          return (
            <div
              key={index}
              className={`
                min-h-24 p-2 border rounded
                ${isCurrentMonth ? "border-gray-700 bg-gray-800" : "border-gray-800 bg-gray-900"}
                ${isToday ? "ring-2 ring-blue-400" : ""}
                hover:bg-gray-750 transition-colors cursor-pointer
              `}
              onClick={() => {
                if (day && onCreateEvent) {
                  onCreateEvent(day);
                }
              }}
            >
              <div
                className={`text-sm font-semibold mb-1 ${
                  isCurrentMonth ? "text-white" : "text-gray-600"
                }`}
              >
                {day?.getDate()}
              </div>

              <div className="space-y-1">
                {dayEvents.slice(0, 3).map((event) => (
                  <CalendarEventCard
                    key={event.id}
                    event={event}
                    onClick={() => {
                      if (onEventClick) onEventClick(event);
                    }}
                    className={`text-xs p-1 rounded cursor-pointer border ${getEventColor(event.event_type)}`}
                  />
                ))}

                {dayEvents.length > 3 && (
                  <div className="text-xs text-gray-400 px-1">
                    +{dayEvents.length - 3} altro
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
