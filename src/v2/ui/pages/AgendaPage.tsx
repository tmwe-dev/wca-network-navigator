/**
 * AgendaPage — Activities grouped by date with overdue highlighting
 */
import * as React from "react";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Clock, AlertCircle, CheckCircle } from "lucide-react";
import { StatusBadge } from "../atoms/StatusBadge";
import { useNavigate } from "react-router-dom";

interface AgendaActivity {
  readonly id: string;
  readonly title: string;
  readonly activity_type: string;
  readonly status: string;
  readonly due_date: string | null;
  readonly priority: string;
  readonly created_at: string;
}

export function AgendaPage(): React.ReactElement {
  const navigate = useNavigate();

  const { data: activities, isLoading } = useQuery({
    queryKey: ["v2-agenda"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activities")
        .select("id, title, activity_type, status, due_date, priority, created_at")
        .in("status", ["pending", "in_progress"])
        .not("due_date", "is", null)
        .order("due_date", { ascending: true })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as AgendaActivity[];
    },
  });

  const today = new Date().toISOString().split("T")[0];

  // Group by date
  const grouped = useMemo(() => {
    if (!activities) return new Map<string, AgendaActivity[]>();
    const map = new Map<string, AgendaActivity[]>();
    for (const a of activities) {
      const date = a.due_date?.split("T")[0] ?? "no-date";
      const list = map.get(date) ?? [];
      list.push(a);
      map.set(date, list);
    }
    return map;
  }, [activities]);

  const overdueCount = useMemo(
    () => activities?.filter((a) => a.due_date && a.due_date < today).length ?? 0,
    [activities, today],
  );

  const formatDateLabel = (date: string): string => {
    if (date === today) return "Oggi";
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (date === tomorrow.toISOString().split("T")[0]) return "Domani";
    if (date < today) return `Scaduto — ${new Date(date).toLocaleDateString("it")}`;
    return new Date(date).toLocaleDateString("it", { weekday: "long", day: "numeric", month: "long" });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Calendar className="h-6 w-6" />Agenda
          </h1>
          <p className="text-sm text-muted-foreground">
            {isLoading ? "Caricamento..." : `${activities?.length ?? 0} attività pianificate • ${overdueCount} scadute`}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : grouped.size > 0 ? (
        <div className="space-y-6">
          {Array.from(grouped.entries()).map(([date, items]) => {
            const isOverdue = date < today;
            return (
              <div key={date}>
                <div className={`flex items-center gap-2 mb-2 ${isOverdue ? "text-destructive" : "text-foreground"}`}>
                  {isOverdue ? <AlertCircle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                  <h3 className="font-semibold text-sm">{formatDateLabel(date)}</h3>
                  <span className="text-xs text-muted-foreground">({items.length})</span>
                </div>
                <div className="space-y-2 pl-6">
                  {items.map((a) => (
                    <div
                      key={a.id}
                      className={`p-3 rounded-lg border bg-card cursor-pointer hover:bg-accent/30 transition-colors ${isOverdue ? "border-l-4 border-l-destructive" : ""}`}
                      onClick={() => navigate("/v2/outreach")}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm text-foreground">{a.title}</span>
                        <div className="flex items-center gap-2">
                          <StatusBadge
                            status={a.priority === "high" ? "error" : a.priority === "medium" ? "warning" : "neutral"}
                            label={a.priority}
                          />
                          <StatusBadge
                            status={a.status === "in_progress" ? "info" : "warning"}
                            label={a.status}
                          />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{a.activity_type.replace(/_/g, " ")}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12">
          <Calendar className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Nessuna attività pianificata</p>
        </div>
      )}
    </div>
  );
}
