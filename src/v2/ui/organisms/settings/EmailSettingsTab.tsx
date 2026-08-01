/**
 * EmailSettingsTab — SMTP configuration
 */
import * as React from "react";
import { useState, useEffect } from "react";
import { useSettingsV2, useUpdateSettingV2 } from "@/v2/hooks/useSettingsV2";
import { Button } from "../../atoms/Button";
import { toast } from "sonner";

const SMTP_KEYS = ["smtp_host", "smtp_port", "smtp_user", "smtp_from_name", "smtp_from_email"] as const;

export function EmailSettingsTab(): React.ReactElement {
  const { data: settings } = useSettingsV2();
  const updateSetting = useUpdateSettingV2();
  const [form, setForm] = useState<Record<string, string>>({});

  useEffect(() => {
    if (settings) {
      const f: Record<string, string> = {};
      SMTP_KEYS.forEach((k) => { f[k] = settings[k] ?? ""; });
      setForm(f);
    }
  }, [settings]);

  const handleSave = async () => {
    try {
      for (const key of SMTP_KEYS) {
        if (form[key]) await updateSetting.mutateAsync({ key, value: form[key] });
      }
      toast.success("Configurazione email salvata");
    } catch {
      toast.error("Errore nel salvataggio");
    }
  };

  const fields = [
    { key: "smtp_host", label: "Host SMTP", placeholder: "smtp.gmail.com" },
    { key: "smtp_port", label: "Porta", placeholder: "587" },
    { key: "smtp_user", label: "Utente SMTP", placeholder: "user@domain.com" },
    { key: "smtp_from_name", label: "Nome mittente", placeholder: "Il tuo nome" },
    { key: "smtp_from_email", label: "Email mittente", placeholder: "noreply@domain.com" },
  ];

  return (
    <div className="space-y-6 max-w-lg">
      <h3 className="text-lg font-semibold text-foreground">Configurazione SMTP</h3>
      {fields.map((f) => (
        <div key={f.key} className="space-y-2">
          <label className="text-sm font-medium text-foreground">{f.label}</label>
          <input
            className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground"
            placeholder={f.placeholder}
            value={form[f.key] ?? ""}
            onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
          />
        </div>
      ))}
      <p className="text-xs text-muted-foreground">
        La password SMTP è gestita come secret di sistema e non viene mostrata qui.
      </p>
      <Button onClick={handleSave} isLoading={updateSetting.isPending}>Salva</Button>
    </div>
  );
}
