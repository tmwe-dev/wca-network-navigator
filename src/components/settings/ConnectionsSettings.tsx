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
  Linkedin, ShieldAlert, MessageCircle, Bot, Phone, Wifi, WifiOff,
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

  return (
    <Tabs defaultValue="wca" className="space-y-4">
      <TabsList className="w-full justify-start">
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

      {/* WCA */}
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
          <Badge variant={(liEmail && liPass) || liAtCookie ? "default" : "secondary"} className={(liEmail && liPass) || liAtCookie ? "bg-primary text-primary-foreground" : ""}>
            {(liEmail && liPass) || liAtCookie ? <><CheckCircle2 className="w-3 h-3 mr-1" /> Configurato</> : "Non configurato"}
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
      </TabsContent>

      {/* Blacklist */}
      <TabsContent value="blacklist" className="m-0">
        <BlacklistManager />
      </TabsContent>
    </Tabs>
  );
}
