import { useState, useEffect, useRef } from "react";
import {
  RefreshCw, Loader2, Search, Inbox, Download, Square, RotateCcw, Database, Mail,
  CheckCircle2, AlertCircle, Clock,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useChannelMessages, useCheckInbox, useMarkAsRead, useContinuousSync, type ChannelMessage } from "@/hooks/useChannelMessages";
import { useResetSync } from "@/hooks/useEmailSync";
import { useEmailCount } from "@/hooks/useEmailCount";
import { EmailMessageList } from "./EmailMessageList";
import { EmailDetailView } from "./EmailDetailView";

function formatElapsed(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

export function EmailInboxView() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: messages = [], isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useChannelMessages("email", debouncedSearch);
  const checkInbox = useCheckInbox();
  const markAsRead = useMarkAsRead();
  const { startSync, stopSync, isSyncing, progress } = useContinuousSync();
  const resetSync = useResetSync();
  const { data: emailCount = 0 } = useEmailCount(isSyncing);

  const isSyncingRef = useRef(isSyncing);
  const checkInboxRef = useRef(checkInbox);
  isSyncingRef.current = isSyncing;
  checkInboxRef.current = checkInbox;

  useEffect(() => {
    const interval = setInterval(() => {
      if (!isSyncingRef.current && !checkInboxRef.current.isPending) {
        checkInboxRef.current.mutate();
      }
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const inbound = messages.filter(m => m.direction === "inbound");
  const selectedMsg = selectedId ? messages.find(m => m.id === selectedId) : null;

  const handleSelect = (msg: ChannelMessage) => {
    setSelectedId(msg.id);
    if (!msg.read_at && msg.direction === "inbound") {
      markAsRead.mutate(msg.id);
    }
  };

  const showSyncPanel = isSyncing || progress.status === "done" || progress.status === "error";

  return (
    <div className="flex h-full">
      {/* Left: message list */}
      <div className={cn(
        "flex flex-col border-r border-border",
        selectedMsg ? "w-[340px]" : "flex-1"
      )}>
        {/* Toolbar */}
        <div className="flex-shrink-0 p-3 space-y-2 border-b border-border">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => checkInbox.mutate()}
              disabled={checkInbox.isPending || isSyncing}
              className="gap-1.5"
            >
              {checkInbox.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              Nuove
            </Button>
            {isSyncing ? (
              <Button
                size="sm"
                variant="destructive"
                onClick={stopSync}
                className="gap-1.5"
              >
                <Square className="w-3.5 h-3.5" />
                Stop ({progress.downloaded})
              </Button>
            ) : (
              <Button
                size="sm"
                variant="default"
                onClick={startSync}
                disabled={checkInbox.isPending}
                className="gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                Scarica Tutto
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
              {resetSync.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RotateCcw className="w-3.5 h-3.5" />
              )}
              Reset
            </Button>
            <div className="flex-1 relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cerca email..."
                className="h-8 pl-8 text-xs"
              />
            </div>
          </div>

          {/* Always-visible email count bar */}
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <div className="flex items-center gap-1.5">
              <Database className="w-3 h-3" />
              <span>
                <strong className="text-foreground">{emailCount.toLocaleString()}</strong> email in database
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Mail className="w-3 h-3" />
              <span>
                <strong className="text-foreground">{inbound.length}</strong> visualizzate
              </span>
            </div>
          </div>
        </div>

        {/* Sync progress panel - shown during/after sync */}
        {showSyncPanel && (
          <div className={cn(
            "flex-shrink-0 border-b border-border p-3 space-y-2 transition-all",
            progress.status === "syncing" && "bg-primary/5",
            progress.status === "done" && "bg-accent/50",
            progress.status === "error" && "bg-destructive/5",
          )}>
            {/* Status header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                {progress.status === "syncing" && (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span className="text-primary">Sincronizzazione in corso...</span>
                  </>
                )}
                {progress.status === "done" && (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <span className="text-primary">Sincronizzazione completata</span>
                  </>
                )}
                {progress.status === "error" && (
                  <>
                    <AlertCircle className="w-4 h-4 text-destructive" />
                    <span className="text-destructive">Errore sincronizzazione</span>
                  </>
                )}
              </div>
              {progress.elapsedSeconds > 0 && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {formatElapsed(progress.elapsedSeconds)}
                </div>
              )}
            </div>

            {/* Progress bar */}
            {progress.status === "syncing" && (
              <Progress value={undefined} className="h-1.5 [&>div]:animate-pulse" />
            )}
            {progress.status === "done" && (
              <Progress value={100} className="h-1.5" />
            )}

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="flex flex-col items-center bg-background/80 rounded p-1.5">
                <span className="text-lg font-bold text-foreground">{progress.downloaded}</span>
                <span className="text-muted-foreground">scaricate</span>
              </div>
              <div className="flex flex-col items-center bg-background/80 rounded p-1.5">
                <span className="text-lg font-bold text-foreground">{progress.batch}</span>
                <span className="text-muted-foreground">blocchi</span>
              </div>
              <div className="flex flex-col items-center bg-background/80 rounded p-1.5">
                <span className="text-lg font-bold text-primary">{emailCount.toLocaleString()}</span>
                <span className="text-muted-foreground">in database</span>
              </div>
            </div>

            {/* Last email subject */}
            {progress.lastSubject && (
              <div className="text-xs text-muted-foreground bg-background/60 rounded px-2 py-1 truncate">
                📄 Ultima: <span className="italic">"{progress.lastSubject.slice(0, 80)}{progress.lastSubject.length > 80 ? '...' : ''}"</span>
              </div>
            )}

            {/* Error message */}
            {progress.status === "error" && progress.errorMessage && (
              <div className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1">
                ⚠️ {progress.errorMessage}
              </div>
            )}
          </div>
        )}

        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : inbound.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground gap-2 px-4">
              <Inbox className="w-8 h-8" />
              <p className="text-sm">Nessuna email in arrivo</p>
              <p className="text-xs text-center">Clicca "Scarica Tutto" per verificare nuove email</p>
            </div>
          ) : (
            <EmailMessageList
              messages={inbound}
              selectedId={selectedId}
              onSelect={handleSelect}
              onLoadMore={() => fetchNextPage()}
              hasMore={hasNextPage && !isFetchingNextPage}
            />
          )}
          {isFetchingNextPage && (
            <div className="flex justify-center p-2">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Right: message detail */}
      {selectedMsg && (
        <EmailDetailView
          message={selectedMsg}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
