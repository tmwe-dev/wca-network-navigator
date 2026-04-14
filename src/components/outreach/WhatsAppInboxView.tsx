/**
 * WhatsAppInboxView — orchestratore sottile per la vista inbox WhatsApp.
 * Compone WhatsAppChatList + WhatsAppChatThread.
 */
import { useState, useMemo, useCallback } from "react";
import { MessageCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useChannelMessages, useMarkAsRead } from "@/hooks/useChannelMessages";
import { useWhatsAppSoftSync } from "@/hooks/useWhatsAppSoftSync";
import { useWhatsAppExtensionBridge } from "@/hooks/useWhatsAppExtensionBridge";
import { WhatsAppChatList } from "./WhatsAppChatList";
import { WhatsAppChatThread } from "./WhatsAppChatThread";
import { isSidebarGhostMessage } from "./whatsappTypes";
import type { ChatThread } from "./whatsappTypes";

type WhatsAppInboxViewProps = {
  syncState?: { enabled: boolean; isAvailable: boolean };
  backfillState?: unknown;
  operatorUserId?: string;
};

export function WhatsAppInboxView({ syncState, operatorUserId }: WhatsAppInboxViewProps = {}) {
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [focusedChat, setFocusedChat] = useState<string | null>(null);

  const { data: messages = [], isLoading } = useChannelMessages("whatsapp", undefined, 0, operatorUserId);
  const markAsRead = useMarkAsRead();
  const { sendWhatsApp } = useWhatsAppExtensionBridge();

  const ownSync = useWhatsAppSoftSync();
  const sync = syncState || ownSync;
  const { enabled } = sync;

  const threads = useMemo(() => {
    const visibleMessages = messages.filter(msg => !isSidebarGhostMessage(msg));
    const map = new Map<string, typeof visibleMessages>();
    visibleMessages.forEach(msg => {
      const contact = msg.direction === "inbound" ? (msg.from_address || "Sconosciuto") : (msg.to_address || "Sconosciuto");
      if (!map.has(contact)) map.set(contact, []);
      map.get(contact)!.push(msg);
    });
    const result: ChatThread[] = [];
    map.forEach((msgs, contact) => {
      const sorted = [...msgs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      result.push({
        contact,
        lastMessage: sorted[0],
        unreadCount: sorted.filter(m => m.direction === "inbound" && !m.read_at).length,
        messages: [...msgs].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
      });
    });
    return result.sort((a, b) => new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime());
  }, [messages]);

  const activeThread = activeTab ? threads.find(t => t.contact === activeTab) : null;

  const focusOn = useCallback((contact: string) => {
    setFocusedChat(contact);
  }, []);

  const openChat = useCallback((contact: string) => {
    if (!openTabs.includes(contact)) setOpenTabs(prev => [...prev, contact]);
    setActiveTab(contact);
    focusOn(contact);
    const thread = threads.find(t => t.contact === contact);
    thread?.messages.forEach(msg => {
      if (msg.direction === "inbound" && !msg.read_at) markAsRead.mutate(msg.id);
    });
  }, [openTabs, threads, focusOn, markAsRead]);

  const closeTab = useCallback((contact: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setOpenTabs(prev => prev.filter(t => t !== contact));
    if (activeTab === contact) {
      const remaining = openTabs.filter(t => t !== contact);
      setActiveTab(remaining.length > 0 ? remaining[remaining.length - 1] : null);
    }
  }, [activeTab, openTabs]);

  return (
    <div className="flex h-full bg-background overflow-hidden">
      <WhatsAppChatList
        threads={threads}
        isLoading={isLoading}
        activeTab={activeTab}
        openTabs={openTabs}
        focusedChat={focusedChat}
        syncEnabled={enabled}
        onOpenChat={openChat}
      />

      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden relative">
        {openTabs.length > 0 && (
          <div className="flex-shrink-0 flex items-center border-b border-border bg-muted/30 overflow-x-auto">
            {openTabs.map(contact => {
              const thread = threads.find(t => t.contact === contact);
              const isActive = contact === activeTab;
              const unread = thread?.unreadCount || 0;
              return (
                <button
                  key={contact}
                  onClick={() => { setActiveTab(contact); focusOn(contact); }}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-xs border-r border-border whitespace-nowrap transition-colors max-w-[180px]",
                    isActive ? "bg-background text-foreground border-b-2 border-b-green-500" : "text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  <MessageCircle className="w-3 h-3 text-green-600 flex-shrink-0" />
                  <span className="truncate">{contact}</span>
                  {unread > 0 && (
                    <span className="bg-green-500 text-white text-[9px] rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-0.5 flex-shrink-0">{unread}</span>
                  )}
                  <button onClick={(e) => closeTab(contact, e)} className="ml-0.5 p-0.5 rounded hover:bg-destructive/20 flex-shrink-0">
                    <X className="w-3 h-3" />
                  </button>
                </button>
              );
            })}
          </div>
        )}

        {activeThread ? (
          <WhatsAppChatThread
            thread={activeThread}
            focusedChat={focusedChat}
            syncEnabled={enabled}
            sendWhatsApp={sendWhatsApp}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center space-y-2">
              <MessageCircle className="w-12 h-12 mx-auto opacity-30" />
              <p className="text-sm">Seleziona una conversazione</p>
              <p className="text-xs">Trascina foto o documenti nella chat per allegarli</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
