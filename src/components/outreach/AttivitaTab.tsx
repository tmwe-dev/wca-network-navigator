import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, Clock, AlertTriangle, Loader2, ListTodo } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";

type StatusFilter = "all" | "pending" | "in_progress" | "completed";

export function AttivitaTab() {
  const [filter, setFilter] = useState<StatusFilter>("all");

  const { data: activities, isLoading } = useQuery({
    queryKey: ["activities-outreach"],
    queryFn: async () => {
      const { data } = await supabase
        .from("activities")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300);
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
    if (p === "medium") return "text-warning";
    return "text-muted-foreground";
  };

  const statusBadge = (s: string) => {
    if (s === "completed") return "default";
    if (s === "in_progress") return "secondary";
    return "outline";
  };

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden p-4 gap-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <ListTodo className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Totali</p>
            <p className="text-lg font-bold">{stats.total}</p>
          </div>
        </Card>
        <Card className="p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-warning/10 flex items-center justify-center">
            <Clock className="w-4 h-4 text-warning" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Pending</p>
            <p className="text-lg font-bold">{stats.pending}</p>
          </div>
        </Card>
        <Card className="p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-blue-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">In corso</p>
            <p className="text-lg font-bold">{stats.in_progress}</p>
          </div>
        </Card>
        <Card className="p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-success/10 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4 text-success" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Completate</p>
            <p className="text-lg font-bold">{stats.completed}</p>
          </div>
        </Card>
      </div>

      {/* Filter */}
      <Tabs value={filter} onValueChange={(v) => setFilter(v as StatusFilter)}>
        <TabsList className="bg-muted/50">
          <TabsTrigger value="all" className="text-xs">Tutte ({stats.total})</TabsTrigger>
          <TabsTrigger value="pending" className="text-xs">Pending ({stats.pending})</TabsTrigger>
          <TabsTrigger value="in_progress" className="text-xs">In corso ({stats.in_progress})</TabsTrigger>
          <TabsTrigger value="completed" className="text-xs">Completate ({stats.completed})</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* List */}
      <ScrollArea className="flex-1 min-h-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            Nessuna attività trovata
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((item) => (
              <Card key={item.id} className="p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{item.title}</p>
                    <span className={`text-[10px] font-semibold uppercase ${priorityColor(item.priority)}`}>
                      {item.priority}
                    </span>
                  </div>
                  {item.description && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{item.description}</p>
                  )}
                </div>
                <Badge variant={statusBadge(item.status)} className="text-[10px] flex-shrink-0">
                  {item.status === "in_progress" ? "in corso" : item.status}
                </Badge>
                <span className="text-[10px] text-muted-foreground flex-shrink-0">
                  {format(new Date(item.created_at), "dd MMM", { locale: it })}
                </span>
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
