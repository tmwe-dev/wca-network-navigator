import { CalendarCheck, Clock, CheckCircle2 } from "lucide-react";
import { useAllActivities } from "@/hooks/useActivities";
import { format, isToday, isTomorrow } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";

export function MiniAgenda({ className }: { className?: string }) {
  const { data: activities = [] } = useAllActivities();

  const upcoming = activities
    .filter(a => !["completed", "cancelled"].includes(a.status) && a.due_date)
    .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())
    .slice(0, 5);

  const todayCount = upcoming.filter(a => a.due_date && isToday(new Date(a.due_date))).length;
  const tomorrowCount = upcoming.filter(a => a.due_date && isTomorrow(new Date(a.due_date))).length;

  return (
    <div className={cn("rounded-xl border border-border/60 bg-card p-4", className)}>
      <div className="flex items-center gap-2 mb-3">
        <CalendarCheck className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold text-foreground">Agenda</span>
        <div className="flex gap-2 ml-auto">
          {todayCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
              {todayCount} oggi
            </span>
          )}
          {tomorrowCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
              {tomorrowCount} domani
            </span>
          )}
        </div>
      </div>
      <div className="space-y-1.5">
        {upcoming.map(a => {
          const date = new Date(a.due_date!);
          const dateLabel = isToday(date) ? "Oggi" : isTomorrow(date) ? "Domani" : format(date, "dd MMM", { locale: it });
          return (
            <div key={a.id} className="flex items-center gap-2 text-xs">
              <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="truncate flex-1 text-foreground/80">{a.title}</span>
              <span className="text-[10px] text-muted-foreground shrink-0">{dateLabel}</span>
            </div>
          );
        })}
        {upcoming.length === 0 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Nessuna attività in scadenza
          </div>
        )}
      </div>
    </div>
  );
}
