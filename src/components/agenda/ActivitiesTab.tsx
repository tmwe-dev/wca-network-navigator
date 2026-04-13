import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Check, Search, Trash2, Activity, Clock, CheckCircle2, Loader2 } from "lucide-react";
import { useAllActivities, useUpdateActivity, useDeleteActivities, type AllActivity } from "@/hooks/useActivities";
import { useSelection } from "@/hooks/useSelection";
import { getCountryFlag } from "@/lib/countries";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface ActivitiesTabProps {
  initialBatchFilter?: string;
}

export default function ActivitiesTab({ initialBatchFilter }: ActivitiesTabProps) {
  const { data: activities, isLoading } = useAllActivities();
  const updateActivity = useUpdateActivity();
  const deleteActivities = useDeleteActivities();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [batchFilter] = useState(initialBatchFilter || "");

  const filtered = useMemo(() => {
    let list = activities || [];
    if (batchFilter) list = list.filter(a => a.campaign_batch_id === batchFilter);
    if (statusFilter !== "all") list = list.filter(a => a.status === statusFilter);
    if (search.length >= 2) {
      const q = search.toLowerCase();
      list = list.filter(a =>
        a.title.toLowerCase().includes(q) ||
        a.partners?.company_name?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [activities, search, statusFilter, batchFilter]);

  const { selectedIds, toggle, isAllSelected, toggleAll, clear, count } = useSelection(filtered);

  const stats = useMemo(() => {
    const all = activities || [];
    return {
      total: all.length,
      pending: all.filter(a => a.status === "pending").length,
      inProgress: all.filter(a => a.status === "in_progress").length,
      completed: all.filter(a => a.status === "completed").length,
    };
  }, [activities]);

  const handleComplete = (id: string) => {
    updateActivity.mutate(
      { id, status: "completed", completed_at: new Date().toISOString() },
      { onSuccess: () => toast.success("Attività completata") }
    );
  };

  const handleDelete = (ids: string[]) => {
    deleteActivities.mutate(ids, {
      onSuccess: () => {
        toast.success(`${ids.length} attività eliminate`);
        clear();
      },
    });
  };

  const handleBulkComplete = () => {
    const ids = Array.from(selectedIds);
    const pending = filtered.filter(a => ids.includes(a.id) && a.status !== "completed");
    if (!pending.length) return toast.info("Nessuna attività da completare nella selezione");
    Promise.all(
      pending.map(a =>
        updateActivity.mutateAsync({ id: a.id, status: "completed", completed_at: new Date().toISOString() })
      )
    ).then(() => {
      toast.success(`${pending.length} attività completate`);
      clear();
    });
  };

  const handleBulkDelete = () => {
    handleDelete(Array.from(selectedIds));
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Glass stats header */}
      <div className="flex-shrink-0 px-4 py-2.5 border-b border-border/30 glass-panel">
        <div className="flex items-center gap-4 mb-2">
          <div className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-bold">{stats.total}</span>
            <span className="text-[10px] text-muted-foreground">totali</span>
          </div>
          <div className="flex items-center gap-1.5 text-amber-500">
            <Clock className="w-3 h-3" />
            <span className="text-[10px] font-medium">{stats.pending} in attesa</span>
          </div>
          <div className="flex items-center gap-1.5 text-blue-400">
            <Loader2 className="w-3 h-3" />
            <span className="text-[10px] font-medium">{stats.inProgress} in corso</span>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-500">
            <CheckCircle2 className="w-3 h-3" />
            <span className="text-[10px] font-medium">{stats.completed} completate</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            checked={isAllSelected}
            onCheckedChange={(checked) => toggleAll(!!checked)}
            aria-label="Seleziona tutti"
            className="shrink-0"
          />
          <span className="text-xs font-medium text-muted-foreground">{filtered.length} risultati</span>
          <div className="flex-1" />
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
            <Input
              placeholder="Cerca..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-7 h-7 w-40 text-xs bg-muted/30 border-border/30"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-7 w-[110px] text-xs bg-muted/30 border-border/30">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti</SelectItem>
              <SelectItem value="pending">In attesa</SelectItem>
              <SelectItem value="in_progress">In corso</SelectItem>
              <SelectItem value="completed">Completati</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Bulk actions */}
        <AnimatePresence>
          {count > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-2 mt-2 p-2 rounded-lg bg-primary/5 border border-primary/20">
                <span className="text-xs font-semibold text-primary">{count} selezionati</span>
                <div className="flex-1" />
                <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1 border-primary/20 text-primary hover:bg-primary/10" onClick={handleBulkComplete}>
                  <Check className="w-3 h-3" /> Completa
                </Button>
                <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1 border-destructive/20 text-destructive hover:bg-destructive/10" onClick={handleBulkDelete}>
                  <Trash2 className="w-3 h-3" /> Elimina
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Activities list */}
      <ScrollArea className="flex-1 min-h-0">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/50">
            <Activity className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-xs">Nessuna attività trovata</p>
          </div>
        ) : (
          <div className="p-3 space-y-1.5">
            <AnimatePresence mode="popLayout">
              {filtered.map((a) => (
                <ActivityRow
                  key={a.id}
                  activity={a}
                  selected={selectedIds.has(a.id)}
                  onToggle={() => toggle(a.id)}
                  onComplete={() => handleComplete(a.id)}
                  onDelete={() => handleDelete([a.id])}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function ActivityRow({
  activity: a,
  selected,
  onToggle,
  onComplete,
  onDelete,
}: {
  activity: AllActivity;
  selected: boolean;
  onToggle: () => void;
  onComplete: () => void;
  onDelete: () => void;
}) {
  const statusConfig: Record<string, { class: string; icon: typeof Clock }> = {
    pending: { class: "border-amber-500/20 text-amber-500 bg-amber-500/10", icon: Clock },
    in_progress: { class: "border-blue-500/20 text-blue-500 bg-blue-500/10", icon: Loader2 },
    completed: { class: "border-emerald-500/20 text-emerald-500 bg-emerald-500/10", icon: CheckCircle2 },
    cancelled: { class: "border-muted text-muted-foreground bg-muted/30", icon: Clock },
  };

  const typeLabels: Record<string, string> = {
    send_email: "📧 Email",
    phone_call: "📞 Chiamata",
    meeting: "🤝 Meeting",
    follow_up: "🔄 Follow-up",
    add_to_campaign: "📬 Campagna",
    other: "📌 Altro",
  };

  const config = statusConfig[a.status] || statusConfig.pending;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-xl border backdrop-blur-sm transition-all",
        "bg-card/40 border-border/30 hover:bg-card/60 hover:border-border/50",
        selected && "bg-primary/5 border-primary/20 shadow-sm shadow-primary/5"
      )}
    >
      <Checkbox
        checked={selected}
        onCheckedChange={onToggle}
        className="shrink-0"
      />
      {a.partners && (
        <span className="text-base shrink-0">{getCountryFlag(a.partners.country_code)}</span>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium truncate">{a.title}</span>
          <span className="text-[9px] text-muted-foreground/70 shrink-0">
            {typeLabels[a.activity_type] || a.activity_type}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          {a.partners && <span className="truncate">{a.partners.company_name}</span>}
          {a.due_date && (
            <>
              <span className="opacity-30">•</span>
              <span>{format(new Date(a.due_date), "dd/MM/yyyy")}</span>
            </>
          )}
          {a.team_members && (
            <>
              <span className="opacity-30">•</span>
              <span>{a.team_members.name}</span>
            </>
          )}
        </div>
      </div>
      <Badge variant="outline" className={cn("text-[9px] shrink-0 px-1.5 py-0 h-4", config.class)}>
        {a.status}
      </Badge>
      {a.status !== "completed" && (
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 hover:bg-emerald-500/10 hover:text-emerald-500" onClick={onComplete} aria-label="Conferma">
          <Check className="w-3 h-3" />
        </Button>
      )}
      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10" onClick={onDelete} aria-label="Elimina">
        <Trash2 className="w-3 h-3" />
      </Button>
    </motion.div>
  );
}
