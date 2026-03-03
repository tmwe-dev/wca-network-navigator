import { useState, useCallback } from "react";
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
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Upload, FileText, Loader2, CheckCircle2, AlertCircle,
  Sparkles, Users, Mail, Phone, ArrowRight, ClipboardPaste,
  FileSearch, Download, Wand2, ArrowLeftRight,
} from "lucide-react";
import { ImportErrorMonitor } from "@/components/import/ImportErrorMonitor";
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
import ExcelJS from "exceljs";

// Normalize header key: lowercase, strip accents, collapse spaces/dashes to underscore
function normalizeKey(key: string): string {
  return key
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .toLowerCase()
    .replace(/[-\s]+/g, "_")         // spaces/dashes → underscore
    .replace(/[^a-z0-9_]/g, "")      // remove special chars
    .replace(/_+/g, "_")             // collapse multiple underscores
    .replace(/^_|_$/g, "");           // trim leading/trailing underscores
}

// Robust 3-tier key matching: exact → normalized → fuzzy
function findRowKey(rowKeys: string[], srcKey: string): string | null {
  // Level 1: exact match
  if (rowKeys.includes(srcKey)) return srcKey;
  // Level 2: normalized match
  const normalizedSrc = normalizeKey(srcKey);
  for (const rk of rowKeys) {
    if (normalizeKey(rk) === normalizedSrc) return rk;
  }
  // Level 3: fuzzy — one contains the other (min 3 chars)
  if (normalizedSrc.length >= 3) {
    for (const rk of rowKeys) {
      const nrk = normalizeKey(rk);
      if (nrk.length >= 3 && (nrk.includes(normalizedSrc) || normalizedSrc.includes(nrk))) return rk;
    }
  }
  return null;
}

// Apply AI column_mapping to a single row using robust key matching
function applyMappingToRow(
  row: Record<string, any>,
  columnMapping: Record<string, string>,
  rowKeys: string[],
): Record<string, string | null> {
  const mapped: Record<string, string | null> = {};
  for (const [src, dst] of Object.entries(columnMapping)) {
    if (!TARGET_COLUMNS.includes(dst)) continue;
    const actualKey = findRowKey(rowKeys, src);
    mapped[dst] = actualKey && row[actualKey] ? String(row[actualKey]).trim() || null : null;
  }
  return mapped;
}

// Auto-detect CSV delimiter by counting occurrences in the first line
function detectDelimiter(firstLine: string): string {
  const candidates = [",", ";", "\t"];
  let best = ",";
  let bestCount = 0;
  for (const d of candidates) {
    const count = firstLine.split(d).length - 1;
    if (count > bestCount) {
      bestCount = count;
      best = d;
    }
  }
  return best;
}

// Handle duplicate headers by appending _2, _3 etc.
function deduplicateHeaders(headers: string[]): string[] {
  const counts: Record<string, number> = {};
  return headers.map((h) => {
    if (!counts[h]) {
      counts[h] = 1;
      return h;
    }
    counts[h]++;
    return `${h}_${counts[h]}`;
  });
}

// Parse CSV/Excel file to rows (keys are normalized, delimiters auto-detected, duplicate headers handled)
async function parseFile(file: File): Promise<{ headers: string[]; rows: any[] }> {
  if (file.name.endsWith(".csv") || file.name.endsWith(".txt")) {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return { headers: [], rows: [] };

    // Auto-detect delimiter
    const delimiter = detectDelimiter(lines[0]);

    const rawHeaders = lines[0].split(delimiter).map((h) => h.trim().replace(/['"]/g, ""));
    const normalizedHeaders = rawHeaders.map(normalizeKey);
    const headers = deduplicateHeaders(normalizedHeaders);

    const rows = lines.slice(1).map((line) => {
      const values: string[] = [];
      let current = "";
      let inQuotes = false;
      for (const ch of line) {
        if (ch === '"') { inQuotes = !inQuotes; continue; }
        if (ch === delimiter && !inQuotes) { values.push(current.trim()); current = ""; continue; }
        current += ch;
      }
      values.push(current.trim());
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => { obj[h] = values[i] || ""; });
      return obj;
    });
    return { headers, rows };
  }

  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return { headers: [], rows: [] };

  const rawNormalized: string[] = [];
  const rows: any[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      row.eachCell((cell) => {
        rawNormalized.push(normalizeKey(String(cell.value || "").trim()));
      });
    }
  });

  const headers = deduplicateHeaders(rawNormalized);

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const obj: Record<string, string> = {};
    row.eachCell((cell, colNumber) => {
      const key = headers[colNumber - 1];
      if (key) obj[key] = String(cell.value || "").trim();
    });
    if (Object.values(obj).some((v) => v)) rows.push(obj);
  });

  return { headers, rows };
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

