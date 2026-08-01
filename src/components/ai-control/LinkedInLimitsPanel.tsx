/**
 * LinkedInLimitsPanel — Edit LinkedIn operation limits from app_settings
 * Allows administrators to adjust:
 *  - Daily message limit
 *  - Hourly message limit
 *  - Operating window (start/end hours)
 *  - Message delay ranges
 *  - Bulk batch maximum
 */

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppSettings, useUpdateSetting } from "@/hooks/useAppSettings";
import { toast } from "@/hooks/use-toast";
import { createLogger } from "@/lib/log";

const log = createLogger("LinkedInLimitsPanel");

interface LinkedInLimitSettings {
  linkedin_daily_limit: string;
  linkedin_hourly_limit: string;
  linkedin_send_start_hour: string;
  linkedin_send_end_hour: string;
  linkedin_min_delay_seconds: string;
  linkedin_max_delay_seconds: string;
  linkedin_bulk_max: string;
}

const DEFAULT_SETTINGS: LinkedInLimitSettings = {
  linkedin_daily_limit: "50",
  linkedin_hourly_limit: "3",
  linkedin_send_start_hour: "9",
  linkedin_send_end_hour: "19",
  linkedin_min_delay_seconds: "45",
  linkedin_max_delay_seconds: "180",
  linkedin_bulk_max: "50",
};

