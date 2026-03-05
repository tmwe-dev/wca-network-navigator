import { useState, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ImportAssistant } from "@/components/import/ImportAssistant";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Upload, FileText, Loader2, CheckCircle2, AlertCircle,
  Sparkles, Users, Mail, Phone, ArrowRight, ClipboardPaste,
  FileSearch, Download, Wand2, ArrowLeftRight, FolderOpen, Trash2,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ImportErrorMonitor } from "@/components/import/ImportErrorMonitor";
import { ContactsGridTab } from "@/components/import/ContactsGridTab";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  useImportLogs,
  useImportLog,
  useImportedContacts,
  useImportErrors,
  useCreateImport,
  useProcessImport,
  useToggleContactSelection,
  useTransferToPartners,
  useCreateActivitiesFromImport,
  useAnalyzeImportStructure,
  useFixImportErrors,
  useCreateImportFromParsedRows,
  exportErrorsToCSV,
  type ImportLog,
  type ImportedContact,
} from "@/hooks/useImportLogs";
import {
  parseFile,
  autoMapColumns,
  mappingsToDict,
  transformRow,
  TARGET_COLUMNS,
  TARGET_SCHEMA,
} from "@/lib/import";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

// Normalize header key: lowercase, strip accents, collapse spaces/dashes to underscore
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

// Detect if a file is a re-import correction (exported incomplete/error CSV)
function isReimportCorrection(headers: string[]): boolean {
  const normalized = headers.map(normalizeKey);
  return normalized.includes("_import_id") || normalized.includes("motivo_errore") || normalized.includes("import_id");
}

// Apply AI column_mapping to a single row — uses transformRow with auto-normalization
function applyMapping(row: Record<string, any>, mapping: Record<string, string>, logFirst = false): Record<string, string | null> {
  const result = transformRow(row, mapping);
  if (logFirst) {
    const populated = Object.values(result).filter(v => v !== null).length;
    const rowDataCount = Object.values(row).filter(v => v !== null && v !== undefined && String(v).trim() !== "").length;
    console.log(`[Import Mapping] Populated ${populated}/${Object.keys(result).length} fields from row with ${rowDataCount} non-empty values`);
    if (populated < rowDataCount * 0.3) {
      console.warn(`[Import Mapping] ⚠️ Low mapping rate — AI keys: [${Object.keys(mapping).join(", ")}] vs Row keys: [${Object.keys(row).join(", ")}]`);
    }
  }
  return result;
}

function statusBadge(status: string) {
  const map: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
    pending: { variant: "outline", label: "In attesa" },
    processing: { variant: "secondary", label: "Elaborazione…" },
    completed: { variant: "default", label: "Completato" },
    failed: { variant: "destructive", label: "Errore" },
  };
  const s = map[status] || { variant: "outline" as const, label: status };
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

