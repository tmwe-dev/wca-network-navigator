import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { ImportError } from "./useImportLogs";

export function useFixImportErrors() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ importLogId, customPrompt }: { importLogId: string; customPrompt?: string }) => {
      const { data, error } = await supabase.functions.invoke("process-ai-import", {
        body: { import_log_id: importLogId, mode: "fix_errors", custom_prompt: customPrompt || undefined },
      });
      if (error) throw error;
      return data as { corrected: number; dismissed: number; has_more: boolean; remaining: number };
    },
    onSuccess: (result, { importLogId }) => {
      queryClient.invalidateQueries({ queryKey: ["import-errors", importLogId] });
      queryClient.invalidateQueries({ queryKey: ["imported-contacts", importLogId] });
      queryClient.invalidateQueries({ queryKey: ["import-log", importLogId] });
      toast({
        title: "Batch completato",
        description: `${result.corrected} corretti, ${result.dismissed} non recuperabili${result.has_more ? ` — ${result.remaining} rimanenti` : ""}`,
      });
    },
    onError: (err) => {
      toast({ title: "Errore correzione AI", description: String(err), variant: "destructive" });
    },
  });
}

export function exportErrorsToCSV(errors: ImportError[]) {
  const SEP = ";";
  const escapeCell = (val: any) => {
    if (val === null || val === undefined) return "";
    const s = String(val).replace(/"/g, '""');
    if (s.includes(SEP) || s.includes('"') || s.includes("\n") || s.includes("\r")) {
      return `"${s}"`;
    }
    return s;
  };

  // Extract raw_data fields as separate columns
  const firstWithRaw = errors.find(e => e.raw_data && typeof e.raw_data === "object");
  const rawKeys = firstWithRaw ? Object.keys(firstWithRaw.raw_data as Record<string, any>) : [];

  const headers = ["riga", "tipo_errore", "messaggio", ...rawKeys];
  const csvRows = [headers.map(escapeCell).join(SEP)];

  for (const err of errors) {
    const raw = (err.raw_data && typeof err.raw_data === "object" ? err.raw_data : {}) as Record<string, any>;
    const row = [
      escapeCell(err.row_number),
      escapeCell(err.error_type),
      escapeCell(err.error_message),
      ...rawKeys.map(k => escapeCell(raw[k])),
    ];
    csvRows.push(row.join(SEP));
  }

  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csvRows.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `errori_import_${Date.now()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
