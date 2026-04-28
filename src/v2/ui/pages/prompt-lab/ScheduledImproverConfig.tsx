/**
 * ScheduledImproverConfig — UI per configurare il "Migliora tutto" settimanale automatico.
 *
 * Permette all'utente di:
 * 1. Abilitare/disabilitare la programmazione settimanale
 * 2. Selezionare il giorno della settimana (default: lunedì)
 * 3. Selezionare l'ora di esecuzione (default: 06:00)
 * 4. Salvare la configurazione in app_settings
 * 5. Visualizzare l'ultima esecuzione e la prossima programmata
 * 6. Trigger manuale "Esegui ora"
 */

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/AuthProvider";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calendar, Clock, Loader2, Play, AlertCircle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

import { createLogger } from "@/lib/log";
const log = createLogger("ScheduledImproverConfig");

interface ScheduledImproverConfig {
  enabled: boolean;
  dayOfWeek: number; // 0 = domenica, 1 = lunedì, ..., 6 = sabato
  hour: number; // 0-23
  lastRunAt?: string;
  nextRunAt?: string;
}

const DAYS_OF_WEEK = [
  { value: "0", label: "Domenica" },
  { value: "1", label: "Lunedì" },
  { value: "2", label: "Martedì" },
  { value: "3", label: "Mercoledì" },
  { value: "4", label: "Giovedì" },
  { value: "5", label: "Venerdì" },
  { value: "6", label: "Sabato" },
];

const HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: String(i),
  label: `${String(i).padStart(2, "0")}:00`,
}));

interface ScheduledImproverConfigProps {
  onRunNow?: () => void;
}

export function ScheduledImproverConfig({ onRunNow }: ScheduledImproverConfigProps) {
  const { user } = useAuth();
  const userId = user?.id ?? "";

  // State per la configurazione
  const [config, setConfig] = useState<ScheduledImproverConfig>({
    enabled: false,
    dayOfWeek: 1, // lunedì
    hour: 6, // 06:00
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [runningNow, setRunningNow] = useState(false);

  // Carica configurazione da app_settings
  const loadConfig = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "prompt_lab_scheduled_improve")
        .single();

      if (error || !data) {
        // Se non esiste, usa i defaults
        setConfig({
          enabled: false,
          dayOfWeek: 1,
          hour: 6,
        });
      } else {
        try {
          const parsed = JSON.parse(data.value as string) as ScheduledImproverConfig;
          setConfig(parsed);
        } catch {
          // JSON non valido, fallback ai defaults
          setConfig({
            enabled: false,
            dayOfWeek: 1,
            hour: 6,
          });
        }
      }
    } catch (err) {
      toast.error("Errore nel caricamento configurazione");
      log.error(err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Carica al mount
  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // Salva configurazione
  const saveConfig = useCallback(
    async (newConfig: ScheduledImproverConfig) => {
      if (!userId) return;
      setSaving(true);
      try {
        const { error } = await supabase
          .from("app_settings")
          .upsert({
            key: "prompt_lab_scheduled_improve",
            value: JSON.stringify(newConfig),
            user_id: userId,
          });

        if (error) throw error;

        setConfig(newConfig);
        toast.success(
          newConfig.enabled
            ? `Programmazione attivata: ogni ${DAYS_OF_WEEK.find((d) => d.value === String(newConfig.dayOfWeek))?.label} alle ${String(newConfig.hour).padStart(2, "0")}:00`
            : "Programmazione disattivata"
        );
      } catch (err) {
        toast.error("Errore nel salvataggio configurazione");
        log.error(err);
      } finally {
        setSaving(false);
      }
    },
    [userId]
  );

  const handleToggleEnabled = useCallback(
    (enabled: boolean) => {
      saveConfig({
        ...config,
        enabled,
      });
    },
    [config, saveConfig]
  );

  const handleChangeDay = useCallback(
    (day: string) => {
      saveConfig({
        ...config,
        dayOfWeek: parseInt(day, 10),
      });
    },
    [config, saveConfig]
  );

  const handleChangeHour = useCallback(
    (hour: string) => {
      saveConfig({
        ...config,
        hour: parseInt(hour, 10),
      });
    },
    [config, saveConfig]
  );

  const handleRunNow = useCallback(async () => {
    setRunningNow(true);
    try {
      if (onRunNow) {
        onRunNow();
      }
      toast.success("Avvio 'Migliora tutto'...");
    } catch (err) {
      toast.error("Errore nell'avvio manuale");
      log.error(err);
    } finally {
      setRunningNow(false);
    }
  }, [onRunNow]);

  const nextRunDate = useCallback(() => {
    if (!config.enabled) return null;

    const now = new Date();
    const target = new Date();
    const currentDay = target.getDay();
    const daysUntilTarget = (config.dayOfWeek - currentDay + 7) % 7 || 7;

    target.setDate(target.getDate() + daysUntilTarget);
    target.setHours(config.hour, 0, 0, 0);

    // Se il giorno è oggi e l'ora è già passata, sposta a prossima settimana
    if (daysUntilTarget === 0 && target <= now) {
      target.setDate(target.getDate() + 7);
    }

    return target;
  }, [config.enabled, config.dayOfWeek, config.hour]);

  const nextRun = nextRunDate();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sezione abilitazione */}
      <div className="flex items-center justify-between rounded border bg-muted/20 p-3">
        <div className="flex items-center gap-3 flex-1">
          <div>
            <p className="text-sm font-medium">Programmazione settimanale</p>
            <p className="text-xs text-muted-foreground">
              Esegui automaticamente "Migliora tutto" ogni settimana
            </p>
          </div>
        </div>
        <Switch
          checked={config.enabled}
          onCheckedChange={handleToggleEnabled}
          disabled={saving}
        />
      </div>

      {/* Selezioni giorno/ora (visibili solo se abilitato) */}
      {config.enabled && (
        <div className="space-y-3 rounded border p-3">
          <div className="grid grid-cols-2 gap-3">
            {/* Giorno della settimana */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                Giorno
              </Label>
              <Select
                value={String(config.dayOfWeek)}
                onValueChange={handleChangeDay}
                disabled={saving}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS_OF_WEEK.map((day) => (
                    <SelectItem key={day.value} value={day.value}>
                      {day.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Ora */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Ora
              </Label>
              <Select
                value={String(config.hour)}
                onValueChange={handleChangeHour}
                disabled={saving}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {HOURS.map((h) => (
                    <SelectItem key={h.value} value={h.value}>
                      {h.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Prossima esecuzione */}
          {nextRun && (
            <div className="rounded bg-primary/10 border border-primary/30 p-2">
              <p className="text-xs text-muted-foreground">
                Prossima esecuzione:
              </p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="default" className="text-[11px]">
                  {nextRun.toLocaleDateString("it-IT", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Badge>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Info e avviso */}
      {config.enabled && (
        <div className="rounded border border-amber-500/40 bg-amber-500/5 p-2.5 flex gap-2">
          <AlertCircle className="h-4 w-4 text-amber-700 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700">
            L'esecuzione automatica richiede che il sistema sia attivo. Verificare i log nelle impostazioni di sistema.
          </p>
        </div>
      )}

      <Separator className="my-2" />

      {/* Pulsante Esegui ora */}
      <Button
        size="sm"
        variant="outline"
        onClick={handleRunNow}
        disabled={runningNow}
        className="w-full gap-2"
      >
        {runningNow ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Play className="h-3.5 w-3.5" />
        )}
        Esegui subito
      </Button>
    </div>
  );
}