export default function Import() {
  const queryClient = useQueryClient();
  const [activeLogId, setActiveLogId] = useState<string | null>(null);
  const [tab, setTab] = useState("upload");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [dialogTab, setDialogTab] = useState<"file" | "paste">("file");
  const [groupName, setGroupName] = useState("");

  // Paste state
  const [pasteText, setPasteText] = useState("");

  // AI mapping state
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingRows, setPendingRows] = useState<any[]>([]);
  const [aiMapping, setAiMapping] = useState<{
    column_mapping: Record<string, string>;
    parsed_rows: any[];
    confidence: number;
    warnings: string[];
    unmapped_columns?: string[];
    data_quality?: any;
  } | null>(null);

  // Drag state (file drop zone)
  const [isDragging, setIsDragging] = useState(false);
  // Drag state (mapping column reassignment)
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: logs = [] } = useImportLogs();
  const { data: activeLog } = useImportLog(activeLogId);
  const { data: contacts = [] } = useImportedContacts(activeLogId);
  const { data: errors = [] } = useImportErrors(activeLogId);

  const createImport = useCreateImport();
  const processImport = useProcessImport();
  const toggleSelection = useToggleContactSelection();
  const transferToPartners = useTransferToPartners();
  const createActivities = useCreateActivitiesFromImport();
  const analyzeStructure = useAnalyzeImportStructure();
  const fixErrors = useFixImportErrors();
  const createFromParsed = useCreateImportFromParsedRows();

  const [uploading, setUploading] = useState(false);

  // === Re-import correction: update existing imported_contacts ===
  const handleReimportCorrection = useCallback(async (rows: any[], headers: string[]) => {
    setUploading(true);
    try {
      // Find the _import_id column key in the row objects
      const idKey = headers.find(h => {
        const n = normalizeKey(h);
        return n === "_import_id" || n === "import_id";
      });
      if (!idKey) {
        toast({ title: "Colonna _import_id non trovata", variant: "destructive" });
        setUploading(false);
        return;
      }

      // Pre-compute mapping: target column → actual row key (excluding meta columns)
      const metaColumns = new Set(["_import_id", "import_id", "motivo_errore"]);
      const dataHeaders = headers.filter(h => !metaColumns.has(normalizeKey(h)));
      const columnKeyMap: Record<string, string> = {};
      for (const col of TARGET_COLUMNS) {
        const match = dataHeaders.find(h => normalizeKey(h) === col);
        if (match) columnKeyMap[col] = match;
      }

      console.log("[Re-import] ID key:", idKey, "| Column map:", columnKeyMap);

      let updatedCount = 0;
      let errorCount = 0;

      // Process in batches of 50 to avoid too many sequential requests
      const BATCH_SIZE = 50;
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        const promises = batch.map(async (row) => {
          const importId = row[idKey];
          if (!importId || !String(importId).trim()) return false;

          const updateData: Record<string, string | null> = {};
          for (const [col, rowKey] of Object.entries(columnKeyMap)) {
            const val = row[rowKey];
            if (val && String(val).trim()) {
              updateData[col] = String(val).trim();
            }
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
      // Invalidate cache to refresh UI
      queryClient.invalidateQueries({ queryKey: ["imported-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["import-logs"] });
    } catch (err) {
      toast({ title: "Errore aggiornamento", description: String(err), variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }, [queryClient]);

  // === Delete an import log and its contacts/errors ===
  const handleDeleteImport = useCallback(async (logId: string) => {
    try {
      // Delete related records first, then the log
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

  const processFile = useCallback(async (file: File) => {
    if (!file.name.match(/\.(csv|xlsx?|txt)$/i)) {
      toast({ title: "Formato non supportato", description: "Usa CSV, Excel (.xlsx) o TXT", variant: "destructive" });
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

      // Convert string[][] → Record<string, string>[] so mapping keys work
      const rowObjects = rawRows.map(row => {
        const obj: Record<string, string> = {};
        headers.forEach((h, idx) => { obj[h] = row[idx] || ""; });
        return obj;
      });

      // Detect re-import correction
      if (isReimportCorrection(headers)) {
        await handleReimportCorrection(rowObjects, headers);
        return;
      }

      // Send to AI for mapping — AI knows our exact table schema
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
      console.error(err);
      toast({ title: "Errore analisi file", description: String(err), variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }, [analyzeStructure, handleReimportCorrection]);

  // === PASTE: Analyze free text ===
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
    } catch {}
  }, [pasteText, analyzeStructure]);

  // === Drag & Drop handlers ===
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

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

  // === Confirm AI mapping and import ===
  const handleConfirmMapping = useCallback(async () => {
    if (!aiMapping) return;
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

        console.log("[Import] Using column_mapping:", mappingKeys);
        const finalRows = pendingRows.map((row, idx) => {
          const mapped = applyMapping(row, aiMapping.column_mapping, idx === 0);
          return { ...mapped, _raw: row };
        });

        const nonEmptyCount = finalRows.filter(r =>
          TARGET_COLUMNS.some(col => r[col] && String(r[col]).trim())
        ).length;
        const fillRate = nonEmptyCount / finalRows.length;
        console.log(`[Import] Fill rate: ${(fillRate * 100).toFixed(1)}% (${nonEmptyCount}/${finalRows.length})`);

        if (fillRate < 0.1) {
          toast({
            title: "Mapping fallito",
            description: `Solo ${nonEmptyCount} righe su ${finalRows.length} hanno dati. Riprova.`,
            variant: "destructive",
          });
          setUploading(false);
          return;
        }

        log = await createFromParsed.mutateAsync({ rows: finalRows, userId: user.id, fileName, groupName: groupName.trim() || undefined });
      } else {
        log = await createFromParsed.mutateAsync({ rows: aiMapping.parsed_rows, userId: user.id, fileName, groupName: groupName.trim() || undefined });
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
  }, [aiMapping, pendingFile, pendingRows, createFromParsed]);

  // Change mapping target via Select dropdown (with duplicate prevention)
  const handleMappingTargetChange = useCallback((srcKey: string, newTarget: string) => {
    if (!aiMapping) return;
    const newMapping = { ...aiMapping.column_mapping };

    if (newTarget === "__unmapped__") {
      // Remove this mapping entirely
      delete newMapping[srcKey];
      const newUnmapped = [...(aiMapping.unmapped_columns || []), srcKey];
      setAiMapping({ ...aiMapping, column_mapping: newMapping, unmapped_columns: newUnmapped });
      return;
    }

    // If newTarget is already used by another source, free it
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
  }, [aiMapping, toast]);

  const handleProcess = useCallback(() => {
    if (!activeLogId) return;
    processImport.mutate(activeLogId);
  }, [activeLogId, processImport]);

  // selectedContacts, handleTransfer, handleCreateActivities, toggleAll removed — now in ContactsGridTab

  const progress = activeLog
    ? activeLog.total_batches > 0
      ? Math.round((activeLog.processing_batch / activeLog.total_batches) * 100)
      : 0
    : 0;

  const pendingErrors = errors.filter((e) => e.status === "pending");
  const correctedErrors = errors.filter((e) => e.status === "corrected");
  const dismissedErrors = errors.filter((e) => e.status === "dismissed");

  // Export incomplete contacts CSV with _import_id for re-import
  const handleExportIncomplete = useCallback(async () => {
    const incomplete = contacts.filter(c => !c.company_name && !c.name);
    if (incomplete.length === 0) return;

    const SEP = ";";
    const escapeCell = (val: any) => {
      if (val === null || val === undefined) return "";
      const s = String(val).replace(/"/g, '""');
      // Quote if contains separator, quotes, or newlines
      if (s.includes(SEP) || s.includes('"') || s.includes("\n") || s.includes("\r")) {
        return `"${s}"`;
      }
      return s;
    };

    // Build from raw_data (most reliable — always available)
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

    // BOM for Excel UTF-8 recognition
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

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Import Contatti</h1>
          <p className="text-sm text-muted-foreground">Carica file o incolla testo — l'AI analizza e mappa automaticamente</p>
        </div>
      </div>

      {/* ====== UPLOAD DIALOG ====== */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Importa Contatti
            </DialogTitle>
            <DialogDescription>
              Carica un file o incolla testo direttamente. Formati supportati: CSV, Excel, TXT.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={dialogTab} onValueChange={(v) => setDialogTab(v as "file" | "paste")}>
            <TabsList className="w-full">
              <TabsTrigger value="file" className="flex-1">
                <FileText className="w-3.5 h-3.5 mr-1.5" />File
              </TabsTrigger>
              <TabsTrigger value="paste" className="flex-1">
                <ClipboardPaste className="w-3.5 h-3.5 mr-1.5" />Incolla Testo
              </TabsTrigger>
            </TabsList>

            <TabsContent value="file" className="mt-4 space-y-3">
              {/* Drag & Drop area */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragging
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-primary/50 hover:bg-accent/30"
                }`}
              >
                <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm font-medium">Trascina qui il tuo file o clicca per selezionare</p>
                <p className="text-xs text-muted-foreground mt-1">.csv, .xlsx, .xls, .txt</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls,.txt"
                onChange={handleFileInputChange}
                className="hidden"
              />
              <Button
                variant="outline"
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <FolderOpen className="w-4 h-4 mr-1.5" />
                Sfoglia file
              </Button>
            </TabsContent>

            <TabsContent value="paste" className="mt-4 space-y-3">
              <Textarea
                placeholder={"Es:\nMario Rossi - Global Logistics Srl - mario@globallog.it - +39 02 1234567 - Milano\nAnna Bianchi - Fast Cargo SpA - anna.bianchi@fastcargo.com - Roma"}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                className="min-h-[180px] font-mono text-xs"
              />
              <Button
                onClick={handlePasteAnalyze}
                disabled={!pasteText.trim() || analyzeStructure.isPending}
                className="w-full"
              >
                {analyzeStructure.isPending ? (
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 mr-1.5" />
                )}
                Analizza con AI
              </Button>
            </TabsContent>
          </Tabs>

          {(uploading || analyzeStructure.isPending) && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              {analyzeStructure.isPending ? "Analisi AI in corso…" : "Lettura file…"}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Left: Import history */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Storico Import</CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            <ScrollArea className="h-[calc(100vh-280px)]">
              <div className="space-y-1">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className={`group relative w-full text-left p-2 rounded-md text-xs transition-colors cursor-pointer ${
                      activeLogId === log.id ? "bg-accent" : "hover:bg-accent/50"
                    }`}
                    onClick={() => { setActiveLogId(log.id); setTab("contacts"); }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium truncate">{log.file_name}</span>
                      <div className="flex items-center gap-1">
                        {statusBadge(log.status)}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost" size="icon"
                              className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Elimina import</AlertDialogTitle>
                              <AlertDialogDescription>
                                Eliminare "{log.file_name}" e tutti i {log.total_rows} contatti importati? Questa azione è irreversibile.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annulla</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => handleDeleteImport(log.id)}
                              >Elimina</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                    <div className="text-muted-foreground mt-0.5">
                      {log.total_rows} righe · {new Date(log.created_at).toLocaleDateString("it")}
                    </div>
                  </div>
                ))}
                {logs.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-8">Nessun import</p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Right: Main content */}
        <div className="lg:col-span-3">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="upload">
                <Upload className="w-3.5 h-3.5 mr-1.5" />Upload
              </TabsTrigger>
              <TabsTrigger value="contacts" disabled={!activeLogId}>
                <Users className="w-3.5 h-3.5 mr-1.5" />Contatti ({contacts.length})
              </TabsTrigger>
              <TabsTrigger value="errors" disabled={!activeLogId || errors.length === 0}>
                <AlertCircle className="w-3.5 h-3.5 mr-1.5" />Errori ({errors.length})
              </TabsTrigger>
            </TabsList>

            {/* ====== UPLOAD TAB ====== */}
            <TabsContent value="upload" className="mt-4 space-y-4">
              {/* Upload trigger button */}
              {!aiMapping && (
                <Card>
                  <CardContent className="py-8 flex flex-col items-center gap-4">
                    <Upload className="w-12 h-12 text-muted-foreground" />
                    <div className="text-center">
                      <p className="font-medium">Carica un file o incolla testo</p>
                      <p className="text-sm text-muted-foreground">CSV, Excel (.xlsx), TXT — l'AI mapperà automaticamente le colonne</p>
                    </div>
                    <Button onClick={() => setUploadDialogOpen(true)} disabled={uploading}>
                      {uploading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Upload className="w-4 h-4 mr-1.5" />}
                      Upload
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* AI MAPPING PREVIEW */}
              {aiMapping && (
                <Card className="border-primary/30">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <ArrowLeftRight className="w-5 h-5" />
                      Anteprima Mapping AI
                      <Badge variant={aiMapping.confidence > 0.7 ? "default" : "secondary"}>
                        {Math.round(aiMapping.confidence * 100)}% confidence
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {Object.keys(aiMapping.column_mapping).length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">
                          Mapping Colonne
                          <span className="text-muted-foreground font-normal ml-2 text-xs">
                            Usa i menu a tendina per cambiare la destinazione
                          </span>
                        </h4>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs">Colonna Sorgente</TableHead>
                              <TableHead className="text-xs">Esempio</TableHead>
                              <TableHead className="text-xs w-8">→</TableHead>
                              <TableHead className="text-xs">Colonna Destinazione</TableHead>
                              <TableHead className="text-xs w-8"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {Object.entries(aiMapping.column_mapping).map(([src, dst]) => {
                              const sampleValue = pendingRows.find(r => r[src]?.toString().trim())?.[src]?.toString() || "—";
                              const truncated = sampleValue.length > 40 ? sampleValue.slice(0, 40) + "…" : sampleValue;
                              return (
                                <TableRow key={src}>
                                  <TableCell className="text-xs font-mono">{src}</TableCell>
                                  <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate" title={sampleValue}>{truncated}</TableCell>
                                  <TableCell className="text-xs text-muted-foreground">→</TableCell>
                                  <TableCell className="text-xs p-1">
                                    <Select
                                      value={dst}
                                      onValueChange={(val) => handleMappingTargetChange(src, val)}
                                    >
                                      <SelectTrigger className="h-8 text-xs w-[180px]">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="__unmapped__" className="text-xs text-muted-foreground">
                                          — Non mappare —
                                        </SelectItem>
                                        {TARGET_SCHEMA.map(t => (
                                          <SelectItem key={t.key} value={t.key} className="text-xs">
                                            {t.label} ({t.key})
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                  <TableCell className="text-xs p-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                      onClick={() => handleMappingTargetChange(src, "__unmapped__")}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}

                    {aiMapping.warnings.length > 0 && (
                      <Alert variant="destructive">
                        <AlertCircle className="w-4 h-4" />
                        <AlertTitle className="text-xs">Attenzione</AlertTitle>
                        <AlertDescription className="text-xs">
                          {aiMapping.warnings.map((w, i) => <div key={i}>• {w}</div>)}
                        </AlertDescription>
                      </Alert>
                    )}

                    {aiMapping.unmapped_columns && aiMapping.unmapped_columns.length > 0 && (
                      <Alert>
                        <AlertCircle className="w-4 h-4" />
                        <AlertTitle className="text-xs">Colonne non mappate ({aiMapping.unmapped_columns.length})</AlertTitle>
                        <AlertDescription className="text-xs">
                          <span className="text-muted-foreground">
                            {aiMapping.unmapped_columns.join(", ")}
                          </span>
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Preview: show REAL local transformation for file mode */}
                    <div>
                      {(() => {
                        const previewRows = pendingFile && pendingRows.length > 0
                          ? pendingRows.slice(0, 5).map(row => applyMapping(row, aiMapping.column_mapping))
                          : aiMapping.parsed_rows.slice(0, 5);
                        const totalRows = pendingFile ? pendingRows.length : aiMapping.parsed_rows.length;
                        const activeCols = TARGET_COLUMNS.filter(col => previewRows.some(r => r[col]));
                        return (
                          <>
                            <h4 className="text-sm font-medium mb-2">
                              Anteprima Trasformazione Reale ({Math.min(5, totalRows)} di {totalRows} righe)
                            </h4>
                            <ScrollArea className="max-h-[240px]">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    {activeCols.map(col => (
                                      <TableHead key={col} className="text-[10px] whitespace-nowrap">{col}</TableHead>
                                    ))}
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {previewRows.map((row, i) => (
                                    <TableRow key={i}>
                                      {activeCols.map(col => (
                                        <TableCell key={col} className="text-[10px] truncate max-w-[120px]">
                                          {row[col] || "—"}
                                        </TableCell>
                                      ))}
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </ScrollArea>
                          </>
                        );
                      })()}
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="group-name" className="text-sm font-medium flex items-center gap-1.5">
                          Nome Gruppo <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="group-name"
                          placeholder="Es. Global, Cosmoprof 2024, Pitti Uomo..."
                          value={groupName}
                          onChange={(e) => setGroupName(e.target.value)}
                          className="max-w-xs text-sm"
                        />
                        {!groupName.trim() && (
                          <p className="text-[11px] text-muted-foreground">Inserisci un nome gruppo per procedere con l'importazione</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {groupName.trim() && (
                          <Button onClick={handleConfirmMapping} disabled={uploading}>
                            {uploading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1.5" />}
                            Conferma e Importa ({pendingFile ? pendingRows.length : aiMapping.parsed_rows.length} righe)
                          </Button>
                        )}
                        <Button variant="outline" onClick={() => { setAiMapping(null); setGroupName(""); }}>
                          Annulla
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* ====== CONTACTS TAB ====== */}
            <TabsContent value="contacts" className="mt-4 space-y-4">
              {activeLog && (
                <>
                  <Card>
                    <CardContent className="py-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {statusBadge(activeLog.status)}
                          <span className="text-sm">
                            {activeLog.total_rows} righe importate
                            {activeLog.error_rows > 0 && ` · ${activeLog.error_rows} errori`}
                          </span>
                        </div>
                      </div>
                      {activeLog.status === "processing" && <Progress value={progress} className="h-1.5" />}
                    </CardContent>
                  </Card>

                  {/* Data Quality Dashboard */}
                  {contacts.length > 0 && (() => {
                    const withCompany = contacts.filter(c => c.company_name).length;
                    const withName = contacts.filter(c => c.name).length;
                    const withEmail = contacts.filter(c => c.email).length;
                    const withPhone = contacts.filter(c => c.phone || c.mobile).length;
                    const withCountry = contacts.filter(c => c.country).length;
                    const allEmpty = contacts.filter(c => !c.company_name && !c.name && !c.email).length;
                    const problemRows = contacts.filter(c => !c.company_name && !c.name).length;
                    const total = contacts.length;

                    return (
                      <Card className={allEmpty === total ? "border-destructive" : ""}>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <FileSearch className="w-4 h-4" />
                            Report Qualità Dati
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
                            <div className="p-2 rounded bg-muted">
                              <div className="font-medium">{withCompany}/{total}</div>
                              <div className="text-muted-foreground">con Azienda</div>
                            </div>
                            <div className="p-2 rounded bg-muted">
                              <div className="font-medium">{withName}/{total}</div>
                              <div className="text-muted-foreground">con Nome</div>
                            </div>
                            <div className="p-2 rounded bg-muted">
                              <div className="font-medium">{withEmail}/{total}</div>
                              <div className="text-muted-foreground">con Email</div>
                            </div>
                            <div className="p-2 rounded bg-muted">
                              <div className="font-medium">{withPhone}/{total}</div>
                              <div className="text-muted-foreground">con Telefono</div>
                            </div>
                            <div className="p-2 rounded bg-muted">
                              <div className="font-medium">{withCountry}/{total}</div>
                              <div className="text-muted-foreground">con Paese</div>
                            </div>
                          </div>

                          {allEmpty === total && (
                            <Alert variant="destructive">
                              <AlertCircle className="w-4 h-4" />
                              <AlertTitle>Mapping fallito</AlertTitle>
                              <AlertDescription>
                                Tutti i {total} record sono vuoti. Il mapping AI non ha trovato corrispondenze con le colonne del file.
                                Elimina questo import e riprova con un file diverso.
                              </AlertDescription>
                            </Alert>
                          )}

                          {allEmpty < total && problemRows > 0 && (
                            <Alert>
                              <AlertCircle className="w-4 h-4" />
                              <AlertTitle>{problemRows} righe incomplete</AlertTitle>
                              <AlertDescription className="space-y-2">
                                <p>Queste righe non hanno né azienda né nome. Puoi:</p>
                                <div className="flex gap-2 flex-wrap">
                                  <Button size="sm" variant="outline" onClick={handleProcess} disabled={processImport.isPending || allEmpty === total}>
                                    <Wand2 className="w-3.5 h-3.5 mr-1" />
                                    Correggi con AI (~{Math.ceil(problemRows / 25)} chiamate)
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={handleExportIncomplete}>
                                    <Download className="w-3.5 h-3.5 mr-1" />
                                    Esporta CSV incompleti ({problemRows})
                                  </Button>
                                </div>
                              </AlertDescription>
                            </Alert>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })()}
                </>
              )}

              <ContactsGridTab contacts={contacts} activeLogId={activeLogId} />
            </TabsContent>

            {/* ====== ERRORS TAB ====== */}
            <TabsContent value="errors" className="mt-4 space-y-4">
              <ImportErrorMonitor
                errors={errors}
                pendingErrors={pendingErrors}
                correctedErrors={correctedErrors}
                dismissedErrors={dismissedErrors}
                activeLogId={activeLogId}
                fixErrors={fixErrors}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* AI Assistant */}
      <ImportAssistant
        activeLogId={activeLogId}
        activeFileName={activeLog?.file_name}
      />
    </div>
  );
}
