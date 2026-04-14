import { useState, useMemo } from "react";
import { Clock, Mail, MessageCircle, Search, Bot, Save, RotateCcw, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { nextDelayMs, type SoftTimerConfig } from "@/lib/time/softTimer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useAppSettings, useUpdateSetting } from "@/hooks/useAppSettings";
import { toast } from "@/hooks/use-toast";
import { createLogger } from "@/lib/log";

const log = createLogger("TimingSettings");

interface TimingField {
  key: string;
  label: string;
  description: string;
  icon: React.ElementType;
  unit: string;
  min: number;
  max: number;
  defaultValue: number;
}

const TIMING_FIELDS: TimingField[] = [
  { key: "email_send_delay", label: "Delay invio email", description: "Secondi tra un'email e la successiva in coda", icon: Mail, unit: "sec", min: 3, max: 120, defaultValue: 10 },
  { key: "email_batch_size", label: "Batch email", description: "Numero massimo email per ciclo di invio", icon: Mail, unit: "email", min: 1, max: 50, defaultValue: 10 },
  { key: "whatsapp_send_delay", label: "Delay invio WhatsApp", description: "Secondi tra un messaggio WhatsApp e il successivo", icon: MessageCircle, unit: "sec", min: 5, max: 120, defaultValue: 15 },
  { key: "linkedin_send_delay", label: "Delay invio LinkedIn", description: "Secondi tra un messaggio LinkedIn e il successivo", icon: MessageCircle, unit: "sec", min: 10, max: 180, defaultValue: 30 },
  { key: "scraping_base_delay", label: "Delay scraping WCA", description: "Secondi tra una pagina e la successiva durante lo scraping", icon: Search, unit: "sec", min: 5, max: 60, defaultValue: 15 },
  { key: "deep_search_delay", label: "Delay Deep Search", description: "Secondi tra una ricerca approfondita e la successiva", icon: Search, unit: "sec", min: 5, max: 120, defaultValue: 20 },
  { key: "agent_cycle_interval", label: "Intervallo ciclo agenti", description: "Minuti tra un ciclo autonomo e il successivo", icon: Bot, unit: "min", min: 5, max: 1440, defaultValue: 60 },
  { key: "agent_max_actions_per_cycle", label: "Max azioni per ciclo", description: "Numero massimo di azioni che un agente può eseguire per ciclo", icon: Bot, unit: "azioni", min: 1, max: 50, defaultValue: 10 },
  { key: "agent_cooldown_after_error", label: "Pausa dopo errore", description: "Minuti di pausa quando un agente incontra un errore", icon: Bot, unit: "min", min: 1, max: 60, defaultValue: 10 },
];

const SCHEDULE_FIELDS = [
  { key: "agent_work_start_hour", label: "Orario inizio lavoro", defaultValue: "08", unit: "ora (0-23)" },
  { key: "agent_work_end_hour", label: "Orario fine lavoro", defaultValue: "19", unit: "ora (0-23)" },
  { key: "agent_work_days", label: "Giorni lavorativi", defaultValue: "1,2,3,4,5", unit: "1=Lun...7=Dom" },
];

export default function TimingSettings() {
  const { data: settings } = useAppSettings();
  const updateSetting = useUpdateSetting();
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});

  const getValue = (key: string, defaultValue: string | number) => {
    if (values[key] !== undefined) return values[key];
    const stored = settings?.[key];
    if (stored) return stored;
    return String(defaultValue);
  };

  const handleChange = (key: string, val: string) => {
    setValues(prev => ({ ...prev, [key]: val }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const allFields = [
        ...TIMING_FIELDS.map(f => ({ key: f.key, value: getValue(f.key, f.defaultValue) })),
        ...SCHEDULE_FIELDS.map(f => ({ key: f.key, value: getValue(f.key, f.defaultValue) })),
      ];
      for (const f of allFields) {
        await updateSetting.mutateAsync({ key: f.key, value: f.value });
      }
      setValues({});
      toast({ title: "✅ Timing salvati", description: "Tutte le configurazioni sono state aggiornate." });
    } catch (e) {
      log.warn("operation failed", { error: e instanceof Error ? e.message : String(e) });
      toast({ title: "Errore", description: "Impossibile salvare i timing." });
    }
    setSaving(false);
  };

  const handleReset = () => {
    const resetVals: Record<string, string> = {};
    TIMING_FIELDS.forEach(f => { resetVals[f.key] = String(f.defaultValue); });
    SCHEDULE_FIELDS.forEach(f => { resetVals[f.key] = f.defaultValue; });
    setValues(resetVals);
  };

  const requireApproval = getValue("agent_require_approval", "true") === "true";

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" /> Timing & Schedulazione
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Configura i tempi di attesa tra le operazioni AI, i limiti per ciclo e gli orari di lavoro degli agenti.
        </p>
      </div>

      <Separator />

      {/* Delay settings */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Delay tra operazioni</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {TIMING_FIELDS.map(field => {
            const Icon = field.icon;
            return (
              <div key={field.key} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
                <Icon className="w-4 h-4 mt-1 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0 space-y-1.5">
                  <Label className="text-xs font-medium">{field.label}</Label>
                  <p className="text-[10px] text-muted-foreground leading-tight">{field.description}</p>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={field.min}
                      max={field.max}
                      value={getValue(field.key, field.defaultValue)}
                      onChange={e => handleChange(field.key, e.target.value)}
                      className="h-7 w-20 text-xs"
                    />
                    <span className="text-[10px] text-muted-foreground">{field.unit}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Separator />

      {/* Schedule settings */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Orari di lavoro agenti</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {SCHEDULE_FIELDS.map(field => (
            <div key={field.key} className="p-3 rounded-lg bg-muted/30 border border-border/50 space-y-1.5">
              <Label className="text-xs font-medium">{field.label}</Label>
              <Input
                value={getValue(field.key, field.defaultValue)}
                onChange={e => handleChange(field.key, e.target.value)}
                className="h-7 text-xs"
                placeholder={field.unit}
              />
              <p className="text-[10px] text-muted-foreground">{field.unit}</p>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* Approval mode */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
        <div>
          <Label className="text-xs font-medium">Richiedi approvazione per azioni AI</Label>
          <p className="text-[10px] text-muted-foreground">Se attivo, ogni azione degli agenti richiede autorizzazione prima dell'esecuzione</p>
        </div>
        <Switch
          checked={requireApproval}
          onCheckedChange={(v) => handleChange("agent_require_approval", v ? "true" : "false")}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <Button onClick={handleSave} disabled={saving} size="sm" className="gap-2">
          <Save className="w-3.5 h-3.5" /> {saving ? "Salvataggio..." : "Salva Timing"}
        </Button>
        <Button onClick={handleReset} variant="outline" size="sm" className="gap-2">
          <RotateCcw className="w-3.5 h-3.5" /> Ripristina Default
        </Button>
      </div>
    </div>
  );
}
