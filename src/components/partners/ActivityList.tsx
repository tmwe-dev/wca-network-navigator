import { useActivitiesForPartner, useUpdateActivity } from "@/hooks/useActivities";
import { CheckCircle2, Circle, Clock, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface ActivityListProps {
  partnerId: string;
}

const statusIcon: Record<string, React.ReactNode> = {
  pending: <Circle className="w-3.5 h-3.5 text-muted-foreground" />,
  in_progress: <Clock className="w-3.5 h-3.5 text-amber-500" />,
  completed: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />,
};

export function ActivityList({ partnerId }: ActivityListProps) {
  const { data: activities = [], isLoading } = useActivitiesForPartner(partnerId);
  const updateActivity = useUpdateActivity();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (activities.length === 0) return null;

  return (
    <div className="bg-card/80 backdrop-blur-sm border border-primary/5 rounded-2xl p-4">
      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3 font-medium">
        Attività ({activities.length})
      </p>
      <div className="space-y-2">
        {activities.slice(0, 5).map((a) => (
          <div
            key={a.id}
            className={cn(
              "flex items-center gap-2 p-2 rounded-lg text-sm transition-colors",
              a.status === "completed" ? "opacity-50" : "hover:bg-accent/50"
            )}
          >
            <button
              onClick={() => {
                const newStatus = a.status === "completed" ? "pending" : "completed";
                updateActivity.mutate({
                  id: a.id,
                  status: newStatus,
                  completed_at: newStatus === "completed" ? new Date().toISOString() : null,
                });
              }}
              className="shrink-0"
            >
              {statusIcon[a.status] || statusIcon.pending}
            </button>
            <div className="flex-1 min-w-0">
              <p className={cn("truncate", a.status === "completed" && "line-through")}>{a.title}</p>
              {a.due_date && (
                <p className="text-xs text-muted-foreground">
                  {format(new Date(a.due_date), "dd MMM", { locale: it })}
                </p>
              )}
            </div>
            {a.team_members?.name && (
              <span className="text-xs text-muted-foreground shrink-0">{a.team_members.name}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
