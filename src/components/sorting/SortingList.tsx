import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, CheckCircle2, Clock, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { groupByCountry } from "@/lib/groupByCountry";
import { isToday, parseISO } from "date-fns";
import type { SortingJob } from "@/hooks/useSortingJobs";

type FilterMode = "all" | "unreviewed" | "reviewed" | "today";

interface SortingListProps {
  jobs: SortingJob[];
  selectedId: string | null;
  selectedIds: Set<string>;
  onSelect: (id: string) => void;
  onToggleCheck: (id: string) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
}

export function SortingList({
  jobs, selectedId, selectedIds, onSelect, onToggleCheck, onSelectAll, onSelectNone,
}: SortingListProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");

  const filtered = useMemo(() => {
    let list = jobs;
    if (filter === "unreviewed") list = list.filter((j) => !j.reviewed);
    if (filter === "reviewed") list = list.filter((j) => j.reviewed);
    if (filter === "today") list = list.filter((j) => j.scheduled_at && isToday(parseISO(j.scheduled_at)));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((j) =>
        (j.partners?.company_name || "").toLowerCase().includes(q) ||
        (j.partners?.company_alias || "").toLowerCase().includes(q) ||
        (j.selected_contact?.name || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [jobs, filter, search]);

  const groups = useMemo(
    () => groupByCountry(filtered, (j) => j.partners?.country_code || "??", (j) => j.partners?.country_name || ""),
    [filtered]
  );

  const reviewedCount = jobs.filter((j) => j.reviewed).length;
  const todayCount = jobs.filter((j) => j.scheduled_at && isToday(parseISO(j.scheduled_at))).length;

  const filters: { key: FilterMode; label: string }[] = [
    { key: "all", label: "Tutti" },
    { key: "unreviewed", label: "Da rivedere" },
    { key: "reviewed", label: "Rivisti" },
    { key: "today", label: "Oggi" },
  ];

  return (
    <div className="flex flex-col h-full border-r border-border">
      {/* Stats */}
      <div className="px-4 pt-4 pb-2 text-xs text-muted-foreground">
        {jobs.length} in coda · {reviewedCount} rivisti · {todayCount} oggi
      </div>

      {/* Toolbar */}
      <div className="px-4 pb-2 space-y-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Cerca azienda o contatto..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
        </div>
        <div className="flex gap-1 flex-wrap">
          {filters.map((f) => (
            <Button key={f.key} variant={filter === f.key ? "default" : "outline"} size="sm" className="h-7 text-xs" onClick={() => setFilter(f.key)}>
              {f.label}
            </Button>
          ))}
        </div>
        <div className="flex gap-2 text-xs">
          <button onClick={onSelectAll} className="text-primary hover:underline">Seleziona tutti</button>
          <button onClick={onSelectNone} className="text-muted-foreground hover:underline">Nessuno</button>
        </div>
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        <div className="px-2 pb-4 space-y-3">
          {groups.map((g) => (
            <div key={g.countryCode}>
              <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <img src={`https://flagcdn.com/16x12/${g.countryCode.toLowerCase()}.png`} alt="" className="w-4 h-3 rounded-sm" />
                {g.countryName} ({g.items.length})
              </div>
              {g.items.map((job) => (
                <div
                  key={job.id}
                  onClick={() => onSelect(job.id)}
                  className={cn(
                    "flex items-start gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors",
                    selectedId === job.id ? "bg-accent" : "hover:bg-muted/50"
                  )}
                >
                  <Checkbox
                    checked={selectedIds.has(job.id)}
                    onCheckedChange={() => onToggleCheck(job.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{job.partners?.company_alias || job.partners?.company_name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {job.selected_contact?.contact_alias || job.selected_contact?.name || "—"} · {job.selected_contact?.email || "no email"}
                    </div>
                    {job.email_subject && (
                      <div className="text-xs text-muted-foreground/70 truncate mt-0.5">✉ {job.email_subject}</div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    {job.reviewed && (
                      <Badge variant="outline" className="text-emerald-600 border-emerald-300 text-[10px] h-5">
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Rivisto
                      </Badge>
                    )}
                    {job.scheduled_at && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(job.scheduled_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
          {groups.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-12">Nessun job in coda</div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
