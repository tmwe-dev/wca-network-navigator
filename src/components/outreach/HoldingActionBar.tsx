import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CheckCircle2, XCircle, PhoneForwarded, Sparkles, ArrowRight } from "lucide-react";
import type { ChannelMessage } from "@/hooks/useChannelMessages";
import type { HoldingMessageGroup } from "@/hooks/useHoldingMessages";

interface HoldingActionBarProps {
  selectedMessage: ChannelMessage | null;
  selectedGroup: HoldingMessageGroup | null;
  onApprove: () => void;
  onIgnore: () => void;
  onEscalate: () => void;
  onRegenerate: () => void;
}

export function HoldingActionBar({
  selectedMessage, selectedGroup, onApprove, onIgnore, onEscalate, onRegenerate,
}: HoldingActionBarProps) {
  if (!selectedMessage) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-2">
          <ArrowRight className="w-5 h-5 text-muted-foreground/30 mx-auto" />
          <p className="text-xs text-muted-foreground">Seleziona un messaggio per analizzare</p>
        </div>
      </div>
    );
  }

  return (
    <>
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

      <div className="px-4 py-2 border-b border-border/40 flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-500 hover:bg-emerald-500/10" onClick={onApprove}>
              <CheckCircle2 className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom"><p className="text-xs">Approva e Invia</p></TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:bg-muted/40" onClick={onIgnore}>
              <XCircle className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom"><p className="text-xs">Ignora</p></TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="ghost" className="h-8 w-8 text-primary hover:bg-primary/10" onClick={onEscalate}>
              <PhoneForwarded className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom"><p className="text-xs">Escalation Chiamata</p></TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="ghost" className="h-8 w-8 text-primary hover:bg-primary/10" onClick={onRegenerate}>
              <Sparkles className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom"><p className="text-xs">Rigenera AI</p></TooltipContent>
        </Tooltip>
      </div>
    </>
  );
}
