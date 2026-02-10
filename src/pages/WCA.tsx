import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Loader2, CheckCircle2, XCircle, Globe, Terminal, Copy, Check,
  RefreshCw, Cookie, Shield, KeyRound, Bookmark, ChevronDown,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useWcaSessionStatus } from "@/hooks/useWcaSessionStatus";
import { useAppSettings, useUpdateSetting } from "@/hooks/useAppSettings";
import { toast } from "sonner";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const BOOKMARKLET = `javascript:void(fetch('${SUPABASE_URL}/functions/v1/save-wca-cookie',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cookie:document.cookie})}).then(r=>r.json()).then(d=>alert(d.message||'Done!')).catch(e=>alert('Errore: '+e.message)))`;

const SNIPPET = `fetch('${SUPABASE_URL}/functions/v1/save-wca-cookie',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cookie:document.cookie})}).then(r=>r.json()).then(d=>alert(d.message||'Done!')).catch(e=>alert('Errore: '+e.message))`;

export default function WCAIntegration() {
  const { status, checkedAt, triggerCheck } = useWcaSessionStatus();
  const { data: settings } = useAppSettings();
  const updateSetting = useUpdateSetting();

  const [copied, setCopied] = useState(false);
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
      toast.success("Codice copiato!");
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast.error("Impossibile copiare");
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

      {/* PRIMARY: Bookmarklet */}
      <Card className={`border-2 ${isOk ? "border-emerald-500/30" : "border-primary/50"}`}>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Bookmark className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Cattura Cookie — Un Click</CardTitle>
              <CardDescription>
                Trascina il bottone nei preferiti, poi cliccalo quando sei su wcaworld.com
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Draggable bookmarklet */}
          <div className="flex flex-col items-center gap-4 p-6 rounded-lg border-2 border-dashed border-primary/30 bg-primary/5">
            <p className="text-sm font-medium text-muted-foreground">
              ↓ Trascina questo bottone nella barra dei preferiti ↓
            </p>
            <a
              href={BOOKMARKLET}
              onClick={(e) => e.preventDefault()}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-semibold text-base shadow-lg hover:bg-primary/90 cursor-grab active:cursor-grabbing select-none"
              draggable
            >
              <Bookmark className="w-5 h-5" />
              📡 Cattura WCA
            </a>
            <p className="text-xs text-muted-foreground text-center max-w-md">
              Non cliccare qui — trascinalo nella barra dei preferiti del browser!
            </p>
          </div>

          {/* Instructions */}
          <div className="rounded-md border bg-muted/50 p-4">
            <p className="text-sm font-medium mb-3">Come funziona:</p>
            <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
              <li>
                <strong>Una volta sola:</strong> trascina il bottone{" "}
                <span className="font-semibold text-primary">"📡 Cattura WCA"</span>{" "}
                nella barra dei preferiti
              </li>
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
                e fai login
              </li>
              <li>
                Clicca il bookmark <strong>"📡 Cattura WCA"</strong> dalla barra dei preferiti
              </li>
              <li>
                Vedrai un messaggio <strong>"Cookie salvato!"</strong> — fatto!
              </li>
            </ol>
          </div>

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

      {/* FALLBACK 1: Console snippet */}
      <Collapsible>
        <Card className="bg-card border-border">
          <CollapsibleTrigger className="w-full">
            <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Terminal className="w-5 h-5 text-muted-foreground" />
                  Metodo alternativo: Console del browser
                </CardTitle>
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-3">
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
                  (loggato)
                </li>
                <li>
                  Premi{" "}
                  <kbd className="px-1.5 py-0.5 rounded bg-muted border text-xs font-mono">F12</kbd>{" "}
                  → tab <strong>Console</strong>
                </li>
                <li>Incolla il codice e premi Invio</li>
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
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* FALLBACK 2: Manual cookie */}
      <Collapsible>
        <Card className="bg-card border-border">
          <CollapsibleTrigger className="w-full">
            <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Cookie className="w-5 h-5 text-muted-foreground" />
                  Metodo alternativo: Cookie manuale
                </CardTitle>
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              <CardDescription>
                Incolla il valore del cookie{" "}
                <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">.ASPXAUTH</code>{" "}
                copiato dai DevTools
              </CardDescription>
              <div className="space-y-2">
                <Label>Cookie completo</Label>
                <Textarea
                  value={manualCookie}
                  onChange={(e) => setManualCookie(e.target.value)}
                  placeholder=".ASPXAUTH=valore_copiato..."
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
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Info */}
      <div className="text-center text-xs text-muted-foreground space-y-1">
        <p>Quando il cookie scade (ogni pochi giorni), clicca di nuovo il bookmark su wcaworld.com.</p>
      </div>
    </div>
  );
}
