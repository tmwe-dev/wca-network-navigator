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

const WA_STEALTH_KEYS = [
  { key: "wa_scan_enabled", defaultValue: "true" },
  { key: "wa_scan_interval_sec", defaultValue: "120" },
  { key: "wa_scan_top_chats", defaultValue: "8" },
  { key: "wa_scan_max_deep_reads", defaultValue: "3" },
  { key: "wa_scan_stagger_sec", defaultValue: "15" },
  { key: "wa_scan_jitter_pct", defaultValue: "25" },
  { key: "wa_scan_long_pause_pct", defaultValue: "10" },
  { key: "wa_scan_quick_check_pct", defaultValue: "5" },
  { key: "wa_scan_work_start_hour", defaultValue: "7" },
  { key: "wa_scan_work_end_hour", defaultValue: "22" },
];

const LI_STEALTH_KEYS = [
  { key: "li_scan_enabled", defaultValue: "true" },
  { key: "li_scan_interval_sec", defaultValue: "14400" },
  { key: "li_scan_top_threads", defaultValue: "10" },
  { key: "li_scan_max_deep_reads", defaultValue: "2" },
  { key: "li_scan_stagger_sec", defaultValue: "60" },
  { key: "li_scan_jitter_pct", defaultValue: "30" },
  { key: "li_scan_long_pause_pct", defaultValue: "15" },
  { key: "li_scan_quick_check_pct", defaultValue: "3" },
  { key: "li_scan_work_start_hour", defaultValue: "8" },
  { key: "li_scan_work_end_hour", defaultValue: "20" },
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
        ...WA_STEALTH_KEYS.map(k => ({ key: k.key, value: getValue(k.key, k.defaultValue) })),
        ...LI_STEALTH_KEYS.map(k => ({ key: k.key, value: getValue(k.key, k.defaultValue) })),
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

      {/* WhatsApp Stealth Section */}
      <WhatsAppStealthSection getValue={getValue} handleChange={handleChange} />

      <Separator />

      {/* LinkedIn Stealth Section */}
      <LinkedInStealthSection getValue={getValue} handleChange={handleChange} />

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

// ── WhatsApp Stealth Section ──

interface StealthProps {
  getValue: (key: string, def: string | number) => string;
  handleChange: (key: string, val: string) => void;
}

function WhatsAppStealthSection({ getValue, handleChange }: StealthProps) {
  const intervalSec = Number(getValue("wa_scan_interval_sec", "120"));
  const jitterPct = Number(getValue("wa_scan_jitter_pct", "25"));
  const longPausePct = Number(getValue("wa_scan_long_pause_pct", "10"));
  const quickCheckPct = Number(getValue("wa_scan_quick_check_pct", "5"));
  const normalPct = 100 - longPausePct - quickCheckPct;
  const workStart = getValue("wa_scan_work_start_hour", "7");
  const workEnd = getValue("wa_scan_work_end_hour", "22");
  const enabled = getValue("wa_scan_enabled", "true") === "true";

  // Estimate next delay for live preview
  const estimatedCfg: SoftTimerConfig = useMemo(() => ({
    baseIntervalSec: intervalSec,
    jitterPct,
    longPauseChancePct: longPausePct,
    longPauseMinMult: 1.8,
    longPauseMaxMult: 3.5,
    quickCheckChancePct: quickCheckPct,
    quickCheckMinMult: 0.5,
    quickCheckMaxMult: 0.8,
    antiRepeatToleranceMs: 1500,
  }), [intervalSec, jitterPct, longPausePct, quickCheckPct]);

  const sampleDelay = useMemo(() => nextDelayMs(estimatedCfg), [estimatedCfg]);
  const estMin = Math.floor(sampleDelay.delayMs / 60000);
  const estSec = Math.round((sampleDelay.delayMs % 60000) / 1000);

  const sliders: { key: string; label: string; min: number; max: number; unit: string }[] = [
    { key: "wa_scan_interval_sec", label: "Intervallo base", min: 60, max: 600, unit: "sec" },
    { key: "wa_scan_top_chats", label: "Chat da scansionare", min: 3, max: 20, unit: "chat" },
    { key: "wa_scan_max_deep_reads", label: "Max letture deep", min: 1, max: 10, unit: "chat" },
    { key: "wa_scan_stagger_sec", label: "Stagger tra deep reads", min: 5, max: 60, unit: "sec" },
    { key: "wa_scan_jitter_pct", label: "Jitter", min: 0, max: 50, unit: "%" },
    { key: "wa_scan_long_pause_pct", label: "Prob. pausa lunga", min: 0, max: 30, unit: "%" },
    { key: "wa_scan_quick_check_pct", label: "Prob. check rapido", min: 0, max: 20, unit: "%" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Shield className="w-4 h-4 text-primary" />
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">WhatsApp — Lettura Stealth</h4>
      </div>
      <p className="text-[10px] text-muted-foreground leading-relaxed">
        Modalità stealth: intervalli variabili e pause notturne per simulare un pattern umano. Nessun ritmo regolare. Valori alti = più sicuro, più latenza.
      </p>

      {/* Enable switch */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
        <Label className="text-xs font-medium">Scansione stealth attiva</Label>
        <Switch
          checked={enabled}
          onCheckedChange={(v) => handleChange("wa_scan_enabled", v ? "true" : "false")}
        />
      </div>

      {/* Sliders */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sliders.map(s => {
          const val = Number(getValue(s.key, WA_STEALTH_KEYS.find(k => k.key === s.key)?.defaultValue || "0"));
          return (
            <div key={s.key} className="p-3 rounded-lg bg-muted/30 border border-border/50 space-y-2">
              <div className="flex justify-between items-center">
                <Label className="text-xs font-medium">{s.label}</Label>
                <span className="text-xs font-mono text-muted-foreground">{val} {s.unit}</span>
              </div>
              <Slider
                min={s.min}
                max={s.max}
                step={1}
                value={[val]}
                onValueChange={([v]) => handleChange(s.key, String(v))}
              />
            </div>
          );
        })}
      </div>

      {/* Work hours */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-3 rounded-lg bg-muted/30 border border-border/50 space-y-1.5">
          <Label className="text-xs font-medium">Inizio lavoro (CET)</Label>
          <Input
            type="number"
            min={0}
            max={23}
            value={workStart}
            onChange={e => handleChange("wa_scan_work_start_hour", e.target.value)}
            className="h-7 text-xs"
          />
        </div>
        <div className="p-3 rounded-lg bg-muted/30 border border-border/50 space-y-1.5">
          <Label className="text-xs font-medium">Fine lavoro (CET)</Label>
          <Input
            type="number"
            min={1}
            max={24}
            value={workEnd}
            onChange={e => handleChange("wa_scan_work_end_hour", e.target.value)}
            className="h-7 text-xs"
          />
        </div>
      </div>

      {/* Live preview */}
      <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-1">
        <p className="text-xs font-medium text-primary">Anteprima distribuzione</p>
        <p className="text-[10px] text-muted-foreground">
          Prossima lettura stimata: tra ~{estMin}m {estSec}s ({sampleDelay.pattern})
        </p>
        <p className="text-[10px] text-muted-foreground">
          Distribuzione: {normalPct}% normale, {longPausePct}% pausa lunga, {quickCheckPct}% rapida
        </p>
        <p className="text-[10px] text-muted-foreground">
          Pausa notturna: dalle {workEnd}:00 alle {workStart}:00 (CET)
        </p>
      </div>
    </div>
  );
}

// ── LinkedIn Stealth Section ──

function LinkedInStealthSection({ getValue, handleChange }: StealthProps) {
  const intervalSec = Number(getValue("li_scan_interval_sec", "14400"));
  const jitterPct = Number(getValue("li_scan_jitter_pct", "30"));
  const longPausePct = Number(getValue("li_scan_long_pause_pct", "15"));
  const quickCheckPct = Number(getValue("li_scan_quick_check_pct", "3"));
  const normalPct = 100 - longPausePct - quickCheckPct;
  const workStart = getValue("li_scan_work_start_hour", "8");
  const workEnd = getValue("li_scan_work_end_hour", "20");
  const enabled = getValue("li_scan_enabled", "true") === "true";

  const workHours = Number(workEnd) - Number(workStart);
  const estimatedDaily = workHours > 0 ? Math.round((workHours * 3600) / intervalSec * 10) / 10 : 0;

  const estimatedCfg: SoftTimerConfig = useMemo(() => ({
    baseIntervalSec: intervalSec,
    jitterPct,
    longPauseChancePct: longPausePct,
    longPauseMinMult: 1.5,
    longPauseMaxMult: 3.0,
    quickCheckChancePct: quickCheckPct,
    quickCheckMinMult: 0.5,
    quickCheckMaxMult: 0.8,
    antiRepeatToleranceMs: 5000,
  }), [intervalSec, jitterPct, longPausePct, quickCheckPct]);

  const sampleDelay = useMemo(() => nextDelayMs(estimatedCfg), [estimatedCfg]);
  const estHours = Math.floor(sampleDelay.delayMs / 3600000);
  const estMin = Math.floor((sampleDelay.delayMs % 3600000) / 60000);

  const formatInterval = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.round((sec % 3600) / 60);
    return `${h}h ${m.toString().padStart(2, "0")}min`;
  };

  const sliders: { key: string; label: string; min: number; max: number; step?: number; unit: string; format?: (v: number) => string }[] = [
    { key: "li_scan_interval_sec", label: "Intervallo base", min: 3600, max: 28800, step: 600, unit: "", format: formatInterval },
    { key: "li_scan_top_threads", label: "Thread da scansionare", min: 5, max: 25, unit: "thread" },
    { key: "li_scan_max_deep_reads", label: "Max letture deep", min: 1, max: 5, unit: "thread" },
    { key: "li_scan_stagger_sec", label: "Stagger tra deep reads", min: 30, max: 180, unit: "sec" },
    { key: "li_scan_jitter_pct", label: "Jitter", min: 0, max: 50, unit: "%" },
    { key: "li_scan_long_pause_pct", label: "Prob. pausa lunga", min: 0, max: 30, unit: "%" },
    { key: "li_scan_quick_check_pct", label: "Prob. check rapido", min: 0, max: 10, unit: "%" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Shield className="w-4 h-4 text-primary" />
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">LinkedIn — Lettura Stealth</h4>
      </div>
      <p className="text-[10px] text-muted-foreground leading-relaxed">
        Modalità stealth LinkedIn: letture rare (4-6 al giorno) a orari umani. LinkedIn rileva scraping più facilmente di WhatsApp. Usa il pulsante "Leggi ora" per refresh manuale.
      </p>

      {/* Enable switch */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
        <Label className="text-xs font-medium">Scansione stealth LinkedIn attiva</Label>
        <Switch
          checked={enabled}
          onCheckedChange={(v) => handleChange("li_scan_enabled", v ? "true" : "false")}
        />
      </div>

      {/* Sliders */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sliders.map(s => {
          const val = Number(getValue(s.key, LI_STEALTH_KEYS.find(k => k.key === s.key)?.defaultValue || "0"));
          const displayVal = s.format ? s.format(val) : `${val} ${s.unit}`;
          return (
            <div key={s.key} className="p-3 rounded-lg bg-muted/30 border border-border/50 space-y-2">
              <div className="flex justify-between items-center">
                <Label className="text-xs font-medium">{s.label}</Label>
                <span className="text-xs font-mono text-muted-foreground">{displayVal}</span>
              </div>
              <Slider
                min={s.min}
                max={s.max}
                step={s.step || 1}
                value={[val]}
                onValueChange={([v]) => handleChange(s.key, String(v))}
              />
            </div>
          );
        })}
      </div>

      {/* Work hours */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-3 rounded-lg bg-muted/30 border border-border/50 space-y-1.5">
          <Label className="text-xs font-medium">Inizio lavoro (CET)</Label>
          <Input
            type="number"
            min={0}
            max={23}
            value={workStart}
            onChange={e => handleChange("li_scan_work_start_hour", e.target.value)}
            className="h-7 text-xs"
          />
        </div>
        <div className="p-3 rounded-lg bg-muted/30 border border-border/50 space-y-1.5">
          <Label className="text-xs font-medium">Fine lavoro (CET)</Label>
          <Input
            type="number"
            min={1}
            max={24}
            value={workEnd}
            onChange={e => handleChange("li_scan_work_end_hour", e.target.value)}
            className="h-7 text-xs"
          />
        </div>
      </div>

      {/* Live preview */}
      <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-1">
        <p className="text-xs font-medium text-primary">Anteprima distribuzione</p>
        <p className="text-[10px] text-muted-foreground">
          Prossima lettura: tra ~{estHours > 0 ? `${estHours}h ` : ""}{estMin}m ({sampleDelay.pattern})
        </p>
        <p className="text-[10px] text-muted-foreground">
          Letture stimate al giorno: {estimatedDaily}
        </p>
        <p className="text-[10px] text-muted-foreground">
          Distribuzione: {normalPct}% normale, {longPausePct}% pausa lunga, {quickCheckPct}% rapida
        </p>
        <p className="text-[10px] text-muted-foreground">
          Pausa notturna: dalle {workEnd}:00 alle {workStart}:00 (CET)
        </p>
      </div>
    </div>
  );
}
