import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Save, Loader2, Shield, CheckCircle2, KeyRound } from "lucide-react";
import { useScrapingSettings, SCRAPING_KEY_MAP, SCRAPING_DEFAULTS, type ScrapingSettings as ScrapingSettingsType } from "@/hooks/useScrapingSettings";
import { useAppSettings, useUpdateSetting } from "@/hooks/useAppSettings";
import { toast } from "sonner";

export function ScrapingSettingsPanel() {
  const { settings, isLoading } = useScrapingSettings();
  const { data: appSettings, isLoading: appLoading } = useAppSettings();
  const updateSetting = useUpdateSetting();
  const [local, setLocal] = useState<ScrapingSettingsType>(SCRAPING_DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [wcaUser, setWcaUser] = useState("");
  const [wcaPass, setWcaPass] = useState("");
  const [savingCreds, setSavingCreds] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setLocal(settings);
      setDirty(false);
    }
  }, [settings, isLoading]);

  useEffect(() => {
    if (!appLoading && appSettings) {
      setWcaUser(appSettings["wca_username"] || "");
      setWcaPass(appSettings["wca_password"] || "");
    }
  }, [appSettings, appLoading]);

  const handleSaveCreds = async () => {
    setSavingCreds(true);
    try {
      await updateSetting.mutateAsync({ key: "wca_username", value: wcaUser });
      await updateSetting.mutateAsync({ key: "wca_password", value: wcaPass });
      toast.success("Credenziali WCA salvate!");
    } catch {
      toast.error("Errore nel salvataggio credenziali");
    } finally {
      setSavingCreds(false);
    }
  };

  const update = <K extends keyof ScrapingSettingsType>(key: K, value: ScrapingSettingsType[K]) => {
    setLocal((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const entries = Object.entries(SCRAPING_KEY_MAP) as [keyof ScrapingSettingsType, string][];
      for (const [field, dbKey] of entries) {
        if (local[field] !== settings[field]) {
          await updateSetting.mutateAsync({ key: dbKey, value: String(local[field]) });
        }
      }
      toast.success("Impostazioni scraping salvate!");
      setDirty(false);
    } catch {
      toast.error("Errore nel salvataggio");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || appLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const effectiveMin = Math.max(local.baseDelay - local.variation, 10);
  const effectiveMax = local.baseDelay + local.variation;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Scraping & Sicurezza</h2>
        </div>
        {dirty && (
          <Button onClick={handleSave} disabled={saving} size="sm">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Salva Modifiche
          </Button>
        )}
      </div>

      {/* Credenziali WCA */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-primary" />
              <CardTitle className="text-base">Credenziali WCA</CardTitle>
            </div>
            {wcaUser && wcaPass ? (
              <Badge className="gap-1"><CheckCircle2 className="w-3 h-3" /> Configurato</Badge>
            ) : (
              <Badge variant="outline">Non configurato</Badge>
            )}
          </div>
          <CardDescription>Username e password per l'accesso automatico al portale WCA</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="wca-user">Username WCA</Label>
            <Input id="wca-user" value={wcaUser} onChange={(e) => setWcaUser(e.target.value)} placeholder="Inserisci username" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wca-pass">Password WCA</Label>
            <Input id="wca-pass" type="password" value={wcaPass} onChange={(e) => setWcaPass(e.target.value)} placeholder="Inserisci password" />
          </div>
          <Button onClick={handleSaveCreds} disabled={savingCreds} size="sm">
            {savingCreds ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Salva Credenziali
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            <CardTitle className="text-base">Cadenza Richieste</CardTitle>
          </div>
          <CardDescription>
            Una richiesta per volta. Delay tra richieste: <strong>{effectiveMin}–{effectiveMax}s</strong> (hard floor 10s)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Base delay */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Delay base tra richieste</Label>
              <span className="text-sm font-mono text-primary">{local.baseDelay}s</span>
            </div>
            <Slider
              value={[local.baseDelay]}
              onValueChange={([v]) => update("baseDelay", v)}
              min={10} max={60} step={1}
            />
          </div>

          <Separator />

          {/* Variation */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Variazione random (±)</Label>
              <span className="text-sm font-mono text-primary">±{local.variation}s</span>
            </div>
            <Slider
              value={[local.variation]}
              onValueChange={([v]) => update("variation", v)}
              min={0} max={10} step={1}
            />
            <p className="text-xs text-muted-foreground">
              Delay effettivo: {effectiveMin}–{effectiveMax} secondi
            </p>
          </div>

          <Separator />

          {/* Max retries */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Max retry per partner fallito</Label>
              <span className="text-sm font-mono text-primary">{local.maxRetries}</span>
            </div>
            <Slider
              value={[local.maxRetries]}
              onValueChange={([v]) => update("maxRetries", v)}
              min={0} max={5} step={1}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
