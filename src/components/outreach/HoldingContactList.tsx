import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Mail, Loader2, Plane, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/EmptyState";
import { cn } from "@/lib/utils";
import type { HoldingChannel, HoldingMessageGroup } from "@/hooks/useHoldingMessages";
import type { ChannelMessage } from "@/hooks/useChannelMessages";
import { getCountryFlag } from "@/lib/outreachMockData";

const CHANNEL_TABS: { key: HoldingChannel; label: string; icon: typeof Mail }[] = [
  { key: "email", label: "Email", icon: Mail },
  { key: "whatsapp", label: "WhatsApp", icon: Mail },
  { key: "linkedin", label: "LinkedIn", icon: Mail },
];

const CHANNEL_COLORS: Record<string, string> = {
  email: "text-muted-foreground bg-muted",
  whatsapp: "text-emerald-500 bg-emerald-500/10",
  linkedin: "text-muted-foreground bg-muted",
};

interface HoldingContactListProps {
  channel: HoldingChannel;
  onChannelChange: (ch: HoldingChannel) => void;
  displayGroups: HoldingMessageGroup[];
  selectedMessageId: string | null;
  totalUnread: number;
  unreadCounts: Record<string, number> | null;
  onSelectMessage: (msg: ChannelMessage, group: HoldingMessageGroup) => void;
}

export function HoldingContactList({
  channel, onChannelChange, displayGroups, selectedMessageId,
  totalUnread, unreadCounts, onSelectMessage,
}: HoldingContactListProps) {
  return (
    <div className="w-[45%] border-r border-border/40 flex flex-col">
      <div className="px-3 py-2 border-b border-border/40">
        <div className="flex items-center gap-2 mb-2">
          <Plane className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold">Centro Operativo</span>
          {totalUnread > 0 && (
            <Badge variant="destructive" className="ml-auto text-[9px] px-1.5">{totalUnread}</Badge>
          )}
        </div>
        <Tabs value={channel} onValueChange={(v) => onChannelChange(v as HoldingChannel)}>
          <TabsList className="h-7 w-full">
            {CHANNEL_TABS.map(t => (
              <TabsTrigger key={t.key} value={t.key} className="text-[10px] gap-1 flex-1 h-6">
                <t.icon className="w-3 h-3" />
                {t.label}
                {unreadCounts && unreadCounts[t.key] > 0 && (
                  <Badge variant="destructive" className="text-[8px] px-1 py-0 ml-0.5 h-3.5 min-w-[14px]">
                    {unreadCounts[t.key]}
                  </Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <ScrollArea className="flex-1">
        {displayGroups.length === 0 ? (
          <EmptyState
            icon={Plane}
            title="Nessun messaggio"
            description={`Nessun messaggio ${channel} dai contatti nel circuito`}
            className="h-full py-12"
          />
        ) : (
          <div className="p-2 space-y-2">
            {displayGroups.map((group) => (
              <div key={group.partnerId} className="rounded-lg border border-border/30 overflow-hidden">
                <div className="flex items-center gap-2.5 px-3 py-2 bg-muted/20 border-b border-border/20">
                  <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0 text-sm font-bold text-primary">
                    {(group as unknown as Record<string, unknown>).logoUrl ? (
                      <img src={String((group as unknown as Record<string, unknown>).logoUrl)} alt="" className="w-6 h-6 object-contain" />
                    ) : (
                      group.companyName?.charAt(0)?.toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold text-foreground truncate uppercase">{group.companyName}</span>
                      {"countryCode" in group && (group as unknown as Record<string, unknown>).countryCode ? (
                        <span className="text-xs shrink-0">{getCountryFlag(String((group as unknown as Record<string, unknown>).countryCode))}</span>
                      ) : null}
                      {"isImportedContact" in group && (group as unknown as Record<string, unknown>).isImportedContact ? (
                        <Badge variant="outline" className="text-[8px] px-1 h-3.5 border-primary/30 text-primary">Imported</Badge>
                      ) : null}
                    </div>
                    {"contactName" in group && (group as unknown as Record<string, unknown>).contactName ? (
                      <p className="text-[10px] text-muted-foreground truncate">{String((group as unknown as Record<string, unknown>).contactName)}</p>
                    ) : null}
                  </div>
                  {group.unreadCount > 0 && (
                    <Badge variant="destructive" className="text-[8px] px-1.5 h-4 shrink-0">{group.unreadCount}</Badge>
                  )}
                </div>
                <div className="divide-y divide-border/10">
                  {group.messages.slice(0, 5).map((msg: ChannelMessage) => {
                    const isInbound = msg.direction === "inbound";
                    const isSelected = selectedMessageId === msg.id;
                    const isUnread = !msg.read_at;
                    const channelColor = CHANNEL_COLORS[channel] || CHANNEL_COLORS.email;
                    return (
                      <button
                        key={msg.id}
                        onClick={() => onSelectMessage(msg, group)}
                        className={cn(
                          "w-full text-left px-3 py-2.5 transition-colors flex gap-2.5",
                          isSelected ? "bg-primary/8" : "hover:bg-muted/30",
                          isUnread && "border-l-2 border-primary"
                        )}
                      >
                        <div className={cn("w-7 h-7 rounded-md flex items-center justify-center shrink-0 mt-0.5", channelColor)}>
                          {isInbound ? <ArrowDownLeft className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={cn("text-[11px] truncate flex-1", isUnread ? "font-bold text-foreground" : "font-medium text-foreground/80")}>
                              {msg.subject || msg.from_address || "Messaggio"}
                            </span>
                            <span className="text-[9px] text-muted-foreground shrink-0">
                              {format(new Date(msg.email_date || msg.created_at), "dd MMM HH:mm", { locale: it })}
                            </span>
                          </div>
                          <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">
                            {(msg.body_text || "").slice(0, 160)}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <Badge variant="outline" className={cn("text-[8px] px-1 h-3.5", isInbound ? "text-emerald-500 border-emerald-500/30" : "text-muted-foreground border-border")}>
                              {isInbound ? "Ricevuto" : "Inviato"}
                            </Badge>
                            <span className="text-[9px] text-muted-foreground">{msg.from_address}</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
