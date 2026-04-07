/**
 * Import wizard state & logic — extracted from Import.tsx
 */
import { useState, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { createLogger } from "@/lib/log";

const log = createLogger("useImportWizard");
import {
  useImportLogs,
  useImportLog,
  useImportedContacts,
  useImportErrors,
  useProcessImport,
  useAnalyzeImportStructure,
  useFixImportErrors,
  useCreateImportFromParsedRows,
  type ImportLog,
} from "@/hooks/useImportLogs";
import {
  parseFile,
  transformRow,
  TARGET_COLUMNS,
  TARGET_SCHEMA,
} from "@/lib/import";

// ── Utility helpers ──

function normalizeKey(key: string): string {
  return key
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[-\s]+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function isReimportCorrection(headers: string[]): boolean {
  const normalized = headers.map(normalizeKey);
  return normalized.includes("_import_id") || normalized.includes("motivo_errore") || normalized.includes("import_id");
}

function applyMapping(row: Record<string, any>, mapping: Record<string, string>): Record<string, string | null> {
  return transformRow(row, mapping);
}

export interface AiMappingResult {
  column_mapping: Record<string, string>;
  parsed_rows: any[];
  confidence: number;
  warnings: string[];
  unmapped_columns?: string[];
  data_quality?: any;
}

export function useImportWizard() {
  const queryClient = useQueryClient();
  const [activeLogId, setActiveLogId] = useState<string | null>(null);
  const [tab, setTab] = useState("upload");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [dialogTab, setDialogTab] = useState<"file" | "paste">("file");
  const [importSource, setImportSource] = useState<"standard" | "business_card">("business_card");
  const [groupName, setGroupName] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingRows, setPendingRows] = useState<any[]>([]);
  const [aiMapping, setAiMapping] = useState<AiMappingResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: logs = [] } = useImportLogs();
  const { data: activeLog } = useImportLog(activeLogId);
  const { data: contacts = [] } = useImportedContacts(activeLogId);
  const { data: errors = [] } = useImportErrors(activeLogId);

  const processImport = useProcessImport();
  const analyzeStructure = useAnalyzeImportStructure();
  const fixErrors = useFixImportErrors();
  const createFromParsed = useCreateImportFromParsedRows();

  const [uploading, setUploading] = useState(false);

  // ── Re-import correction ──
  const handleReimportCorrection = useCallback(async (rows: any[], headers: string[]) => {
    setUploading(true);
    try {
      const idKey = headers.find(h => {
        const n = normalizeKey(h);
        return n === "_import_id" || n === "import_id";
      });
      if (!idKey) {
        toast({ title: "Colonna _import_id non trovata", variant: "destructive" });
        setUploading(false);
        return;
      }

      const metaColumns = new Set(["_import_id", "import_id", "motivo_errore"]);
      const dataHeaders = headers.filter(h => !metaColumns.has(normalizeKey(h)));
      const columnKeyMap: Record<string, string> = {};
      for (const col of TARGET_COLUMNS) {
        const match = dataHeaders.find(h => normalizeKey(h) === col);
        if (match) columnKeyMap[col] = match;
      }

      let updatedCount = 0;
      let errorCount = 0;
      const BATCH_SIZE = 50;

      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        const promises = batch.map(async (row) => {
          const importId = row[idKey];
          if (!importId || !String(importId).trim()) return false;
          const updateData: Record<string, string | null> = {};
          for (const [col, rowKey] of Object.entries(columnKeyMap)) {
            const val = row[rowKey];
            if (val && String(val).trim()) updateData[col] = String(val).trim();
          }
          if (Object.keys(updateData).length === 0) return false;
          const { error } = await supabase
            .from("imported_contacts")
            .update(updateData)
            .eq("id", String(importId).trim());
          return !error;
        });
        const results = await Promise.all(promises);
        updatedCount += results.filter(Boolean).length;
        errorCount += results.filter(r => r === false).length;
      }

      toast({ title: `${updatedCount} record aggiornati con successo${errorCount > 0 ? ` (${errorCount} saltati)` : ""}` });
      queryClient.invalidateQueries({ queryKey: ["imported-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["import-logs"] });
    } catch (err) {
      toast({ title: "Errore aggiornamento", description: String(err), variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }, [queryClient]);

  // ── Delete import ──
  const handleDeleteImport = useCallback(async (logId: string) => {
    try {
      await supabase.from("import_errors").delete().eq("import_log_id", logId);
      await supabase.from("imported_contacts").delete().eq("import_log_id", logId);
      await supabase.from("import_logs").delete().eq("id", logId);
      if (activeLogId === logId) setActiveLogId(null);
      queryClient.invalidateQueries({ queryKey: ["import-logs"] });
      queryClient.invalidateQueries({ queryKey: ["imported-contacts"] });
      toast({ title: "Import eliminato" });
    } catch (err) {
      toast({ title: "Errore eliminazione", description: String(err), variant: "destructive" });
    }
  }, [activeLogId, queryClient]);

  // ── Process file ──
  const processFile = useCallback(async (file: File) => {
    if (!file.name.match(/\.(csv|xlsx?|txt|json)$/i)) {
      toast({ title: "Formato non supportato", description: "Usa CSV, Excel (.xlsx), TXT o JSON", variant: "destructive" });
      return;
    }
    setUploading(true);
    setUploadDialogOpen(false);
    setTab("upload");
    try {
      const { parsed } = await parseFile(file);
      const { headers, rows: rawRows } = parsed;
      if (rawRows.length === 0) {
        toast({ title: "File vuoto", variant: "destructive" });
        setUploading(false);
        return;
      }
      const rowObjects = rawRows.map(row => {
        const obj: Record<string, string> = {};
        headers.forEach((h, idx) => { obj[h] = row[idx] || ""; });
        return obj;
      });
      if (isReimportCorrection(headers)) {
        await handleReimportCorrection(rowObjects, headers);
        return;
      }
      setPendingFile(file);
      setPendingRows(rowObjects);
      const sampleSize = Math.min(50, rowObjects.length);
      const step = rowObjects.length / sampleSize;
      const sample: any[] = [];
      for (let i = 0; i < sampleSize; i++) {
        sample.push(rowObjects[Math.floor(i * step)]);
      }
      const result = await analyzeStructure.mutateAsync({
        inputType: "file",
        sampleRows: sample,
      });
      setAiMapping(result);
      const mappedCount = Object.keys(result.column_mapping || {}).length;
      if (mappedCount > 0) {
        toast({
          title: `Analisi AI: ${mappedCount} colonne mappate (confidence ${Math.round(result.confidence * 100)}%) — ${rowObjects.length} righe totali`,
        });
      } else {
        toast({
          title: "L'AI non ha trovato colonne mappabili",
          description: "Verifica che il file contenga dati di contatti (email, telefono, nomi aziende). Riprova.",
          variant: "destructive",
        });
      }
    } catch (err) {
      log.error("file analysis failed", { message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined });
      toast({ title: "Errore analisi file", description: String(err), variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }, [analyzeStructure, handleReimportCorrection]);

  // ── Paste analyze ──
  const handlePasteAnalyze = useCallback(async () => {
    if (!pasteText.trim()) return;
    setUploadDialogOpen(false);
    try {
      const result = await analyzeStructure.mutateAsync({
        inputType: "paste",
        rawText: pasteText,
      });
      setAiMapping(result);
      toast({ title: `${result.parsed_rows.length} righe estratte (confidence: ${Math.round(result.confidence * 100)}%)` });
    } catch { /* intentionally ignored: best-effort cleanup */ }
  }, [pasteText, analyzeStructure]);

  // ── Drag & Drop ──
  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);
  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  // ── Confirm mapping ──
  const handleConfirmMapping = useCallback(async () => {
    if (!aiMapping) return;
    if (!groupName.trim()) {
      toast({ title: "Inserisci un evento o gruppo", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non autenticato");

      const uploadMode = pendingFile ? "file" : "paste";
      const fileName = uploadMode === "paste"
        ? `testo_incollato_${new Date().toISOString().slice(0, 10)}`
        : pendingFile?.name || "file_importato";

      let log: ImportLog;
      if (uploadMode === "file" && pendingFile) {
        const mappingKeys = Object.keys(aiMapping.column_mapping || {});
        if (mappingKeys.length === 0) {
          toast({ title: "Nessun mapping disponibile. Riprova l'analisi.", variant: "destructive" });
          setUploading(false);
          return;
        }
        const finalRows = pendingRows.map((row) => {
          const mapped = applyMapping(row, aiMapping.column_mapping);
          return { ...mapped, _raw: row };
        });
        const nonEmptyCount = finalRows.filter(r =>
          TARGET_COLUMNS.some(col => {
            const val = (r as Record<string, unknown>)[col];
            return val != null && String(val).trim();
          })
        ).length;
        const fillRate = nonEmptyCount / finalRows.length;
        if (fillRate < 0.1) {
          toast({
            title: "Mapping fallito",
            description: `Solo ${nonEmptyCount} righe su ${finalRows.length} hanno dati. Riprova.`,
            variant: "destructive",
          });
          setUploading(false);
          return;
        }
        log = await createFromParsed.mutateAsync({
          rows: finalRows,
          userId: user.id,
          fileName,
          groupName: groupName.trim(),
          importSource,
        });
      } else {
        log = await createFromParsed.mutateAsync({
          rows: aiMapping.parsed_rows,
          userId: user.id,
          fileName,
          groupName: groupName.trim(),
          importSource,
        });
      }

      setActiveLogId(log.id);
      setTab("contacts");
      setAiMapping(null);
      setPasteText("");
      setPendingFile(null);
      setPendingRows([]);
      setGroupName("");
      toast({ title: "Importazione completata", description: `${pendingFile ? pendingRows.length : aiMapping.parsed_rows.length} righe nello staging` });
    } catch (err) {
      toast({ title: "Errore", description: String(err), variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }, [aiMapping, pendingFile, pendingRows, createFromParsed, groupName, importSource]);

  // ── Change mapping target ──
  const handleMappingTargetChange = useCallback((srcKey: string, newTarget: string) => {
    if (!aiMapping) return;
    const newMapping = { ...aiMapping.column_mapping };
    if (newTarget === "__unmapped__") {
      delete newMapping[srcKey];
      const newUnmapped = [...(aiMapping.unmapped_columns || []), srcKey];
      setAiMapping({ ...aiMapping, column_mapping: newMapping, unmapped_columns: newUnmapped });
      return;
    }
    const existingEntry = Object.entries(newMapping).find(
      ([key, val]) => val === newTarget && key !== srcKey
    );
    if (existingEntry) {
      delete newMapping[existingEntry[0]];
      const newUnmapped = [...(aiMapping.unmapped_columns || []), existingEntry[0]];
      toast({ title: `"${existingEntry[0]}" rimossa dal mapping (${newTarget} era già assegnata)` });
      setAiMapping({ ...aiMapping, column_mapping: { ...newMapping, [srcKey]: newTarget }, unmapped_columns: newUnmapped });
    } else {
      newMapping[srcKey] = newTarget;
      setAiMapping({ ...aiMapping, column_mapping: newMapping });
    }
  }, [aiMapping]);

  const handleProcess = useCallback(() => {
    if (!activeLogId) return;
    processImport.mutate(activeLogId);
  }, [activeLogId, processImport]);

  const progress = activeLog
    ? activeLog.total_batches > 0
      ? Math.round((activeLog.processing_batch / activeLog.total_batches) * 100)
      : 0
    : 0;

  const pendingErrors = errors.filter((e) => e.status === "pending");
  const correctedErrors = errors.filter((e) => e.status === "corrected");
  const dismissedErrors = errors.filter((e) => e.status === "dismissed");

  // ── Export incomplete ──
  const handleExportIncomplete = useCallback(async () => {
    const incomplete = contacts.filter(c => !c.company_name && !c.name);
    if (incomplete.length === 0) return;
    const SEP = ";";
    const escapeCell = (val: any) => {
      if (val === null || val === undefined) return "";
      const s = String(val).replace(/"/g, '""');
      if (s.includes(SEP) || s.includes('"') || s.includes("\n") || s.includes("\r")) return `"${s}"`;
      return s;
    };
    const firstWithRaw = incomplete.find(c => c.raw_data && typeof c.raw_data === "object");
    const originalHeaders = firstWithRaw ? Object.keys(firstWithRaw.raw_data as Record<string, any>) : [
      "company_name", "name", "email", "phone", "mobile", "country", "city", "address", "zip_code"
    ];
    const headers = ["_import_id", ...originalHeaders, "motivo_errore"];
    const csvRows = [headers.map(escapeCell).join(SEP)];
    for (const c of incomplete) {
      const motivo = !c.company_name && !c.name
        ? "azienda e nome mancanti"
        : !c.company_name ? "azienda mancante" : "nome mancante";
      const raw = (c.raw_data && typeof c.raw_data === "object" ? c.raw_data : {}) as Record<string, any>;
      const row = [
        escapeCell(c.id),
        ...originalHeaders.map(h => escapeCell(raw[h])),
        escapeCell(motivo),
      ];
      csvRows.push(row.join(SEP));
    }
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvRows.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `record_incompleti_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: `${incomplete.length} record incompleti esportati` });
  }, [contacts, activeLog]);

  return {
    // State
    activeLogId, setActiveLogId,
    tab, setTab,
    uploadDialogOpen, setUploadDialogOpen,
    dialogTab, setDialogTab,
    importSource, setImportSource,
    groupName, setGroupName,
    pasteText, setPasteText,
    pendingFile, pendingRows,
    aiMapping, setAiMapping,
    isDragging,
    fileInputRef,
    uploading,
    // Query data
    logs, activeLog, contacts, errors,
    // Derived
    progress,
    pendingErrors, correctedErrors, dismissedErrors,
    // Mutations
    processImport, analyzeStructure, fixErrors,
    // Handlers
    handleDeleteImport,
    processFile,
    handlePasteAnalyze,
    handleDragOver, handleDragLeave, handleDrop,
    handleFileInputChange,
    handleConfirmMapping,
    handleMappingTargetChange,
    handleProcess,
    handleExportIncomplete,
  };
}
