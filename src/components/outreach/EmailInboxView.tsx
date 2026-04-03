import { useEffect, useMemo, useState } from "react";
import {
  RefreshCw,
  Loader2,
  Search,
  Inbox,
  Download,
  Square,
  RotateCcw,
  Database,
  Mail,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useChannelMessages, useCheckInbox, useMarkAsRead, useContinuousSync, type ChannelMessage } from "@/hooks/useChannelMessages";
import { useResetSync } from "@/hooks/useEmailSync";
import { useEmailCount } from "@/hooks/useEmailCount";
import { EmailMessageList } from "./EmailMessageList";
import { EmailDetailView } from "./EmailDetailView";

function formatElapsed(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return minutes > 0 ? `${minutes}m ${secs}s` : `${secs}s`;
}

export function EmailInboxView() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0); // reset page on search change
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: messages = [], isLoading, pageSize } = useChannelMessages("email", debouncedSearch, page);
  const checkInbox = useCheckInbox();
  const markAsRead = useMarkAsRead();
  const { startSync, stopSync, isSyncing, progress } = useContinuousSync();
  const resetSync = useResetSync();
  const { data: emailCount = 0 } = useEmailCount(isSyncing);

  const inbound = useMemo(
    () => messages.filter((message) => message.direction === "inbound"),
    [messages],
  );
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

    const selectionStillExists = selectedId
      ? inbound.some((message) => message.id === selectedId)
      : false;

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
        <div className="flex-shrink-0 space-y-2 border-b border-border p-3">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => checkInbox.mutate()}
              disabled={checkInbox.isPending || isSyncing}
              className="gap-1.5"
            >
              {checkInbox.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Nuove
            </Button>

            {isSyncing ? (
              <Button size="sm" variant="destructive" onClick={stopSync} className="gap-1.5">
                <Square className="h-3.5 w-3.5" /> Stop ({progress.downloaded})
              </Button>
            ) : (
              <Button size="sm" variant="default" onClick={startSync} disabled={checkInbox.isPending} className="gap-1.5">
                <Download className="h-3.5 w-3.5" /> Scarica Tutto
              </Button>
            )}

            <Button
              size="sm"
              variant="ghost"
              onClick={() => resetSync.mutate()}
              disabled={resetSync.isPending || isSyncing}
              title="Reset sync — riscarica tutta la inbox"
              className="gap-1.5"
            >
              {resetSync.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
              Reset
            </Button>

            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cerca email..."
                className="h-8 pl-8 text-xs"
              />
            </div>
          </div>

          <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Database className="h-3 w-3" />
              <span><strong className="text-foreground">{emailCount.toLocaleString()}</strong> email in database</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Mail className="h-3 w-3" />
              <span>pag. <strong className="text-foreground">{page + 1}</strong> · <strong className="text-foreground">{inbound.length}</strong> visualizzate</span>
            </div>
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
                {progress.status === "syncing" && <><Loader2 className="h-4 w-4 animate-spin text-primary" /><span className="text-primary">Sincronizzazione in corso...</span></>}
                {progress.status === "done" && <><CheckCircle2 className="h-4 w-4 text-primary" /><span className="text-primary">Sincronizzazione completata</span></>}
                {progress.status === "error" && <><AlertCircle className="h-4 w-4 text-destructive" /><span className="text-destructive">Errore sincronizzazione</span></>}
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
            <p className="text-center text-xs">Clicca "Scarica Tutto" per verificare nuove email</p>
          </div>
        ) : (
          <EmailMessageList
            messages={inbound}
            selectedId={selectedId}
            onSelect={handleSelect}
          />
        )}

        {/* Pagination controls */}
        {!isLoading && inbound.length > 0 && (
          <div className="flex flex-shrink-0 items-center justify-between border-t border-border bg-muted/30 px-3 py-2">
            <Button
              size="sm"
              variant="ghost"
              disabled={!hasPrevPage}
              onClick={() => setPage(p => p - 1)}
              className="gap-1 text-xs"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Precedente
            </Button>
            <span className="text-xs text-muted-foreground">Pagina {page + 1}</span>
            <Button
              size="sm"
              variant="ghost"
              disabled={!hasNextPage}
              onClick={() => setPage(p => p + 1)}
              className="gap-1 text-xs"
            >
              Successiva
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {selectedMsg && <EmailDetailView message={selectedMsg} onClose={() => setSelectedId(null)} />}
    </div>
  );
}
