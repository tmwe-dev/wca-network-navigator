import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, Clock, AlertTriangle, Loader2, ListTodo, Mail, Phone, Users, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { EmptyState } from "@/components/shared/EmptyState";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | "pending" | "in_progress" | "completed";

const ACTIVITY_ICONS: Record<string, any> = {
  send_email: Mail,
  email: Mail,
  phone_call: Phone,
  meeting: Users,
  follow_up: RotateCcw,
};

export function AttivitaTab() {
  const { filters: gf } = useGlobalFilters();
  const filter = (gf.attivitaStatus || "all") as StatusFilter;
  const priorityFilter = gf.attivitaPriority || "all";
  const searchTerm = gf.search || "";

  const { data: activities, isLoading } = useQuery({
    queryKey: ["activities-outreach"],
    queryFn: async () => {
      const { data } = await supabase
        .from("activities")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  const all = activities || [];
  const filtered = filter === "all" ? all : all.filter(a => a.status === filter);

  const stats = {
    total: all.length,
    pending: all.filter(a => a.status === "pending").length,
    in_progress: all.filter(a => a.status === "in_progress").length,
    completed: all.filter(a => a.status === "completed").length,
  };

  const priorityColor = (p: string) => {
    if (p === "high" || p === "urgent") return "text-destructive";
    if (p === "medium") return "text-amber-500";
    return "text-muted-foreground";
  };

  const statusConfig: Record<string, { label: string; color: string; bg: string; icon: any }> = {
    pending: { label: "In attesa", color: "text-amber-500", bg: "bg-amber-500/15", icon: Clock },
    in_progress: { label: "In corso", color: "text-primary", bg: "bg-primary/15", icon: AlertTriangle },
    completed: { label: "Completata", color: "text-emerald-500", bg: "bg-emerald-500/15", icon: CheckCircle2 },
  };

  const filterButtons: { key: StatusFilter; label: string; count: number; icon: any; color: string }[] = [
    { key: "all", label: "Tutte", count: stats.total, icon: ListTodo, color: "text-foreground" },
    { key: "pending", label: "In attesa", count: stats.pending, icon: Clock, color: "text-amber-500" },
    { key: "in_progress", label: "In corso", count: stats.in_progress, icon: AlertTriangle, color: "text-primary" },
    { key: "completed", label: "Completate", count: stats.completed, icon: CheckCircle2, color: "text-emerald-500" },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Compact header with inline stats */}
      <div className="shrink-0 px-4 py-2 border-b border-border/40 flex items-center gap-1">
        {filterButtons.map((f) => {
          const Icon = f.icon;
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors",
                active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/40"
              )}
            >
              <Icon className="w-3 h-3" />
              {f.label}
              <span className={cn("text-[10px] font-bold", active ? "text-primary" : "text-muted-foreground/60")}>
                {f.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* List */}
      <ScrollArea className="flex-1 min-h-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title={filter === "all" ? "Nessuna attività" : "Nessuna attività in questo stato"}
            description={filter === "all" 
              ? "Le attività verranno create automaticamente quando lavori dal Cockpit" 
              : "Cambia filtro per vedere le altre attività"}
          />
        ) : (
          <div className="p-2 space-y-1">
            {filtered.map((item) => {
              const sc = statusConfig[item.status] || statusConfig.pending;
              const StatusIcon = sc.icon;
              const TypeIcon = ACTIVITY_ICONS[item.activity_type] || ListTodo;
              const isOverdue = item.due_date && new Date(item.due_date) < new Date() && item.status !== "completed";

              return (
                <div
                  key={item.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/30 transition-colors cursor-pointer"
                >
                  {/* Type icon */}
                  <div className={cn("w-7 h-7 rounded-md flex items-center justify-center shrink-0", sc.bg)}>
                    <TypeIcon className={cn("w-3.5 h-3.5", sc.color)} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-foreground truncate">{item.title}</span>
                      <span className={cn("text-[9px] font-bold uppercase", priorityColor(item.priority))}>
                        {item.priority}
                      </span>
                    </div>
                    {item.description && (
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">{item.description}</p>
                    )}
                  </div>

                  {/* Status */}
                  <span className={cn("text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded shrink-0", sc.bg, sc.color)}>
                    {sc.label}
                  </span>

                  {/* Date */}
                  <span className={cn(
                    "text-[10px] shrink-0",
                    isOverdue ? "text-destructive font-semibold" : "text-muted-foreground"
                  )}>
                    {item.due_date
                      ? format(new Date(item.due_date), "dd MMM", { locale: it })
                      : format(new Date(item.created_at), "dd MMM", { locale: it })}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
