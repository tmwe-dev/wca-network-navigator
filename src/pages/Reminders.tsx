import { useState, lazy, Suspense, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Check, ChevronLeft, ChevronRight, ListTodo, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import { useReminders, useCompleteReminder } from "@/hooks/useReminders";
import { getCountryFlag, getPriorityColor } from "@/lib/countries";
import { Skeleton } from "@/components/ui/skeleton";
const ActivitiesTab = lazy(() => import("@/components/agenda/ActivitiesTab"));
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  isToday,
  isPast,
} from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";

export default function Reminders() {
  const [searchParams] = useSearchParams();
  const tabFromUrl = searchParams.get("tab") === "attivita" ? "activities" : undefined;
  const batchFromUrl = searchParams.get("batch") || undefined;
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const { data: reminders, isLoading } = useReminders();
  const completeReminder = useCompleteReminder();

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getRemindersForDay = (day: Date) =>
    reminders?.filter((r) => isSameDay(new Date(r.due_date), day)) || [];

  const pendingReminders = reminders?.filter((r) => r.status === "pending") || [];
  const completedReminders = reminders?.filter((r) => r.status === "completed") || [];
  const overdueReminders = useMemo(
    () => pendingReminders.filter((r) => isPast(new Date(r.due_date)) && !isToday(new Date(r.due_date))),
    [pendingReminders]
  );

  return (
    <div className="flex flex-col h-full">
      {/* Glass top bar with stats */}
      <div className="shrink-0 px-4 py-3 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="w-4.5 h-4.5 text-primary" />
            <div>
              <h1 className="text-sm font-semibold text-foreground">Agenda</h1>
              <p className="text-[11px] text-muted-foreground">Follow-up e scadenze</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full float-panel-subtle text-xs">
              <Clock className="w-3 h-3 text-warning" />
              <span className="font-medium text-foreground">{pendingReminders.length}</span>
              <span className="text-muted-foreground">in attesa</span>
            </div>
            {overdueReminders.length > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full float-panel-subtle text-xs">
                <AlertTriangle className="w-3 h-3 text-destructive" />
                <span className="font-medium text-destructive">{overdueReminders.length}</span>
                <span className="text-muted-foreground">scaduti</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full float-panel-subtle text-xs">
              <CheckCircle2 className="w-3 h-3 text-success" />
              <span className="font-medium text-foreground">{completedReminders.length}</span>
              <span className="text-muted-foreground">completati</span>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue={tabFromUrl || "calendar"} className="flex-1 flex flex-col min-h-0">
        <div className="px-4 pt-2 border-b border-border/50 shrink-0">
          <TabsList className="h-9">
            <TabsTrigger value="calendar" className="gap-1.5 text-xs">
              <Calendar className="w-3.5 h-3.5" />
              Calendario
            </TabsTrigger>
            <TabsTrigger value="list" className="gap-1.5 text-xs">
              In attesa ({pendingReminders.length})
            </TabsTrigger>
            <TabsTrigger value="completed" className="gap-1.5 text-xs">
              Completati ({completedReminders.length})
            </TabsTrigger>
            <TabsTrigger value="activities" className="gap-1.5 text-xs">
              <ListTodo className="w-3.5 h-3.5" />
              Attività
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="calendar" className="flex-1 m-0 overflow-auto p-4">
          <div className="float-panel p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-foreground capitalize">
                {format(currentMonth, "MMMM yyyy", { locale: it })}
              </h2>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setCurrentMonth(new Date())}
                >
                  Oggi
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-px mb-2">
              {["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map((day) => (
                <div
                  key={day}
                  className="text-center text-[10px] font-medium text-muted-foreground py-1.5"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-px rounded-xl overflow-hidden border border-border/30">
              {days.map((day) => {
                const dayReminders = getRemindersForDay(day);
                const isCurrentMonth = isSameMonth(day, currentMonth);

                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "min-h-20 p-1.5 transition-colors",
                      isCurrentMonth
                        ? "bg-card/70 backdrop-blur-sm"
                        : "bg-muted/20"
                    )}
                  >
                    <div
                      className={cn(
                        "text-xs font-medium mb-1",
                        !isCurrentMonth && "text-muted-foreground/50",
                        isToday(day) &&
                          "w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px]"
                      )}
                    >
                      {format(day, "d")}
                    </div>
                    <div className="space-y-0.5">
                      {dayReminders.slice(0, 3).map((reminder) => (
                        <Link
                          key={reminder.id}
                          to={`/partners/${reminder.partner_id}`}
                          className={cn(
                            "block text-[9px] px-1 py-0.5 rounded truncate font-medium leading-tight",
                            reminder.status === "completed"
                              ? "bg-muted/50 text-muted-foreground line-through"
                              : getPriorityColor(reminder.priority)
                          )}
                        >
                          {reminder.title}
                        </Link>
                      ))}
                      {dayReminders.length > 3 && (
                        <p className="text-[9px] text-muted-foreground pl-1">
                          +{dayReminders.length - 3}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="list" className="flex-1 m-0 overflow-auto p-4">
          <div className="float-panel p-4">
            <h2 className="text-sm font-semibold mb-3">Reminder in attesa</h2>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-lg" />
                ))}
              </div>
            ) : pendingReminders.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-8">
                Nessun reminder in attesa
              </p>
            ) : (
              <div className="space-y-2">
                {pendingReminders.map((reminder) => (
                  <div
                    key={reminder.id}
                    className="flex items-center gap-3 p-3 rounded-xl float-panel-subtle hover:bg-card/80 transition-colors"
                  >
                    <div className="text-xl shrink-0">
                      {reminder.partners
                        ? getCountryFlag(reminder.partners.country_code)
                        : "📅"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{reminder.title}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="truncate">{reminder.partners?.company_name}</span>
                        <span>•</span>
                        <span>{format(new Date(reminder.due_date), "d MMM yyyy", { locale: it })}</span>
                      </div>
                    </div>
                    <Badge className={cn("shrink-0 text-[10px]", getPriorityColor(reminder.priority))}>
                      {reminder.priority === "high" ? "Alta" : reminder.priority === "medium" ? "Media" : "Bassa"}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => completeReminder.mutate(reminder.id)}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="completed" className="flex-1 m-0 overflow-auto p-4">
          <div className="float-panel p-4">
            <h2 className="text-sm font-semibold mb-3">Reminder completati</h2>
            {completedReminders.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-8">
                Nessun reminder completato
              </p>
            ) : (
              <div className="space-y-2">
                {completedReminders.map((reminder) => (
                  <div
                    key={reminder.id}
                    className="flex items-center gap-3 p-3 rounded-xl float-panel-subtle opacity-60"
                  >
                    <div className="text-xl shrink-0">
                      {reminder.partners
                        ? getCountryFlag(reminder.partners.country_code)
                        : "📅"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium line-through truncate">{reminder.title}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {reminder.partners?.company_name}
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-[10px]">Completato</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="activities" className="flex-1 m-0 overflow-auto p-4">
          <Suspense fallback={<Skeleton className="h-40 w-full rounded-xl" />}>
            <ActivitiesTab initialBatchFilter={batchFromUrl} />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
