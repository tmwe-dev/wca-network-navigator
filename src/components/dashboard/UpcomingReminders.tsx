import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, ArrowRight, Check } from "lucide-react";
import { usePendingReminders, useCompleteReminder } from "@/hooks/useReminders";
import { getCountryFlag, getPriorityColor } from "@/lib/countries";
import { Skeleton } from "@/components/ui/skeleton";
import { format, isToday, isTomorrow, isPast } from "date-fns";
import { cn } from "@/lib/utils";

export function UpcomingReminders() {
  const { data: reminders, isLoading } = usePendingReminders();
  const completeReminder = useCompleteReminder();

  const formatDueDate = (date: string) => {
    const d = new Date(date);
    if (isToday(d)) return "Today";
    if (isTomorrow(d)) return "Tomorrow";
    return format(d, "MMM d");
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-semibold">Upcoming Reminders</CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/reminders" className="text-primary">
            View all <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="space-y-1 flex-1">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            ))
          ) : reminders?.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No pending reminders
            </p>
          ) : (
            reminders?.map((reminder) => (
              <div
                key={reminder.id}
                className="flex items-start gap-3 p-2 -mx-2 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted text-2xl flex-shrink-0">
                  {reminder.partners
                    ? getCountryFlag(reminder.partners.country_code)
                    : "📅"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{reminder.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {reminder.partners?.company_name}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={cn(
                        "text-xs font-medium",
                        isPast(new Date(reminder.due_date)) && !isToday(new Date(reminder.due_date))
                          ? "text-destructive"
                          : "text-muted-foreground"
                      )}
                    >
                      {formatDueDate(reminder.due_date)}
                    </span>
                    <Badge
                      className={cn("text-[10px] px-1.5 py-0", getPriorityColor(reminder.priority))}
                    >
                      {reminder.priority}
                    </Badge>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-success"
                  onClick={() => completeReminder.mutate(reminder.id)}
                >
                  <Check className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
