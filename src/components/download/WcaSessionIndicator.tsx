import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Loader2, RefreshCw, ShieldCheck, ShieldAlert, CheckCircle, Key, Plug } from "lucide-react";
import { useTheme, t } from "./theme";
import { useWcaSessionStatus, CheckStep } from "@/hooks/useWcaSessionStatus";
import { toast } from "@/hooks/use-toast";

function stepLabel(step: CheckStep): string {
  switch (step) {
    case "syncing_cookie": return "Sincronizzazione cookie...";
    case "verifying_session": return "Verifica contatti reali...";
    case "updating_db": return "Aggiornamento stato...";
    default: return "Verifica in corso...";
  }
}

export function WcaSessionIndicator() {
  const isDark = useTheme();
  const { status, checkedAt, diagnostics, triggerCheck, isChecking, checkStep } = useWcaSessionStatus();

  const isOk = status === "ok";

  const handleVerify = async () => {
    const result = await triggerCheck();
    if (result) {
      toast({
        title: result.status === "ok" ? "✅ Sessione attiva" : "❌ Sessione non attiva",
        description: result.status === "ok"
          ? `Contatti reali visibili (${result.diagnostics?.method || "verificato"})`
          : result.diagnostics?.reason || "Sincronizza il cookie dall'estensione Chrome",
      });
    } else {
      toast({ title: "Errore", description: "Verifica fallita", variant: "destructive" });
    }
  };

  const dotColor = isOk
    ? (isDark ? "bg-emerald-400" : "bg-emerald-500")
    : status === "checking"
      ? (isDark ? "bg-amber-400" : "bg-amber-500")
      : (isDark ? "bg-red-400" : "bg-red-500");
  const label = isOk
    ? "WCA Connesso"
    : status === "expired"
      ? "Sessione Scaduta"
      : status === "checking"
        ? "Verifica..."
        : status === "no_cookie"
          ? "Non configurato"
          : "Errore";

  return (
    <TooltipProvider>
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs transition-all ${
                isDark
                  ? "bg-white/[0.04] border-white/[0.1] hover:bg-white/[0.08] text-slate-300"
                  : "bg-white/60 border-slate-200 hover:bg-white/80 text-slate-600"
              }`}>
                <div className={`w-2.5 h-2.5 rounded-full ${dotColor} ${!isOk ? "animate-pulse" : ""}`} />
                <span className="hidden sm:inline">{label}</span>
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>{label}</p>
            {checkedAt && <p className="text-xs opacity-70">Ultimo check: {new Date(checkedAt).toLocaleString("it-IT")}</p>}
          </TooltipContent>
        </Tooltip>
        <PopoverContent className={`w-80 ${isDark ? "bg-slate-900 border-slate-700 text-slate-200" : ""}`}>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              {isOk ? <ShieldCheck className="w-5 h-5 text-emerald-500" /> : <ShieldAlert className="w-5 h-5 text-red-500" />}
              <span className="font-medium">{label}</span>
            </div>
            
            {/* Diagnostics */}
            {diagnostics && (
              <div className={`text-xs rounded-lg p-2 space-y-1 ${isDark ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-500"}`}>
                <div className="flex items-center gap-1">
                  <Plug className="w-3 h-3" />
                  <span>Metodo: {diagnostics.method === "extension_verify" ? "Estensione Chrome" : "Controllo DB"}</span>
                </div>
                {diagnostics.reason && (
                  <div>Risultato: {diagnostics.reason}</div>
                )}
                {diagnostics.hasAspxAuth !== undefined && (
                  <div className="flex items-center gap-1">
                    <Key className="w-3 h-3" />
                    <span>.ASPXAUTH: {diagnostics.hasAspxAuth ? "✅" : "❌ (non bloccante)"}</span>
                  </div>
                )}
              </div>
            )}

            {!isOk && (
              <div className="space-y-2">
                <p className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  Assicurati di essere loggato su wcaworld.com e che l'estensione Chrome sia attiva.
                </p>
              </div>
            )}
            <Button size="sm" variant="outline" onClick={handleVerify} disabled={isChecking} className="w-full">
              {isChecking ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
              {isChecking ? stepLabel(checkStep) : "Verifica ora"}
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </TooltipProvider>
  );
}

export function WcaSessionDialog({ open, onOpenChange, onRetry }: { open: boolean; onOpenChange: (o: boolean) => void; onRetry: () => void }) {
  const isDark = useTheme();
  const th = t(isDark);
  const { status, diagnostics, triggerCheck, isChecking, checkStep } = useWcaSessionStatus();

  const handleRetry = async () => {
    const result = await triggerCheck();
    if (result?.status === "ok") {
      toast({ title: "✅ Sessione attiva", description: "Contatti personali visibili." });
    }
    setTimeout(() => { onRetry(); }, 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={th.dlgBg}>
        <DialogHeader>
          <DialogTitle className={th.dlgTitle}>
            <ShieldAlert className="w-5 h-5 inline mr-2 text-red-500" />
            Sessione WCA non attiva
          </DialogTitle>
          <DialogDescription className={th.dlgSub}>
            I contatti personali non sono visibili. L'estensione Chrome verificherà la sessione reale.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <ol className={`text-sm space-y-3 ${th.body}`}>
            <li className="flex gap-3">
              <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${th.stepAct}`}>1</span>
              <span>Vai su <a href="https://www.wcaworld.com" target="_blank" rel="noopener" className={`underline ${th.hi}`}>wcaworld.com</a> e fai login</span>
            </li>
            <li className="flex gap-3">
              <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${th.stepWait}`}>2</span>
              <span>Clicca <strong>Verifica sessione</strong> — l'estensione aprirà un profilo di test per confermare</span>
            </li>
          </ol>
          
          {diagnostics && (
            <div className={`text-xs rounded-lg p-2 ${isDark ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-500"}`}>
              <div>Metodo: {diagnostics.method === "extension_verify" ? "Estensione Chrome (test reale)" : "Controllo DB"}</div>
              {diagnostics.reason && <div>Risultato: {diagnostics.reason}</div>}
            </div>
          )}

          <Button onClick={handleRetry} disabled={isChecking} className={`w-full ${th.btnPri}`}>
            {isChecking ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            {isChecking ? stepLabel(checkStep) : "Verifica sessione"}
          </Button>
          {status === "ok" && (
            <div className={`p-3 rounded-lg border text-sm text-center ${isDark ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" : "bg-emerald-50 border-emerald-200 text-emerald-700"}`}>
              <CheckCircle className="w-4 h-4 inline mr-1" /> Sessione attiva! Contatti personali visibili.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
