import { useState, useMemo } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  isSameDay,
  isSameMonth,
  isToday,
  getHours,
  parseISO,
} from "date-fns";
import { it } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Calendar as CalIcon, Mail, Phone, Users, RotateCcw, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { useReminders } from "@/hooks/useReminders";
import { useAllActivities } from "@/hooks/useActivities";
import { ScrollArea } from "@/components/ui/scroll-area";

type ViewMode = "month" | "week" | "day";

interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  hour?: number;
  type: "reminder" | "activity";
  priority: string;
  activityType?: string;
  status?: string;
  company?: string;
}

const ACTIVITY_COLORS: Record<string, string> = {
  send_email: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  phone_call: "bg-green-500/20 text-green-300 border-green-500/30",
  meeting: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  follow_up: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  add_to_campaign: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  other: "bg-muted text-muted-foreground border-border",
};

const ACTIVITY_ICONS: Record<string, typeof Mail> = {
  send_email: Mail,
  phone_call: Phone,
  meeting: Users,
  follow_up: RotateCcw,
  add_to_campaign: Users,
  other: MoreHorizontal,
};

const PRIORITY_DOT: Record<string, string> = {
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-green-500",
};

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8); // 8-20

export default function Agenda() {
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [currentDate, setCurrentDate] = useState(new Date());

  const { data: reminders = [] } = useReminders();
  const { data: activities = [] } = useAllActivities();

  const events = useMemo<CalendarEvent[]>(() => {
    const evts: CalendarEvent[] = [];

    reminders.forEach((r) => {
      evts.push({
        id: r.id,
        title: r.title,
        date: parseISO(r.due_date),
        type: "reminder",
        priority: r.priority || "medium",
        company: r.partners?.company_name,
      });
    });

    activities.forEach((a) => {
      if (!a.due_date) return;
      const d = parseISO(a.due_date);
      evts.push({
        id: a.id,
        title: a.title,
        date: d,
        hour: undefined,
        type: "activity",
        priority: a.priority || "medium",
        activityType: a.activity_type,
        status: a.status,
        company: a.partners?.company_name || (a.source_meta as any)?.company_name,
      });
    });

    return evts;
  }, [reminders, activities]);

  const navigate = (dir: 1 | -1) => {
    if (viewMode === "month") setCurrentDate(dir === 1 ? addMonths(currentDate, 1) : subMonths(currentDate, 1));
    else if (viewMode === "week") setCurrentDate(dir === 1 ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1));
    else setCurrentDate(dir === 1 ? addDays(currentDate, 1) : subDays(currentDate, 1));
  };

  const headerLabel = useMemo(() => {
    if (viewMode === "month") return format(currentDate, "MMMM yyyy", { locale: it });
    if (viewMode === "week") {
      const s = startOfWeek(currentDate, { weekStartsOn: 1 });
      const e = endOfWeek(currentDate, { weekStartsOn: 1 });
      return `${format(s, "d MMM", { locale: it })} — ${format(e, "d MMM yyyy", { locale: it })}`;
    }
    return format(currentDate, "EEEE d MMMM yyyy", { locale: it });
  }, [currentDate, viewMode]);

  const eventsForDay = (day: Date) => events.filter((e) => isSameDay(e.date, day));

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border/50 glass-panel px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h1 className="text-sm font-semibold capitalize min-w-[200px] text-center">{headerLabel}</h1>
          <button onClick={() => navigate(1)} className="p-1.5 rounded hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="ml-2 text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          >
            Oggi
          </button>
        </div>
        <div className="flex items-center gap-0.5 bg-muted/30 rounded-md p-0.5">
          {(["day", "week", "month"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setViewMode(m)}
              className={cn(
                "px-2.5 py-1 text-[10px] font-medium rounded transition-all uppercase tracking-wider",
                viewMode === m ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {m === "day" ? "G" : m === "week" ? "S" : "M"}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar body */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {viewMode === "month" && <MonthView currentDate={currentDate} eventsForDay={eventsForDay} onDayClick={(d) => { setCurrentDate(d); setViewMode("day"); }} />}
        {viewMode === "week" && <WeekView currentDate={currentDate} eventsForDay={eventsForDay} onDayClick={(d) => { setCurrentDate(d); setViewMode("day"); }} />}
        {viewMode === "day" && <DayView currentDate={currentDate} events={eventsForDay(currentDate)} />}
      </div>
    </div>
  );
}

/* ── Event Pill ── */
function EventPill({ event, compact = false }: { event: CalendarEvent; compact?: boolean }) {
  const colorClass = event.type === "reminder"
    ? "bg-orange-500/20 text-orange-300 border-orange-500/30"
    : ACTIVITY_COLORS[event.activityType || "other"];
  const Icon = event.type === "reminder" ? CalIcon : ACTIVITY_ICONS[event.activityType || "other"];

  if (compact) {
    return (
      <div className={cn("flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] border truncate", colorClass)}>
        <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", PRIORITY_DOT[event.priority] || PRIORITY_DOT.medium)} />
        <span className="truncate">{event.title}</span>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2 px-2 py-1.5 rounded-md border text-xs", colorClass)}>
      {Icon && <Icon className="w-3 h-3 flex-shrink-0" />}
      <span className={cn("w-2 h-2 rounded-full flex-shrink-0", PRIORITY_DOT[event.priority] || PRIORITY_DOT.medium)} />
      <div className="flex-1 min-w-0">
        <p className="truncate font-medium">{event.title}</p>
        {event.company && <p className="truncate text-[10px] opacity-70">{event.company}</p>}
      </div>
      {event.status === "completed" && <span className="text-[9px] opacity-50">✓</span>}
    </div>
  );
}

/* ── Month View ── */
function MonthView({ currentDate, eventsForDay, onDayClick }: { currentDate: Date; eventsForDay: (d: Date) => CalendarEvent[]; onDayClick: (d: Date) => void }) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });
  const weekDays = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-border/30 flex-shrink-0">
        {weekDays.map((d) => (
          <div key={d} className="text-[10px] text-muted-foreground font-medium text-center py-1.5 uppercase tracking-wider">{d}</div>
        ))}
      </div>
      {/* Grid */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="grid grid-cols-7 auto-rows-fr min-h-full">
          {days.map((day) => {
            const dayEvents = eventsForDay(day);
            const inMonth = isSameMonth(day, currentDate);
            const today = isToday(day);
            const MAX_SHOW = 3;

            return (
              <div
                key={day.toISOString()}
                onClick={() => onDayClick(day)}
                className={cn(
                  "border-b border-r border-border/20 p-1 min-h-[90px] cursor-pointer hover:bg-muted/20 transition-colors",
                  !inMonth && "opacity-40"
                )}
              >
                <div className={cn(
                  "text-[11px] font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full",
                  today && "bg-primary text-primary-foreground",
                  !today && "text-foreground"
                )}>
                  {format(day, "d")}
                </div>
                <div className="space-y-0.5">
                  {dayEvents.slice(0, MAX_SHOW).map((e) => (
                    <EventPill key={e.id} event={e} compact />
                  ))}
                  {dayEvents.length > MAX_SHOW && (
                    <div className="text-[9px] text-muted-foreground pl-1">+{dayEvents.length - MAX_SHOW} altri</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

/* ── Week View ── */
function WeekView({ currentDate, eventsForDay, onDayClick }: { currentDate: Date; eventsForDay: (d: Date) => CalendarEvent[]; onDayClick: (d: Date) => void }) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: endOfWeek(currentDate, { weekStartsOn: 1 }) });

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border/30 flex-shrink-0">
        <div />
        {days.map((day) => (
          <div
            key={day.toISOString()}
            onClick={() => onDayClick(day)}
            className="text-center py-2 cursor-pointer hover:bg-muted/20 transition-colors"
          >
            <div className="text-[10px] text-muted-foreground uppercase">{format(day, "EEE", { locale: it })}</div>
            <div className={cn(
              "text-sm font-semibold w-7 h-7 mx-auto flex items-center justify-center rounded-full",
              isToday(day) && "bg-primary text-primary-foreground"
            )}>
              {format(day, "d")}
            </div>
          </div>
        ))}
      </div>
      {/* Time grid */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="grid grid-cols-[60px_repeat(7,1fr)] min-h-[780px]">
          {HOURS.map((hour) => (
            <div key={hour} className="contents">
              <div className="text-[10px] text-muted-foreground text-right pr-2 py-2 border-b border-border/10">
                {`${hour}:00`}
              </div>
              {days.map((day) => {
                const dayEvents = eventsForDay(day);
                const hourEvents = dayEvents.filter((e) => (e.hour ?? 9) === hour);
                return (
                  <div key={`${day.toISOString()}-${hour}`} className="border-b border-r border-border/10 p-0.5 min-h-[60px] relative">
                    {hourEvents.map((e) => (
                      <EventPill key={e.id} event={e} compact />
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

/* ── Day View ── */
function DayView({ currentDate, events }: { currentDate: Date; events: CalendarEvent[] }) {
  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-1">
        {HOURS.map((hour) => {
          const hourEvents = events.filter((e) => (e.hour ?? 9) === hour);
          return (
            <div key={hour} className="flex gap-3 min-h-[56px]">
              <div className="text-xs text-muted-foreground w-12 text-right pt-1 flex-shrink-0">{`${hour}:00`}</div>
              <div className="flex-1 border-t border-border/20 pt-1 space-y-1">
                {hourEvents.length > 0
                  ? hourEvents.map((e) => <EventPill key={e.id} event={e} />)
                  : <div className="h-full" />
                }
              </div>
            </div>
          );
        })}

        {/* Events without specific hour */}
        {events.filter((e) => e.hour === undefined).length > 0 && (
          <div className="mt-6 border-t border-border/30 pt-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Senza orario</p>
            <div className="space-y-1">
              {events.filter((e) => e.hour === undefined).map((e) => (
                <EventPill key={e.id} event={e} />
              ))}
            </div>
          </div>
        )}

        {events.length === 0 && (
          <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
            Nessun impegno per questa giornata
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
