/**
 * WhatsAppInboxView — orchestratore sottile per la vista inbox WhatsApp.
 */
import { useState, useMemo, useCallback, useEffect } from "react";
import { MessageCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useChannelMessages, useMarkAsRead } from "@/hooks/useChannelMessages";
import { useWhatsAppExtensionBridge } from "@/hooks/useWhatsAppExtensionBridge";
import { useWhatsAppChatMode } from "@/hooks/useWhatsAppChatMode";
import { WhatsAppChatList } from "./WhatsAppChatList";
import { WhatsAppChatThread } from "./WhatsAppChatThread";
import { isSidebarGhostMessage } from "./whatsappTypes";
import type { ChatThread } from "./whatsappTypes";
import { PersistentResizablePanelGroup } from "@/v2/ui/atoms/PersistentResizablePanelGroup";
import { ResizablePanel, ResizableHandle } from "@/components/ui/resizable";

type WhatsAppInboxViewProps = {
  syncState?: {
    focusedChat: string | null;
    focusOn: (c: string) => void;
    isAvailable: boolean;
    syncSingleThread?: (contact: string) => Promise<number>;
  };
  backfillState?: unknown;
  operatorUserId?: string;
};

export function WhatsAppInboxView({ syncState, operatorUserId }: WhatsAppInboxViewProps) {
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);

  const { data: messages = [], isLoading } = useChannelMessages("whatsapp", undefined, 0, operatorUserId);
  const markAsRead = useMarkAsRead();
  const { sendWhatsApp } = useWhatsAppExtensionBridge();
  const noopSync = useCallback(async () => 0, []);
  const chatMode = useWhatsAppChatMode({
    contact: activeTab,
    syncSingleThread: syncState?.syncSingleThread ?? noopSync,
  });

  const focusedChat = syncState?.focusedChat ?? null;
  const focusOn = syncState?.focusOn ?? (() => {});

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

  const existingActive = activeTab ? threads.find(t => t.contact === activeTab) : null;
  // Se la chat è aperta dall'esterno (icona WA da rubrica) e non ha ancora messaggi,
  // creiamo un thread sintetico vuoto per mostrare subito il composer.
  const activeThread: ChatThread | null = existingActive
    ? existingActive
    : activeTab
      ? ({
          contact: activeTab,
          lastMessage: ({
            id: `synthetic-${activeTab}`,
            channel: "whatsapp",
            direction: "outbound",
            from_address: null,
            to_address: activeTab,
            subject: null,
            body_text: "",
            body_html: null,
            created_at: new Date().toISOString(),
            read_at: null,
            user_id: null,
          } as unknown) as ChatThread["lastMessage"],
          unreadCount: 0,
          messages: [],
        } as ChatThread)
      : null;

  const openChat = useCallback((contact: string) => {
    if (!openTabs.includes(contact)) setOpenTabs(prev => [...prev, contact]);
    setActiveTab(contact);
    focusOn(contact);
    const thread = threads.find(t => t.contact === contact);
    thread?.messages.forEach(msg => {
      if (msg.direction === "inbound" && !msg.read_at) markAsRead.mutate(msg.id);
    });
  }, [openTabs, threads, focusOn, markAsRead]);

  // Apertura chat dall'esterno (es. click icona WhatsApp da rubrica/partner card).
  useEffect(() => {
    function onOpen(e: Event) {
      const detail = (e as CustomEvent).detail as { phone?: string } | undefined;
      const phone = detail?.phone;
      if (!phone) return;
      openChat(phone);
    }
    window.addEventListener("wa-open-chat", onOpen as EventListener);
    return () => window.removeEventListener("wa-open-chat", onOpen as EventListener);
  }, [openChat]);

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
      <PersistentResizablePanelGroup
        storageId="inbox-whatsapp:list-vs-thread"
        direction="horizontal"
        className="h-full w-full"
      >
        <ResizablePanel defaultSize={26} minSize={15} maxSize={60} className="min-h-0">
          <WhatsAppChatList
            threads={threads}
            isLoading={isLoading}
            activeTab={activeTab}
            openTabs={openTabs}
            focusedChat={focusedChat}
            syncEnabled={false}
            onOpenChat={openChat}
          />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={74} minSize={30} className="min-h-0">
          <div className="flex h-full flex-col min-w-0 min-h-0 overflow-hidden relative">
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
            syncEnabled={false}
            sendWhatsApp={sendWhatsApp}
            chatMode={{ active: chatMode.active, source: chatMode.source, toggle: chatMode.toggle }}
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
        </ResizablePanel>
      </PersistentResizablePanelGroup>
    </div>
  );
}
