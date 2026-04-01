import { useState, useMemo } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import {
  Mail, MessageCircle, Linkedin, RefreshCw, Loader2, Eye, EyeOff,
  Inbox, Search, ChevronDown, ChevronRight, User, Building2,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useChannelMessages, useCheckInbox, useMarkAsRead, type ChannelMessage } from "@/hooks/useChannelMessages";

const CHANNEL_CONFIG: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  email: { icon: Mail, label: "Email", color: "text-blue-500" },
  whatsapp: { icon: MessageCircle, label: "WhatsApp", color: "text-green-500" },
  linkedin: { icon: Linkedin, label: "LinkedIn", color: "text-sky-500" },
};

export function InboxView() {
  const [channelFilter, setChannelFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: messages = [], isLoading } = useChannelMessages(channelFilter);
  const checkInbox = useCheckInbox();
  const markAsRead = useMarkAsRead();

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
        {/* Controls */}
        <div className="flex-shrink-0 p-3 space-y-2 border-b border-border">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => checkInbox.mutate()}
              disabled={checkInbox.isPending}
              className="gap-1.5"
            >
              {checkInbox.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              Scarica Posta
            </Button>
            <div className="flex-1 relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cerca..."
                className="h-8 pl-8 text-xs"
              />
            </div>
          </div>

          <Tabs value={channelFilter} onValueChange={setChannelFilter}>
            <TabsList className="h-7 bg-muted/40">
              <TabsTrigger value="all" className="text-xs h-6 px-2">
                <Inbox className="w-3 h-3 mr-1" />
                Tutti
              </TabsTrigger>
              <TabsTrigger value="email" className="text-xs h-6 px-2">
                <Mail className="w-3 h-3 mr-1" />
                Email
              </TabsTrigger>
              <TabsTrigger value="whatsapp" className="text-xs h-6 px-2">
                <MessageCircle className="w-3 h-3 mr-1" />
                WA
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Message list */}
        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : inbound.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground gap-2 px-4">
              <Inbox className="w-8 h-8" />
              <p className="text-sm">Nessun messaggio in arrivo</p>
              <p className="text-xs text-center">Clicca "Scarica Posta" per verificare nuove email</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {inbound.map(msg => {
                const config = CHANNEL_CONFIG[msg.channel] || CHANNEL_CONFIG.email;
                const Icon = config.icon;
                const isUnread = !msg.read_at;
                const isSelected = msg.id === selectedId;
                const senderName = msg.raw_payload?.sender_name || msg.from_address || "Sconosciuto";

                return (
                  <button
                    key={msg.id}
                    onClick={() => handleSelect(msg)}
                    className={cn(
                      "w-full text-left p-3 hover:bg-muted/50 transition-colors",
                      isSelected && "bg-muted",
                      isUnread && "bg-primary/5"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <Icon className={cn("w-4 h-4 mt-0.5 flex-shrink-0", config.color)} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className={cn(
                            "text-sm truncate",
                            isUnread ? "font-semibold" : "font-normal"
                          )}>
                            {senderName}
                          </span>
                          <span className="text-[10px] text-muted-foreground flex-shrink-0">
                            {format(new Date(msg.created_at), "dd/MM HH:mm", { locale: it })}
                          </span>
                        </div>
                        <p className={cn(
                          "text-xs truncate",
                          isUnread ? "text-foreground" : "text-muted-foreground"
                        )}>
                          {msg.subject || "(nessun oggetto)"}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                          {msg.body_text?.slice(0, 80)}
                        </p>
                      </div>
                      {isUnread && (
                        <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                      )}
                    </div>
                    {msg.source_type && msg.source_type !== "unknown" && (
                      <div className="mt-1 ml-6">
                        <Badge variant="outline" className="text-[9px] h-4 gap-0.5">
                          {msg.source_type === "partner" && <Building2 className="w-2.5 h-2.5" />}
                          {msg.source_type === "partner_contact" && <User className="w-2.5 h-2.5" />}
                          {msg.source_type.replace("_", " ")}
                        </Badge>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Right: message detail */}
      {selectedMsg && (
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-shrink-0 p-4 border-b border-border space-y-1">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold truncate">
                {selectedMsg.subject || "(nessun oggetto)"}
              </h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedId(null)}
                className="text-xs"
              >
                Chiudi
              </Button>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">
                {selectedMsg.raw_payload?.sender_name || selectedMsg.from_address}
              </span>
              <span>→</span>
              <span>{selectedMsg.to_address}</span>
              <span>·</span>
              <span>{format(new Date(selectedMsg.created_at), "dd MMM yyyy HH:mm", { locale: it })}</span>
            </div>
            {selectedMsg.source_type && selectedMsg.source_type !== "unknown" && (
              <Badge variant="secondary" className="text-xs gap-1">
                {selectedMsg.source_type === "partner" ? (
                  <Building2 className="w-3 h-3" />
                ) : (
                  <User className="w-3 h-3" />
                )}
                Associato: {selectedMsg.raw_payload?.sender_name}
              </Badge>
            )}
          </div>

          <ScrollArea className="flex-1 p-4">
            <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm">
              {selectedMsg.body_text || "(corpo vuoto)"}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
