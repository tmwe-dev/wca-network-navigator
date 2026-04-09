import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Zap, Loader2, CheckCircle2, Mail, MessageCircle, Linkedin, Plane, ListTodo } from "lucide-react";
import { useLinkedInExtensionBridge } from "@/hooks/useLinkedInExtensionBridge";
import { useWhatsAppExtensionBridge } from "@/hooks/useWhatsAppExtensionBridge";
import { useFireScrapeExtensionBridge } from "@/hooks/useFireScrapeExtensionBridge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAppSettings, useUpdateSetting } from "@/hooks/useAppSettings";
import { useUnreadCounts } from "@/hooks/useUnreadCounts";
import { cn } from "@/lib/utils";

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

const STORAGE_KEY = "connection_status_cache";

function loadCachedStatus(): ChannelStatus {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* intentionally ignored: best-effort cleanup */ }
  return { li: false, wa: false, fs: false, ai: true };
}

function saveCachedStatus(s: ChannelStatus) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* intentionally ignored: best-effort cleanup */ }
}

export function ConnectionStatusBar({ onAiClick, outreachQueue }: Props) {
  const navigate = useNavigate();
  const li = useLinkedInExtensionBridge();
  const wa = useWhatsAppExtensionBridge();
  const fsExt = useFireScrapeExtensionBridge();
  const { data: settings } = useAppSettings();
  const updateSetting = useUpdateSetting();
  const { data: counts } = useUnreadCounts();

  const [status, setStatus] = useState<ChannelStatus>(loadCachedStatus);
  const [connecting, setConnecting] = useState(false);

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

    let liOk = false;
    if (li.isAvailable) {
      try {
        const r = await li.verifySession();
        liOk = r.success === true && r.authenticated === true;
        if (!liOk) problems.push("LinkedIn: sessione non autenticata");
      } catch {
        problems.push("LinkedIn: verifica fallita");
      }
    } else {
      problems.push("LinkedIn: estensione non rilevata");
    }

    let waOk = false;
    if (wa.isAvailable) {
      try {
        const r = await wa.verifySession();
        waOk = r.success;
        if (!waOk) problems.push("WhatsApp: sessione non attiva");
      } catch {
        problems.push("WhatsApp: verifica fallita");
      }
    } else {
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
        } catch { /* intentionally ignored: best-effort cleanup */ }
      }
      if (!waOk) problems.push("WhatsApp: né estensione né API configurata");
    }

    const fsOk = fsExt.isAvailable;
    if (!fsOk) problems.push("Partner Connect: estensione non rilevata");
    const aiOk = true;

    const newStatus: ChannelStatus = { li: liOk, wa: waOk, fs: fsOk, ai: aiOk };
    setStatus(newStatus);
    saveCachedStatus(newStatus);

    try {
      await updateSetting.mutateAsync({ key: "linkedin_connected", value: String(liOk) });
      await updateSetting.mutateAsync({ key: "whatsapp_connected", value: String(waOk) });
    } catch { /* intentionally ignored: best-effort cleanup */ }

    setConnecting(false);

    const activeCount = [liOk, waOk, fsOk, aiOk].filter(Boolean).length;
    if (!fsOk) downloadPartnerConnectExtension();

    if (activeCount === 4) {
      toast({ title: "✅ Tutto attivo", description: "LinkedIn · WhatsApp · Partner Connect · AI" });
    } else {
      toast({ title: `⚠️ ${activeCount}/4 attivi`, description: problems.slice(0, 3).join("\n"), duration: 6000 });
    }
  }, [li, wa, fsExt, settings, updateSetting, downloadPartnerConnectExtension]);


  const activeCount = [status.li, status.wa, status.fs, status.ai].filter(Boolean).length;
  const allActive = activeCount === 4;

  const indicators = [
    {
      icon: Mail,
      count: counts?.email ?? 0,
      label: "Email non lette",
      color: "text-blue-400",
      bg: "bg-blue-500/15",
      onClick: () => navigate("/outreach", { state: { tab: "email" } }),
    },
    {
      icon: MessageCircle,
      count: counts?.whatsapp ?? 0,
      label: "WhatsApp non letti",
      color: "text-emerald-400",
      bg: "bg-emerald-500/15",
      onClick: () => navigate("/outreach", { state: { tab: "whatsapp" } }),
    },
    {
      icon: Linkedin,
      count: counts?.linkedin ?? 0,
      label: "LinkedIn non letti",
      color: "text-sky-400",
      bg: "bg-sky-500/15",
      onClick: () => navigate("/outreach", { state: { tab: "linkedin" } }),
    },
    {
      icon: Plane,
      count: counts?.circuito ?? 0,
      label: "Contatti in circuito",
      color: "text-amber-400",
      bg: "bg-amber-500/15",
      onClick: () => navigate("/outreach", { state: { tab: "circuito" } }),
    },
    {
      icon: ListTodo,
      count: counts?.todo ?? 0,
      label: "Attività pendenti",
      color: "text-purple-400",
      bg: "bg-purple-500/15",
      onClick: () => navigate("/outreach", { state: { tab: "attivita" } }),
    },
  ];

  return (
    <TooltipProvider delayDuration={300}>
      <div className="hidden sm:flex items-center gap-1">
        {/* Connection status */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={activateAll}
              disabled={connecting}
              className={cn(
                "relative h-7 px-2 flex items-center gap-1 rounded-lg transition-all text-[10px] font-semibold",
                allActive
                  ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"
                  : "bg-primary/10 text-primary hover:bg-primary/20"
              )}
            >
              {connecting ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : allActive ? (
                <CheckCircle2 className="w-3 h-3" />
              ) : (
                <Zap className="w-3 h-3" />
              )}
              <span>{connecting ? "..." : `${activeCount}/4`}</span>
              <div className="flex items-center gap-0.5 ml-0.5">
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
            <div className="text-muted-foreground pt-1">Clicca per verificare</div>
          </TooltipContent>
        </Tooltip>

        {/* Divider */}
        <div className="w-px h-5 bg-border/50 mx-0.5" />

        {/* Indicator badges */}
        {indicators.map((ind, i) => {
          const Icon = ind.icon;
          const hasItems = ind.count > 0;
          return (
            <Tooltip key={i}>
              <TooltipTrigger asChild>
                <button
                  onClick={ind.onClick}
                  className={cn(
                    "h-7 px-1.5 flex items-center gap-1 rounded-lg transition-all text-[10px] font-semibold",
                    hasItems ? `${ind.bg} ${ind.color}` : "text-muted-foreground/50 hover:bg-muted/40"
                  )}
                >
                  <Icon className="w-3 h-3" />
                  {hasItems && <span className="tabular-nums">{ind.count > 99 ? "99+" : ind.count}</span>}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">{ind.label}: {ind.count}</TooltipContent>
            </Tooltip>
          );
        })}

        {/* Outreach queue */}
        {outreachQueue && outreachQueue.pendingCount > 0 && (
          <>
            <div className="w-px h-5 bg-border/50 mx-0.5" />
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => outreachQueue.setPaused(!outreachQueue.paused)}
                  className="relative h-7 flex items-center gap-1 px-1.5 rounded-lg hover:bg-muted/60 transition-colors"
                >
                  <span className="text-[10px] font-semibold tabular-nums text-foreground">{outreachQueue.pendingCount} coda</span>
                  {outreachQueue.processing && !outreachQueue.paused && (
                    <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {outreachQueue.paused ? "Coda in pausa — clicca per riprendere" : "Clicca per mettere in pausa"}
              </TooltipContent>
            </Tooltip>
          </>
        )}
      </div>
    </TooltipProvider>
  );
}
