import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Check, Search, Trash2 } from "lucide-react";
import { useAllActivities, useUpdateActivity, useDeleteActivities, type AllActivity } from "@/hooks/useActivities";
import { useSelection } from "@/hooks/useSelection";
import { getCountryFlag } from "@/lib/countries";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";

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
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Checkbox
              checked={isAllSelected}
              onCheckedChange={(checked) => toggleAll(!!checked)}
              aria-label="Seleziona tutti"
            />
            <CardTitle className="text-lg">Attività ({filtered.length})</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Cerca..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 h-8 w-48 text-xs"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 w-[120px] text-xs">
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
        </div>
        {count > 0 && (
          <div className="flex items-center gap-2 mt-2 p-2 rounded-md bg-muted/50 border">
            <span className="text-xs font-medium">{count} selezionati</span>
            <div className="flex-1" />
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={handleBulkComplete}>
              <Check className="w-3 h-3" /> Completa
            </Button>
            <Button variant="destructive" size="sm" className="h-7 text-xs gap-1" onClick={handleBulkDelete}>
              <Trash2 className="w-3 h-3" /> Elimina
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            Nessuna attività trovata
          </p>
        ) : (
          <div className="space-y-2">
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
          </div>
        )}
      </CardContent>
    </Card>
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
  const statusColors: Record<string, string> = {
    pending: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    in_progress: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    completed: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    cancelled: "bg-muted text-muted-foreground",
  };

  const typeLabels: Record<string, string> = {
    send_email: "📧 Email",
    phone_call: "📞 Chiamata",
    meeting: "🤝 Meeting",
    follow_up: "🔄 Follow-up",
    add_to_campaign: "📬 Campagna",
    other: "📌 Altro",
  };

  return (
    <div className={cn("flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors", selected && "bg-primary/5 border-primary/30")}>
      <Checkbox
        checked={selected}
        onCheckedChange={onToggle}
        className="shrink-0"
      />
      {a.partners && (
        <span className="text-lg shrink-0">{getCountryFlag(a.partners.country_code)}</span>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{a.title}</span>
          <span className="text-[10px] text-muted-foreground">
            {typeLabels[a.activity_type] || a.activity_type}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {a.partners && <span className="truncate">{a.partners.company_name}</span>}
          {a.due_date && (
            <>
              <span>•</span>
              <span>{format(new Date(a.due_date), "dd/MM/yyyy")}</span>
            </>
          )}
          {a.team_members && (
            <>
              <span>•</span>
              <span>{a.team_members.name}</span>
            </>
          )}
        </div>
      </div>
      <Badge variant="outline" className={cn("text-[10px] shrink-0", statusColors[a.status])}>
        {a.status}
      </Badge>
      {a.status !== "completed" && (
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onComplete}>
          <Check className="w-3.5 h-3.5" />
        </Button>
      )}
      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive" onClick={onDelete}>
        <Trash2 className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}
