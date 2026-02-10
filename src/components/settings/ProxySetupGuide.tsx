import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Copy, Check, Terminal } from "lucide-react";
import { useWcaSessionStatus } from "@/hooks/useWcaSessionStatus";
import { toast } from "sonner";

interface WcaSessionCardProps {
  hasCredentials: boolean;
  onVerify: () => void;
  verifying: boolean;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const SNIPPET = `fetch('${SUPABASE_URL}/functions/v1/save-wca-cookie',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cookie:document.cookie})}).then(r=>r.json()).then(d=>alert(d.message||'Done!')).catch(e=>alert('Errore: '+e.message))`;

export function ProxySetupGuide({
  hasCredentials,
  onVerify,
  verifying,
}: WcaSessionCardProps) {
  const { status, checkedAt } = useWcaSessionStatus();
  const [copied, setCopied] = useState(false);
  const [showSnippet, setShowSnippet] = useState(false);

  const isOk = status === "ok";
  const statusLabel = isOk
    ? "Sessione attiva"
    : status === "expired"
    ? "Sessione scaduta"
    : status === "no_cookie"
    ? "Nessun cookie"
    : status === "checking"
    ? "Verifica in corso..."
    : "Errore";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(SNIPPET);
      setCopied(true);
      toast.success("Codice copiato! Ora incollalo nella console di wcaworld.com");
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast.error("Impossibile copiare, seleziona il testo manualmente");
    }
  };

  return (
    <div className="rounded-lg border bg-background p-4 space-y-3">
      {/* Status indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`w-3 h-3 rounded-full ${isOk ? "bg-emerald-500" : "bg-destructive"}`} />
          <div>
            <p className="text-sm font-medium">{statusLabel}</p>
            {checkedAt && (
              <p className="text-xs text-muted-foreground">
                Ultimo controllo: {new Date(checkedAt).toLocaleString("it-IT")}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Primary action: Capture cookie */}
      <Button
        onClick={() => setShowSnippet(!showSnippet)}
        className="w-full"
        variant={isOk ? "outline" : "default"}
        size="sm"
      >
        <Terminal className="w-4 h-4 mr-2" />
        {isOk ? "Rinnova Cookie dal Browser" : "Cattura Cookie dal Browser"}
      </Button>

      {showSnippet && (
        <div className="rounded-md border bg-muted/50 p-3 space-y-2">
          <p className="text-xs font-medium">Procedura (30 secondi):</p>
          <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Vai su <a href="https://www.wcaworld.com/MemberSection" target="_blank" rel="noopener noreferrer" className="underline text-primary">wcaworld.com</a> (devi essere loggato)</li>
            <li>Premi <kbd className="px-1 py-0.5 rounded bg-muted border text-[10px] font-mono">F12</kbd> → apri la tab <strong>Console</strong></li>
            <li>Incolla il codice qui sotto e premi <kbd className="px-1 py-0.5 rounded bg-muted border text-[10px] font-mono">Invio</kbd></li>
          </ol>
          <div className="relative">
            <pre className="text-[10px] font-mono bg-background border rounded p-2 overflow-x-auto whitespace-pre-wrap break-all select-all">
              {SNIPPET}
            </pre>
            <Button
              size="icon"
              variant="ghost"
              className="absolute top-1 right-1 h-6 w-6"
              onClick={handleCopy}
            >
              {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Vedrai un messaggio di conferma. Il semaforo si aggiornerà automaticamente.
          </p>
        </div>
      )}

      {/* Secondary: verify session */}
      <Button
        onClick={onVerify}
        disabled={verifying}
        variant="outline"
        className="w-full"
        size="sm"
      >
        {verifying ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <RefreshCw className="w-4 h-4 mr-2" />
        )}
        {verifying ? "Verifica in corso..." : "Ricontrolla Sessione"}
      </Button>

      <p className="text-xs text-muted-foreground text-center">
        Il cookie viene catturato dalla tua sessione browser su wcaworld.com e salvato nel sistema.
      </p>
    </div>
  );
}