const TARGET_COLUMNS = [
  "company_name", "name", "email", "phone", "mobile",
  "country", "city", "address", "zip_code", "note", "origin",
  "company_alias", "contact_alias",
];

export default function Import() {
  const [activeLogId, setActiveLogId] = useState<string | null>(null);
  const [tab, setTab] = useState("upload");
  const [uploadMode, setUploadMode] = useState<"paste" | "file">("file");

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
  } | null>(null);

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

  // === PASTE: Analyze free text ===
  const handlePasteAnalyze = useCallback(async () => {
    if (!pasteText.trim()) return;
    try {
      const result = await analyzeStructure.mutateAsync({
        inputType: "paste",
        rawText: pasteText,
      });
      setAiMapping(result);
      toast({ title: `${result.parsed_rows.length} righe estratte (confidence: ${Math.round(result.confidence * 100)}%)` });
    } catch {}
  }, [pasteText, analyzeStructure]);

  // === FILE: Analyze with AI mapping (distributed 50-row sample) ===
  const handleFileForAiMapping = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.match(/\.(csv|xlsx?|txt)$/i)) {
      toast({ title: "Formato non supportato", description: "Usa CSV, Excel (.xlsx) o TXT", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const { headers, rows } = await parseFile(file);
      if (rows.length === 0) {
        toast({ title: "File vuoto", variant: "destructive" });
        return;
      }
      setPendingFile(file);
      setPendingRows(rows);

      // Distributed sampling: pick 50 rows spread evenly across the file
      const sampleSize = Math.min(50, rows.length);
      const step = rows.length / sampleSize;
      const sample: any[] = [];
      for (let i = 0; i < sampleSize; i++) {
        sample.push(rows[Math.floor(i * step)]);
      }

      const result = await analyzeStructure.mutateAsync({
        inputType: "file",
        sampleRows: sample,
      });
      setAiMapping(result);
      toast({ title: `Mapping AI generato (confidence: ${Math.round(result.confidence * 100)}%) — ${rows.length} righe totali` });
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  }, [analyzeStructure]);

  // === Confirm AI mapping and import (local transformation, raw_data preserved) ===
  const handleConfirmMapping = useCallback(async () => {
    if (!aiMapping || aiMapping.parsed_rows.length === 0) return;
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non autenticato");

      const fileName = uploadMode === "paste"
        ? `testo_incollato_${new Date().toISOString().slice(0, 10)}`
        : pendingFile?.name || "file_importato";

      let log: ImportLog;
      if (uploadMode === "file" && pendingFile) {
        // Debug: log key comparison
        const rowKeys = Object.keys(pendingRows[0] || {});
        const mappingKeys = Object.keys(aiMapping.column_mapping);
        console.log("[Import Debug] Row keys:", rowKeys);
        console.log("[Import Debug] AI mapping keys:", mappingKeys);
        const unmatchedKeys = mappingKeys.filter(k => !findRowKey(rowKeys, k));
        if (unmatchedKeys.length > 0) {
          console.warn("[Import Debug] Unmatched AI keys:", unmatchedKeys);
        }

        // Apply AI mapping LOCALLY to ALL rows using robust 3-tier matching
        const mappedRows = pendingRows.map((row) => {
          const mapped = applyMappingToRow(row, aiMapping.column_mapping, rowKeys);
          return { ...mapped, _raw: row };
        });

        // Pre-import validation: abort if >90% rows are completely empty
        const nonEmptyCount = mappedRows.filter(r => 
          TARGET_COLUMNS.some(col => r[col] && String(r[col]).trim())
        ).length;
        const fillRate = nonEmptyCount / mappedRows.length;
        console.log(`[Import Debug] Fill rate: ${(fillRate * 100).toFixed(1)}% (${nonEmptyCount}/${mappedRows.length})`);
        
        if (fillRate < 0.1) {
          toast({
            title: "Mapping fallito",
            description: `Solo ${nonEmptyCount} righe su ${mappedRows.length} hanno dati. Il mapping AI non corrisponde alle colonne del file. Riprova.`,
            variant: "destructive",
          });
          setUploading(false);
          return;
        }

        log = await createFromParsed.mutateAsync({ rows: mappedRows, userId: user.id, fileName });
      } else {
        log = await createFromParsed.mutateAsync({ rows: aiMapping.parsed_rows, userId: user.id, fileName });
      }

      setActiveLogId(log.id);
      setTab("contacts");
      setAiMapping(null);
      setPasteText("");
      setPendingFile(null);
      setPendingRows([]);
      toast({ title: "Importazione completata", description: `${uploadMode === "file" ? pendingRows.length : aiMapping.parsed_rows.length} righe nello staging` });
    } catch (err) {
      toast({ title: "Errore", description: String(err), variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }, [aiMapping, uploadMode, pendingFile, pendingRows, createFromParsed]);

  const handleProcess = useCallback(() => {
    if (!activeLogId) return;
    processImport.mutate(activeLogId);
  }, [activeLogId, processImport]);

  const selectedContacts = contacts.filter((c) => c.is_selected && !c.is_transferred);

  const handleTransfer = useCallback(() => {
    if (selectedContacts.length === 0) return;
    transferToPartners.mutate(selectedContacts);
  }, [selectedContacts, transferToPartners]);

  const handleCreateActivities = useCallback((type: "send_email" | "phone_call") => {
    if (selectedContacts.length === 0) return;
    const batchId = `import_${Date.now()}`;
    createActivities.mutate({ contacts: selectedContacts, activityType: type, campaignBatchId: batchId });
  }, [selectedContacts, createActivities]);

  const toggleAll = useCallback((selected: boolean) => {
    contacts.filter((c) => !c.is_transferred).forEach((c) => toggleSelection.mutate({ id: c.id, selected }));
  }, [contacts, toggleSelection]);

  const progress = activeLog
    ? activeLog.total_batches > 0
      ? Math.round((activeLog.processing_batch / activeLog.total_batches) * 100)
      : 0
    : 0;

  const pendingErrors = errors.filter((e) => e.status === "pending");
  const correctedErrors = errors.filter((e) => e.status === "corrected");
  const dismissedErrors = errors.filter((e) => e.status === "dismissed");

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Import Contatti</h1>
          <p className="text-sm text-muted-foreground">Carica file o incolla testo — l'AI analizza e mappa automaticamente</p>
        </div>
      </div>

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
                  <button
                    key={log.id}
                    onClick={() => { setActiveLogId(log.id); setTab("contacts"); }}
                    className={`w-full text-left p-2 rounded-md text-xs transition-colors ${
                      activeLogId === log.id ? "bg-accent" : "hover:bg-accent/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium truncate">{log.file_name}</span>
                      {statusBadge(log.status)}
                    </div>
                    <div className="text-muted-foreground mt-0.5">
                      {log.total_rows} righe · {new Date(log.created_at).toLocaleDateString("it")}
                    </div>
                  </button>
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
              {/* Sub-mode selector — only Paste and File+AI */}
              <div className="flex gap-2">
                <Button
                  variant={uploadMode === "paste" ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setUploadMode("paste"); setAiMapping(null); }}
                >
                  <ClipboardPaste className="w-3.5 h-3.5 mr-1.5" />Incolla Testo
                </Button>
                <Button
                  variant={uploadMode === "file" ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setUploadMode("file"); setAiMapping(null); }}
                >
                  <FileSearch className="w-3.5 h-3.5 mr-1.5" />File + Mapping AI
                </Button>
              </div>

              {/* PASTE MODE */}
              {uploadMode === "paste" && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <ClipboardPaste className="w-5 h-5" />Incolla Testo Libero
                    </CardTitle>
                    <CardDescription>
                      Incolla testo da email, tabelle, elenchi. L'AI estrarrà i dati strutturati automaticamente.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Textarea
                      placeholder={"Es:\nMario Rossi - Global Logistics Srl - mario@globallog.it - +39 02 1234567 - Milano, Italia\nAnna Bianchi - Fast Cargo SpA - anna.bianchi@fastcargo.com - Roma"}
                      value={pasteText}
                      onChange={(e) => setPasteText(e.target.value)}
                      className="min-h-[200px] font-mono text-xs"
                    />
                    <Button
                      onClick={handlePasteAnalyze}
                      disabled={!pasteText.trim() || analyzeStructure.isPending}
                    >
                      {analyzeStructure.isPending ? (
                        <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4 mr-1.5" />
                      )}
                      Analizza con AI
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* FILE + AI MAPPING MODE */}
              {uploadMode === "file" && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <FileSearch className="w-5 h-5" />File con Mapping AI Intelligente
                    </CardTitle>
                    <CardDescription>
                      Carica qualsiasi file CSV/Excel/TXT. Il sistema auto-rileva il formato, campiona 50 righe distribuite e propone il mapping ottimale con 1 sola chiamata AI.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <Label>File CSV / Excel</Label>
                      <Input
                        type="file"
                        accept=".csv,.xlsx,.xls,.txt"
                        onChange={handleFileForAiMapping}
                        disabled={uploading || analyzeStructure.isPending}
                      />
                    </div>
                    {(uploading || analyzeStructure.isPending) && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {analyzeStructure.isPending ? "Analisi AI in corso (50 righe campione distribuite)…" : "Lettura file e auto-detect formato…"}
                      </div>
                    )}
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
                    {/* Column mapping table */}
                    {Object.keys(aiMapping.column_mapping).length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">Mapping Colonne</h4>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs">Colonna Sorgente</TableHead>
                              <TableHead className="text-xs">→</TableHead>
                              <TableHead className="text-xs">Colonna Destinazione</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {Object.entries(aiMapping.column_mapping).map(([src, dst]) => (
                              <TableRow key={src}>
                                <TableCell className="text-xs font-mono">{src}</TableCell>
                                <TableCell className="text-xs">→</TableCell>
                                <TableCell className="text-xs font-medium">{dst}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}

                    {/* Warnings */}
                    {aiMapping.warnings.length > 0 && (
                      <Alert variant="destructive">
                        <AlertCircle className="w-4 h-4" />
                        <AlertTitle className="text-xs">Attenzione</AlertTitle>
                        <AlertDescription className="text-xs">
                          {aiMapping.warnings.map((w, i) => <div key={i}>• {w}</div>)}
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Preview: show REAL local transformation for file mode */}
                    <div>
                      {(() => {
                        // For file mode, show locally-transformed rows; for paste, show AI rows
                        const previewRows = uploadMode === "file" && pendingRows.length > 0
                          ? (() => {
                              const rowKeys = Object.keys(pendingRows[0] || {});
                              return pendingRows.slice(0, 5).map(row => applyMappingToRow(row, aiMapping.column_mapping, rowKeys));
                            })()
                          : aiMapping.parsed_rows.slice(0, 5);
                        const totalRows = uploadMode === "file" ? pendingRows.length : aiMapping.parsed_rows.length;
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

                    <div className="flex gap-2">
                      <Button onClick={handleConfirmMapping} disabled={uploading}>
                        {uploading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1.5" />}
                        Conferma e Importa ({uploadMode === "file" ? pendingRows.length : aiMapping.parsed_rows.length} righe)
                      </Button>
                      <Button variant="outline" onClick={() => setAiMapping(null)}>
                        Annulla
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* ====== CONTACTS TAB ====== */}
            <TabsContent value="contacts" className="mt-4 space-y-4">
              {activeLog && (
                <>
                  {/* Quality Report */}
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

              {selectedContacts.length > 0 && (
                <Card>
                  <CardContent className="py-2 flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{selectedContacts.length} selezionati</span>
                    <Button size="sm" variant="outline" onClick={handleTransfer}>
                      <ArrowRight className="w-3.5 h-3.5 mr-1" />Trasferisci a Partner
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleCreateActivities("send_email")}>
                      <Mail className="w-3.5 h-3.5 mr-1" />Crea Attività Email
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleCreateActivities("phone_call")}>
                      <Phone className="w-3.5 h-3.5 mr-1" />Crea Attività Chiamata
                    </Button>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardContent className="p-0">
                  <div className="flex items-center gap-2 px-3 py-2 border-b">
                    <Checkbox
                      checked={contacts.filter((c) => !c.is_transferred).length > 0 &&
                        contacts.filter((c) => !c.is_transferred).every((c) => c.is_selected)}
                      onCheckedChange={(v) => toggleAll(!!v)}
                    />
                    <span className="text-xs text-muted-foreground">Seleziona tutto</span>
                  </div>
                  <ScrollArea className="h-[calc(100vh-420px)]">
                    <div className="divide-y">
                      {contacts.map((c) => (
                        <div
                          key={c.id}
                          className={`flex items-center gap-3 px-3 py-2 text-sm ${c.is_transferred ? "opacity-50" : ""}`}
                        >
                          <Checkbox
                            checked={c.is_selected}
                            disabled={c.is_transferred}
                            onCheckedChange={(v) => toggleSelection.mutate({ id: c.id, selected: !!v })}
                          />
                          <div className="flex-1 min-w-0 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-0.5">
                            <span className="font-medium truncate">{c.company_name || "—"}</span>
                            <span className="truncate text-muted-foreground">{c.name || "—"}</span>
                            <span className="truncate text-muted-foreground">{c.email || "—"}</span>
                            <span className="truncate text-muted-foreground">
                              {c.city}{c.country ? `, ${c.country}` : ""}
                            </span>
                          </div>
                          {c.is_transferred && <Badge variant="secondary" className="text-[10px]">Trasferito</Badge>}
                        </div>
                      ))}
                      {contacts.length === 0 && (
                        <p className="text-center text-sm text-muted-foreground py-12">Nessun contatto nello staging</p>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
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
