import { Linkedin, MessageCircle, Bot, Send, Pause, Play } from "lucide-react";
import { useLinkedInExtensionBridge } from "@/hooks/useLinkedInExtensionBridge";
import { useWhatsAppExtensionBridge } from "@/hooks/useWhatsAppExtensionBridge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";

interface OutreachQueueState {
  pendingCount: number;
  processing: boolean;
  paused: boolean;
  setPaused: (v: boolean) => void;
}

interface Props {
  onAiClick?: () => void;
  outreachQueue?: OutreachQueueState;
}

export function ConnectionStatusBar({ onAiClick, outreachQueue }: Props) {
  const li = useLinkedInExtensionBridge();
  const wa = useWhatsAppExtensionBridge();

  const handleLiClick = async () => {
    if (!li.isAvailable) {
      toast({ title: "LinkedIn non connesso", description: "Vai su Impostazioni → Connessioni per configurare LinkedIn." });
      window.location.href = "/settings";
      return;
    }
    const res = await li.verifySession();
    toast({ title: res.success ? "✅ LinkedIn connesso" : "⚠️ Sessione LinkedIn non attiva", description: res.success ? "Sessione verificata" : (res.error || "Effettua il login su LinkedIn") });
  };

  const handleWaClick = async () => {
    if (!wa.isAvailable) {
      toast({ title: "WhatsApp non connesso", description: "Vai su Impostazioni → Connessioni per configurare WhatsApp." });
      window.location.href = "/settings";
      return;
    }
    const res = await wa.verifySession();
    toast({ title: res.success ? "✅ WhatsApp connesso" : "⚠️ Sessione WhatsApp non attiva", description: res.success ? "Sessione verificata" : (res.error || "Apri WhatsApp Web e scansiona il QR") });
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="hidden sm:flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <button onClick={handleLiClick} className="relative h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted/60 transition-colors">
              <Linkedin className="w-4 h-4 text-muted-foreground" />
              <span className={`absolute bottom-0.5 right-0.5 w-2 h-2 rounded-full border border-background ${li.isAvailable ? "bg-emerald-500" : "bg-red-500"}`} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{li.isAvailable ? "LinkedIn connesso" : "LinkedIn non connesso — clicca per installare"}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button onClick={handleWaClick} className="relative h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted/60 transition-colors">
              <MessageCircle className="w-4 h-4 text-muted-foreground" />
              <span className={`absolute bottom-0.5 right-0.5 w-2 h-2 rounded-full border border-background ${wa.isAvailable ? "bg-emerald-500" : "bg-red-500"}`} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{wa.isAvailable ? "WhatsApp connesso" : "WhatsApp non connesso — clicca per installare"}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button onClick={onAiClick} className="relative h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted/60 transition-colors">
              <Bot className="w-4 h-4 text-muted-foreground" />
              <span className="absolute bottom-0.5 right-0.5 w-2 h-2 rounded-full border border-background bg-emerald-500" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">AI Agent attivo</TooltipContent>
        </Tooltip>

        {/* Outreach Queue indicator */}
        {outreachQueue && outreachQueue.pendingCount > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => outreachQueue.setPaused(!outreachQueue.paused)}
                className="relative h-7 flex items-center gap-1 px-1.5 rounded-md hover:bg-muted/60 transition-colors"
              >
                {outreachQueue.paused ? (
                  <Play className="w-3.5 h-3.5 text-muted-foreground" />
                ) : (
                  <Send className="w-3.5 h-3.5 text-primary" />
                )}
                <span className="text-[10px] font-semibold tabular-nums text-foreground">{outreachQueue.pendingCount}</span>
                {outreachQueue.processing && !outreachQueue.paused && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-primary animate-pulse" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {outreachQueue.paused
                ? `Coda in pausa — ${outreachQueue.pendingCount} messaggi. Clicca per riprendere`
                : `${outreachQueue.pendingCount} messaggi in coda — clicca per mettere in pausa`}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
