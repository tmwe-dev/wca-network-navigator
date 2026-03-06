import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Save, Loader2, CheckCircle2, Globe, RefreshCw, ExternalLink,
  ClipboardPaste, XCircle, Download, KeyRound, Eye, EyeOff, Mail,
  Linkedin,
} from "lucide-react";
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

  useEffect(() => {
    if (settings) {
      setWcaUser(settings["wca_username"] || "");
      setWcaPass(settings["wca_password"] || "");
      setLiAtCookie(settings["linkedin_li_at"] || "");
      setLiEmail(settings["linkedin_email"] || "");
      setLiPass(settings["linkedin_password"] || "");
    }
  }, [settings]);

  const handleSaveWcaCreds = async () => {
    setSavingWcaCreds(true);
    try {
      await updateSetting.mutateAsync({ key: "wca_username", value: wcaUser.trim() });
      await updateSetting.mutateAsync({ key: "wca_password", value: wcaPass.trim() });
      toast.success("Credenziali WCA salvate!");
    } catch { toast.error("Errore nel salvataggio"); }
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

  return (
    <div className="space-y-4">
      {/* WCA Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Connessione WCA World</h2>
        </div>
        <Badge variant={isWcaOk ? "default" : "destructive"} className={isWcaOk ? "bg-primary text-primary-foreground" : ""}>
          {isWcaOk ? <><CheckCircle2 className="w-3 h-3 mr-1" /> Connesso</> : <><XCircle className="w-3 h-3 mr-1" /> Non connesso</>}
        </Badge>
      </div>

      {/* WCA Credentials */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <KeyRound className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Credenziali Auto-Login</CardTitle>
                <CardDescription>Username e password per il login automatico WCA</CardDescription>
              </div>
            </div>
            <Badge variant={wcaUser && wcaPass ? "default" : "secondary"} className={wcaUser && wcaPass ? "bg-primary text-primary-foreground" : ""}>
              {wcaUser && wcaPass ? <><CheckCircle2 className="w-3 h-3 mr-1" /> Configurato</> : "Non configurato"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Username WCA</Label>
            <Input value={wcaUser} onChange={(e) => setWcaUser(e.target.value)} placeholder="email@example.com" />
          </div>
          <div className="space-y-2">
            <Label>Password WCA</Label>
            <div className="relative">
              <Input type={showWcaPass ? "text" : "password"} value={wcaPass} onChange={(e) => setWcaPass(e.target.value)} placeholder="••••••••" className="pr-10" />
              <button type="button" onClick={() => setShowWcaPass((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showWcaPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <Button onClick={handleSaveWcaCreds} disabled={savingWcaCreds || !wcaUser.trim() || !wcaPass.trim()}>
            {savingWcaCreds ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Salva Credenziali
          </Button>
        </CardContent>
      </Card>

      {/* Extension download */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Scarica l'estensione Chrome, installala, e clicca <strong>"🚀 Connetti WCA"</strong>.<br/>
              Fa tutto lui: login + cookie + verifica. Un solo click.
            </p>
          </div>
          <Button className="w-full" size="lg" onClick={() => window.open("/download-wca-extension.html", "_blank")}>
            <Download className="w-4 h-4 mr-2" /> Scarica Estensione Chrome
          </Button>
          <p className="text-[11px] text-muted-foreground text-center">
            Dopo il download: Chrome → chrome://extensions/ → Modalità sviluppatore → Carica estensione non pacchettizzata → seleziona la cartella.
          </p>
        </CardContent>
      </Card>

      {/* Verify */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <Button onClick={handleVerify} disabled={verifying} variant="outline" className="w-full">
            {verifying ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            {verifying ? "Verifica..." : "Verifica Sessione"}
          </Button>
        </CardContent>
      </Card>

      {/* Advanced */}
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

      {/* LinkedIn */}
      <div className="flex items-center justify-between mt-6">
        <div className="flex items-center gap-2">
          <Linkedin className="w-5 h-5 text-[#0A66C2]" />
          <h2 className="text-lg font-semibold">LinkedIn</h2>
        </div>
        <Badge variant={(liEmail && liPass) || liAtCookie ? "default" : "secondary"} className={(liEmail && liPass) || liAtCookie ? "bg-primary text-primary-foreground" : ""}>
          {(liEmail && liPass) || liAtCookie ? <><CheckCircle2 className="w-3 h-3 mr-1" /> Configurato</> : "Non configurato"}
        </Badge>
      </div>

      {/* LinkedIn Credentials */}
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

      {/* LinkedIn Extension */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Scarica l'estensione Chrome per LinkedIn, installala e clicca <strong>"🚀 Connetti LinkedIn"</strong>.
            </p>
          </div>
          <Button className="w-full" size="lg" onClick={() => window.open("/download-linkedin-extension.html", "_blank")}>
            <Download className="w-4 h-4 mr-2" /> Scarica Estensione LinkedIn
          </Button>
          <p className="text-[11px] text-muted-foreground text-center">
            Chrome → chrome://extensions/ → Modalità sviluppatore → Carica estensione non pacchettizzata
          </p>
        </CardContent>
      </Card>

      {/* LinkedIn Advanced Cookie */}
      <details className="group">
        <summary className="text-xs font-medium cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
          ⚙️ Avanzate (cookie li_at manuale)
        </summary>
        <div className="mt-3">
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
                <p className="text-xs text-muted-foreground">
                  Accedi a LinkedIn → F12 → Application → Cookies → linkedin.com → copia il valore di <code className="font-mono bg-muted px-1 rounded">li_at</code>
                </p>
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

      {/* Blacklist */}
      <div className="mt-8 pt-6 border-t border-border">
        <BlacklistManager />
      </div>
    </div>
  );
}
