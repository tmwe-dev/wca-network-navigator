import { useState, lazy, Suspense, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Check, ChevronLeft, ChevronRight, ListTodo } from "lucide-react";
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
} from "date-fns";
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

  const getRemindersForDay = (day: Date) => {
    return reminders?.filter((r) => isSameDay(new Date(r.due_date), day)) || [];
  };

  const pendingReminders = reminders?.filter((r) => r.status === "pending") || [];
  const completedReminders = reminders?.filter((r) => r.status === "completed") || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reminders</h1>
        <p className="text-muted-foreground mt-1">
          Track follow-ups and important dates
        </p>
      </div>

      <Tabs defaultValue={tabFromUrl || "calendar"} className="space-y-6">
        <TabsList>
          <TabsTrigger value="calendar">
            <Calendar className="w-4 h-4 mr-2" />
            Calendar
          </TabsTrigger>
          <TabsTrigger value="list">
            Pending ({pendingReminders.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed ({completedReminders.length})
          </TabsTrigger>
          <TabsTrigger value="activities">
            <ListTodo className="w-4 h-4 mr-2" />
            Attività
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendar">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg">
                {format(currentMonth, "MMMM yyyy")}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentMonth(new Date())}
                >
                  Today
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Weekday headers */}
              <div className="grid grid-cols-7 gap-px mb-2">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                  <div
                    key={day}
                    className="text-center text-sm font-medium text-muted-foreground py-2"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
                {days.map((day) => {
                  const dayReminders = getRemindersForDay(day);
                  const isCurrentMonth = isSameMonth(day, currentMonth);

                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        "min-h-24 p-2 bg-card",
                        !isCurrentMonth && "bg-muted/30"
                      )}
                    >
                      <div
                        className={cn(
                          "text-sm font-medium mb-1",
                          !isCurrentMonth && "text-muted-foreground",
                          isToday(day) &&
                            "w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center"
                        )}
                      >
                        {format(day, "d")}
                      </div>
                      <div className="space-y-1">
                        {dayReminders.slice(0, 3).map((reminder) => (
                          <Link
                            key={reminder.id}
                            to={`/partners/${reminder.partner_id}`}
                            className={cn(
                              "block text-[10px] px-1.5 py-0.5 rounded truncate font-medium",
                              reminder.status === "completed"
                                ? "bg-muted text-muted-foreground line-through"
                                : getPriorityColor(reminder.priority)
                            )}
                          >
                            {reminder.title}
                          </Link>
                        ))}
                        {dayReminders.length > 3 && (
                          <p className="text-[10px] text-muted-foreground">
                            +{dayReminders.length - 3} more
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="list">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Pending Reminders</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : pendingReminders.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No pending reminders
                </p>
              ) : (
                <div className="space-y-3">
                  {pendingReminders.map((reminder) => (
                    <div
                      key={reminder.id}
                      className="flex items-center gap-4 p-4 rounded-lg border"
                    >
                      <div className="text-2xl">
                        {reminder.partners
                          ? getCountryFlag(reminder.partners.country_code)
                          : "📅"}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{reminder.title}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{reminder.partners?.company_name}</span>
                          <span>•</span>
                          <span>{format(new Date(reminder.due_date), "MMM d, yyyy")}</span>
                        </div>
                      </div>
                      <Badge className={cn(getPriorityColor(reminder.priority))}>
                        {reminder.priority}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => completeReminder.mutate(reminder.id)}
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="completed">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Completed Reminders</CardTitle>
            </CardHeader>
            <CardContent>
              {completedReminders.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No completed reminders
                </p>
              ) : (
                <div className="space-y-3">
                  {completedReminders.map((reminder) => (
                    <div
                      key={reminder.id}
                      className="flex items-center gap-4 p-4 rounded-lg border opacity-60"
                    >
                      <div className="text-2xl">
                        {reminder.partners
                          ? getCountryFlag(reminder.partners.country_code)
                          : "📅"}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium line-through">{reminder.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {reminder.partners?.company_name}
                        </p>
                      </div>
                      <Badge variant="secondary">Completed</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="activities">
          <Suspense fallback={<Skeleton className="h-40 w-full" />}>
            <ActivitiesTab initialBatchFilter={batchFromUrl} />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
