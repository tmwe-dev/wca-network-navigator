import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Loader2, RefreshCw, ShieldCheck, ShieldAlert, CheckCircle } from "lucide-react";
import { useTheme, t } from "./theme";
import { useWcaSessionStatus } from "@/hooks/useWcaSessionStatus";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const BOOKMARKLET = `javascript:void(fetch('${SUPABASE_URL}/functions/v1/save-wca-cookie',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cookie:document.cookie})}).then(r=>r.json()).then(d=>alert(d.message||'Done!')).catch(e=>alert('Errore: '+e.message)))`;

export function WcaSessionIndicator() {
  const isDark = useTheme();
  const { status, checkedAt, triggerCheck, isLoading } = useWcaSessionStatus();

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
            {!isOk && (
              <div className="space-y-2">
                <p className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  Per attivare la sessione, trascina il bottone qui sotto nella barra dei preferiti, poi cliccalo su wcaworld.com:
                </p>
                <a
                  href={BOOKMARKLET}
                  onClick={e => e.preventDefault()}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium cursor-grab active:cursor-grabbing ${
                    isDark ? "bg-amber-600 text-white" : "bg-sky-600 text-white"
                  }`}
                >
                  🔗 Cattura WCA
                </a>
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
  const { status, triggerCheck, isLoading } = useWcaSessionStatus();

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
            Per scaricare i dati dei contatti è necessaria una sessione WCA attiva.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <ol className={`text-sm space-y-3 ${th.body}`}>
            <li className="flex gap-3">
              <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${th.stepAct}`}>1</span>
              <span>Trascina questo bottone nella barra dei preferiti:
                <a href={BOOKMARKLET} onClick={e => e.preventDefault()} className={`inline-flex items-center gap-1 ml-2 px-2 py-1 rounded text-xs font-medium cursor-grab active:cursor-grabbing ${isDark ? "bg-amber-600 text-white" : "bg-sky-600 text-white"}`}>
                  🔗 Cattura WCA
                </a>
              </span>
            </li>
            <li className="flex gap-3">
              <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${th.stepWait}`}>2</span>
              <span>Vai su <a href="https://www.wcaworld.com" target="_blank" rel="noopener" className={`underline ${th.hi}`}>wcaworld.com</a> e fai login</span>
            </li>
            <li className="flex gap-3">
              <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${th.stepWait}`}>3</span>
              <span>Clicca il bookmark "Cattura WCA" — vedrai un alert "Done!"</span>
            </li>
          </ol>
          <Button onClick={handleRetry} disabled={isLoading} className={`w-full ${th.btnPri}`}>
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Riprova verifica
          </Button>
          {status === "ok" && (
            <div className={`p-3 rounded-lg border text-sm text-center ${isDark ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" : "bg-emerald-50 border-emerald-200 text-emerald-700"}`}>
              <CheckCircle className="w-4 h-4 inline mr-1" /> Sessione attiva! Puoi procedere.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
