import { useState, useEffect, useCallback } from "react";
import { Zap, Loader2, CheckCircle2 } from "lucide-react";
import { useLinkedInExtensionBridge } from "@/hooks/useLinkedInExtensionBridge";
import { useWhatsAppExtensionBridge } from "@/hooks/useWhatsAppExtensionBridge";
import { useFireScrapeExtensionBridge } from "@/hooks/useFireScrapeExtensionBridge";
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

type ChannelStatus = { li: boolean; wa: boolean; fs: boolean; ai: boolean };

export function ConnectionStatusBar({ onAiClick, outreachQueue }: Props) {
  const li = useLinkedInExtensionBridge();
  const wa = useWhatsAppExtensionBridge();
  const fsExt = useFireScrapeExtensionBridge();
  const { data: settings } = useAppSettings();
  const updateSetting = useUpdateSetting();

  // Start everything as FALSE — no lies
  const [status, setStatus] = useState<ChannelStatus>({ li: false, wa: false, fs: false, ai: false });
  const [connecting, setConnecting] = useState(false);
  const [didAutoRun, setDidAutoRun] = useState(false);

  // Live extension detection — only for Partner Connect (no session needed)
  useEffect(() => {
    setStatus(p => ({ ...p, fs: fsExt.isAvailable }));
  }, [fsExt.isAvailable]);

  const downloadPartnerConnectExtension = useCallback(() => {
    fetch("/partner-connect-extension.zip")
      .then((res) => {
        if (!res.ok) throw new Error(`Download failed: ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "partner-connect-extension.zip";
        a.click();
        URL.revokeObjectURL(a.href);
        toast({
          title: "🔌 Partner Connect scaricato",
          description: "1) Estrai lo ZIP  2) chrome://extensions → Modalità sviluppatore  3) Carica non pacchettizzata  4) Ricarica questa pagina",
        });
      })
      .catch(() => toast({ title: "Errore download", description: "Impossibile scaricare Partner Connect" }));
  }, []);

  const activateAll = useCallback(async () => {
    setConnecting(true);
    const problems: string[] = [];

    // --- LinkedIn: REAL verification only ---
    let liOk = false;
    if (li.isAvailable) {
      try {
        const r = await li.verifySession();
        liOk = r.success;
        if (!liOk) problems.push("LinkedIn: sessione scaduta");
      } catch {
        liOk = false;
        problems.push("LinkedIn: verifica fallita");
      }
    } else {
      problems.push("LinkedIn: estensione non rilevata");
    }

    // --- WhatsApp: extension OR API mode ---
    let waOk = false;
    if (wa.isAvailable) {
      try {
        const r = await wa.verifySession();
        waOk = r.success;
        if (!waOk) problems.push("WhatsApp: sessione non attiva");
      } catch {
        waOk = false;
        problems.push("WhatsApp: verifica fallita");
      }
    } else {
      // API mode: check whatsapp_sender
      const sender = settings?.["whatsapp_sender"];
      if (sender) {
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
      if (!waOk) problems.push("WhatsApp: né estensione né API configurata");
    }

    // --- Partner Connect ---
    const fsOk = fsExt.isAvailable;
    if (!fsOk) problems.push("Partner Connect: estensione non rilevata");

    // --- AI: fallback true (no healthcheck endpoint yet) ---
    const aiOk = true;

    const newStatus: ChannelStatus = { li: liOk, wa: waOk, fs: fsOk, ai: aiOk };
    setStatus(newStatus);

    // Persist real state
    try {
      await updateSetting.mutateAsync({ key: "linkedin_connected", value: String(liOk) });
      await updateSetting.mutateAsync({ key: "whatsapp_connected", value: String(waOk) });
    } catch {}

    setConnecting(false);

    const activeCount = [liOk, waOk, fsOk, aiOk].filter(Boolean).length;
    const allOk = activeCount === 4;

    if (!fsOk) {
      downloadPartnerConnectExtension();
    }

    if (allOk) {
      toast({ title: "✅ Tutto attivo", description: "LinkedIn · WhatsApp · Partner Connect · AI" });
    } else {
      toast({
        title: `⚠️ ${activeCount}/4 attivi`,
        description: problems.slice(0, 3).join("\n"),
        duration: 6000,
      });
    }
  }, [li, wa, fsExt, settings, updateSetting, downloadPartnerConnectExtension]);

  // Auto-activate on first mount (after settings load)
  useEffect(() => {
    if (!didAutoRun && settings) {
      setDidAutoRun(true);
      const timer = setTimeout(activateAll, 1500);
      return () => clearTimeout(timer);
    }
  }, [settings, didAutoRun, activateAll]);

  const activeCount = [status.li, status.wa, status.fs, status.ai].filter(Boolean).length;
  const allActive = activeCount === 4;

  return (
    <TooltipProvider delayDuration={300}>
      <div className="hidden sm:flex items-center">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={activateAll}
              disabled={connecting}
              className={`relative h-8 px-3 flex items-center gap-1.5 rounded-lg transition-all text-xs font-semibold ${
                allActive
                  ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"
                  : "bg-primary/10 text-primary hover:bg-primary/20"
              }`}
            >
              {connecting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : allActive ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : (
                <Zap className="w-3.5 h-3.5" />
              )}
              <span>{connecting ? "Verifico..." : allActive ? "Tutto attivo" : `${activeCount}/4 attivi`}</span>
              <div className="flex items-center gap-0.5 ml-1">
                {[status.li, status.wa, status.fs, status.ai].map((on, i) => (
                  <span key={i} className={`w-1.5 h-1.5 rounded-full ${on ? "bg-emerald-500" : "bg-destructive"}`} />
                ))}
              </div>
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs space-y-0.5">
            <div className="flex items-center gap-1.5"><span className={`w-1.5 h-1.5 rounded-full ${status.li ? "bg-emerald-500" : "bg-destructive"}`} /> LinkedIn</div>
            <div className="flex items-center gap-1.5"><span className={`w-1.5 h-1.5 rounded-full ${status.wa ? "bg-emerald-500" : "bg-destructive"}`} /> WhatsApp</div>
            <div className="flex items-center gap-1.5"><span className={`w-1.5 h-1.5 rounded-full ${status.fs ? "bg-emerald-500" : "bg-destructive"}`} /> Partner Connect</div>
            <div className="flex items-center gap-1.5"><span className={`w-1.5 h-1.5 rounded-full ${status.ai ? "bg-emerald-500" : "bg-destructive"}`} /> AI Agent</div>
            <div className="text-muted-foreground pt-1">Clicca per verificare tutto</div>
          </TooltipContent>
        </Tooltip>

        {outreachQueue && outreachQueue.pendingCount > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => outreachQueue.setPaused(!outreachQueue.paused)}
                className="relative h-7 flex items-center gap-1 px-1.5 ml-1 rounded-md hover:bg-muted/60 transition-colors"
              >
                <span className="text-[10px] font-semibold tabular-nums text-foreground">{outreachQueue.pendingCount} in coda</span>
                {outreachQueue.processing && !outreachQueue.paused && (
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {outreachQueue.paused ? "Coda in pausa — clicca per riprendere" : "Clicca per mettere in pausa"}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
