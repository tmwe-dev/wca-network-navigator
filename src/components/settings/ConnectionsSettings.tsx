import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Save, Loader2, CheckCircle2, Globe, RefreshCw, ExternalLink,
  ClipboardPaste, XCircle, Download, KeyRound, Eye, EyeOff, Mail,
  Linkedin, ShieldAlert, MessageCircle, Bot, Phone, Wifi, WifiOff, Zap,
} from "lucide-react";
import { useLinkedInExtensionBridge } from "@/hooks/useLinkedInExtensionBridge";
import { useWhatsAppExtensionBridge } from "@/hooks/useWhatsAppExtensionBridge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useWcaSession } from "@/hooks/useWcaSession";
import BlacklistManager from "@/components/settings/BlacklistManager";

interface ConnectionsSettingsProps {
  settings: Record<string, string> | undefined;
  updateSetting: any;
}

export function ConnectionsSettings({ settings, updateSetting }: ConnectionsSettingsProps) {
  const { isSessionActive, ensureSession } = useWcaSession();
  const liExt = useLinkedInExtensionBridge();
  const waExt = useWhatsAppExtensionBridge();
  const isWcaOk = isSessionActive === true;

  const [verifying, setVerifying] = useState(false);
  const [cookieInput, setCookieInput] = useState("");
  const [savingCookie, setSavingCookie] = useState(false);

  const [wcaUser, setWcaUser] = useState("");
  const [wcaPass, setWcaPass] = useState("");
  const [showWcaPass, setShowWcaPass] = useState(false);
  const [savingWcaCreds, setSavingWcaCreds] = useState(false);

  const [liEmail, setLiEmail] = useState("");
  const [liPass, setLiPass] = useState("");
  const [showLiPass, setShowLiPass] = useState(false);
  const [savingLiCreds, setSavingLiCreds] = useState(false);
  const [liAtCookie, setLiAtCookie] = useState("");
  const [showLiAt, setShowLiAt] = useState(false);
  const [savingLi, setSavingLi] = useState(false);

  const [connectingAll, setConnectingAll] = useState(false);

  // Derived states
  const liHasCreds = !!(liEmail && liPass) || !!(settings?.["linkedin_li_at"]);
  const liConnected = liExt.isAvailable || liHasCreds;
  const waConnected = waExt.isAvailable;

  useEffect(() => {
    async function loadWcaCreds() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("user_wca_credentials")
        .select("wca_username, wca_password")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setWcaUser(data.wca_username || "");
        setWcaPass(data.wca_password || "");
      }
    }
    loadWcaCreds();
  }, []);

  useEffect(() => {
    if (settings) {
      setLiAtCookie(settings["linkedin_li_at"] || "");
      setLiEmail(settings["linkedin_email"] || "");
      setLiPass(settings["linkedin_password"] || "");
    }
  }, [settings]);

  const handleSaveWcaCreds = async () => {
    setSavingWcaCreds(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non autenticato");
      const { data: existing } = await supabase.from("user_wca_credentials").select("id").eq("user_id", user.id).maybeSingle();
      if (existing) {
        const { error } = await supabase.from("user_wca_credentials").update({ wca_username: wcaUser.trim(), wca_password: wcaPass.trim(), updated_at: new Date().toISOString() }).eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("user_wca_credentials").insert({ user_id: user.id, wca_username: wcaUser.trim(), wca_password: wcaPass.trim() });
        if (error) throw error;
      }
      toast.success("Credenziali WCA salvate!");
    } catch (e: any) { toast.error("Errore: " + (e.message || "Sconosciuto")); }
    finally { setSavingWcaCreds(false); }
  };

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const ok = await ensureSession();
      toast.success(ok ? "Sessione attiva!" : "Sessione non attiva");
    } catch { toast.error("Errore durante la verifica"); }
    finally { setVerifying(false); }
  };

  const handleSaveCookie = async () => {
    const cookie = cookieInput.trim();
    if (!cookie) return;
    setSavingCookie(true);
    try {
      const { data, error } = await supabase.functions.invoke("save-wca-cookie", { body: { cookie } });
      if (error) throw error;
      if (data?.authenticated) { toast.success("Cookie salvato e verificato!"); setCookieInput(""); }
      else toast.warning("Cookie salvato ma la verifica è fallita.");
      ensureSession();
    } catch (err: any) { toast.error("Errore: " + (err.message || "Sconosciuto")); }
    finally { setSavingCookie(false); }
  };

  const handleConnectAll = async () => {
    setConnectingAll(true);
    const results: string[] = [];

    // LinkedIn
    if (liExt.isAvailable) {
      const res = await liExt.verifySession();
      results.push(res.success ? "✅ LinkedIn" : "⚠️ LinkedIn (sessione scaduta)");
    } else if (liHasCreds) {
      results.push("✅ LinkedIn (credenziali salvate)");
    } else {
      results.push("❌ LinkedIn (configura credenziali)");
    }

    // WhatsApp
    if (waExt.isAvailable) {
      const res = await waExt.verifySession();
      results.push(res.success ? "✅ WhatsApp" : "⚠️ WhatsApp (sessione scaduta)");
    } else {
      results.push("❌ WhatsApp (estensione non rilevata)");
    }

    // AI
    results.push("✅ AI Agent");

    // Persist
    try {
      await updateSetting.mutateAsync({ key: "linkedin_connected", value: String(liConnected) });
      await updateSetting.mutateAsync({ key: "whatsapp_connected", value: String(waConnected) });
    } catch {}

    toast.success(results.join(" · "));
    setConnectingAll(false);
  };

  return (
    <Tabs defaultValue="canali" className="space-y-4">
      <TabsList className="w-full justify-start flex-wrap">
        <TabsTrigger value="canali" className="gap-1.5 text-xs">
          <Wifi className="w-3.5 h-3.5" /> Canali
        </TabsTrigger>
        <TabsTrigger value="estensioni" className="gap-1.5 text-xs">
          <Download className="w-3.5 h-3.5" /> Estensioni
        </TabsTrigger>
        <TabsTrigger value="wca" className="gap-1.5 text-xs">
          <Globe className="w-3.5 h-3.5" /> WCA
        </TabsTrigger>
        <TabsTrigger value="linkedin" className="gap-1.5 text-xs">
          <Linkedin className="w-3.5 h-3.5" /> LinkedIn
        </TabsTrigger>
        <TabsTrigger value="blacklist" className="gap-1.5 text-xs">
          <ShieldAlert className="w-3.5 h-3.5" /> Blacklist
        </TabsTrigger>
      </TabsList>

      {/* Canali di Comunicazione */}
      <TabsContent value="canali" className="m-0 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Canali di Comunicazione</h2>
            <p className="text-sm text-muted-foreground">Stato delle connessioni per l'invio automatico.</p>
          </div>
          <Button onClick={handleConnectAll} disabled={connectingAll} size="sm" className="gap-1.5">
            {connectingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            Connetti Tutto
          </Button>
        </div>

        {/* WhatsApp */}
        <Card>
          <CardContent className="pt-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <MessageCircle className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="font-medium text-sm">WhatsApp</p>
                  <p className="text-xs text-muted-foreground">Invio messaggi via estensione Chrome</p>
                </div>
              </div>
              <Badge variant={waConnected ? "default" : "secondary"} className={waConnected ? "bg-emerald-600 text-white" : ""}>
                {waConnected
                  ? <><CheckCircle2 className="w-3 h-3 mr-1" /> Connesso</>
                  : <><WifiOff className="w-3 h-3 mr-1" /> Non rilevato</>}
              </Badge>
            </div>
            {waConnected && (
              <Button variant="outline" size="sm" onClick={async () => {
                const res = await waExt.verifySession();
                toast[res.success ? "success" : "error"](res.success ? "Sessione WhatsApp verificata!" : "Sessione WhatsApp non attiva");
              }}>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Verifica Sessione
              </Button>
            )}
            {!waConnected && (
              <details className="group">
                <summary className="text-xs cursor-pointer text-muted-foreground hover:text-foreground">
                  ⚙️ Setup avanzato (estensione Chrome)
                </summary>
                <div className="mt-2 space-y-2 p-3 rounded-lg bg-muted/50 border border-border">
                  <Button variant="outline" size="sm" onClick={() => {
                    fetch("/whatsapp-extension.zip")
                      .then(r => { if (!r.ok) throw new Error("Download failed"); return r.blob(); })
                      .then(blob => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "whatsapp-extension.zip"; a.click(); URL.revokeObjectURL(a.href); })
                      .catch(() => toast.error("File non disponibile"));
                  }}>
                    <Download className="w-3.5 h-3.5 mr-1.5" /> Scarica Estensione
                  </Button>
                  <ol className="text-[11px] text-muted-foreground list-decimal list-inside space-y-0.5">
                    <li>Decomprimi il file ZIP</li>
                    <li>Apri <code className="font-mono bg-muted px-1 rounded">chrome://extensions</code></li>
                    <li>Attiva <strong>Modalità sviluppatore</strong></li>
                    <li>Clicca <strong>Carica estensione non pacchettizzata</strong></li>
                  </ol>
                </div>
              </details>
            )}
          </CardContent>
        </Card>

        {/* LinkedIn */}
        <Card>
          <CardContent className="pt-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[#0A66C2]/10">
                  <Linkedin className="w-5 h-5 text-[#0A66C2]" />
                </div>
                <div>
                  <p className="font-medium text-sm">LinkedIn</p>
                  <p className="text-xs text-muted-foreground">
                    {liHasCreds ? "Credenziali configurate" : "Configura nel tab LinkedIn"}
                  </p>
                </div>
              </div>
              <Badge variant={liConnected ? "default" : "secondary"} className={liConnected ? "bg-emerald-600 text-white" : ""}>
                {liConnected
                  ? <><CheckCircle2 className="w-3 h-3 mr-1" /> {liExt.isAvailable ? "Connesso" : "Configurato"}</>
                  : <><WifiOff className="w-3 h-3 mr-1" /> Non configurato</>}
              </Badge>
            </div>
            {liExt.isAvailable && (
              <Button variant="outline" size="sm" onClick={async () => {
                const res = await liExt.verifySession();
                toast[res.success ? "success" : "error"](res.success ? "Sessione LinkedIn verificata!" : "Sessione LinkedIn non attiva");
              }}>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Verifica Sessione
              </Button>
            )}
            {!liExt.isAvailable && !liHasCreds && (
              <details className="group">
                <summary className="text-xs cursor-pointer text-muted-foreground hover:text-foreground">
                  ⚙️ Setup avanzato (estensione Chrome)
                </summary>
                <div className="mt-2 space-y-2 p-3 rounded-lg bg-muted/50 border border-border">
                  <Button variant="outline" size="sm" onClick={() => {
                    fetch("/linkedin-extension.zip")
                      .then(r => { if (!r.ok) throw new Error("Download failed"); return r.blob(); })
                      .then(blob => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "linkedin-extension.zip"; a.click(); URL.revokeObjectURL(a.href); })
                      .catch(() => toast.error("File non disponibile"));
                  }}>
                    <Download className="w-3.5 h-3.5 mr-1.5" /> Scarica Estensione
                  </Button>
                </div>
              </details>
            )}
          </CardContent>
        </Card>

        {/* AI Agent */}
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Bot className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">AI Agent</p>
                  <p className="text-xs text-muted-foreground">Engine di generazione outreach e analisi</p>
                </div>
              </div>
              <Badge className="bg-emerald-600 text-white">
                <CheckCircle2 className="w-3 h-3 mr-1" /> Attivo
              </Badge>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Estensioni Chrome */}
      <TabsContent value="estensioni" className="m-0 space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Estensioni Chrome</h2>
          <p className="text-sm text-muted-foreground">Scarica e installa le estensioni per abilitare i canali di comunicazione.</p>
        </div>

        <div className="p-3 rounded-lg bg-muted/50 border border-border space-y-1">
          <p className="text-xs font-medium">Istruzioni di installazione:</p>
          <ol className="text-[11px] text-muted-foreground list-decimal list-inside space-y-0.5">
            <li>Scarica lo ZIP dell'estensione</li>
            <li>Decomprimi il file</li>
            <li>Apri <code className="font-mono bg-muted px-1 rounded">chrome://extensions</code></li>
            <li>Attiva <strong>Modalità sviluppatore</strong> (toggle in alto a destra)</li>
            <li>Clicca <strong>Carica estensione non pacchettizzata</strong> e seleziona la cartella</li>
            <li>Ricarica questa pagina</li>
          </ol>
        </div>

        {/* Partner Connect */}
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Zap className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">Partner Connect</p>
                  <p className="text-xs text-muted-foreground">Scraping, Deep Search, Hydra Memory</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => {
                fetch("/partner-connect-extension.zip")
                  .then(r => { if (!r.ok) throw new Error("Download failed"); return r.blob(); })
                  .then(blob => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "partner-connect-extension.zip"; a.click(); URL.revokeObjectURL(a.href); toast.success("Partner Connect scaricato!"); })
                  .catch(() => toast.error("File non disponibile"));
              }}>
                <Download className="w-3.5 h-3.5 mr-1.5" /> Scarica ZIP
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* WhatsApp */}
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <MessageCircle className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="font-medium text-sm">WhatsApp Direct Send</p>
                  <p className="text-xs text-muted-foreground">Invio automatico messaggi WhatsApp</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => {
                fetch("/whatsapp-extension.zip")
                  .then(r => { if (!r.ok) throw new Error("Download failed"); return r.blob(); })
                  .then(blob => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "whatsapp-extension.zip"; a.click(); URL.revokeObjectURL(a.href); toast.success("WhatsApp extension scaricata!"); })
                  .catch(() => toast.error("File non disponibile — pacchettizzazione necessaria"));
              }}>
                <Download className="w-3.5 h-3.5 mr-1.5" /> Scarica ZIP
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* LinkedIn */}
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[#0A66C2]/10">
                  <Linkedin className="w-5 h-5 text-[#0A66C2]" />
                </div>
                <div>
                  <p className="font-medium text-sm">LinkedIn Cookie Sync</p>
                  <p className="text-xs text-muted-foreground">Login automatico e invio messaggi LinkedIn</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => {
                fetch("/linkedin-extension.zip")
                  .then(r => { if (!r.ok) throw new Error("Download failed"); return r.blob(); })
                  .then(blob => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "linkedin-extension.zip"; a.click(); URL.revokeObjectURL(a.href); toast.success("LinkedIn extension scaricata!"); })
                  .catch(() => toast.error("File non disponibile — pacchettizzazione necessaria"));
              }}>
                <Download className="w-3.5 h-3.5 mr-1.5" /> Scarica ZIP
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="wca" className="m-0 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Connessione WCA World</h2>
          </div>
          <Badge variant={isWcaOk ? "default" : "destructive"} className={isWcaOk ? "bg-primary text-primary-foreground" : ""}>
            {isWcaOk ? <><CheckCircle2 className="w-3 h-3 mr-1" /> Connesso</> : <><XCircle className="w-3 h-3 mr-1" /> Non connesso</>}
          </Badge>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <KeyRound className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">Login Automatico WCA</CardTitle>
                  <CardDescription>Connessione gestita da Claude Engine V8 via wca-app</CardDescription>
                </div>
              </div>
              <Badge variant={isWcaOk ? "default" : "secondary"} className={isWcaOk ? "bg-emerald-600 text-white" : ""}>
                {isWcaOk ? <><CheckCircle2 className="w-3 h-3 mr-1" /> Automatico</> : "Da verificare"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Le credenziali WCA sono gestite automaticamente lato server. Non devi inserire username o password.
              Il sistema effettua il login SSO tramite <code className="font-mono bg-muted px-1 rounded text-xs">wca-app.vercel.app</code>.
            </p>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <span className="text-sm">🤖</span>
              <span className="text-xs text-amber-700 dark:text-amber-300">Claude Engine V8 — Login server-side, cache 8 min</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 space-y-3">
            <Button onClick={handleVerify} disabled={verifying} variant="outline" className="w-full">
              {verifying ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              {verifying ? "Verifica..." : "Verifica Sessione"}
            </Button>
          </CardContent>
        </Card>

        <details className="group">
          <summary className="text-xs font-medium cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
            ⚙️ Avanzate (cookie manuale, link diretto)
          </summary>
          <div className="mt-3 space-y-3">
            <Card>
              <CardContent className="pt-4 space-y-3">
                <Button className="w-full" variant="outline" size="sm" onClick={() => window.open("https://www.wcaworld.com/MemberSection", "_blank")}>
                  <ExternalLink className="w-4 h-4 mr-2" /> Apri WCA World
                </Button>
                <div className="flex gap-2">
                  <Input placeholder="Incolla header Cookie completo..." value={cookieInput} onChange={(e) => setCookieInput(e.target.value)} className="font-mono text-xs" />
                  <Button onClick={handleSaveCookie} disabled={savingCookie || !cookieInput.trim()} size="sm" className="shrink-0">
                    {savingCookie ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardPaste className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">Emergenza: F12 → Network → Headers → Cookie → incolla qui.</p>
              </CardContent>
            </Card>
          </div>
        </details>
      </TabsContent>

      {/* LinkedIn */}
      <TabsContent value="linkedin" className="m-0 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Linkedin className="w-5 h-5 text-[#0A66C2]" />
            <h2 className="text-lg font-semibold">LinkedIn</h2>
          </div>
          <Badge variant={liHasCreds ? "default" : "secondary"} className={liHasCreds ? "bg-primary text-primary-foreground" : ""}>
            {liHasCreds ? <><CheckCircle2 className="w-3 h-3 mr-1" /> Configurato</> : "Non configurato"}
          </Badge>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#0A66C2]/10">
                <Mail className="w-5 h-5 text-[#0A66C2]" />
              </div>
              <div>
                <CardTitle className="text-base">Credenziali LinkedIn</CardTitle>
                <CardDescription>Email e password per l'auto-login dell'estensione</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Email LinkedIn</Label>
              <Input value={liEmail} onChange={(e) => setLiEmail(e.target.value)} placeholder="email@example.com" />
            </div>
            <div className="space-y-2">
              <Label>Password LinkedIn</Label>
              <div className="relative">
                <Input type={showLiPass ? "text" : "password"} value={liPass} onChange={(e) => setLiPass(e.target.value)} placeholder="••••••••" className="pr-10" />
                <button type="button" onClick={() => setShowLiPass((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showLiPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <Button
              onClick={async () => {
                setSavingLiCreds(true);
                try {
                  await updateSetting.mutateAsync({ key: "linkedin_email", value: liEmail.trim() });
                  await updateSetting.mutateAsync({ key: "linkedin_password", value: liPass.trim() });
                  toast.success("Credenziali LinkedIn salvate!");
                } catch { toast.error("Errore nel salvataggio"); }
                finally { setSavingLiCreds(false); }
              }}
              disabled={savingLiCreds || !liEmail.trim() || !liPass.trim()}
            >
              {savingLiCreds ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Salva Credenziali LinkedIn
            </Button>
          </CardContent>
        </Card>

        <details className="group">
          <summary className="text-xs font-medium cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
            ⚙️ Avanzate (estensione Chrome, cookie li_at manuale)
          </summary>
          <div className="mt-3 space-y-3">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <Button className="w-full" size="sm" variant="outline" onClick={() => {
                  fetch("/linkedin-extension.zip")
                    .then(r => { if (!r.ok) throw new Error("Download failed"); return r.blob(); })
                    .then(blob => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "linkedin-extension.zip"; a.click(); URL.revokeObjectURL(a.href); })
                    .catch(() => toast.error("File non disponibile"));
                }}>
                  <Download className="w-4 h-4 mr-2" /> Scarica Estensione LinkedIn
                </Button>
                <p className="text-[11px] text-muted-foreground text-center">
                  Chrome → chrome://extensions/ → Modalità sviluppatore → Carica estensione
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[#0A66C2]/10">
                    <KeyRound className="w-5 h-5 text-[#0A66C2]" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Cookie di Sessione (li_at)</CardTitle>
                    <CardDescription>Inserimento manuale del cookie per la Deep Search</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Cookie li_at</Label>
                  <div className="relative">
                    <Input
                      type={showLiAt ? "text" : "password"}
                      value={liAtCookie}
                      onChange={(e) => setLiAtCookie(e.target.value)}
                      placeholder="AQEDAx..."
                      className="pr-10 font-mono text-xs"
                    />
                    <button type="button" onClick={() => setShowLiAt((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showLiAt ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <Button
                  onClick={async () => {
                    if (!liAtCookie.trim()) return;
                    setSavingLi(true);
                    try {
                      await updateSetting.mutateAsync({ key: "linkedin_li_at", value: liAtCookie.trim() });
                      toast.success("Cookie LinkedIn salvato!");
                    } catch { toast.error("Errore nel salvataggio"); }
                    finally { setSavingLi(false); }
                  }}
                  disabled={savingLi || !liAtCookie.trim()}
                >
                  {savingLi ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Salva Cookie LinkedIn
                </Button>
              </CardContent>
            </Card>
          </div>
        </details>
      </TabsContent>

      {/* Blacklist */}
      <TabsContent value="blacklist" className="m-0">
        <BlacklistManager />
      </TabsContent>
    </Tabs>
  );
}
