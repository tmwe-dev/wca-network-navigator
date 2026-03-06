import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Save, Loader2, Globe, Download, FileSpreadsheet, File, FileText,
  Settings as SettingsIcon, Crown, Upload, BookOpen, Link, CheckCircle2,
} from "lucide-react";
import { SubscriptionPanel } from "@/components/settings/SubscriptionPanel";
import { useAppSettings, useUpdateSetting } from "@/hooks/useAppSettings";
import { useWcaSession } from "@/hooks/useWcaSession";
import { usePartners } from "@/hooks/usePartners";
import { toast } from "sonner";
import { toast as toastHook } from "@/hooks/use-toast";
import { CSVImport } from "@/components/partners/CSVImport";
import { WCAScraper } from "@/components/partners/WCAScraper";
import ContentManager from "@/components/settings/ContentManager";
import { GeneraleTab } from "@/components/settings/GeneraleTab";
import { ConnessioniTab } from "@/components/settings/ConnessioniTab";

/* ── Export field config ── */
function ReportAziendeSettings({ settings, updateSetting }: { settings: Record<string, string> | undefined; updateSetting: ReturnType<typeof useUpdateSetting> }) {
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
          <Button className="w-full" size="lg" onClick={() => window.open("/download-ra-extension.html", "_blank")}>
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
  const isWcaOk = isSessionActive === true;

  /* ── Generale state ── */
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("465");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [showSmtpPass, setShowSmtpPass] = useState(false);
  const [emailSender, setEmailSender] = useState("");
  const [emailName, setEmailName] = useState("");
  const [testEmailTo, setTestEmailTo] = useState("");

  /* ── WCA state ── */
  const [wcaUser, setWcaUser] = useState("");
  const [wcaPass, setWcaPass] = useState("");
  const [showWcaPass, setShowWcaPass] = useState(false);

  /* ── LinkedIn state ── */
  const [liEmail, setLiEmail] = useState("");
  const [liPass, setLiPass] = useState("");
  const [showLiPass, setShowLiPass] = useState(false);
  const [liAtCookie, setLiAtCookie] = useState("");
  const [showLiAt, setShowLiAt] = useState(false);

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

  const toggleField = (id: string) =>
    setSelectedFields((p) => (p.includes(id) ? p.filter((f) => f !== id) : [...p, id]));

  const downloadBlob = (content: string, type: string, ext: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wca-partners-${new Date().toISOString().split("T")[0]}.${ext}`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportCSV = () => {
    if (!partners?.length) { toastHook({ title: "Nessun dato", variant: "destructive" }); return; }
    const headers = selectedFields.join(",");
    const rows = partners.map((p) => selectedFields.map((f) => { const v = (p as Record<string, unknown>)[f]; return v == null ? "" : `"${String(v).replace(/"/g, '""')}"`; }).join(","));
    downloadBlob([headers, ...rows].join("\n"), "text/csv;charset=utf-8;", "csv");
    toastHook({ title: "Export completato", description: `${partners.length} partner esportati in CSV.` });
  };

  const exportJSON = () => {
    if (!partners?.length) { toastHook({ title: "Nessun dato", variant: "destructive" }); return; }
    const data = partners.map((p) => { const o: Record<string, unknown> = {}; selectedFields.forEach((f) => { o[f] = (p as Record<string, unknown>)[f]; }); return o; });
    downloadBlob(JSON.stringify(data, null, 2), "application/json", "json");
    toastHook({ title: "Export completato", description: `${partners.length} partner esportati in JSON.` });
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
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="generale" className="flex items-center gap-2"><SettingsIcon className="w-4 h-4" /> Generale</TabsTrigger>
          <TabsTrigger value="contenuti" className="flex items-center gap-2"><BookOpen className="w-4 h-4" /> Contenuti</TabsTrigger>
          <TabsTrigger value="wca" className="flex items-center gap-2"><Link className="w-4 h-4" /> Connessioni</TabsTrigger>
          <TabsTrigger value="import-export" className="flex items-center gap-2"><Download className="w-4 h-4" /> Import / Export</TabsTrigger>
          <TabsTrigger value="reportaziende" className="flex items-center gap-2"><FileText className="w-4 h-4" /> Report Aziende</TabsTrigger>
          <TabsTrigger value="abbonamento" className="flex items-center gap-2"><Crown className="w-4 h-4" /> Abbonamento</TabsTrigger>
        </TabsList>

        <TabsContent value="generale">
          <GeneraleTab
            settings={settings} updateSetting={updateSetting}
            whatsappNumber={whatsappNumber} setWhatsappNumber={setWhatsappNumber}
            smtpHost={smtpHost} setSmtpHost={setSmtpHost}
            smtpPort={smtpPort} setSmtpPort={setSmtpPort}
            smtpUser={smtpUser} setSmtpUser={setSmtpUser}
            smtpPass={smtpPass} setSmtpPass={setSmtpPass}
            showSmtpPass={showSmtpPass} setShowSmtpPass={setShowSmtpPass}
            emailSender={emailSender} setEmailSender={setEmailSender}
            emailName={emailName} setEmailName={setEmailName}
            testEmailTo={testEmailTo} setTestEmailTo={setTestEmailTo}
          />
        </TabsContent>

        <TabsContent value="wca">
          <ConnessioniTab
            settings={settings} updateSetting={updateSetting}
            isWcaOk={isWcaOk} ensureSession={ensureSession}
            wcaUser={wcaUser} setWcaUser={setWcaUser}
            wcaPass={wcaPass} setWcaPass={setWcaPass}
            showWcaPass={showWcaPass} setShowWcaPass={setShowWcaPass}
            liEmail={liEmail} setLiEmail={setLiEmail}
            liPass={liPass} setLiPass={setLiPass}
            showLiPass={showLiPass} setShowLiPass={setShowLiPass}
            liAtCookie={liAtCookie} setLiAtCookie={setLiAtCookie}
            showLiAt={showLiAt} setShowLiAt={setShowLiAt}
          />
        </TabsContent>

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
                      <div className="text-left"><p className="font-medium">CSV (Excel compatibile)</p><p className="text-sm text-muted-foreground">Ideale per fogli di calcolo</p></div>
                    </Button>
                    <Button variant="outline" className="w-full justify-start h-auto py-4" onClick={exportJSON} disabled={selectedFields.length === 0 || loadingPartners}>
                      <File className="w-8 h-8 mr-4 text-primary" />
                      <div className="text-left"><p className="font-medium">JSON</p><p className="text-sm text-muted-foreground">Ideale per sviluppatori e API</p></div>
                    </Button>
                    <Button variant="outline" className="w-full justify-start h-auto py-4" disabled>
                      <FileText className="w-8 h-8 mr-4 text-muted-foreground" />
                      <div className="text-left"><p className="font-medium">PDF Report</p><p className="text-sm text-muted-foreground">Prossimamente</p></div>
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
            <TabsContent value="wca-download"><WCAScraper /></TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="reportaziende">
          <ReportAziendeSettings settings={settings} updateSetting={updateSetting} />
        </TabsContent>

        <TabsContent value="contenuti"><ContentManager /></TabsContent>

        <TabsContent value="abbonamento"><SubscriptionPanel /></TabsContent>
      </Tabs>
    </div>
  );
}
