import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Loader2, CheckCircle2, XCircle, Globe, Terminal, Copy, Check,
  RefreshCw, Cookie, Shield, KeyRound,
} from "lucide-react";
import { useWcaSessionStatus } from "@/hooks/useWcaSessionStatus";
import { useAppSettings, useUpdateSetting } from "@/hooks/useAppSettings";
import { toast } from "sonner";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const SNIPPET = `fetch('${SUPABASE_URL}/functions/v1/save-wca-cookie',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cookie:document.cookie})}).then(r=>r.json()).then(d=>alert(d.message||'Done!')).catch(e=>alert('Errore: '+e.message))`;

export default function WCAIntegration() {
  const { status, checkedAt, triggerCheck } = useWcaSessionStatus();
  const { data: settings } = useAppSettings();
  const updateSetting = useUpdateSetting();

  const [copied, setCopied] = useState(false);
  const [showSnippet, setShowSnippet] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [manualCookie, setManualCookie] = useState("");
  const [savingCookie, setSavingCookie] = useState(false);

  const isOk = status === "ok";
  const hasCookie = !!settings?.["wca_session_cookie"];

  const statusLabel = isOk
    ? "Sessione attiva"
    : status === "expired"
    ? "Sessione scaduta"
    : status === "no_cookie"
    ? "Nessun cookie salvato"
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

  const handleSaveManualCookie = async () => {
    if (!manualCookie.trim()) return;
    setSavingCookie(true);
    try {
      await updateSetting.mutateAsync({ key: "wca_session_cookie", value: manualCookie.trim() });
      toast.success("Cookie salvato, verifica in corso...");
      await triggerCheck();
      setManualCookie("");
    } catch {
      toast.error("Errore nel salvataggio");
    } finally {
      setSavingCookie(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Globe className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">WCA World — Sessione</h1>
        </div>
        <Badge
          variant={isOk ? "default" : "destructive"}
          className={isOk ? "bg-emerald-600 hover:bg-emerald-700" : ""}
        >
          {isOk ? (
            <><CheckCircle2 className="w-3 h-3 mr-1" /> Connesso</>
          ) : (
            <><XCircle className="w-3 h-3 mr-1" /> {statusLabel}</>
          )}
        </Badge>
      </div>

      {/* Status cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${isOk ? "bg-emerald-500/10" : "bg-destructive/10"}`}>
                <span className={`block w-3 h-3 rounded-full ${isOk ? "bg-emerald-500" : "bg-destructive"}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Stato</p>
                <p className={`text-lg font-bold ${isOk ? "text-emerald-500" : "text-destructive"}`}>
                  {statusLabel}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Cookie className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Cookie</p>
                <p className="text-lg font-bold">{hasCookie ? "Presente" : "Mancante"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <RefreshCw className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ultimo controllo</p>
                <p className="text-lg font-bold">
                  {checkedAt ? new Date(checkedAt).toLocaleString("it-IT") : "—"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Primary action: Cookie capture */}
      <Card className={`border-2 ${isOk ? "border-emerald-500/30" : "border-amber-500/50"}`}>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <KeyRound className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <CardTitle className="text-lg">
                {isOk ? "Rinnova Sessione" : "Cattura Cookie dal Browser"}
              </CardTitle>
              <CardDescription>
                Sincronizza la tua sessione WCA attiva con il sistema in 30 secondi
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={() => setShowSnippet(!showSnippet)}
            className="w-full"
            variant={isOk ? "outline" : "default"}
          >
            <Terminal className="w-4 h-4 mr-2" />
            {showSnippet ? "Nascondi istruzioni" : isOk ? "Rinnova Cookie" : "Cattura Cookie dal Browser"}
          </Button>

          {showSnippet && (
            <div className="rounded-md border bg-muted/50 p-4 space-y-3">
              <p className="text-sm font-medium">Procedura (30 secondi):</p>
              <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                <li>
                  Vai su{" "}
                  <a
                    href="https://www.wcaworld.com/MemberSection"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline text-primary font-medium"
                  >
                    wcaworld.com
                  </a>{" "}
                  (devi essere loggato)
                </li>
                <li>
                  Premi{" "}
                  <kbd className="px-1.5 py-0.5 rounded bg-muted border text-xs font-mono">F12</kbd>{" "}
                  → apri la tab <strong>Console</strong>
                </li>
                <li>Copia il codice qui sotto e incollalo nella console</li>
                <li>
                  Premi{" "}
                  <kbd className="px-1.5 py-0.5 rounded bg-muted border text-xs font-mono">Invio</kbd>
                  {" "}— vedrai un messaggio "Cookie salvato!"
                </li>
              </ol>

              <div className="relative">
                <pre className="text-xs font-mono bg-background border rounded p-3 overflow-x-auto whitespace-pre-wrap break-all select-all">
                  {SNIPPET}
                </pre>
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute top-2 right-2 h-7 w-7"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                Il semaforo si aggiornerà automaticamente dopo l'esecuzione del codice.
              </p>
            </div>
          )}

          {/* Verify button */}
          <Button onClick={handleVerify} disabled={verifying} variant="outline" className="w-full">
            {verifying ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            {verifying ? "Verifica in corso..." : "Verifica Sessione"}
          </Button>
        </CardContent>
      </Card>

      {/* Manual cookie fallback */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Cookie className="w-5 h-5 text-amber-500" />
            Inserimento Cookie Manuale
          </CardTitle>
          <CardDescription>
            In alternativa, incolla il valore del cookie <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">.ASPXAUTH</code> copiato dai DevTools del browser
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Cookie completo</Label>
            <Textarea
              value={manualCookie}
              onChange={(e) => setManualCookie(e.target.value)}
              placeholder=".ASPXAUTH=valore_copiato_da_devtools..."
              className="font-mono text-xs min-h-[80px]"
            />
          </div>
          <Button
            onClick={handleSaveManualCookie}
            disabled={savingCookie || !manualCookie.trim()}
            variant="outline"
            className="w-full"
          >
            {savingCookie ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Shield className="w-4 h-4 mr-2" />
            )}
            Salva Cookie Manualmente
          </Button>
        </CardContent>
      </Card>

      {/* Info */}
      <div className="text-center text-xs text-muted-foreground space-y-1">
        <p>Il cookie viene catturato dalla tua sessione browser su wcaworld.com e salvato nel sistema.</p>
        <p>Quando scade (ogni pochi giorni), basta ripetere la procedura.</p>
      </div>
    </div>
  );
}
