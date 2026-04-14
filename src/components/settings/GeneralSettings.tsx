import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Save, Loader2, MessageCircle, Phone, CheckCircle2, Shield,
  Mail, Send, AlertCircle, Eye, EyeOff, FileText, Bot,
} from "lucide-react";
import { toast } from "sonner";
import { invokeEdge } from "@/lib/api/invokeEdge";
import TemplateManager from "@/components/settings/TemplateManager";
import AIProfileSettings from "@/components/settings/AIProfileSettings";
import { createLogger } from "@/lib/log";

const log = createLogger("GeneralSettings");

interface GeneralSettingsProps {
  settings: Record<string, string> | undefined;
  updateSetting: { mutateAsync: (params: { key: string; value: string }) => Promise<unknown> };
}

export function GeneralSettings({ settings, updateSetting }: GeneralSettingsProps) {
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [savingWA, setSavingWA] = useState(false);

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

  useEffect(() => {
    if (settings) {
      setWhatsappNumber(settings["whatsapp_number"] || "");
      setSmtpHost(settings["smtp_host"] || "");
      setSmtpPort(settings["smtp_port"] || "465");
      setSmtpUser(settings["smtp_user"] || "");
      setSmtpPass(settings["smtp_password"] || "");
      setEmailSender(settings["default_sender_email"] || "");
      setEmailName(settings["default_sender_name"] || "");
      setTestEmailTo(settings["default_sender_email"] || "");
    }
  }, [settings]);

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
    } catch (e) { log.warn("operation failed", { error: e instanceof Error ? e.message : String(e) }); toast.error("Errore nel salvataggio"); }
    finally { setSavingEmail(false); }
  };

  const handleTestEmail = async () => {
    if (!testEmailTo.trim()) return;
    setSendingTest(true);
    try {
      const fromField = emailName.trim()
        ? `${emailName.trim()} <${emailSender.trim()}>`
        : emailSender.trim();
      await invokeEdge("send-email", { body: {
          to: testEmailTo.trim(),
          subject: "✅ Test Email da WCA Network Navigator",
          html: `<p>Ciao! Questa è un'email di test inviata da <strong>WCA Network Navigator</strong>.</p><p>Se la ricevi, la configurazione del mittente <strong>${fromField}</strong> è corretta.</p>`,
          from: fromField,
        }, context: "GeneralSettings.send_email" });
      toast.success("Email di test inviata con successo!");
    } catch (err: unknown) {
      toast.error("Errore invio: " + ((err instanceof Error ? err.message : String(err)) || "Sconosciuto"));
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <Tabs defaultValue="whatsapp" className="space-y-4">
      <TabsList className="w-full justify-start">
        <TabsTrigger value="whatsapp" className="gap-1.5 text-xs">
          <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
        </TabsTrigger>
        <TabsTrigger value="smtp" className="gap-1.5 text-xs">
          <Mail className="w-3.5 h-3.5" /> Email SMTP
        </TabsTrigger>
        <TabsTrigger value="template" className="gap-1.5 text-xs">
          <FileText className="w-3.5 h-3.5" /> Template
        </TabsTrigger>
        <TabsTrigger value="ai-profile" className="gap-1.5 text-xs">
          <Bot className="w-3.5 h-3.5" /> Profilo AI
        </TabsTrigger>
      </TabsList>

      {/* WhatsApp */}
      <TabsContent value="whatsapp" className="m-0">
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
                  catch (e) { log.warn("operation failed", { error: e instanceof Error ? e.message : String(e) }); toast.error("Errore nel salvataggio"); }
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

      {/* Email SMTP */}
      <TabsContent value="smtp" className="m-0 space-y-4">
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
                <Input type={showSmtpPass ? "text" : "password"} value={smtpPass} onChange={(e) => setSmtpPass(e.target.value)} placeholder="••••••••" />
                <Button type="button" variant="ghost" size="sm" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0" onClick={() => setShowSmtpPass(!showSmtpPass)}>
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
              <Input type="email" value={testEmailTo} onChange={(e) => setTestEmailTo(e.target.value)} placeholder="luca@tmwe.it" />
            </div>
            <Button onClick={handleTestEmail} disabled={sendingTest || !testEmailTo.trim() || !emailSender.trim()} variant="outline">
              {sendingTest ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              {sendingTest ? "Invio in corso..." : "Invia Email di Test"}
            </Button>
            {!emailSender.trim() && (
              <p className="text-xs text-muted-foreground">Salva prima l'email mittente per poter inviare il test.</p>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Template */}
      <TabsContent value="template" className="m-0">
        <TemplateManager />
      </TabsContent>

      {/* Profilo AI */}
      <TabsContent value="ai-profile" className="m-0">
        <AIProfileSettings />
      </TabsContent>
    </Tabs>
  );
}
