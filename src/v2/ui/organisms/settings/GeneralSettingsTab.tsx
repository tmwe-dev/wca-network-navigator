/**
 * GeneralSettingsTab — Profile and preferences
 */
import * as React from "react";
import { useState, useEffect } from "react";
import { useAuthV2 } from "@/v2/hooks/useAuthV2";
import { useSettingsV2, useUpdateSettingV2 } from "@/v2/hooks/useSettingsV2";
import { Button } from "../../atoms/Button";
import { toast } from "sonner";

export function GeneralSettingsTab(): React.ReactElement {
  const { profile } = useAuthV2();
  const { data: settings } = useSettingsV2();
  const updateSetting = useUpdateSettingV2();

  const [displayName, setDisplayName] = useState("");
  const [language, setLanguage] = useState("it");

  useEffect(() => {
    if (profile?.displayName) setDisplayName(profile.displayName);
    if (settings?.language) setLanguage(settings.language);
  }, [profile, settings]);

  const handleSave = async () => {
    try {
      await updateSetting.mutateAsync({ key: "display_name", value: displayName });
      await updateSetting.mutateAsync({ key: "language", value: language });
      toast.success("Impostazioni salvate");
    } catch {
      toast.error("Errore nel salvataggio");
    }
  };

  return (
    <div className="space-y-6 max-w-lg">
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Nome visualizzato</label>
        <input
          className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Lingua</label>
        <select
          className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
        >
          <option value="it">Italiano</option>
          <option value="en">English</option>
        </select>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Email</label>
        <input
          className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground opacity-60"
          value={profile?.email ?? ""}
          readOnly
        />
        <p className="text-xs text-muted-foreground">L'email non può essere modificata.</p>
      </div>
      <Button onClick={handleSave} isLoading={updateSetting.isPending}>Salva</Button>
    </div>
  );
}
