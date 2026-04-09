/**
 * HoldingPatternCommandCenter — Split-view command center for the holding pattern.
 * Left: incoming messages with rich company cards
 * Right: Quick action icons + 2 tabs (Risposta / Strategia)
 */
import { useState } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import {
  Mail, MessageCircle, Linkedin, Loader2, Plane, ArrowRight,
  CheckCircle2, XCircle, PhoneForwarded, Sparkles,
  AlertTriangle, TrendingUp, Clock, ArrowDownLeft, ArrowUpRight,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/EmptyState";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  useHoldingMessages,
  useHoldingUnreadCounts,
  type HoldingChannel,
  type HoldingMessageGroup,
} from "@/hooks/useHoldingMessages";
import { useHoldingStrategy } from "@/hooks/useHoldingStrategy";
import type { ChannelMessage } from "@/hooks/useChannelMessages";
import { useMarkAsRead } from "@/hooks/useEmailActions";
import { useOutreachMock } from "@/hooks/useOutreachMock";
import { MOCK_HOLDING_GROUPS, getCountryFlag } from "@/lib/outreachMockData";
import { toast } from "sonner";

const CHANNEL_TABS: { key: HoldingChannel; label: string; icon: typeof Mail }[] = [
  { key: "email", label: "Email", icon: Mail },
  { key: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { key: "linkedin", label: "LinkedIn", icon: Linkedin },
];

const CHANNEL_COLORS: Record<string, string> = {
  email: "text-blue-500 bg-blue-500/10",
  whatsapp: "text-emerald-500 bg-emerald-500/10",
  linkedin: "text-sky-600 bg-sky-600/10",
};

export function HoldingPatternCommandCenter() {
  const [channel, setChannel] = useState<HoldingChannel>("email");
  const [selectedGroup, setSelectedGroup] = useState<HoldingMessageGroup | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<ChannelMessage | null>(null);

  const { data: groups = [], isLoading } = useHoldingMessages(channel);
  const { data: unreadCounts } = useHoldingUnreadCounts();
  const { analyze, isAnalyzing, strategy, setStrategy, reset: resetStrategy } = useHoldingStrategy();
  const markAsRead = useMarkAsRead();
  const { mockEnabled } = useOutreachMock();

  // Use mock data when enabled
  const displayGroups = mockEnabled ? MOCK_HOLDING_GROUPS as any as HoldingMessageGroup[] : groups;

  const handleSelectMessage = async (msg: ChannelMessage, group: HoldingMessageGroup) => {
    setSelectedGroup(group);
    setSelectedMessage(msg);
    resetStrategy();
    if (!msg.read_at && !mockEnabled) {
      markAsRead.mutate(msg.id);
    }
    if (!mockEnabled) {
      analyze(msg, group.companyName);
    }
  };

  const totalUnread = mockEnabled
    ? MOCK_HOLDING_GROUPS.reduce((s, g) => s + g.unreadCount, 0)
    : unreadCounts ? unreadCounts.email + unreadCounts.whatsapp + unreadCounts.linkedin : 0;

  if (isLoading && !groups.length && !mockEnabled) {
    return (
      <div className="flex items-center justify-center h-full gap-2 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Caricamento…
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* ═══ LEFT: Messages Panel ═══ */}
      <div className="w-[45%] border-r border-border/40 flex flex-col">
        {/* Channel tabs header */}
        <div className="px-3 py-2 border-b border-border/40">
          <div className="flex items-center gap-2 mb-2">
            <Plane className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold">Centro Operativo</span>
            {totalUnread > 0 && (
              <Badge variant="destructive" className="ml-auto text-[9px] px-1.5">{totalUnread}</Badge>
            )}
          </div>
          <Tabs value={channel} onValueChange={(v) => { setChannel(v as HoldingChannel); setSelectedMessage(null); setSelectedGroup(null); resetStrategy(); }}>
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

        {/* Message list — enriched cards */}
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
              {displayGroups.map((group: any) => (
                <div key={group.partnerId} className="rounded-lg border border-border/30 overflow-hidden">
                  {/* Company header card */}
                  <div className="flex items-center gap-2.5 px-3 py-2 bg-muted/20 border-b border-border/20">
                    {/* Logo or initial */}
                    <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0 text-sm font-bold text-primary">
                      {group.logoUrl ? (
                        <img src={group.logoUrl} alt="" className="w-6 h-6 object-contain" />
                      ) : (
                        group.companyName?.charAt(0)?.toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-bold text-foreground truncate uppercase">
                          {group.companyName}
                        </span>
                        {(group as any).countryCode && (
                          <span className="text-xs shrink-0">{getCountryFlag((group as any).countryCode)}</span>
                        )}
                      </div>
                      {(group as any).contactName && (
                        <p className="text-[10px] text-muted-foreground truncate">{(group as any).contactName}</p>
                      )}
                    </div>
                    {group.unreadCount > 0 && (
                      <Badge variant="destructive" className="text-[8px] px-1.5 h-4 shrink-0">{group.unreadCount}</Badge>
                    )}
                  </div>
                  {/* Messages */}
                  <div className="divide-y divide-border/10">
                    {group.messages.slice(0, 5).map((msg: any) => {
                      const isInbound = msg.direction === "inbound";
                      const isSelected = selectedMessage?.id === msg.id;
                      const isUnread = !msg.read_at;
                      const channelColor = CHANNEL_COLORS[channel] || CHANNEL_COLORS.email;

                      return (
                        <button
                          key={msg.id}
                          onClick={() => handleSelectMessage(msg as ChannelMessage, group as HoldingMessageGroup)}
                          className={cn(
                            "w-full text-left px-3 py-2.5 transition-colors flex gap-2.5",
                            isSelected ? "bg-primary/8" : "hover:bg-muted/30",
                            isUnread && "border-l-2 border-primary"
                          )}
                        >
                          {/* Direction + channel icon */}
                          <div className={cn("w-7 h-7 rounded-md flex items-center justify-center shrink-0 mt-0.5", channelColor)}>
                            {isInbound
                              ? <ArrowDownLeft className="w-3.5 h-3.5" />
                              : <ArrowUpRight className="w-3.5 h-3.5" />
                            }
                          </div>
                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className={cn(
                                "text-[11px] truncate flex-1",
                                isUnread ? "font-bold text-foreground" : "font-medium text-foreground/80"
                              )}>
                                {msg.subject || msg.from_address || "Messaggio"}
                              </span>
                              <span className="text-[9px] text-muted-foreground shrink-0">
                                {format(new Date(msg.email_date || msg.created_at), "dd MMM HH:mm", { locale: it })}
                              </span>
                            </div>
                            <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">
                              {(msg.body_text || "").slice(0, 160)}
                            </p>
                            {/* Direction badge */}
                            <div className="flex items-center gap-1.5 mt-1">
                              <Badge variant="outline" className={cn("text-[8px] px-1 h-3.5", isInbound ? "text-emerald-500 border-emerald-500/30" : "text-blue-500 border-blue-500/30")}>
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

      {/* ═══ RIGHT: Strategy Panel ═══ */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selectedMessage ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-2">
              <ArrowRight className="w-5 h-5 text-muted-foreground/30 mx-auto" />
              <p className="text-xs text-muted-foreground">Seleziona un messaggio per analizzare</p>
            </div>
          </div>
        ) : (
          <>
            {/* Message header */}
            <div className="px-4 py-3 border-b border-border/40">
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold truncate">{selectedGroup?.companyName}</h3>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {selectedMessage.subject || "Nessun oggetto"} · {selectedMessage.from_address}
                  </p>
                </div>
                <Badge variant="outline" className="text-[9px] shrink-0">
                  {selectedMessage.direction === "inbound" ? "Ricevuto" : "Inviato"}
                </Badge>
              </div>
            </div>

            {/* ── Quick Action Icons ── */}
            <div className="px-4 py-2 border-b border-border/40 flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-500 hover:bg-emerald-500/10"
                    onClick={() => toast.success("Risposta approvata e accodata")}>
                    <CheckCircle2 className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom"><p className="text-xs">Approva e Invia</p></TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:bg-muted/40"
                    onClick={() => toast.info("Messaggio ignorato")}>
                    <XCircle className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom"><p className="text-xs">Ignora</p></TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-amber-500 hover:bg-amber-500/10"
                    onClick={() => toast.info("Escalation telefonica avviata")}>
                    <PhoneForwarded className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom"><p className="text-xs">Escalation Chiamata</p></TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-primary hover:bg-primary/10"
                    onClick={() => {
                      if (!mockEnabled) analyze(selectedMessage, selectedGroup?.companyName || "");
                      else toast.info("Analisi AI rigenerata (mock)");
                    }}>
                    <Sparkles className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom"><p className="text-xs">Rigenera AI</p></TooltipContent>
              </Tooltip>
            </div>

            {/* ── 2 Tabs: Risposta + Strategia ── */}
            <Tabs defaultValue="risposta" className="flex-1 flex flex-col overflow-hidden">
              <div className="px-4 pt-2">
                <TabsList className="h-7 w-full">
                  <TabsTrigger value="risposta" className="text-[10px] gap-1 flex-1 h-6">
                    <Sparkles className="w-3 h-3" /> Risposta
                  </TabsTrigger>
                  <TabsTrigger value="strategia" className="text-[10px] gap-1 flex-1 h-6">
                    <TrendingUp className="w-3 h-3" /> Strategia
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="risposta" className="flex-1 overflow-auto px-4 py-3 m-0">
                {mockEnabled ? (
                  <div className="space-y-3">
                    <Textarea
                      defaultValue="Gentile cliente, grazie per il suo messaggio. Stiamo preparando una risposta dettagliata con tutte le informazioni richieste. La contatteremo al più presto."
                      className="min-h-[200px] text-sm resize-none"
                      placeholder="Bozza di risposta..."
                    />
                  </div>
                ) : isAnalyzing ? (
                  <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-xs">AI sta analizzando...</span>
                  </div>
                ) : strategy ? (
                  <div className="space-y-3">
                    <Textarea
                      value={strategy.draftReply}
                      onChange={(e) => setStrategy({ ...strategy, draftReply: e.target.value })}
                      className="min-h-[200px] text-sm resize-none"
                      placeholder="Bozza di risposta..."
                    />
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-xs text-muted-foreground">Seleziona un messaggio per generare la risposta AI</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="strategia" className="flex-1 overflow-auto px-4 py-3 m-0">
                {mockEnabled ? (
                  <div className="space-y-3">
                    <StrategyCard icon={AlertTriangle} label="Sentiment" value="Positivo — interesse dichiarato" color="text-emerald-500" />
                    <StrategyCard icon={TrendingUp} label="Intent Rilevato" value="Richiesta informazioni / preventivo" color="text-primary" />
                    <StrategyCard icon={Mail} label="Azione Suggerita" value="Rispondere con dettagli tecnici e proposta call" color="text-amber-500" />
                    <StrategyCard icon={Clock} label="Prossimo Step" value="Follow-up tra 3 giorni se nessuna risposta" color="text-blue-500" />
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <div className="flex-1 h-1.5 bg-muted/30 rounded-full overflow-hidden">
                        <div className="h-full bg-primary/60 rounded-full" style={{ width: "92%" }} />
                      </div>
                      <span>Confidenza: 92%</span>
                    </div>
                  </div>
                ) : isAnalyzing ? (
                  <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-xs">Analisi in corso...</span>
                  </div>
                ) : strategy ? (
                  <div className="space-y-3">
                    <StrategyCard icon={AlertTriangle} label="Sentiment" value={strategy.sentiment} color={
                      strategy.sentiment === "positive" ? "text-emerald-500" :
                      strategy.sentiment === "negative" ? "text-destructive" : "text-muted-foreground"
                    } />
                    <StrategyCard icon={TrendingUp} label="Intent Rilevato" value={strategy.intent} color="text-primary" />
                    <StrategyCard icon={Mail} label="Azione Suggerita" value={strategy.suggestedAction} color="text-amber-500" />
                    {strategy.nextStepDate && (
                      <StrategyCard icon={Clock} label="Prossimo Step" value={strategy.nextStepDate} color="text-blue-500" />
                    )}
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <div className="flex-1 h-1.5 bg-muted/30 rounded-full overflow-hidden">
                        <div className="h-full bg-primary/60 rounded-full" style={{ width: `${strategy.confidence}%` }} />
                      </div>
                      <span>Confidenza: {strategy.confidence}%</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-8">Nessuna analisi disponibile</p>
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Strategy Card ── */
function StrategyCard({ icon: Icon, label, value, color }: {
  icon: typeof Mail; label: string; value: string; color: string;
}) {
  return (
    <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-muted/10 border border-border/20">
      <div className="w-7 h-7 rounded-md bg-muted/30 flex items-center justify-center shrink-0">
        <Icon className={cn("w-3.5 h-3.5", color)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-xs text-foreground capitalize">{value}</p>
      </div>
    </div>
  );
}
