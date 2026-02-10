import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Save, Eye, EyeOff, Globe, Shield, CheckCircle2, Loader2, KeyRound, MessageCircle, Phone } from "lucide-react";
import { ProxySetupGuide } from "@/components/settings/ProxySetupGuide";
import { useAppSettings, useUpdateSetting } from "@/hooks/useAppSettings";
import { useWcaSessionStatus } from "@/hooks/useWcaSessionStatus";
import { useWCA } from "@/hooks/useWCA";
import { toast } from "sonner";

export default function Settings() {
  const { data: settings, isLoading } = useAppSettings();
  const updateSetting = useUpdateSetting();
  const { triggerCheck } = useWcaSessionStatus();
  const wca = useWCA();

  const [wcaUsername, setWcaUsername] = useState("");
  const [wcaPassword, setWcaPassword] = useState("");
  const [wcaCookie, setWcaCookie] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [autoLogging, setAutoLogging] = useState(false);

  const handleAutoLogin = async () => {
    if (!wcaUsername || !wcaPassword) {
      toast.error("Inserisci prima username e password WCA");
      return;
    }
    if (!wca.isProxyOnline) {
      toast.error("Proxy offline. Avvia wca-auth-proxy.py sul tuo computer");
      return;
    }
    setAutoLogging(true);
    try {
      await wca.login(wcaUsername, wcaPassword);
      const cookie = await wca.getCookie();
      if (!cookie) throw new Error("Cookie non ottenuto dal proxy");
      await updateSetting.mutateAsync({ key: "wca_session_cookie", value: cookie });
      setWcaCookie(cookie);
      toast.success("Cookie ottenuto e salvato automaticamente!");
      await triggerCheck();
    } catch (e: any) {
      toast.error(e.message || "Errore nel login automatico");
    } finally {
      setAutoLogging(false);
    }
  };

  useEffect(() => {
    if (settings) {
      setWcaUsername(settings["wca_username"] || "");
      setWcaPassword(settings["wca_password"] || "");
      setWcaCookie(settings["wca_session_cookie"] || "");
      setWhatsappNumber(settings["whatsapp_number"] || "");
    }
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSetting.mutateAsync({ key: "wca_username", value: wcaUsername });
      await updateSetting.mutateAsync({ key: "wca_password", value: wcaPassword });
      if (wcaCookie) {
        await updateSetting.mutateAsync({ key: "wca_session_cookie", value: wcaCookie });
      }
      toast.success("Credenziali WCA salvate con successo");
    } catch (err) {
      toast.error("Errore nel salvataggio delle credenziali");
    } finally {
      setSaving(false);
    }
  };

  const isConfigured = !!settings?.["wca_username"] && !!settings?.["wca_password"];
  const hasCookie = !!settings?.["wca_session_cookie"];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Impostazioni</h1>
        <p className="text-muted-foreground mt-1">Configurazione della piattaforma</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Globe className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Credenziali WCA World</CardTitle>
                <CardDescription>
                  Utilizzate per accedere ai dati completi dei partner (email, telefoni, contatti)
                </CardDescription>
              </div>
            </div>
            {isConfigured ? (
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Configurato
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-amber-600">
                Non configurato
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="wca-username">Username WCA</Label>
            <Input
              id="wca-username"
              value={wcaUsername}
              onChange={(e) => setWcaUsername(e.target.value)}
              placeholder="Il tuo username WCA"
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wca-password">Password WCA</Label>
            <div className="relative">
              <Input
                id="wca-password"
                type={showPassword ? "text" : "password"}
                value={wcaPassword}
                onChange={(e) => setWcaPassword(e.target.value)}
                placeholder="La tua password WCA"
                autoComplete="off"
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Shield className="w-3.5 h-3.5" />
              Le credenziali sono salvate in modo sicuro nel database
            </div>
            <Button onClick={handleSave} disabled={saving || !wcaUsername || !wcaPassword}>
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Salva Credenziali
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-amber-200 bg-amber-50/30">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <KeyRound className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <CardTitle className="text-base">Cookie di Sessione WCA (Obbligatorio)</CardTitle>
                <CardDescription>
                  Necessario per accedere ai dati contatti (email, telefoni). Senza cookie valido i dati sono nascosti.
                </CardDescription>
              </div>
            </div>
            {hasCookie ? (
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Presente
              </Badge>
            ) : (
              <Badge variant="destructive">Mancante</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <ProxySetupGuide
            isProxyOnline={wca.isProxyOnline}
            hasCredentials={!!wcaUsername && !!wcaPassword && isConfigured}
            hasCookie={hasCookie}
            autoLogging={autoLogging}
            onAutoLogin={handleAutoLogin}
          />

          <div className="space-y-2">
            <Label htmlFor="wca-cookie">Cookie completo</Label>
            <Textarea
              id="wca-cookie"
              value={wcaCookie}
              onChange={(e) => setWcaCookie(e.target.value)}
              placeholder="Incolla qui l'output di document.cookie"
              rows={3}
              className="font-mono text-xs"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              onClick={async () => {
                if (!wcaCookie) return;
                setSaving(true);
                try {
                  await updateSetting.mutateAsync({ key: "wca_session_cookie", value: wcaCookie });
                  toast.success("Cookie di sessione salvato, verifica in corso...");
                  // Trigger WCA session check after saving
                  await triggerCheck();
                } catch {
                  toast.error("Errore nel salvataggio");
                } finally {
                  setSaving(false);
                }
              }}
              disabled={saving || !wcaCookie}
            >
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Salva Cookie
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* WhatsApp Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <MessageCircle className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <CardTitle className="text-base">Numero WhatsApp</CardTitle>
                <CardDescription>
                  Il tuo numero WhatsApp per effettuare chiamate e messaggi direttamente dal sistema
                </CardDescription>
              </div>
            </div>
            {settings?.["whatsapp_number"] ? (
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Configurato
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
                <Input
                  id="whatsapp-number"
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  placeholder="+39 333 1234567"
                  className="pl-10"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Inserisci il numero completo con prefisso internazionale (es. +39 per l'Italia). Verrà usato come mittente per i link WhatsApp.
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Shield className="w-3.5 h-3.5" />
              Il numero viene salvato nelle impostazioni dell'app
            </div>
            <Button
              onClick={async () => {
                if (!whatsappNumber.trim()) return;
                setSaving(true);
                try {
                  await updateSetting.mutateAsync({ key: "whatsapp_number", value: whatsappNumber.trim() });
                  toast.success("Numero WhatsApp salvato");
                } catch {
                  toast.error("Errore nel salvataggio");
                } finally {
                  setSaving(false);
                }
              }}
              disabled={saving || !whatsappNumber.trim()}
              variant="outline"
            >
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Salva Numero
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
