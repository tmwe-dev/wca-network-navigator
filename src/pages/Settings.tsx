import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, Loader2, KeyRound, MessageCircle, Phone, CheckCircle2, Shield } from "lucide-react";
import { WcaSessionCard } from "@/components/settings/WcaSessionCard";
import { useAppSettings, useUpdateSetting } from "@/hooks/useAppSettings";
import { useWcaSessionStatus } from "@/hooks/useWcaSessionStatus";
import { toast } from "sonner";

export default function Settings() {
  const { data: settings, isLoading } = useAppSettings();
  const updateSetting = useUpdateSetting();
  const { triggerCheck } = useWcaSessionStatus();

  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);

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

  useEffect(() => {
    if (settings) {
      setWhatsappNumber(settings["whatsapp_number"] || "");
    }
  }, [settings]);

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

      {/* WCA Session - compact card pointing to /wca */}
      <Card className="border-amber-200 bg-amber-50/30">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <KeyRound className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <CardTitle className="text-base">Sessione WCA</CardTitle>
                <CardDescription>Stato della connessione a WCA World</CardDescription>
              </div>
            </div>
            {hasCookie ? (
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Cookie presente
              </Badge>
            ) : (
              <Badge variant="destructive">Mancante</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <WcaSessionCard onVerify={handleVerify} verifying={verifying} />
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
                  Il tuo numero WhatsApp per chiamate e messaggi dal sistema
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
              Inserisci il numero completo con prefisso internazionale (es. +39 per l'Italia).
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Shield className="w-3.5 h-3.5" />
              Salvato nelle impostazioni dell'app
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
