/**
 * AgendaPage — Activities and follow-up calendar
 */
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Clock, AlertCircle } from "lucide-react";
import { StatusBadge } from "../atoms/StatusBadge";

export function AgendaPage(): React.ReactElement {
  const { data: activities, isLoading } = useQuery({
    queryKey: ["v2-agenda"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activities")
        .select("id, title, activity_type, status, due_date, priority, created_at")
        .in("status", ["pending", "in_progress"])
        .not("due_date", "is", null)
        .order("due_date", { ascending: true })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Calendar className="h-6 w-6" />Agenda
        </h1>
        <p className="text-sm text-muted-foreground">Attività pianificate e follow-up.</p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Caricamento...</p>
      ) : activities && activities.length > 0 ? (
        <div className="space-y-3">
          {activities.map((a) => {
            const isOverdue = a.due_date && a.due_date < today;
            return (
              <div key={a.id} className={`p-4 rounded-lg border bg-card ${isOverdue ? "border-l-4 border-l-destructive" : ""}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isOverdue ? <AlertCircle className="h-4 w-4 text-destructive" /> : <Clock className="h-4 w-4 text-muted-foreground" />}
                    <span className="font-medium text-sm text-foreground">{a.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge
                      status={a.priority === "high" ? "error" : a.priority === "medium" ? "warning" : "neutral"}
                      label={a.priority}
                    />
                    <StatusBadge
                      status={a.status === "pending" ? "warning" : "info"}
                      label={a.status}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  <span>{a.activity_type}</span>
                  {a.due_date ? <span>Scadenza: {new Date(a.due_date).toLocaleDateString("it")}</span> : null}
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
