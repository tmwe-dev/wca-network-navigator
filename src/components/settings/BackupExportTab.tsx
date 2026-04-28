/**
 * Tab "Backup & Export" in Impostazioni.
 * Combina:
 *  - AIExportPanel: ZIP leggibile (Markdown) di prompt + KB + logica
 *  - AIBackupPanel: backup tecnico JSON automatico (Storage)
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AIExportPanel } from "./AIExportPanel";
import { AIBackupPanel } from "./AIBackupPanel";
import { KBIngestPanel } from "./KBIngestPanel";
import { Loader2 } from "lucide-react";

export function BackupExportTab() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) setUserId(data.user?.id ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!userId) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
        <Loader2 className="h-4 w-4 animate-spin" />
        Caricamento sessione…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Backup &amp; Export</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Esporta o salva tutto ciò che alimenta gli agenti AI: prompt, knowledge base,
          memorie, prompt operativi e logica applicata.
        </p>
      </div>
      <KBIngestPanel />
      <AIExportPanel userId={userId} />
      <AIBackupPanel userId={userId} />
    </div>
  );
}
