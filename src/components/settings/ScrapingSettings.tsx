import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Save, Loader2, Shield, Zap, Clock, Moon, AlertTriangle } from "lucide-react";
import { useScrapingSettings, SCRAPING_KEY_MAP, SCRAPING_DEFAULTS, type ScrapingSettings as ScrapingSettingsType } from "@/hooks/useScrapingSettings";
import { useUpdateSetting } from "@/hooks/useAppSettings";
import { toast } from "sonner";

export function ScrapingSettingsPanel() {
  const { settings, isLoading } = useScrapingSettings();
  const updateSetting = useUpdateSetting();
  const [local, setLocal] = useState<ScrapingSettingsType>(SCRAPING_DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setLocal(settings);
      setDirty(false);
    }
  }, [settings, isLoading]);

  const update = <K extends keyof ScrapingSettingsType>(key: K, value: ScrapingSettingsType[K]) => {
    setLocal((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const entries = Object.entries(SCRAPING_KEY_MAP) as [keyof ScrapingSettingsType, string][];
      for (const [field, dbKey] of entries) {
        const val = local[field];
        const defaultVal = SCRAPING_DEFAULTS[field];
        // Only save if different from what's in DB
        if (val !== settings[field]) {
          await updateSetting.mutateAsync({ key: dbKey, value: String(val) });
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

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

      {/* ── 1. Velocità e Limiti ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            <CardTitle className="text-base">Velocità e Limiti</CardTitle>
          </div>
          <CardDescription>Controlla la velocità di scraping per evitare blocchi</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Delay minimo */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Delay minimo consentito</Label>
              <span className="text-sm font-mono text-primary">{local.delayMin}s</span>
            </div>
            <Slider
              value={[local.delayMin]}
              onValueChange={([v]) => update("delayMin", v)}
              min={0} max={30} step={1}
            />
            <p className="text-xs text-muted-foreground">Impedisce di impostare velocità pericolose. Valore raccomandato: ≥10s</p>
            {local.delayMin < 10 && (
              <div className="flex items-center gap-1.5 text-xs text-destructive">
                <AlertTriangle className="w-3.5 h-3.5" />
                Delay inferiore a 10s aumenta il rischio di ban
              </div>
            )}
          </div>

          <Separator />

          {/* Delay massimo */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Delay massimo</Label>
              <span className="text-sm font-mono text-primary">{local.delayMax}s</span>
            </div>
            <Slider
              value={[local.delayMax]}
              onValueChange={([v]) => update("delayMax", Math.max(v, local.delayMin))}
              min={10} max={120} step={5}
            />
          </div>

          <Separator />

          {/* Delay default */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Delay predefinito per nuovi job</Label>
              <span className="text-sm font-mono text-primary">{local.delayDefault}s</span>
            </div>
            <Slider
              value={[local.delayDefault]}
              onValueChange={([v]) => update("delayDefault", Math.min(Math.max(v, local.delayMin), local.delayMax))}
              min={local.delayMin} max={local.delayMax} step={1}
            />
          </div>

          <Separator />

          {/* Tempo medio scraping */}
          <div className="space-y-2">
            <Label>Tempo medio scraping stimato (per calcolo ETA)</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={local.avgScrapeTime}
                onChange={(e) => update("avgScrapeTime", Math.max(1, Number(e.target.value) || 1))}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">secondi</span>
            </div>
          </div>

          <Separator />

          {/* Default pipeline options */}
          <div className="space-y-3">
            <Label>Opzioni pipeline predefinite</Label>
            <label className="flex items-center gap-3 cursor-pointer">
              <Switch checked={local.enrichDefault} onCheckedChange={(v) => update("enrichDefault", v)} />
              <div>
                <span className="text-sm">Arricchimento Sito</span>
                <p className="text-xs text-muted-foreground">Attiva di default l'arricchimento tramite scraping del sito web</p>
              </div>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <Switch checked={local.deepSearchDefault} onCheckedChange={(v) => update("deepSearchDefault", v)} />
              <div>
                <span className="text-sm">Deep Search</span>
                <p className="text-xs text-muted-foreground">Attiva di default la ricerca approfondita (LinkedIn, social)</p>
              </div>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* ── 2. Sicurezza Sessione ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            <CardTitle className="text-base">Sicurezza Sessione</CardTitle>
          </div>
          <CardDescription>Parametri di auto-recovery e protezione della connessione</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Recovery threshold */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Soglia recovery sessione</Label>
              <span className="text-sm font-mono text-primary">{local.recoveryThreshold} vuoti</span>
            </div>
            <Slider
              value={[local.recoveryThreshold]}
              onValueChange={([v]) => update("recoveryThreshold", v)}
              min={1} max={10} step={1}
            />
            <p className="text-xs text-muted-foreground">Dopo N partner vuoti consecutivi, tenta il recovery automatico</p>
          </div>

          <Separator />

          {/* Exclude threshold */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Soglia auto-esclusione network</Label>
              <span className="text-sm font-mono text-primary">{local.excludeThreshold} tentativi</span>
            </div>
            <Slider
              value={[local.excludeThreshold]}
              onValueChange={([v]) => update("excludeThreshold", v)}
              min={1} max={10} step={1}
            />
            <p className="text-xs text-muted-foreground">Network con 0% successo dopo N tentativi viene escluso automaticamente</p>
          </div>

          <Separator />

          {/* Anti-throttling gap */}
          <div className="space-y-2">
            <Label>Soglia anti-throttling</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={Math.round(local.throttleGapMs / 1000)}
                onChange={(e) => update("throttleGapMs", Math.max(30, Number(e.target.value) || 120) * 1000)}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">secondi (gap tra partner che attiva sync cookie)</span>
            </div>
          </div>

          <Separator />

          {/* Recovery wait times */}
          <div className="space-y-3">
            <Label>Pause tra tentativi di recovery</Label>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">1° tentativo</span>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    value={Math.round(local.recoveryWait1 / 1000)}
                    onChange={(e) => update("recoveryWait1", Math.max(1, Number(e.target.value) || 3) * 1000)}
                    className="w-16 text-center"
                  />
                  <span className="text-xs text-muted-foreground">s</span>
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">2° tentativo</span>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    value={Math.round(local.recoveryWait2 / 1000)}
                    onChange={(e) => update("recoveryWait2", Math.max(1, Number(e.target.value) || 10) * 1000)}
                    className="w-16 text-center"
                  />
                  <span className="text-xs text-muted-foreground">s</span>
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">3° tentativo</span>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    value={Math.round(local.recoveryWait3 / 1000)}
                    onChange={(e) => update("recoveryWait3", Math.max(1, Number(e.target.value) || 30) * 1000)}
                    className="w-16 text-center"
                  />
                  <span className="text-xs text-muted-foreground">s</span>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Keep-alive interval */}
          <div className="space-y-2">
            <Label>Keep-alive interval</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={Math.round(local.keepAliveMs / 1000)}
                onChange={(e) => update("keepAliveMs", Math.max(10, Number(e.target.value) || 30) * 1000)}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">secondi</span>
            </div>
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

      {/* ── 3. Pause Programmate ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Moon className="w-4 h-4 text-primary" />
            <CardTitle className="text-base">Pause Programmate</CardTitle>
          </div>
          <CardDescription>Simula un comportamento umano con pause regolari e notturne</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Night pause */}
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <Switch checked={local.nightPause} onCheckedChange={(v) => update("nightPause", v)} />
              <div>
                <span className="text-sm font-medium">Pausa notturna</span>
                <p className="text-xs text-muted-foreground">Ferma lo scraping durante la notte e riprende automaticamente</p>
              </div>
            </label>
            {local.nightPause && (
              <div className="grid grid-cols-2 gap-4 ml-14">
                <div className="space-y-1">
                  <Label className="text-xs">Stop alle ore</Label>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      value={local.nightStopHour}
                      onChange={(e) => update("nightStopHour", Math.min(23, Math.max(0, Number(e.target.value) || 0)))}
                      className="w-16 text-center"
                      min={0} max={23}
                    />
                    <span className="text-xs text-muted-foreground">:00</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Riprendi alle ore</Label>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      value={local.nightStartHour}
                      onChange={(e) => update("nightStartHour", Math.min(23, Math.max(0, Number(e.target.value) || 0)))}
                      className="w-16 text-center"
                      min={0} max={23}
                    />
                    <span className="text-xs text-muted-foreground">:00</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Periodic pause */}
          <div className="space-y-3">
            <Label>Pausa lunga periodica</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Ogni N partner</span>
                <Input
                  type="number"
                  value={local.pauseEveryN}
                  onChange={(e) => update("pauseEveryN", Math.max(0, Number(e.target.value) || 0))}
                  placeholder="0 = disattivo"
                />
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Durata pausa</span>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    value={Math.round(local.pauseDurationS / 60)}
                    onChange={(e) => update("pauseDurationS", Math.max(1, Number(e.target.value) || 5) * 60)}
                    className="w-16"
                  />
                  <span className="text-xs text-muted-foreground">minuti</span>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {local.pauseEveryN > 0
                ? `Pausa di ${Math.round(local.pauseDurationS / 60)} minuti ogni ${local.pauseEveryN} partner processati`
                : "Disattivato (0 = nessuna pausa periodica)"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Save button (bottom) */}
      {dirty && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Salva Tutte le Modifiche
          </Button>
        </div>
      )}
    </div>
  );
}
