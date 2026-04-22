/**
 * UpcomingEventsWidget Component
 * Compact list of upcoming events for dashboard/sidebar use
 */
import React from "react";
import { Clock, ChevronRight } from "lucide-react";
import { useUpcomingEvents } from "@/hooks/useCalendar";
import { CalendarEventCard } from "./CalendarEventCard";
import type { CalendarEvent } from "@/data/calendar";

interface UpcomingEventsWidgetProps {
  limit?: number;
  onEventClick?: (event: CalendarEvent) => void;
  className?: string;
}

export function UpcomingEventsWidget({
  limit = 5,
  onEventClick,
  className = "",
}: UpcomingEventsWidgetProps) {
  const { data: events = [], isLoading } = useUpcomingEvents(limit);

  const getEventTypeColor = (type: string): string => {
    const colors: Record<string, string> = {
      meeting: "border-l-blue-400 bg-blue-950",
      call: "border-l-green-400 bg-green-950",
      task: "border-l-yellow-400 bg-yellow-950",
      reminder: "border-l-purple-400 bg-purple-950",
      follow_up: "border-l-orange-400 bg-orange-950",
    };
    return colors[type] || colors.meeting;
  };

  const getEventTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      meeting: "Riunione",
      call: "Chiamata",
      task: "Attività",
      reminder: "Promemoria",
      follow_up: "Follow-up",
    };
    return labels[type] || type;
  };

  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMs < 0) return "Passato";
    if (diffHours < 1) return "Fra pochi minuti";
    if (diffHours < 24) return `Fra ${diffHours}h`;
    if (diffDays === 1) return "Domani";
    if (diffDays <= 7) return `Fra ${diffDays}g`;

    return date.toLocaleDateString("it-IT", {
      month: "short",
      day: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className={`bg-gray-800 rounded-lg border border-gray-700 p-4 ${className}`}>
        <div className="h-32 bg-gray-700 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className={`bg-gray-800 rounded-lg border border-gray-700 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-700 bg-gray-850">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-semibold text-white">Prossimi Eventi</h3>
          </div>
          <span className="text-xs bg-blue-900 text-blue-100 px-2 py-1 rounded">
            {events.length}
          </span>
        </div>
      </div>

      {/* Events List */}
      {events.length > 0 ? (
        <div className="divide-y divide-gray-700">
          {events.map((event) => (
            <div
              key={event.id}
              onClick={() => {
                if (onEventClick) onEventClick(event);
              }}
              className={`p-3 border-l-4 cursor-pointer hover:bg-gray-750 transition-colors ${getEventTypeColor(event.event_type)}`}
            >
              <div className="space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-medium text-white line-clamp-2">
                    {event.title}
                  </h4>
                  <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
                </div>

                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span className="badge px-2 py-0.5 rounded bg-gray-700">
                    {getEventTypeLabel(event.event_type)}
                  </span>
                  <span className="font-medium">{formatTime(event.start_at)}</span>
                </div>

                {event.location && (
                  <p className="text-xs text-gray-500">📍 {event.location}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-8 text-center">
          <Clock className="w-8 h-8 text-gray-600 mx-auto mb-2" />
          <p className="text-sm text-gray-400">Nessun evento in programma</p>
        </div>
      )}

      {/* Footer link */}
      {events.length > 0 && (
        <div className="px-4 py-3 border-t border-gray-700 bg-gray-850">
          <button className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1">
            Visualizza tutti gli eventi
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}
