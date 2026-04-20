import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, Inbox, Database, Mail, CheckCircle2, AlertCircle, Clock, ChevronLeft, ChevronRight, Plane } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useChannelMessages, useMarkAsRead, useContinuousSync, type ChannelMessage } from "@/hooks/useChannelMessages";
import { useEmailCount } from "@/hooks/useEmailCount";
import { EmailMessageList } from "./EmailMessageList";
import { EmailDetailView } from "./EmailDetailView";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { extractSenderBrand } from "./email/emailUtils";

function formatElapsed(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return minutes > 0 ? `${minutes}m ${secs}s` : `${secs}s`;
}

export function EmailInboxView({ operatorUserId }: { operatorUserId?: string }) {
  const g = useGlobalFilters();
  // La search globale (sortingSearch) ha priorità su quella locale; manteniamo quella locale come fallback.
  const [localSearch, setLocalSearch] = useState("");
  const search = g.filters.sortingSearch || localSearch;
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [holdingFilter, setHoldingFilter] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: messages = [], isLoading, pageSize } = useChannelMessages("email", debouncedSearch, page, operatorUserId);
  const markAsRead = useMarkAsRead();
  const { isSyncing, progress } = useContinuousSync();
  const { data: emailCount = 0 } = useEmailCount(isSyncing);

  const inbound = useMemo(() => {
    const base = messages.filter((message) => message.direction === "inbound");

    // Filtro stato lette/non lette dalla sidebar globale
    const stateFilter = g.filters.sortingFilter;
    const stateFiltered = stateFilter === "unreviewed"
      ? base.filter(m => !m.read_at)
      : stateFilter === "reviewed"
        ? base.filter(m => !!m.read_at)
        : base;

    // Ordinamento dalla sidebar globale (emailSort)
    const sort = g.filters.emailSort;
    const sorted = [...stateFiltered].sort((a, b) => {
      const da = new Date(a.email_date || a.created_at).getTime();
      const db = new Date(b.email_date || b.created_at).getTime();
      if (sort === "date_asc") return da - db;
      if (sort === "unread") {
        const ua = a.read_at ? 1 : 0;
        const ub = b.read_at ? 1 : 0;
        if (ua !== ub) return ua - ub;
        return db - da;
      }
      // default date_desc
      return db - da;
    });

    // Raggruppamento per mittente: cluster contigui per brand normalizzato
    if (g.filters.inreachGroupBySender) {
      const buckets = new Map<string, ChannelMessage[]>();
      for (const m of sorted) {
        const { brand } = extractSenderBrand(m.from_address || "");
        const key = (brand || m.from_address || "—").toLowerCase();
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key)!.push(m);
      }
      // Ordina i bucket per data più recente del primo elemento
      const bucketArr = Array.from(buckets.entries()).sort((a, b) => {
        const da = new Date(a[1][0].email_date || a[1][0].created_at).getTime();
        const dbb = new Date(b[1][0].email_date || b[1][0].created_at).getTime();
        return dbb - da;
      });
      return bucketArr.flatMap(([, arr]) => arr);
    }

    return sorted;
  }, [messages, g.filters.sortingFilter, g.filters.emailSort, g.filters.inreachGroupBySender]);

  const selectedMsg = useMemo(
    () => (selectedId ? inbound.find((message) => message.id === selectedId) ?? null : null),
    [inbound, selectedId],
  );

  const showSyncPanel = isSyncing || progress.status === "done" || progress.status === "error";
  const hasNextPage = messages.length === pageSize;
  const hasPrevPage = page > 0;

  useEffect(() => {
    if (inbound.length === 0) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }
    const selectionStillExists = selectedId ? inbound.some((message) => message.id === selectedId) : false;
    if (!selectionStillExists) {
      setSelectedId(inbound[0].id);
    }
  }, [inbound, selectedId]);

  const handleSelect = (message: ChannelMessage) => {
    setSelectedId(message.id);
    if (!message.read_at && message.direction === "inbound") {
      markAsRead.mutate(message.id);
    }
  };

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      <div className={cn("flex min-h-0 flex-col overflow-hidden border-r border-border", selectedMsg ? "w-[340px]" : "flex-1")}>
        {/* Compact header: search + stats in one row */}
        <div className="flex-shrink-0 border-b border-border px-3 py-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => {
                  // Se la search globale è vuota, scriviamo nello stato locale; altrimenti aggiorniamo il globale
                  if (g.filters.sortingSearch) {
                    g.setSortingSearch(event.target.value);
                  } else {
                    setLocalSearch(event.target.value);
                  }
                }}
                placeholder="Cerca email..."
                className="h-7 pl-8 text-xs"
              />
            </div>
            <button
              onClick={() => setHoldingFilter(f => !f)}
              title={holdingFilter ? "Mostra tutte" : "Solo circuito d'attesa"}
              className={cn(
                "h-7 px-2 flex items-center gap-1 rounded-md text-[10px] font-medium transition-colors",
                holdingFilter
                  ? "bg-warning/15 text-warning border border-warning/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              )}
            >
              <Plane className="h-3 w-3" />
              ✈️
            </button>
          </div>
          <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Database className="h-2.5 w-2.5" />
              <strong className="text-foreground">{emailCount.toLocaleString()}</strong> in db
            </span>
            <span className="flex items-center gap-1">
              <Mail className="h-2.5 w-2.5" />
              pag. <strong className="text-foreground">{page + 1}</strong> · <strong className="text-foreground">{inbound.length}</strong> vis.
            </span>
          </div>
        </div>

        {showSyncPanel && (
          <div
            className={cn(
              "flex-shrink-0 space-y-2 border-b border-border p-3 transition-all",
              progress.status === "syncing" && "bg-primary/5",
              progress.status === "done" && "bg-accent/50",
              progress.status === "error" && "bg-destructive/5",
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                {progress.status === "syncing" && <><Loader2 className="h-4 w-4 animate-spin text-primary" /><span className="text-primary">Sincronizzazione...</span></>}
                {progress.status === "done" && <><CheckCircle2 className="h-4 w-4 text-primary" /><span className="text-primary">Completata</span></>}
                {progress.status === "error" && <><AlertCircle className="h-4 w-4 text-destructive" /><span className="text-destructive">Errore</span></>}
              </div>
              {progress.elapsedSeconds > 0 && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {formatElapsed(progress.elapsedSeconds)}
                </div>
              )}
            </div>
            {progress.status === "syncing" && <Progress value={undefined} className="h-1.5 [&>div]:animate-pulse" />}
            {progress.status === "done" && <Progress value={100} className="h-1.5" />}
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="flex flex-col items-center rounded bg-background/80 p-1.5">
                <span className="text-lg font-bold text-foreground">{progress.downloaded}</span>
                <span className="text-muted-foreground">scaricate</span>
              </div>
              <div className="flex flex-col items-center rounded bg-background/80 p-1.5">
                <span className="text-lg font-bold text-foreground">{progress.batch}</span>
                <span className="text-muted-foreground">blocchi</span>
              </div>
              <div className="flex flex-col items-center rounded bg-background/80 p-1.5">
                <span className="text-lg font-bold text-primary">{emailCount.toLocaleString()}</span>
                <span className="text-muted-foreground">in database</span>
              </div>
            </div>
            {progress.lastSubject && (
              <div className="truncate rounded bg-background/60 px-2 py-1 text-xs text-muted-foreground">
                📄 Ultima: <span className="italic">"{progress.lastSubject.slice(0, 80)}{progress.lastSubject.length > 80 ? "..." : ""}"</span>
              </div>
            )}
            {progress.status === "error" && progress.errorMessage && (
              <div className="rounded bg-destructive/10 px-2 py-1 text-xs text-destructive">⚠️ {progress.errorMessage}</div>
            )}
          </div>
        )}

        {isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : inbound.length === 0 ? (
          <div className="flex h-32 flex-col items-center justify-center gap-2 px-4 text-muted-foreground">
            <Inbox className="h-8 w-8" />
            <p className="text-sm">Nessuna email in arrivo</p>
            <p className="text-center text-xs">Clicca "Scarica" nella toolbar per verificare nuove email</p>
          </div>
        ) : (
          <EmailMessageList
            messages={inbound}
            selectedId={selectedId}
            onSelect={handleSelect}
            holdingFilter={holdingFilter}
          />
        )}

        {!isLoading && inbound.length > 0 && (
          <div className="flex flex-shrink-0 items-center justify-between border-t border-border bg-muted/30 px-3 py-2">
            <Button size="sm" variant="ghost" disabled={!hasPrevPage} onClick={() => setPage(p => p - 1)} className="gap-1 text-xs">
              <ChevronLeft className="h-3.5 w-3.5" /> Prec
            </Button>
            <span className="text-xs text-muted-foreground">Pag. {page + 1}</span>
            <Button size="sm" variant="ghost" disabled={!hasNextPage} onClick={() => setPage(p => p + 1)} className="gap-1 text-xs">
              Succ <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {selectedMsg && <EmailDetailView message={selectedMsg} onClose={() => setSelectedId(null)} />}
    </div>
  );
}
