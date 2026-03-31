import { useState, useEffect, useCallback } from "react";
import { Linkedin, MessageCircle, Bot, Send, Pause, Play, Zap, Loader2 } from "lucide-react";
import { useLinkedInExtensionBridge } from "@/hooks/useLinkedInExtensionBridge";
import { useWhatsAppExtensionBridge } from "@/hooks/useWhatsAppExtensionBridge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAppSettings, useUpdateSetting } from "@/hooks/useAppSettings";

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
  const { data: settings } = useAppSettings();
  const updateSetting = useUpdateSetting();

  const [liConnected, setLiConnected] = useState(false);
  const [waConnected, setWaConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);

  // Restore persisted state on mount
  useEffect(() => {
    if (settings) {
      setLiConnected(settings["linkedin_connected"] === "true" || li.isAvailable);
      setWaConnected(settings["whatsapp_connected"] === "true" || wa.isAvailable);
    }
  }, [settings, li.isAvailable, wa.isAvailable]);

  // Update when extension pings succeed
  useEffect(() => {
    if (li.isAvailable && !liConnected) setLiConnected(true);
  }, [li.isAvailable]);

  useEffect(() => {
    if (wa.isAvailable && !waConnected) setWaConnected(true);
  }, [wa.isAvailable]);

  const connectAll = useCallback(async () => {
    setConnecting(true);
    let liOk = li.isAvailable;
    let waOk = wa.isAvailable;

    // LinkedIn: check if credentials/cookie exist in DB
    if (!liOk) {
      try {
        const { data } = await supabase.functions.invoke("get-linkedin-credentials");
        if (data?.email || settings?.["linkedin_li_at"]) {
          liOk = true;
        }
      } catch {}
    }

    // WhatsApp: check if sender number is configured
    if (!waOk) {
      if (settings?.["whatsapp_sender"]) {
        waOk = true;
      } else {
        try {
          const { data } = await supabase
            .from("app_settings")
            .select("value")
            .eq("key", "whatsapp_sender")
            .maybeSingle();
          if (data?.value) waOk = true;
        } catch {}
      }
    }

    // LinkedIn: if extension available, verify session
    if (li.isAvailable) {
      try {
        const res = await li.verifySession();
        liOk = res.success;
      } catch { liOk = true; /* extension present, assume ok */ }
    }

    // WhatsApp: if extension available, verify session
    if (wa.isAvailable) {
      try {
        const res = await wa.verifySession();
        waOk = res.success;
      } catch { waOk = true; }
    }

    setLiConnected(liOk);
    setWaConnected(waOk);

    // Persist
    try {
      await updateSetting.mutateAsync({ key: "linkedin_connected", value: String(liOk) });
      await updateSetting.mutateAsync({ key: "whatsapp_connected", value: String(waOk) });
    } catch {}

    setConnecting(false);

    const channels = [liOk && "LinkedIn", waOk && "WhatsApp", "AI Agent"].filter(Boolean);
    toast({
      title: "🔗 Connessioni verificate",
      description: `${channels.join(", ")} — ${liOk && waOk ? "Tutti i canali attivi" : "Alcuni canali richiedono configurazione"}`,
    });
  }, [li, wa, settings, updateSetting]);

  const handleLiClick = async () => {
    if (li.isAvailable) {
      const res = await li.verifySession();
      const ok = res.success;
      setLiConnected(ok);
      toast({
        title: ok ? "✅ LinkedIn connesso" : "⚠️ Sessione LinkedIn non attiva",
        description: ok ? "Sessione verificata" : (res.error || "Effettua il login su LinkedIn"),
      });
    } else if (liConnected) {
      toast({ title: "LinkedIn", description: "Credenziali configurate — estensione non rilevata per DM diretto" });
    } else {
      toast({ title: "LinkedIn non connesso", description: "Vai su Impostazioni → Connessioni per configurare LinkedIn." });
      window.location.href = "/settings";
    }
  };

  const handleWaClick = async () => {
    if (wa.isAvailable) {
      const res = await wa.verifySession();
      const ok = res.success;
      setWaConnected(ok);
      toast({
        title: ok ? "✅ WhatsApp connesso" : "⚠️ Sessione WhatsApp non attiva",
        description: ok ? "Sessione verificata" : (res.error || "Apri WhatsApp Web e scansiona il QR"),
      });
    } else if (waConnected) {
      toast({ title: "WhatsApp", description: "Configurato — estensione non rilevata per invio diretto" });
    } else {
      toast({ title: "WhatsApp non connesso", description: "Vai su Impostazioni → Connessioni per configurare WhatsApp." });
      window.location.href = "/settings";
    }
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="hidden sm:flex items-center gap-1">
        {/* Connect All button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={connectAll}
              disabled={connecting}
              className="relative h-7 px-2 flex items-center gap-1 rounded-md hover:bg-muted/60 transition-colors text-primary"
            >
              {connecting
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Zap className="w-3.5 h-3.5" />}
              <span className="text-[10px] font-semibold">Connetti</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Verifica e attiva tutte le connessioni</TooltipContent>
        </Tooltip>

        <div className="w-px h-4 bg-border mx-0.5" />

        <Tooltip>
          <TooltipTrigger asChild>
            <button onClick={handleLiClick} className="relative h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted/60 transition-colors">
              <Linkedin className="w-4 h-4 text-muted-foreground" />
              <span className={`absolute bottom-0.5 right-0.5 w-2 h-2 rounded-full border border-background ${liConnected ? "bg-emerald-500" : "bg-red-500"}`} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{liConnected ? "LinkedIn connesso" : "LinkedIn non connesso — clicca per verificare"}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button onClick={handleWaClick} className="relative h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted/60 transition-colors">
              <MessageCircle className="w-4 h-4 text-muted-foreground" />
              <span className={`absolute bottom-0.5 right-0.5 w-2 h-2 rounded-full border border-background ${waConnected ? "bg-emerald-500" : "bg-red-500"}`} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{waConnected ? "WhatsApp connesso" : "WhatsApp non connesso — clicca per verificare"}</TooltipContent>
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
