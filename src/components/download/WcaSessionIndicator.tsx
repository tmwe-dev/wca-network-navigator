import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Loader2, RefreshCw, ShieldCheck, ShieldAlert, CheckCircle, Key } from "lucide-react";
import { useTheme, t } from "./theme";
import { useWcaSessionStatus } from "@/hooks/useWcaSessionStatus";

export function WcaSessionIndicator() {
  const isDark = useTheme();
  const { status, checkedAt, diagnostics, triggerCheck, autoLogin, isLoading } = useWcaSessionStatus();

  const isOk = status === "ok";
  const dotColor = isOk
    ? (isDark ? "bg-emerald-400" : "bg-emerald-500")
    : (isDark ? "bg-red-400" : "bg-red-500");
  const label = isOk ? "WCA Connesso" : status === "expired" ? "Sessione Scaduta" : "Non configurato";

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
                  <Key className="w-3 h-3" />
                  <span>.ASPXAUTH: {diagnostics.hasAspxAuth ? "✅" : "❌ Mancante"}</span>
                </div>
                {diagnostics.contactsTotal != null && (
                  <>
                    <div>Contatti trovati: {diagnostics.contactsTotal}</div>
                    <div>Nomi reali visibili: {diagnostics.contactsWithRealName || 0}</div>
                    <div>Email visibili: {diagnostics.contactsWithEmail || 0}</div>
                    {diagnostics.membersOnlyCount > 0 && (
                      <div className="text-amber-500">"Members only": {diagnostics.membersOnlyCount}x</div>
                    )}
                  </>
                )}
              </div>
            )}

            {!isOk && (
              <div className="space-y-2">
                <p className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  Usa l'estensione Chrome per sincronizzare il cookie .ASPXAUTH, oppure prova il login automatico.
                </p>
                <Button size="sm" variant="outline" onClick={autoLogin} disabled={isLoading} className="w-full">
                  {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Key className="w-3.5 h-3.5 mr-1" />}
                  Tenta Auto-Login
                </Button>
              </div>
            )}
            <Button size="sm" variant="outline" onClick={triggerCheck} disabled={isLoading} className="w-full">
              {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
              Verifica ora
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
  const { status, diagnostics, triggerCheck, autoLogin, isLoading } = useWcaSessionStatus();

  const handleAutoLogin = async () => {
    await autoLogin();
    setTimeout(() => { onRetry(); }, 2000);
  };

  const handleRetry = async () => {
    await triggerCheck();
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
            I contatti personali non sono visibili. Serve una sessione autenticata con .ASPXAUTH.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <ol className={`text-sm space-y-3 ${th.body}`}>
            <li className="flex gap-3">
              <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${th.stepAct}`}>1</span>
              <span>Prova il <strong>Login Automatico</strong> (usa le credenziali salvate)</span>
            </li>
            <li className="flex gap-3">
              <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${th.stepWait}`}>2</span>
              <span>Se fallisce, vai su <a href="https://www.wcaworld.com" target="_blank" rel="noopener" className={`underline ${th.hi}`}>wcaworld.com</a>, fai login, e usa l'estensione Chrome per sincronizzare il cookie</span>
            </li>
          </ol>
          
          {diagnostics && (
            <div className={`text-xs rounded-lg p-2 ${isDark ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-500"}`}>
              <div>.ASPXAUTH: {diagnostics.hasAspxAuth ? "✅" : "❌ Mancante"}</div>
              <div>Nomi visibili: {diagnostics.contactsWithRealName || 0}/{diagnostics.contactsTotal || 0}</div>
              {diagnostics.membersOnlyCount > 0 && <div className="text-amber-500">"Members only": {diagnostics.membersOnlyCount}x</div>}
            </div>
          )}

          <Button onClick={handleAutoLogin} disabled={isLoading} className={`w-full ${th.btnPri}`}>
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Key className="w-4 h-4 mr-2" />}
            Tenta Auto-Login
          </Button>
          <Button onClick={handleRetry} disabled={isLoading} variant="outline" className="w-full">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Verifica sessione
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
