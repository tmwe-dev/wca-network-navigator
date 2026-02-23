import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Save, Loader2, MessageCircle, Phone, CheckCircle2, Shield,
  Globe, RefreshCw, ExternalLink, ClipboardPaste, XCircle,
  Upload, Download, FileSpreadsheet, File, FileText, Settings as SettingsIcon,
  Zap, Crown, Paperclip, KeyRound, Eye, EyeOff, Mail, Send, AlertCircle,
  Brain, Linkedin, Link,
} from "lucide-react";
// ScrapingSettings deprecated — removed
import { SubscriptionPanel } from "@/components/settings/SubscriptionPanel";
import { useAppSettings, useUpdateSetting } from "@/hooks/useAppSettings";
import { useWcaSession } from "@/hooks/useWcaSession";
import { usePartners } from "@/hooks/usePartners";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { toast as toastHook } from "@/hooks/use-toast";
import { CSVImport } from "@/components/partners/CSVImport";
import AIProfileSettings from "@/components/settings/AIProfileSettings";
import { WCAScraper } from "@/components/partners/WCAScraper";
import BlacklistManager from "@/components/settings/BlacklistManager";
import TemplateManager from "@/components/settings/TemplateManager";

/* ── Export field config ── */

function ReportAziendeSettings({ settings, updateSetting }: { settings: any; updateSetting: any }) {
  const [raUser, setRaUser] = useState(settings?.["ra_username"] || "");
  const [raPass, setRaPass] = useState(settings?.["ra_password"] || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setRaUser(settings["ra_username"] || "");
      setRaPass(settings["ra_password"] || "");
    }
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSetting.mutateAsync({ key: "ra_username", value: raUser.trim() });
      await updateSetting.mutateAsync({ key: "ra_password", value: raPass.trim() });
      toast.success("Credenziali Report Aziende salvate!");
    } catch { toast.error("Errore nel salvataggio"); }
    finally { setSaving(false); }
  };

  const hasCredentials = !!(settings?.["ra_username"] && settings?.["ra_password"]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Report Aziende</h2>
        </div>
        <Badge variant={hasCredentials ? "default" : "secondary"} className={hasCredentials ? "bg-primary text-primary-foreground" : ""}>
          {hasCredentials ? <><CheckCircle2 className="w-3 h-3 mr-1" /> Configurato</> : "Non configurato"}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Credenziali di accesso</CardTitle>
          <CardDescription>Username e password per reportaziende.it</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Username / Email</Label>
            <Input value={raUser} onChange={(e) => setRaUser(e.target.value)} placeholder="email@example.com" />
          </div>
          <div className="space-y-2">
            <Label>Password</Label>
            <Input type="password" value={raPass} onChange={(e) => setRaPass(e.target.value)} placeholder="••••••••" />
          </div>
          <Button onClick={handleSave} disabled={saving || !raUser.trim() || !raPass.trim()}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Salva Credenziali
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Scarica l'estensione Chrome per ReportAziende, installala e clicca <strong>"🚀 Connetti"</strong>.
            </p>
          </div>
          <Button className="w-full" size="lg" onClick={() => {
            window.open("/download-ra-extension.html", "_blank");
          }}>
            <Download className="w-4 h-4 mr-2" /> Scarica Estensione RA
          </Button>
          <p className="text-[11px] text-muted-foreground text-center">
            Chrome → chrome://extensions/ → Modalità sviluppatore → Carica estensione non pacchettizzata
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

const EXPORT_FIELDS = [
  { id: "company_name", label: "Company Name" },
  { id: "wca_id", label: "WCA ID" },
  { id: "country_code", label: "Country Code" },
  { id: "country_name", label: "Country" },
  { id: "city", label: "City" },
  { id: "address", label: "Address" },
  { id: "phone", label: "Phone" },
  { id: "email", label: "Email" },
  { id: "website", label: "Website" },
  { id: "partner_type", label: "Partner Type" },
  { id: "member_since", label: "Member Since" },
  { id: "membership_expires", label: "Membership Expires" },
];

export default function Settings() {
  const { data: settings, isLoading } = useAppSettings();
  const updateSetting = useUpdateSetting();
  const { isSessionActive, ensureSession } = useWcaSession();
  const wcaStatus = isSessionActive === true ? "ok" : "expired";
  const isWcaOkDerived = isSessionActive === true;

  /* ── Generale state ── */
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [savingWA, setSavingWA] = useState(false);

  /* ── Email SMTP state ── */
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("465");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [showSmtpPass, setShowSmtpPass] = useState(false);
  const [emailSender, setEmailSender] = useState("");
  const [emailName, setEmailName] = useState("");
  const [testEmailTo, setTestEmailTo] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);

  /* ── WCA state ── */
  const [verifying, setVerifying] = useState(false);
  const [cookieInput, setCookieInput] = useState("");
  const [savingCookie, setSavingCookie] = useState(false);
  const isWcaOk = isWcaOkDerived;

  /* ── WCA Credentials state ── */
  const [wcaUser, setWcaUser] = useState("");
  const [wcaPass, setWcaPass] = useState("");
  const [showWcaPass, setShowWcaPass] = useState(false);
  const [savingWcaCreds, setSavingWcaCreds] = useState(false);

  /* ── LinkedIn state ── */
  const [liEmail, setLiEmail] = useState("");
  const [liPass, setLiPass] = useState("");
  const [showLiPass, setShowLiPass] = useState(false);
  const [savingLiCreds, setSavingLiCreds] = useState(false);
  const [liAtCookie, setLiAtCookie] = useState("");
  const [showLiAt, setShowLiAt] = useState(false);
  const [savingLi, setSavingLi] = useState(false);

  /* ── Export state ── */
  const [selectedFields, setSelectedFields] = useState<string[]>(EXPORT_FIELDS.map((f) => f.id));
  const { data: partners, isLoading: loadingPartners } = usePartners();

  useEffect(() => {
    if (settings) {
      setWhatsappNumber(settings["whatsapp_number"] || "");
      setWcaUser(settings["wca_username"] || "");
      setWcaPass(settings["wca_password"] || "");
      setSmtpHost(settings["smtp_host"] || "");
      setSmtpPort(settings["smtp_port"] || "465");
      setSmtpUser(settings["smtp_user"] || "");
      setSmtpPass(settings["smtp_password"] || "");
      setEmailSender(settings["default_sender_email"] || "");
      setEmailName(settings["default_sender_name"] || "");
      setTestEmailTo(settings["default_sender_email"] || "");
      setLiAtCookie(settings["linkedin_li_at"] || "");
      setLiEmail(settings["linkedin_email"] || "");
      setLiPass(settings["linkedin_password"] || "");
    }
  }, [settings]);

  /* ── WCA Credentials handler ── */
  const handleSaveWcaCreds = async () => {
    setSavingWcaCreds(true);
    try {
      await updateSetting.mutateAsync({ key: "wca_username", value: wcaUser.trim() });
      await updateSetting.mutateAsync({ key: "wca_password", value: wcaPass.trim() });
      toast.success("Credenziali WCA salvate!");
    } catch { toast.error("Errore nel salvataggio"); }
    finally { setSavingWcaCreds(false); }
  };

  /* ── Email handlers ── */
  const handleSaveEmail = async () => {
    setSavingEmail(true);
    try {
      await updateSetting.mutateAsync({ key: "smtp_host", value: smtpHost.trim() });
      await updateSetting.mutateAsync({ key: "smtp_port", value: smtpPort.trim() });
      await updateSetting.mutateAsync({ key: "smtp_user", value: smtpUser.trim() });
      await updateSetting.mutateAsync({ key: "smtp_password", value: smtpPass });
      await updateSetting.mutateAsync({ key: "default_sender_email", value: emailSender.trim() });
      await updateSetting.mutateAsync({ key: "default_sender_name", value: emailName.trim() });
      toast.success("Impostazioni email SMTP salvate!");
    } catch { toast.error("Errore nel salvataggio"); }
    finally { setSavingEmail(false); }
  };

  const handleTestEmail = async () => {
    if (!testEmailTo.trim()) return;
    setSendingTest(true);
    try {
      const fromField = emailName.trim()
        ? `${emailName.trim()} <${emailSender.trim()}>`
        : emailSender.trim();
      const { error } = await supabase.functions.invoke("send-email", {
        body: {
          to: testEmailTo.trim(),
          subject: "✅ Test Email da WCA Network Navigator",
          html: `<p>Ciao! Questa è un'email di test inviata da <strong>WCA Network Navigator</strong>.</p><p>Se la ricevi, la configurazione del mittente <strong>${fromField}</strong> è corretta.</p>`,
          from: fromField,
        },
      });
      if (error) throw error;
      toast.success("Email di test inviata con successo!");
    } catch (err: any) {
      toast.error("Errore invio: " + (err.message || "Sconosciuto"));
    } finally {
      setSendingTest(false);
    }
  };

  /* ── WCA handlers ── */
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

  /* ── Export handlers ── */
  const toggleField = (id: string) =>
    setSelectedFields((p) => (p.includes(id) ? p.filter((f) => f !== id) : [...p, id]));

  const exportCSV = () => {
    if (!partners?.length) { toastHook({ title: "Nessun dato", variant: "destructive" }); return; }
    const headers = selectedFields.join(",");
    const rows = partners.map((p) => selectedFields.map((f) => { const v = (p as any)[f]; return v == null ? "" : `"${String(v).replace(/"/g, '""')}"`; }).join(","));
    downloadBlob([headers, ...rows].join("\n"), "text/csv;charset=utf-8;", "csv");
    toastHook({ title: "Export completato", description: `${partners.length} partner esportati in CSV.` });
  };

  const exportJSON = () => {
    if (!partners?.length) { toastHook({ title: "Nessun dato", variant: "destructive" }); return; }
    const data = partners.map((p) => { const o: Record<string, any> = {}; selectedFields.forEach((f) => { o[f] = (p as any)[f]; }); return o; });
    downloadBlob(JSON.stringify(data, null, 2), "application/json", "json");
    toastHook({ title: "Export completato", description: `${partners.length} partner esportati in JSON.` });
  };

  const downloadBlob = (content: string, type: string, ext: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wca-partners-${new Date().toISOString().split("T")[0]}.${ext}`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Impostazioni</h1>
        <p className="text-muted-foreground mt-1">Configurazione della piattaforma</p>
      </div>

      <Tabs defaultValue="generale" className="space-y-6">
        <TabsList>
          <TabsTrigger value="generale" className="flex items-center gap-2">
            <SettingsIcon className="w-4 h-4" /> Generale
          </TabsTrigger>
          <TabsTrigger value="email" className="flex items-center gap-2">
            <Mail className="w-4 h-4" /> Email
          </TabsTrigger>
          <TabsTrigger value="wca" className="flex items-center gap-2">
            <Link className="w-4 h-4" /> Connessioni
          </TabsTrigger>
          <TabsTrigger value="import-export" className="flex items-center gap-2">
            <Download className="w-4 h-4" /> Import / Export
          </TabsTrigger>
          <TabsTrigger value="blacklist" className="flex items-center gap-2">
            <Shield className="w-4 h-4" /> Blacklist
          </TabsTrigger>
          {/* Scraping tab removed */}
          <TabsTrigger value="reportaziende" className="flex items-center gap-2">
            <FileText className="w-4 h-4" /> Report Aziende
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <Paperclip className="w-4 h-4" /> Template
          </TabsTrigger>
          <TabsTrigger value="ai-profile" className="flex items-center gap-2">
            <Brain className="w-4 h-4" /> Profilo AI
          </TabsTrigger>
          <TabsTrigger value="abbonamento" className="flex items-center gap-2">
            <Crown className="w-4 h-4" /> Abbonamento
          </TabsTrigger>
        </TabsList>

        {/* ════════════════ GENERALE ════════════════ */}
        <TabsContent value="generale">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <MessageCircle className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Numero WhatsApp</CardTitle>
                    <CardDescription>Il tuo numero WhatsApp per chiamate e messaggi dal sistema</CardDescription>
                  </div>
                </div>
                {settings?.["whatsapp_number"] ? (
                  <Badge className="bg-primary/10 text-primary border border-primary/20">
                    <CheckCircle2 className="w-3 h-3 mr-1" /> Configurato
                  </Badge>
                ) : (
                  <Badge variant="secondary">Non impostato</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="whatsapp-number">Numero di telefono</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="whatsapp-number" value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)} placeholder="+39 333 1234567" className="pl-10" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Inserisci il numero completo con prefisso internazionale (es. +39 per l'Italia).</p>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Shield className="w-3.5 h-3.5" /> Salvato nelle impostazioni dell'app
                </div>
                <Button
                  onClick={async () => {
                    if (!whatsappNumber.trim()) return;
                    setSavingWA(true);
                    try { await updateSetting.mutateAsync({ key: "whatsapp_number", value: whatsappNumber.trim() }); toast.success("Numero WhatsApp salvato"); }
                    catch { toast.error("Errore nel salvataggio"); }
                    finally { setSavingWA(false); }
                  }}
                  disabled={savingWA || !whatsappNumber.trim()}
                  variant="outline"
                >
                  {savingWA ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Salva Numero
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ════════════════ EMAIL ════════════════ */}
        <TabsContent value="email">
          <div className="space-y-4">
            {/* Server SMTP */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Mail className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">Configurazione SMTP</CardTitle>
                      <CardDescription>Server e credenziali per l'invio email diretto</CardDescription>
                    </div>
                  </div>
                  <Badge variant={smtpHost && smtpUser ? "default" : "secondary"} className={smtpHost && smtpUser ? "bg-primary text-primary-foreground" : ""}>
                    {smtpHost && smtpUser ? <><CheckCircle2 className="w-3 h-3 mr-1" /> Configurato</> : "Non configurato"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Host SMTP</Label>
                    <Input value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} placeholder="smtps.aruba.it" />
                  </div>
                  <div className="space-y-2">
                    <Label>Porta</Label>
                    <Input value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} placeholder="465" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Username SMTP</Label>
                  <Input value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} placeholder="luca@tmwe.it" />
                </div>
                <div className="space-y-2">
                  <Label>Password SMTP</Label>
                  <div className="relative">
                    <Input
                      type={showSmtpPass ? "text" : "password"}
                      value={smtpPass}
                      onChange={(e) => setSmtpPass(e.target.value)}
                      placeholder="••••••••"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                      onClick={() => setShowSmtpPass(!showSmtpPass)}
                    >
                      {showSmtpPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                <hr className="border-border" />

                <div className="space-y-2">
                  <Label>Email mittente</Label>
                  <Input type="email" value={emailSender} onChange={(e) => setEmailSender(e.target.value)} placeholder="luca@tmwe.it" />
                </div>
                <div className="space-y-2">
                  <Label>Nome mittente (opzionale)</Label>
                  <Input value={emailName} onChange={(e) => setEmailName(e.target.value)} placeholder="Luca - TMWE" />
                </div>
                <Button onClick={handleSaveEmail} disabled={savingEmail || !smtpHost.trim() || !smtpUser.trim() || !smtpPass.trim() || !emailSender.trim()}>
                  {savingEmail ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Salva Impostazioni Email
                </Button>
              </CardContent>
            </Card>

            {/* Info SMTP */}
            <div className="flex gap-3 rounded-lg border border-border bg-muted/50 p-4">
              <AlertCircle className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium">Server SMTP comuni</p>
                <p className="text-sm text-muted-foreground">
                  <strong>Aruba:</strong> smtps.aruba.it, porta 465 (SSL)<br />
                  <strong>Gmail:</strong> smtp.gmail.com, porta 587 (TLS) — richiede App Password<br />
                  <strong>Outlook:</strong> smtp.office365.com, porta 587 (TLS)
                </p>
              </div>
            </div>

            {/* Test Invio */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Send className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Test Invio</CardTitle>
                    <CardDescription>Invia un'email di verifica per controllare la configurazione</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Invia email di test a:</Label>
                  <Input
                    type="email"
                    value={testEmailTo}
                    onChange={(e) => setTestEmailTo(e.target.value)}
                    placeholder="luca@tmwe.it"
                  />
                </div>
                <Button
                  onClick={handleTestEmail}
                  disabled={sendingTest || !testEmailTo.trim() || !emailSender.trim()}
                  variant="outline"
                >
                  {sendingTest ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                  {sendingTest ? "Invio in corso..." : "Invia Email di Test"}
                </Button>
                {!emailSender.trim() && (
                  <p className="text-xs text-muted-foreground">Salva prima l'email mittente per poter inviare il test.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ════════════════ WCA ════════════════ */}
        <TabsContent value="wca">
          <div className="space-y-4">
            {/* Status badge */}
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
                    <Input
                      type={showWcaPass ? "text" : "password"}
                      value={wcaPass}
                      onChange={(e) => setWcaPass(e.target.value)}
                      placeholder="••••••••"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowWcaPass((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
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

            {/* Main action: Scarica estensione */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="text-center space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Scarica l'estensione Chrome, installala, e clicca <strong>"🚀 Connetti WCA"</strong>.<br/>
                    Fa tutto lui: login + cookie + verifica. Un solo click.
                  </p>
                </div>
                <Button className="w-full" size="lg" onClick={() => {
                  window.open("/download-wca-extension.html", "_blank");
                }}>
                  <Download className="w-4 h-4 mr-2" /> Scarica Estensione Chrome
                </Button>
                <p className="text-[11px] text-muted-foreground text-center">
                  Dopo il download: Chrome → chrome://extensions/ → Modalità sviluppatore → Carica estensione non pacchettizzata → seleziona la cartella.
                </p>
              </CardContent>
            </Card>

            {/* Verify session */}
            <Card>
              <CardContent className="pt-6 space-y-3">
                <Button onClick={handleVerify} disabled={verifying} variant="outline" className="w-full">
                  {verifying ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                  {verifying ? "Verifica..." : "Verifica Sessione"}
                </Button>
              </CardContent>
            </Card>

            {/* Advanced - collapsed */}
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

            {/* ── LinkedIn ── */}
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
                    <Input
                      type={showLiPass ? "text" : "password"}
                      value={liPass}
                      onChange={(e) => setLiPass(e.target.value)}
                      placeholder="••••••••"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLiPass((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
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

            {/* LinkedIn Extension Download */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="text-center space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Scarica l'estensione Chrome per LinkedIn, installala e clicca <strong>"🚀 Connetti LinkedIn"</strong>.
                  </p>
                </div>
                <Button className="w-full" size="lg" onClick={() => {
                  window.open("/download-linkedin-extension.html", "_blank");
                }}>
                  <Download className="w-4 h-4 mr-2" /> Scarica Estensione LinkedIn
                </Button>
                <p className="text-[11px] text-muted-foreground text-center">
                  Chrome → chrome://extensions/ → Modalità sviluppatore → Carica estensione non pacchettizzata
                </p>
              </CardContent>
            </Card>

            {/* Advanced - Cookie manuale */}
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
                        <button
                          type="button"
                          onClick={() => setShowLiAt((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
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
          </div>
        </TabsContent>

        {/* ════════════════ IMPORT / EXPORT ════════════════ */}
        <TabsContent value="import-export">
          <Tabs defaultValue="import" className="space-y-6">
            <TabsList>
              <TabsTrigger value="import" className="flex items-center gap-2"><Upload className="w-4 h-4" /> Importa</TabsTrigger>
              <TabsTrigger value="export" className="flex items-center gap-2"><Download className="w-4 h-4" /> Esporta</TabsTrigger>
              <TabsTrigger value="wca-download" className="flex items-center gap-2"><Globe className="w-4 h-4" /> Scarica da WCA</TabsTrigger>
            </TabsList>

            <TabsContent value="import"><CSVImport /></TabsContent>

            <TabsContent value="export">
              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Seleziona Campi</CardTitle>
                    <CardDescription>Scegli quali campi includere nell'export</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {EXPORT_FIELDS.map((field) => (
                        <div key={field.id} className="flex items-center space-x-2">
                          <Checkbox id={field.id} checked={selectedFields.includes(field.id)} onCheckedChange={() => toggleField(field.id)} />
                          <Label htmlFor={field.id} className="cursor-pointer">{field.label}</Label>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 mt-4 pt-4 border-t">
                      <Button variant="outline" size="sm" onClick={() => setSelectedFields(EXPORT_FIELDS.map((f) => f.id))}>Seleziona Tutto</Button>
                      <Button variant="outline" size="sm" onClick={() => setSelectedFields([])}>Deseleziona Tutto</Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Formato Export</CardTitle>
                    <CardDescription>{loadingPartners ? "Caricamento..." : `${partners?.length || 0} partner verranno esportati`}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Button variant="outline" className="w-full justify-start h-auto py-4" onClick={exportCSV} disabled={selectedFields.length === 0 || loadingPartners}>
                      <FileSpreadsheet className="w-8 h-8 mr-4 text-primary" />
                      <div className="text-left">
                        <p className="font-medium">CSV (Excel compatibile)</p>
                        <p className="text-sm text-muted-foreground">Ideale per fogli di calcolo</p>
                      </div>
                    </Button>
                    <Button variant="outline" className="w-full justify-start h-auto py-4" onClick={exportJSON} disabled={selectedFields.length === 0 || loadingPartners}>
                      <File className="w-8 h-8 mr-4 text-primary" />
                      <div className="text-left">
                        <p className="font-medium">JSON</p>
                        <p className="text-sm text-muted-foreground">Ideale per sviluppatori e API</p>
                      </div>
                    </Button>
                    <Button variant="outline" className="w-full justify-start h-auto py-4" disabled>
                      <FileText className="w-8 h-8 mr-4 text-muted-foreground" />
                      <div className="text-left">
                        <p className="font-medium">PDF Report</p>
                        <p className="text-sm text-muted-foreground">Prossimamente</p>
                      </div>
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="wca-download"><WCAScraper /></TabsContent>
          </Tabs>
        </TabsContent>
        {/* ════════════════ BLACKLIST ════════════════ */}
        <TabsContent value="blacklist">
          <BlacklistManager />
        </TabsContent>

        {/* Scraping tab removed */}

        {/* ════════════════ REPORT AZIENDE ════════════════ */}
        <TabsContent value="reportaziende">
          <ReportAziendeSettings settings={settings} updateSetting={updateSetting} />
        </TabsContent>

        {/* ════════════════ TEMPLATE ════════════════ */}
        <TabsContent value="templates">
          <TemplateManager />
        </TabsContent>

        {/* ════════════════ PROFILO AI ════════════════ */}
        <TabsContent value="ai-profile">
          <AIProfileSettings />
        </TabsContent>

        {/* ════════════════ ABBONAMENTO ════════════════ */}
        <TabsContent value="abbonamento">
          <SubscriptionPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
