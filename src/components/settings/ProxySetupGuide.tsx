import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, RefreshCw, ClipboardPaste, Info } from "lucide-react";
import { useWcaSessionStatus } from "@/hooks/useWcaSessionStatus";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface WcaSessionCardProps {
  hasCredentials: boolean;
  onVerify: () => void;
  verifying: boolean;
}

export function ProxySetupGuide({
  hasCredentials,
  onVerify,
  verifying,
}: WcaSessionCardProps) {
  const { status, checkedAt } = useWcaSessionStatus();
  const [cookieInput, setCookieInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

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

  const handleSaveCookie = async () => {
    const cookie = cookieInput.trim();
    if (!cookie) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("save-wca-cookie", {
        body: { cookie },
      });
      if (error) throw error;
      if (data?.authenticated) {
        toast.success("✅ Cookie salvato e verificato!");
        setCookieInput("");
        setShowGuide(false);
      } else {
        toast.warning("⚠️ Cookie salvato ma verifica fallita. Copia l'header Cookie completo dal pannello Network.");
      }
      onVerify();
    } catch (err: any) {
      toast.error("Errore: " + (err.message || "Sconosciuto"));
    } finally {
      setSaving(false);
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

      {/* Primary action */}
      <Button
        onClick={() => setShowGuide(!showGuide)}
        className="w-full"
        variant={isOk ? "outline" : "default"}
        size="sm"
      >
        <ClipboardPaste className="w-4 h-4 mr-2" />
        {isOk ? "Aggiorna Cookie" : "Inserisci Cookie WCA"}
      </Button>

      {showGuide && (
        <div className="rounded-md border bg-muted/50 p-3 space-y-3">
          <div className="flex items-start gap-2">
            <Info className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
            <p className="text-xs font-medium">Copia il Cookie dal pannello Network</p>
          </div>
          <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Vai su <a href="https://www.wcaworld.com/MemberSection" target="_blank" rel="noopener noreferrer" className="underline text-primary">wcaworld.com</a> (devi essere loggato)</li>
            <li>Premi <kbd className="px-1 py-0.5 rounded bg-muted border text-[10px] font-mono">F12</kbd> → tab <strong>Network</strong> → ricarica pagina</li>
            <li>Clicca la prima richiesta → <strong>Headers → Cookie</strong></li>
            <li>Copia tutto il valore e incollalo qui sotto</li>
          </ol>
          <div className="flex gap-2">
            <Input
              placeholder="Incolla l'header Cookie completo..."
              value={cookieInput}
              onChange={(e) => setCookieInput(e.target.value)}
              className="font-mono text-[10px] h-8"
            />
            <Button
              size="sm"
              onClick={handleSaveCookie}
              disabled={saving || !cookieInput.trim()}
              className="shrink-0 h-8"
            >
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : "Salva"}
            </Button>
          </div>
        </div>
      )}

      {/* Verify session */}
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
        I cookie di sessione WCA sono HttpOnly e richiedono copia manuale dal pannello Network.
      </p>
    </div>
  );
}
