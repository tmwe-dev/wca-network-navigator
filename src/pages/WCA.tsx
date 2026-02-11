import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Loader2, CheckCircle2, XCircle, Globe,
  RefreshCw, ClipboardPaste, Info,
} from "lucide-react";
import { useWcaSessionStatus } from "@/hooks/useWcaSessionStatus";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export default function WCAIntegration() {
  const { status, checkedAt, triggerCheck } = useWcaSessionStatus();
  const [verifying, setVerifying] = useState(false);
  const [cookieInput, setCookieInput] = useState("");
  const [saving, setSaving] = useState(false);

  const isOk = status === "ok";

  const handleVerify = async () => {
    setVerifying(true);
    try {
      await triggerCheck();
      toast.success("Verifica completata!");
    } catch {
      toast.error("Errore durante la verifica");
    } finally {
      setVerifying(false);
    }
  };

  const handleSaveCookie = async () => {
    const cookie = cookieInput.trim();
    if (!cookie) {
      toast.error("Incolla il valore del cookie prima di salvare");
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("save-wca-cookie", {
        body: { cookie },
      });
      if (error) throw error;
      if (data?.authenticated) {
        toast.success("✅ Cookie salvato e verificato! Sessione attiva.");
        setCookieInput("");
      } else {
        toast.warning("⚠️ Cookie salvato ma la verifica è fallita. Assicurati di copiare l'header Cookie completo.");
      }
      triggerCheck();
    } catch (err: any) {
      toast.error("Errore: " + (err.message || "Sconosciuto"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 py-4">
      {/* Header + status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold text-foreground">WCA World</h1>
        </div>
        <Badge
          variant={isOk ? "default" : "destructive"}
          className={isOk ? "bg-emerald-600 hover:bg-emerald-700" : ""}
        >
          {isOk ? (
            <><CheckCircle2 className="w-3 h-3 mr-1" /> Connesso</>
          ) : (
            <><XCircle className="w-3 h-3 mr-1" /> Non connesso</>
          )}
        </Badge>
      </div>

      {/* Chrome Extension card */}
      <Card>
        <CardContent className="pt-6 space-y-6">
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <p className="text-sm font-medium text-foreground">
                Sincronizzazione automatica con Estensione Chrome
              </p>
            </div>
            <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
              <li>
                Scarica la cartella <strong>chrome-extension</strong> dal{" "}
                <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="underline text-primary">
                  repository GitHub
                </a>{" "}
                del progetto (cartella <code className="px-1 py-0.5 rounded bg-muted border text-xs">public/chrome-extension</code>)
              </li>
              <li>
                Apri Chrome → <strong>chrome://extensions</strong> → attiva <strong>Modalità sviluppatore</strong>
              </li>
              <li>
                Clicca <strong>"Carica estensione non pacchettizzata"</strong> e seleziona la cartella scaricata
              </li>
              <li>
                Accedi a{" "}
                <a href="https://www.wcaworld.com/MemberSection" target="_blank" rel="noopener noreferrer" className="underline text-primary">
                  wcaworld.com
                </a>, poi clicca l'icona dell'estensione → <strong>🔄 Sincronizza Cookie</strong>
              </li>
            </ol>
            <p className="text-xs text-muted-foreground mt-2">
              L'estensione legge i cookie HttpOnly (impossibili da catturare via JavaScript) e li invia direttamente al server. <strong>Un solo click!</strong>
            </p>
          </div>

          {/* Fallback: manual cookie input */}
          <details className="group">
            <summary className="text-sm font-medium cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
              ⚙️ Metodo alternativo (manuale)
            </summary>
            <div className="mt-3 space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Incolla qui il valore completo dell'header Cookie..."
                  value={cookieInput}
                  onChange={(e) => setCookieInput(e.target.value)}
                  className="font-mono text-xs"
                />
                <Button
                  onClick={handleSaveCookie}
                  disabled={saving || !cookieInput.trim()}
                  className="shrink-0"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ClipboardPaste className="w-4 h-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                F12 → Network → prima richiesta → Headers → Cookie → copia tutto il valore.
              </p>
            </div>
          </details>

          {/* Verify */}
          <Button onClick={handleVerify} disabled={verifying} variant="outline" className="w-full">
            {verifying ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            {verifying ? "Verifica..." : "Verifica Sessione"}
          </Button>

          {/* Last check */}
          {checkedAt && (
            <p className="text-xs text-center text-muted-foreground">
              Ultimo controllo: {new Date(checkedAt).toLocaleString("it-IT")}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
