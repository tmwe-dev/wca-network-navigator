import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useActivitiesForPartner, useUpdateActivity } from "@/hooks/useActivities";
import { CheckCircle, Clock, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { toast } from "sonner";

const TYPE_LABELS: Record<string, string> = {
  send_email: "Email",
  phone_call: "Telefonata",
  add_to_campaign: "Campagna",
  meeting: "Meeting",
  follow_up: "Follow-up",
  other: "Altro",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  completed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  cancelled: "bg-muted text-muted-foreground",
};

const PRIORITY_COLORS: Record<string, string> = {
  high: "border-l-red-500",
  medium: "border-l-amber-500",
  low: "border-l-green-500",
};

export function ActivityList({ partnerId }: { partnerId: string }) {
  const { data: activities = [] } = useActivitiesForPartner(partnerId);
  const updateActivity = useUpdateActivity();

  const pending = activities.filter((a) => a.status !== "completed" && a.status !== "cancelled");
  const completed = activities.filter((a) => a.status === "completed");

  const markComplete = async (id: string) => {
    try {
      await updateActivity.mutateAsync({
        id,
        status: "completed",
        completed_at: new Date().toISOString(),
      });
      toast.success("Attività completata");
    } catch {
      toast.error("Errore");
    }
  };

  if (activities.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <ClipboardList className="w-4 h-4" />
          Attività ({pending.length} attive, {completed.length} completate)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {pending.map((a) => (
          <div
            key={a.id}
            className={cn(
              "flex items-center justify-between p-3 rounded-lg border border-l-4",
              PRIORITY_COLORS[a.priority] || ""
            )}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">{TYPE_LABELS[a.activity_type] || a.activity_type}</Badge>
                <span className="font-medium text-sm truncate">{a.title}</span>
              </div>
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                {a.team_members && <span>→ {(a.team_members as any).name}</span>}
                {a.due_date && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {format(new Date(a.due_date), "d MMM", { locale: it })}
                  </span>
                )}
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => markComplete(a.id)}>
              <CheckCircle className="w-4 h-4 text-green-500" />
            </Button>
          </div>
        ))}
        {completed.length > 0 && (
          <div className="pt-2 border-t space-y-1.5">
            <p className="text-xs text-muted-foreground font-medium">Completate</p>
            {completed.slice(0, 3).map((a) => (
              <div key={a.id} className="flex items-center gap-2 text-xs text-muted-foreground p-2 rounded border opacity-60">
                <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                <span className="truncate">{a.title}</span>
              </div>
            ))}
            {completed.length > 3 && (
              <p className="text-xs text-muted-foreground">+{completed.length - 3} altre</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
