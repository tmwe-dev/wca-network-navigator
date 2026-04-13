import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronLeft, ChevronRight, Mail, MessageCircle, Linkedin, Phone, StickyNote } from "lucide-react";
import { useReminders } from "@/hooks/useReminders";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameMonth, isSameDay, addMonths, subMonths,
  startOfWeek, endOfWeek, isToday,
} from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";

export type ActivityTypeFilter = "all" | "send_email" | "whatsapp" | "linkedin" | "phone_call" | "note";
export type ResponseFilter = "all" | "responded" | "no_response";

interface AgendaCalendarPageProps {
  selectedDay: Date;
  onSelectDay: (day: Date) => void;
  filters: {
    activityType: ActivityTypeFilter;
    responseStatus: ResponseFilter;
  };
  onFiltersChange: (filters: { activityType: ActivityTypeFilter; responseStatus: ResponseFilter }) => void;
}

export default function AgendaCalendarPage({
  selectedDay,
  onSelectDay,
  filters,
  onFiltersChange,
}: AgendaCalendarPageProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const { data: reminders } = useReminders();

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getRemindersCount = (day: Date) =>
    reminders?.filter((r) => isSameDay(new Date(r.due_date), day)).length || 0;

  const activityTypes: { value: ActivityTypeFilter; label: string; icon: typeof Mail }[] = [
    { value: "all", label: "Tutti", icon: Mail },
    { value: "send_email", label: "Email", icon: Mail },
    { value: "whatsapp", label: "WhatsApp", icon: MessageCircle },
    { value: "linkedin", label: "LinkedIn", icon: Linkedin },
    { value: "phone_call", label: "Chiamate", icon: Phone },
    { value: "note", label: "Note", icon: StickyNote },
  ];

  const responseTypes: { value: ResponseFilter; label: string }[] = [
    { value: "all", label: "Tutti" },
    { value: "responded", label: "Ha risposto" },
    { value: "no_response", label: "Non ha risposto" },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Month header */}
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-sm font-bold text-foreground capitalize">
          {format(currentMonth, "MMMM yyyy", { locale: it })}
        </h2>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} aria-label="Precedente">
            <ChevronLeft className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={() => { setCurrentMonth(new Date()); onSelectDay(new Date()); }}>
            Oggi
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} aria-label="Successivo">
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-px px-3 mb-1">
        {["Lu", "Ma", "Me", "Gi", "Ve", "Sa", "Do"].map((d) => (
          <div key={d} className="text-center text-[9px] font-medium text-muted-foreground py-1">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px px-3 mb-4">
        {days.map((day) => {
          const isSelected = isSameDay(day, selectedDay);
          const isCurrent = isSameMonth(day, currentMonth);
          const count = getRemindersCount(day);

          return (
            <button
              key={day.toISOString()}
              onClick={() => onSelectDay(day)}
              className={cn(
                "relative flex flex-col items-center py-1.5 rounded-lg transition-all text-xs",
                !isCurrent && "opacity-30",
                isSelected && "bg-primary text-primary-foreground shadow-md",
                !isSelected && isToday(day) && "bg-accent text-accent-foreground",
                !isSelected && !isToday(day) && "hover:bg-muted/50"
              )}
            >
              <span className="font-medium">{format(day, "d")}</span>
              {count > 0 && (
                <div className={cn(
                  "w-1.5 h-1.5 rounded-full mt-0.5",
                  isSelected ? "bg-primary-foreground" : "bg-primary"
                )} />
              )}
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex-1 px-4 space-y-4 overflow-auto">
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-2">Tipo attività</p>
          <div className="space-y-1">
            {activityTypes.map((t) => (
              <label
                key={t.value}
                className={cn(
                  "flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors text-xs",
                  filters.activityType === t.value ? "bg-primary/10 text-primary" : "hover:bg-muted/50 text-muted-foreground"
                )}
                onClick={() => onFiltersChange({ ...filters, activityType: t.value })}
              >
                <t.icon className="w-3 h-3" />
                <span>{t.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-2">Stato risposta</p>
          <div className="space-y-1">
            {responseTypes.map((t) => (
              <label
                key={t.value}
                className={cn(
                  "flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors text-xs",
                  filters.responseStatus === t.value ? "bg-primary/10 text-primary" : "hover:bg-muted/50 text-muted-foreground"
                )}
                onClick={() => onFiltersChange({ ...filters, responseStatus: t.value })}
              >
                <Checkbox
                  checked={filters.responseStatus === t.value}
                  className="w-3 h-3"
                  tabIndex={-1}
                />
                <span>{t.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
