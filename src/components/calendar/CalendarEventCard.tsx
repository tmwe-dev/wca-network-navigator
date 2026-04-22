/**
 * CalendarEventCard Component
 * Compact event display for calendar view
 */
import React from "react";
import { Clock, Users, Target, AlertCircle, ArrowRight } from "lucide-react";
import type { CalendarEvent, EventType } from "@/data/calendar";

interface CalendarEventCardProps {
  event: CalendarEvent;
  onClick?: () => void;
  className?: string;
  compact?: boolean;
}

export function CalendarEventCard({
  event,
  onClick,
  className = "",
  compact = true,
}: CalendarEventCardProps) {
  const getEventIcon = (type: EventType) => {
    const iconProps = {
      className: "w-3 h-3",
    };

    switch (type) {
      case "meeting":
        return <Users {...iconProps} />;
      case "call":
        return <Clock {...iconProps} />;
      case "task":
        return <Target {...iconProps} />;
      case "reminder":
        return <AlertCircle {...iconProps} />;
      case "follow_up":
        return <ArrowRight {...iconProps} />;
      default:
        return <Clock {...iconProps} />;
    }
  };

  const getEventTypeLabel = (type: EventType): string => {
    const labels: Record<EventType, string> = {
      meeting: "Riunione",
      call: "Chiamata",
      task: "Attività",
      reminder: "Promemoria",
      follow_up: "Follow-up",
    };
    return labels[type];
  };

  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("it-IT", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (compact) {
    return (
      <div
        onClick={onClick}
        className={`flex items-start gap-1 ${className}`}
        title={event.title}
      >
        <span className="flex-shrink-0">{getEventIcon(event.event_type)}</span>
        <span className="truncate text-xs font-medium">{event.title}</span>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`flex flex-col gap-2 p-2 rounded border cursor-pointer hover:shadow-md transition-shadow ${className}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <span className="flex-shrink-0 mt-0.5">{getEventIcon(event.event_type)}</span>
          <div className="min-w-0 flex-1">
            <h4 className="font-semibold text-sm leading-tight truncate">
              {event.title}
            </h4>
            <p className="text-xs opacity-75">
              {getEventTypeLabel(event.event_type)}
            </p>
          </div>
        </div>
      </div>

      {!event.all_day && (
        <div className="text-xs opacity-75">
          {formatTime(event.start_at)}
          {event.end_at && ` - ${formatTime(event.end_at)}`}
        </div>
      )}

      {event.location && (
        <div className="text-xs opacity-75 truncate">
          📍 {event.location}
        </div>
      )}
    </div>
  );
}
