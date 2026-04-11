/**
 * ImportSettingsTab — Import history overview
 */
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FormSection } from "../../organisms/FormSection";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

export function ImportSettingsTab(): React.ReactElement {
  const navigate = useNavigate();

  const { data: logs, isLoading } = useQuery({
    queryKey: ["v2-import-logs-recent"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase
        .from("import_logs")
        .select("id, file_name, total_rows, imported_rows, error_rows, status, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      <FormSection title="Importazione Contatti" description="Storico importazioni e accesso rapido al wizard.">
        <Button onClick={() => navigate("/import")} className="gap-2">
          <Upload className="h-4 w-4" /> Apri wizard importazione
        </Button>

        <div className="mt-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Ultime importazioni</p>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : !logs || logs.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nessuna importazione trovata.</p>
          ) : (
            <div className="space-y-1.5">
              {logs.map((log) => (
                <div key={log.id} className="flex items-center gap-3 p-2 rounded border text-xs">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="flex-1 truncate text-foreground">{log.file_name}</span>
                  <span className="text-muted-foreground">{log.imported_rows}/{log.total_rows}</span>
                  <span className={log.status === "completed" ? "text-emerald-500" : "text-amber-500"}>
                    {log.status}
                  </span>
                  <span className="text-muted-foreground">
                    {format(new Date(log.created_at), "dd/MM HH:mm")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </FormSection>
    </div>
  );
}
