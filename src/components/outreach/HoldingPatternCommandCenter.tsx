/**
 * HoldingPatternCommandCenter — Split-view command center for the holding pattern.
 * Left: incoming messages grouped by channel (Email/WA/LinkedIn)
 * Right: AI strategy panel (Draft Reply / Strategy / Actions)
 */
import { useState, useMemo } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import {
  Mail, MessageCircle, Linkedin, Loader2, Plane, ArrowRight,
  CheckCircle2, Pencil, XCircle, PhoneForwarded, ChevronRight,
  Sparkles, AlertTriangle, TrendingUp, Clock,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/EmptyState";
import { useNavigate } from "react-router-dom";
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
import { toast } from "sonner";

const CHANNEL_TABS: { key: HoldingChannel; label: string; icon: typeof Mail }[] = [
  { key: "email", label: "Email", icon: Mail },
  { key: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { key: "linkedin", label: "LinkedIn", icon: Linkedin },
];

export function HoldingPatternCommandCenter() {
  const navigate = useNavigate();
  const [channel, setChannel] = useState<HoldingChannel>("email");
  const [selectedGroup, setSelectedGroup] = useState<HoldingMessageGroup | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<ChannelMessage | null>(null);

  const { data: groups = [], isLoading } = useHoldingMessages(channel);
  const { data: unreadCounts } = useHoldingUnreadCounts();
  const { analyze, isAnalyzing, strategy, setStrategy, reset: resetStrategy } = useHoldingStrategy();
  const markAsRead = useMarkAsRead();

  const handleSelectMessage = async (msg: ChannelMessage, group: HoldingMessageGroup) => {
    setSelectedGroup(group);
    setSelectedMessage(msg);
    resetStrategy();

    // Mark as read
    if (!msg.read_at) {
      markAsRead.mutate(msg.id);
    }

    // Auto-trigger AI analysis
    analyze(msg, group.companyName);
  };

  const totalUnread = unreadCounts
    ? unreadCounts.email + unreadCounts.whatsapp + unreadCounts.linkedin
    : 0;

  if (isLoading && !groups.length) {
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

        {/* Message list */}
        <ScrollArea className="flex-1">
          {groups.length === 0 ? (
            <EmptyState
              icon={Plane}
              title="Nessun messaggio"
              description={`Nessun messaggio ${channel} dai contatti nel circuito`}
              className="h-full py-12"
            />
          ) : (
            <div className="p-2 space-y-1">
              {groups.map(group => (
                <div key={group.partnerId} className="space-y-0.5">
                  {/* Company header */}
                  <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <span className="truncate">{group.companyName}</span>
                    {group.unreadCount > 0 && (
                      <Badge variant="destructive" className="text-[8px] px-1 h-3.5">{group.unreadCount}</Badge>
                    )}
                  </div>
                  {group.messages.slice(0, 5).map(msg => (
                    <button
                      key={msg.id}
                      onClick={() => handleSelectMessage(msg, group)}
                      className={cn(
                        "w-full text-left px-2.5 py-2 rounded-md text-xs transition-colors",
                        selectedMessage?.id === msg.id
                          ? "bg-primary/10 text-foreground"
                          : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                        !msg.read_at && "border-l-2 border-primary"
                      )}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className={cn("truncate flex-1 font-medium", !msg.read_at && "text-foreground")}>
                          {msg.subject || msg.from_address || "Messaggio"}
                        </span>
                        <span className="text-[9px] text-muted-foreground shrink-0">
                          {format(new Date(msg.email_date || msg.created_at), "dd MMM", { locale: it })}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                        {msg.direction === "inbound" ? "← " : "→ "}
                        {(msg.body_text || "").slice(0, 80)}
                      </p>
                    </button>
                  ))}
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

            {/* Strategy tabs */}
            <Tabs defaultValue="risposta" className="flex-1 flex flex-col overflow-hidden">
              <div className="px-4 pt-2">
                <TabsList className="h-7 w-full">
                  <TabsTrigger value="risposta" className="text-[10px] gap-1 flex-1 h-6">
                    <Sparkles className="w-3 h-3" /> Risposta
                  </TabsTrigger>
                  <TabsTrigger value="strategia" className="text-[10px] gap-1 flex-1 h-6">
                    <TrendingUp className="w-3 h-3" /> Strategia
                  </TabsTrigger>
                  <TabsTrigger value="azioni" className="text-[10px] gap-1 flex-1 h-6">
                    <CheckCircle2 className="w-3 h-3" /> Azioni
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="risposta" className="flex-1 overflow-auto px-4 py-3 m-0">
                {isAnalyzing ? (
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
                    <div className="flex gap-2">
                      <Button size="sm" className="gap-1.5 flex-1" onClick={() => toast.success("Risposta approvata e accodata")}>
                        <CheckCircle2 className="w-3.5 h-3.5" /> Approva e Invia
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => toast.info("Modalità modifica attiva")}>
                        <Pencil className="w-3.5 h-3.5" /> Modifica
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-xs text-muted-foreground">Seleziona un messaggio per generare la risposta AI</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="strategia" className="flex-1 overflow-auto px-4 py-3 m-0">
                {isAnalyzing ? (
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
                    <StrategyCard icon={ChevronRight} label="Azione Suggerita" value={strategy.suggestedAction} color="text-amber-500" />
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

              <TabsContent value="azioni" className="flex-1 overflow-auto px-4 py-3 m-0">
                <div className="space-y-2">
                  <Button size="sm" variant="outline" className="w-full justify-start gap-2" onClick={() => toast.success("Risposta inviata")}>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Approva e Invia
                  </Button>
                  <Button size="sm" variant="outline" className="w-full justify-start gap-2" onClick={() => toast.info("Ignorato")}>
                    <XCircle className="w-3.5 h-3.5 text-muted-foreground" /> Ignora
                  </Button>
                  <Button size="sm" variant="outline" className="w-full justify-start gap-2" onClick={() => toast.info("Escalation avviata")}>
                    <PhoneForwarded className="w-3.5 h-3.5 text-amber-500" /> Escalation (Chiamata)
                  </Button>
                  <Button size="sm" variant="outline" className="w-full justify-start gap-2" onClick={() => {
                    analyze(selectedMessage, selectedGroup?.companyName || "");
                  }}>
                    <Sparkles className="w-3.5 h-3.5 text-primary" /> Rigenera Analisi AI
                  </Button>
                </div>
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
