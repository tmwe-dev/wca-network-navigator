/**
 * NotificationPreferences — Toggle switches for notification preferences
 * Saves to app_settings table
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/providers/AuthProvider";

interface NotificationSetting {
  key: string;
  label: string;
  description: string;
  value: boolean;
}

const DEFAULT_SETTINGS: NotificationSetting[] = [
  {
    key: "notify_email_received",
    label: "Nuova email ricevuta",
    description: "Notifica quando viene ricevuta una nuova email",
    value: true,
  },
  {
    key: "notify_outreach_response",
    label: "Risposta a outreach",
    description: "Notifica quando qualcuno risponde a una campagna di outreach",
    value: true,
  },
  {
    key: "notify_deal_stage_change",
    label: "Cambio fase deal",
    description: "Notifica quando uno stato dell'affare cambia",
    value: true,
  },
  {
    key: "notify_ai_automation_complete",
    label: "Automazione IA completata",
    description: "Notifica quando un'automazione IA termina l'esecuzione",
    value: true,
  },
  {
    key: "notify_system_error",
    label: "Errore di sistema",
    description: "Notifica per errori critici del sistema",
    value: true,
  },
  {
    key: "notify_in_app",
    label: "Notifiche in-app",
    description: "Mostra notifiche toast all'interno dell'applicazione",
    value: true,
  },
];

export function NotificationPreferences() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<NotificationSetting[]>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Load settings from database
  useEffect(() => {
    if (!user) return;

    const loadSettings = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("app_settings")
          .select("*")
          .eq("user_id", user.id);

        if (error) throw error;

        if (data && data.length > 0) {
          const settingsMap = data.reduce(
            (acc, row) => {
              acc[row.key] = row.value === true || row.value === "true";
              return acc;
            },
            {} as Record<string, boolean>
          );

          setSettings((prev) =>
            prev.map((setting) => ({
              ...setting,
              value: settingsMap[setting.key] ?? setting.value,
            }))
          );
        }
      } catch (err) {
        console.error("Error loading settings:", err);
        setError("Errore nel caricamento delle preferenze");
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [user]);

  const handleToggle = (key: string) => {
    setSettings((prev) =>
      prev.map((setting) =>
        setting.key === key ? { ...setting, value: !setting.value } : setting
      )
    );
    setSaved(false);
  };

  const handleSave = async () => {
    if (!user) {
      toast.error("Utente non autenticato");
      return;
    }

    try {
      setSaving(true);
      setError(null);

      // Upsert each setting
      const promises = settings.map((setting) =>
        supabase.from("app_settings").upsert(
          {
            user_id: user.id,
            key: setting.key,
            value: setting.value,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,key" }
        )
      );

      const results = await Promise.all(promises);

      // Check for errors
      for (const result of results) {
        if (result.error) throw result.error;
      }

      setSaved(true);
      toast.success("Preferenze di notifica salvate");

      // Reset saved state after 3 seconds
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error("Error saving settings:", err);
      const errorMsg = err instanceof Error ? err.message : "Errore sconosciuto";
      setError(errorMsg);
      toast.error("Errore nel salvataggio delle preferenze");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error alert */}
      {error && (
        <Card className="p-4 bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 flex gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-sm text-red-900 dark:text-red-100">
              Errore
            </div>
            <div className="text-sm text-red-800 dark:text-red-200 mt-1">{error}</div>
          </div>
        </Card>
      )}

      {/* Settings */}
      <Card className="p-6 space-y-6">
        <div>
          <h3 className="font-semibold text-lg">Preferenze di Notifica</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Personalizza come e quando desideri ricevere le notifiche
          </p>
        </div>

        <div className="space-y-4">
          {settings.map((setting) => (
            <div
              key={setting.key}
              className="flex items-start justify-between p-3 rounded-lg hover:bg-muted/50 transition"
            >
              <div className="space-y-1 flex-1">
                <Label className="text-sm font-semibold cursor-pointer">
                  {setting.label}
                </Label>
                <p className="text-xs text-muted-foreground">{setting.description}</p>
              </div>
              <Switch
                checked={setting.value}
                onCheckedChange={() => handleToggle(setting.key)}
                disabled={saving}
                className="ml-4"
              />
            </div>
          ))}
        </div>
      </Card>

      {/* Save status */}
      {saved && (
        <Card className="p-4 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 flex gap-3">
          <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-sm text-green-900 dark:text-green-100">
              Preferenze salvate con successo
            </div>
          </div>
        </Card>
      )}

      {/* Save Button */}
      <div className="flex justify-end gap-2">
        <Button
          onClick={handleSave}
          disabled={saving}
        >
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salva preferenze
        </Button>
      </div>

      {/* Info section */}
      <Card className="p-4 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <div className="text-sm text-blue-900 dark:text-blue-100">
          <p className="font-semibold mb-2">Informazioni</p>
          <ul className="space-y-1 text-xs">
            <li>• Le notifiche in-app appaiono come toast nel basso a destra</li>
            <li>• Le preferenze vengono salvate nel tuo account</li>
            <li>• Puoi modificare queste impostazioni in qualsiasi momento</li>
          </ul>
        </div>
      </Card>
    </div>
  );
}
