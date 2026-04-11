/**
 * ConnectionsSettingsTab — WCA & LinkedIn connections
 */
import * as React from "react";
import { useSettingsV2, useUpdateSettingV2 } from "@/v2/hooks/useSettingsV2";
import { useState, useEffect } from "react";
import { Button } from "../../atoms/Button";
import { StatusBadge } from "../../atoms/StatusBadge";
import { toast } from "sonner";

export function ConnectionsSettingsTab(): React.ReactElement {
  const { data: settings } = useSettingsV2();
  const updateSetting = useUpdateSettingV2();
  const [liEmail, setLiEmail] = useState("");
  const [liAt, setLiAt] = useState("");

  useEffect(() => {
    if (settings) {
      setLiEmail(settings.linkedin_email ?? "");
      setLiAt(settings.linkedin_li_at ?? "");
    }
  }, [settings]);

  const handleSaveLinkedIn = async () => {
    try {
      if (liEmail) await updateSetting.mutateAsync({ key: "linkedin_email", value: liEmail });
      if (liAt) await updateSetting.mutateAsync({ key: "linkedin_li_at", value: liAt });
      toast.success("Credenziali LinkedIn salvate");
    } catch {
      toast.error("Errore nel salvataggio");
    }
  };

  const wcaConnected = !!settings?.wca_session_cookie;
  const liConnected = !!settings?.linkedin_li_at;

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-foreground">WCA API</h3>
          <StatusBadge status={wcaConnected ? "success" : "warning"} label={wcaConnected ? "Connesso" : "Non configurato"} />
        </div>
        <p className="text-sm text-muted-foreground">
          La connessione WCA è gestita tramite cookie di sessione server-side.
          Verifica lo stato nella pagina Diagnostica.
        </p>
      </div>

      <div className="space-y-4 max-w-lg">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-foreground">LinkedIn</h3>
          <StatusBadge status={liConnected ? "success" : "warning"} label={liConnected ? "Configurato" : "Non configurato"} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Email LinkedIn</label>
          <input
            className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground"
            value={liEmail}
            onChange={(e) => setLiEmail(e.target.value)}
            placeholder="email@example.com"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Cookie li_at</label>
          <input
            className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground font-mono text-xs"
            value={liAt}
            onChange={(e) => setLiAt(e.target.value)}
            placeholder="AQEDAx..."
          />
        </div>
        <Button onClick={handleSaveLinkedIn} isLoading={updateSetting.isPending}>Salva LinkedIn</Button>
      </div>
    </div>
  );
}
