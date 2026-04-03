import { useState, useMemo } from "react";
import {
  RefreshCw, Loader2, Search, Inbox, Download, Square,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useChannelMessages, useCheckInbox, useMarkAsRead, useContinuousSync, type ChannelMessage } from "@/hooks/useChannelMessages";
import { EmailMessageList } from "./EmailMessageList";
import { EmailDetailView } from "./EmailDetailView";

export function EmailInboxView() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: messages = [], isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useChannelMessages("email");
  const checkInbox = useCheckInbox();
  const markAsRead = useMarkAsRead();
  const { startSync, stopSync, isSyncing, progress } = useContinuousSync();

  const filtered = useMemo(() => {
    if (!search.trim()) return messages;
    const q = search.toLowerCase();
    return messages.filter(m =>
      m.from_address?.toLowerCase().includes(q) ||
      m.subject?.toLowerCase().includes(q) ||
      m.body_text?.toLowerCase().includes(q) ||
      m.raw_payload?.sender_name?.toLowerCase().includes(q)
    );
  }, [messages, search]);

  const inbound = filtered.filter(m => m.direction === "inbound");
  const selectedMsg = selectedId ? messages.find(m => m.id === selectedId) : null;

  const handleSelect = (msg: ChannelMessage) => {
    setSelectedId(msg.id);
    if (!msg.read_at && msg.direction === "inbound") {
      markAsRead.mutate(msg.id);
    }
  };

  return (
    <div className="flex h-full">
      {/* Left: message list */}
      <div className={cn(
        "flex flex-col border-r border-border",
        selectedMsg ? "w-[340px]" : "flex-1"
      )}>
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
        </div>

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
