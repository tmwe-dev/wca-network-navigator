import { Loader2, AlertTriangle, TrendingUp, Clock, Mail, Sparkles } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { ChannelMessage } from "@/hooks/useChannelMessages";

import type { HoldingStrategy } from "@/hooks/useHoldingStrategy";

interface HoldingMessageThreadProps {
  selectedMessage: ChannelMessage;
  strategy: HoldingStrategy | null;
  isAnalyzing: boolean;
  strategyError: string | null;
  onStrategyChange: (s: HoldingStrategy) => void;
}

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

export function HoldingMessageThread({
  selectedMessage, strategy, isAnalyzing, strategyError, onStrategyChange,
}: HoldingMessageThreadProps) {
  return (
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
        {isAnalyzing ? (
          <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-xs">AI sta analizzando...</span>
          </div>
        ) : strategy ? (
          <div className="space-y-3">
            <Textarea
              value={strategy.draftReply}
              onChange={(e) => onStrategyChange({ ...strategy, draftReply: e.target.value })}
              className="min-h-[200px] text-sm resize-none"
              placeholder="Bozza di risposta..."
            />
          </div>
        ) : (
          <div className="space-y-3">
            {strategyError && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-xs text-destructive">{strategyError}</p>
              </div>
            )}
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Messaggio originale</p>
              <div className="text-xs text-foreground/80 whitespace-pre-wrap bg-muted/10 rounded-lg p-3 border border-border/20 max-h-[300px] overflow-auto">
                {selectedMessage?.body_text || "Nessun contenuto disponibile"}
              </div>
            </div>
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
            <StrategyCard icon={Mail} label="Azione Suggerita" value={strategy.suggestedAction} color="text-primary" />
            {strategy.nextStepDate && (
              <StrategyCard icon={Clock} label="Prossimo Step" value={strategy.nextStepDate} color="text-muted-foreground" />
            )}
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <div className="flex-1 h-1.5 bg-muted/30 rounded-full overflow-hidden">
                <div className="h-full bg-primary/60 rounded-full" style={{ width: `${strategy.confidence}%` }} />
              </div>
              <span>Confidenza: {strategy.confidence}%</span>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {strategyError && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-xs text-destructive">{strategyError}</p>
              </div>
            )}
            {!strategyError && (
              <p className="text-xs text-muted-foreground text-center py-8">Nessuna analisi disponibile</p>
            )}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
