/**
 * WhatsAppChatList — sidebar con lista thread e ricerca.
 * Scopo unico: visualizzare e filtrare i thread WhatsApp (Documento 2 §2.4).
 */
import { useState, useMemo } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import {
  MessageCircle, Loader2, Search, Radio, PanelLeftClose, PanelLeftOpen,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ChatThread } from "./whatsappTypes";

interface WhatsAppChatListProps {
  threads: ChatThread[];
  isLoading: boolean;
  activeTab: string | null;
  openTabs: string[];
  focusedChat: string | null;
  syncEnabled: boolean;
  onOpenChat: (contact: string) => void;
}

export function WhatsAppChatList({
  threads, isLoading, activeTab, openTabs,
  focusedChat, syncEnabled, onOpenChat,
}: WhatsAppChatListProps) {
  const [search, setSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const filteredThreads = useMemo(() => {
    if (!search.trim()) return threads;
    const q = search.toLowerCase();
    return threads.filter(t =>
      t.contact.toLowerCase().includes(q) ||
      t.lastMessage.body_text?.toLowerCase().includes(q)
    );
  }, [threads, search]);

  if (!sidebarOpen) {
    return (
      <div className="flex flex-col items-center pt-2 gap-2 w-[48px] min-w-[48px] border-r border-border bg-background shrink-0">
        <Button size="icon" variant="ghost" onClick={() = aria-label="Visualizza"> setSidebarOpen(true)} className="h-8 w-8" title="Apri contatti" aria-label="Visualizza">
          <PanelLeftOpen className="w-4 h-4" />
        </Button>
        <div className="w-8 h-8 rounded-full bg-green-500/15 flex items-center justify-center">
          <MessageCircle className="w-4 h-4 text-green-600" />
        </div>
        {threads.some(t => t.unreadCount > 0) && (
          <span className="bg-destructive text-destructive-foreground text-[9px] rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-0.5">
            {threads.reduce((s, t) => s + t.unreadCount, 0)}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col border-r border-border bg-background shrink-0 w-[280px] min-w-[280px]">
      <div className="flex-shrink-0 p-2 border-b border-border">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Button size="icon" variant="ghost" onClick={() = aria-label="Visualizza"> setSidebarOpen(false)} className="h-7 w-7" title="Chiudi lista" aria-label="Chiudi">
            <PanelLeftClose className="w-3.5 h-3.5" />
          </Button>
          <span className="text-xs font-medium text-muted-foreground">
            {threads.length} chat
            {threads.reduce((s, t) => s + t.unreadCount, 0) > 0 && (
              <span className="text-green-600 ml-1">• {threads.reduce((s, t) => s + t.unreadCount, 0)} non letti</span>
            )}
          </span>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca..." className="h-7 pl-7 text-xs" />
        </div>
      </div>

      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : filteredThreads.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground gap-2 px-4">
            <MessageCircle className="w-8 h-8" />
            <p className="text-xs text-center">Nessuna conversazione</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredThreads.map(thread => {
              const isOpen = openTabs.includes(thread.contact);
              const isFocused = thread.contact === focusedChat;
              return (
                <button
                  key={thread.contact}
                  onClick={() => onOpenChat(thread.contact)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors",
                    isOpen && "bg-primary/5",
                    thread.unreadCount > 0 && !isOpen && "bg-accent/30",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0",
                      isFocused && syncEnabled ? "bg-green-500/30" : "bg-green-500/15"
                    )}>
                      {isFocused && syncEnabled ? (
                        <Radio className="w-4 h-4 text-green-600 animate-pulse" />
                      ) : (
                        <MessageCircle className="w-4 h-4 text-green-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className={cn("text-sm truncate", thread.unreadCount > 0 ? "font-semibold" : "")}>
                          {thread.contact}
                        </span>
                        <span className="text-[10px] text-muted-foreground flex-shrink-0">
                          {format(new Date(thread.lastMessage.created_at), "HH:mm", { locale: it })}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {thread.lastMessage.direction === "outbound" && "Tu: "}
                        {thread.lastMessage.body_text?.slice(0, 50) || "(media)"}
                      </p>
                    </div>
                    {thread.unreadCount > 0 && (
                      <span className="bg-green-500 text-white text-[10px] rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 flex-shrink-0">
                        {thread.unreadCount}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