export function LinkedInLimitsPanel(): React.ReactElement {
  const { data: settings, isLoading } = useAppSettings();
  const updateSetting = useUpdateSetting();
  const [formValues, setFormValues] = useState<LinkedInLimitSettings>(DEFAULT_SETTINGS);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize form with settings from DB
  useEffect(() => {
    if (settings) {
      const newValues: LinkedInLimitSettings = {
        linkedin_daily_limit: settings.linkedin_daily_limit || DEFAULT_SETTINGS.linkedin_daily_limit,
        linkedin_hourly_limit: settings.linkedin_hourly_limit || DEFAULT_SETTINGS.linkedin_hourly_limit,
        linkedin_send_start_hour: settings.linkedin_send_start_hour || DEFAULT_SETTINGS.linkedin_send_start_hour,
        linkedin_send_end_hour: settings.linkedin_send_end_hour || DEFAULT_SETTINGS.linkedin_send_end_hour,
        linkedin_min_delay_seconds: settings.linkedin_min_delay_seconds || DEFAULT_SETTINGS.linkedin_min_delay_seconds,
        linkedin_max_delay_seconds: settings.linkedin_max_delay_seconds || DEFAULT_SETTINGS.linkedin_max_delay_seconds,
        linkedin_bulk_max: settings.linkedin_bulk_max || DEFAULT_SETTINGS.linkedin_bulk_max,
      };
      setFormValues(newValues);
      setIsDirty(false);
    }
  }, [settings]);

  const handleInputChange = (key: keyof LinkedInLimitSettings, value: string) => {
    setFormValues(prev => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  const validateSettings = (): boolean => {
    const daily = parseInt(formValues.linkedin_daily_limit, 10);
    const hourly = parseInt(formValues.linkedin_hourly_limit, 10);
    const startHour = parseInt(formValues.linkedin_send_start_hour, 10);
    const endHour = parseInt(formValues.linkedin_send_end_hour, 10);
    const minDelay = parseInt(formValues.linkedin_min_delay_seconds, 10);
    const maxDelay = parseInt(formValues.linkedin_max_delay_seconds, 10);
    const bulkMax = parseInt(formValues.linkedin_bulk_max, 10);

    if (isNaN(daily) || daily < 1) {
      toast({ title: "Errore", description: "Limite giornaliero deve essere >= 1", variant: "destructive" });
      return false;
    }
    if (isNaN(hourly) || hourly < 1) {
      toast({ title: "Errore", description: "Limite orario deve essere >= 1", variant: "destructive" });
      return false;
    }
    if (isNaN(startHour) || startHour < 0 || startHour > 23) {
      toast({ title: "Errore", description: "Ora inizio deve essere 0-23", variant: "destructive" });
      return false;
    }
    if (isNaN(endHour) || endHour < 0 || endHour > 23) {
      toast({ title: "Errore", description: "Ora fine deve essere 0-23", variant: "destructive" });
      return false;
    }
    if (isNaN(minDelay) || minDelay < 1) {
      toast({ title: "Errore", description: "Delay minimo deve essere >= 1 secondi", variant: "destructive" });
      return false;
    }
    if (isNaN(maxDelay) || maxDelay < minDelay) {
      toast({ title: "Errore", description: "Delay massimo deve essere >= delay minimo", variant: "destructive" });
      return false;
    }
    if (isNaN(bulkMax) || bulkMax < 1) {
      toast({ title: "Errore", description: "Limite bulk deve essere >= 1", variant: "destructive" });
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateSettings()) return;

    setIsSaving(true);
    try {
      const updates = Object.entries(formValues).map(([key, value]) => ({
        key,
        value,
      }));

      let hasError = false;
      for (const { key, value } of updates) {
        try {
          await updateSetting.mutateAsync({ key, value });
        } catch (err) {
          log.error("failed to update setting", { key, error: err });
          hasError = true;
        }
      }

      if (!hasError) {
        toast({
          title: "Impostazioni salvate",
          description: "I limiti LinkedIn sono stati aggiornati.",
          variant: "default",
        });
        setIsDirty(false);
      } else {
        toast({
          title: "Errore parziale",
          description: "Alcuni limiti non sono stati salvati. Controlla la console.",
          variant: "destructive",
        });
      }
    } catch (err) {
      log.error("save error", { error: err });
      toast({
        title: "Errore",
        description: "Impossibile salvare le impostazioni.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (settings) {
      const newValues: LinkedInLimitSettings = {
        linkedin_daily_limit: settings.linkedin_daily_limit || DEFAULT_SETTINGS.linkedin_daily_limit,
        linkedin_hourly_limit: settings.linkedin_hourly_limit || DEFAULT_SETTINGS.linkedin_hourly_limit,
        linkedin_send_start_hour: settings.linkedin_send_start_hour || DEFAULT_SETTINGS.linkedin_send_start_hour,
        linkedin_send_end_hour: settings.linkedin_send_end_hour || DEFAULT_SETTINGS.linkedin_send_end_hour,
        linkedin_min_delay_seconds: settings.linkedin_min_delay_seconds || DEFAULT_SETTINGS.linkedin_min_delay_seconds,
        linkedin_max_delay_seconds: settings.linkedin_max_delay_seconds || DEFAULT_SETTINGS.linkedin_max_delay_seconds,
        linkedin_bulk_max: settings.linkedin_bulk_max || DEFAULT_SETTINGS.linkedin_bulk_max,
      };
      setFormValues(newValues);
      setIsDirty(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Limiti LinkedIn</CardTitle>
          <CardDescription>Caricamento...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Limiti Operativi LinkedIn</CardTitle>
        <CardDescription>
          Configura i limiti di invio messaggi LinkedIn. Questi parametri si applicano a tutti gli utenti.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Daily and Hourly Limits */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="daily_limit">Limite Giornaliero</Label>
            <Input
              id="daily_limit"
              type="number"
              min="1"
              value={formValues.linkedin_daily_limit}
              onChange={(e) => handleInputChange("linkedin_daily_limit", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Messaggi al giorno</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="hourly_limit">Limite Orario</Label>
            <Input
              id="hourly_limit"
              type="number"
              min="1"
              value={formValues.linkedin_hourly_limit}
              onChange={(e) => handleInputChange("linkedin_hourly_limit", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Messaggi all'ora</p>
          </div>
        </div>

        {/* Operating Window */}
        <div className="space-y-3 border-t pt-4">
          <h3 className="text-sm font-semibold">Finestra Operativa (CET)</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_hour">Ora Inizio</Label>
              <Input
                id="start_hour"
                type="number"
                min="0"
                max="23"
                value={formValues.linkedin_send_start_hour}
                onChange={(e) => handleInputChange("linkedin_send_start_hour", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">0-23</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_hour">Ora Fine</Label>
              <Input
                id="end_hour"
                type="number"
                min="0"
                max="23"
                value={formValues.linkedin_send_end_hour}
                onChange={(e) => handleInputChange("linkedin_send_end_hour", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">0-23</p>
            </div>
          </div>
        </div>

        {/* Delay Range */}
        <div className="space-y-3 border-t pt-4">
          <h3 className="text-sm font-semibold">Intervallo Delay Tra Messaggi</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="min_delay">Delay Minimo</Label>
              <Input
                id="min_delay"
                type="number"
                min="1"
                value={formValues.linkedin_min_delay_seconds}
                onChange={(e) => handleInputChange("linkedin_min_delay_seconds", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Secondi</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="max_delay">Delay Massimo</Label>
              <Input
                id="max_delay"
                type="number"
                min="1"
                value={formValues.linkedin_max_delay_seconds}
                onChange={(e) => handleInputChange("linkedin_max_delay_seconds", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Secondi</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Random delay tra questi valori per simulare comportamento umano
          </p>
        </div>

        {/* Bulk Maximum */}
        <div className="space-y-3 border-t pt-4">
          <div className="space-y-2">
            <Label htmlFor="bulk_max">Massimo Batch Bulk</Label>
            <Input
              id="bulk_max"
              type="number"
              min="1"
              value={formValues.linkedin_bulk_max}
              onChange={(e) => handleInputChange("linkedin_bulk_max", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Messaggi massimi per invio bulk</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 border-t pt-4">
          <Button onClick={handleSave} disabled={!isDirty || isSaving}>
            {isSaving ? "Salvataggio..." : "Salva Modifiche"}
          </Button>
          <Button variant="outline" onClick={handleReset} disabled={!isDirty || isSaving}>
            Annulla
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
