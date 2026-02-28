import { useState, useCallback } from "react";
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

// Parse CSV/Excel file to rows
async function parseFile(file: File): Promise<{ headers: string[]; rows: any[] }> {
  if (file.name.endsWith(".csv")) {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return { headers: [], rows: [] };
    const headers = lines[0].split(",").map((h) => h.trim().replace(/['"]/g, ""));
    const rows = lines.slice(1).map((line) => {
      const values: string[] = [];
      let current = "";
      let inQuotes = false;
      for (const ch of line) {
        if (ch === '"') { inQuotes = !inQuotes; continue; }
        if (ch === "," && !inQuotes) { values.push(current.trim()); current = ""; continue; }
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

  const headers: string[] = [];
  const rows: any[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      row.eachCell((cell) => {
        headers.push(String(cell.value || "").trim());
      });
    } else {
      const obj: Record<string, string> = {};
      row.eachCell((cell, colNumber) => {
        const key = headers[colNumber - 1];
        if (key) obj[key] = String(cell.value || "").trim();
      });
      if (Object.values(obj).some((v) => v)) rows.push(obj);
    }
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
];

export default function Import() {
  const [activeLogId, setActiveLogId] = useState<string | null>(null);
  const [tab, setTab] = useState("upload");
  const [uploadMode, setUploadMode] = useState<"paste" | "file" | "standard">("file");

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

  // === FILE: Analyze with AI mapping ===
  const handleFileForAiMapping = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.match(/\.(csv|xlsx?)$/i)) {
      toast({ title: "Formato non supportato", description: "Usa CSV o Excel (.xlsx)", variant: "destructive" });
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

      // Send first 5 rows to AI for mapping
      const sample = rows.slice(0, 5);
      const result = await analyzeStructure.mutateAsync({
        inputType: "file",
        sampleRows: sample,
      });
      setAiMapping(result);
      toast({ title: `Mapping AI generato (confidence: ${Math.round(result.confidence * 100)}%)` });
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  }, [analyzeStructure]);

  // === Confirm AI mapping and import ===
  const handleConfirmMapping = useCallback(async () => {
    if (!aiMapping || aiMapping.parsed_rows.length === 0) return;
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non autenticato");

      const fileName = uploadMode === "paste"
        ? `testo_incollato_${new Date().toISOString().slice(0, 10)}`
        : pendingFile?.name || "file_importato";

      // If we have a pending file, use createImport (saves to storage). Otherwise use createFromParsed.
      let log: ImportLog;
      if (uploadMode === "file" && pendingFile) {
        // Apply AI mapping to ALL rows (not just sample)
        const mappedRows = pendingRows.map((row) => {
          const mapped: Record<string, string | null> = {};
          for (const [src, dst] of Object.entries(aiMapping.column_mapping)) {
            if (TARGET_COLUMNS.includes(dst)) {
              mapped[dst] = row[src] || null;
            }
          }
          return mapped;
        });
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
      toast({ title: "Importazione completata", description: `${aiMapping.parsed_rows.length || pendingRows.length} righe nello staging` });
    } catch (err) {
      toast({ title: "Errore", description: String(err), variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }, [aiMapping, uploadMode, pendingFile, pendingRows, createFromParsed]);

  // === Standard file upload (existing logic) ===
  const handleStandardUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.match(/\.(csv|xlsx?)$/i)) {
      toast({ title: "Formato non supportato", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const { rows } = await parseFile(file);
      if (rows.length === 0) { toast({ title: "File vuoto", variant: "destructive" }); return; }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non autenticato");
      const log = await createImport.mutateAsync({ file, rows, userId: user.id });
      setActiveLogId(log.id);
      setTab("contacts");
      toast({ title: "File caricato", description: `${rows.length} righe importate` });
    } catch (err) {
      toast({ title: "Errore upload", description: String(err), variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }, [createImport]);

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
          <p className="text-sm text-muted-foreground">Carica, incolla testo libero o file con formato personalizzato</p>
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
              {/* Sub-mode selector */}
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
                <Button
                  variant={uploadMode === "standard" ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setUploadMode("standard"); setAiMapping(null); }}
                >
                  <FileText className="w-3.5 h-3.5 mr-1.5" />File Standard
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
                      <FileSearch className="w-5 h-5" />File con Mapping AI
                    </CardTitle>
                    <CardDescription>
                      Carica un file con qualsiasi formato colonne. L'AI campionerà le prime 5 righe e proporrà il mapping.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <Label>File CSV / Excel</Label>
                      <Input
                        type="file"
                        accept=".csv,.xlsx,.xls"
                        onChange={handleFileForAiMapping}
                        disabled={uploading || analyzeStructure.isPending}
                      />
                    </div>
                    {(uploading || analyzeStructure.isPending) && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {analyzeStructure.isPending ? "Analisi AI in corso…" : "Lettura file…"}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* STANDARD MODE */}
              {uploadMode === "standard" && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <FileText className="w-5 h-5" />File Standard
                    </CardTitle>
                    <CardDescription>
                      CSV o Excel con colonne già nel formato atteso. Mapping statico automatico.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <Label>File CSV / Excel</Label>
                      <Input
                        type="file"
                        accept=".csv,.xlsx,.xls"
                        onChange={handleStandardUpload}
                        disabled={uploading}
                      />
                    </div>
                    {uploading && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />Caricamento…
                      </div>
                    )}
                    <Alert>
                      <FileText className="w-4 h-4" />
                      <AlertTitle>Colonne supportate</AlertTitle>
                      <AlertDescription className="text-xs">
                        company_name, name, email, phone, mobile, country, city, address, zip_code, note, origin
                      </AlertDescription>
                    </Alert>
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

                    {/* Preview of parsed rows (max 5) */}
                    <div>
                      <h4 className="text-sm font-medium mb-2">
                        Anteprima ({Math.min(aiMapping.parsed_rows.length, 5)} di {uploadMode === "file" ? pendingRows.length : aiMapping.parsed_rows.length} righe)
                      </h4>
                      <ScrollArea className="max-h-[240px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              {TARGET_COLUMNS.filter((col) =>
                                aiMapping.parsed_rows.some((r) => r[col])
                              ).map((col) => (
                                <TableHead key={col} className="text-[10px] whitespace-nowrap">{col}</TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {aiMapping.parsed_rows.slice(0, 5).map((row, i) => (
                              <TableRow key={i}>
                                {TARGET_COLUMNS.filter((col) =>
                                  aiMapping!.parsed_rows.some((r) => r[col])
                                ).map((col) => (
                                  <TableCell key={col} className="text-[10px] truncate max-w-[120px]">
                                    {row[col] || "—"}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    </div>

                    <div className="flex gap-2">
                      <Button onClick={handleConfirmMapping} disabled={uploading}>
                        {uploading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1.5" />}
                        Conferma e Importa
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
                <Card>
                  <CardContent className="py-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {statusBadge(activeLog.status)}
                        <span className="text-sm">
                          {activeLog.imported_rows}/{activeLog.total_rows} elaborati
                          {activeLog.error_rows > 0 && ` · ${activeLog.error_rows} errori`}
                        </span>
                      </div>
                      {activeLog.status === "pending" && (
                        <Button size="sm" onClick={handleProcess} disabled={processImport.isPending}>
                          <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                          {processImport.isPending ? "Avvio…" : "Normalizza con AI"}
                        </Button>
                      )}
                    </div>
                    {activeLog.status === "processing" && <Progress value={progress} className="h-1.5" />}
                  </CardContent>
                </Card>
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
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-destructive" />
                      Errori di importazione
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{pendingErrors.length} pending</Badge>
                      <Badge variant="default">{correctedErrors.length} corretti</Badge>
                      <Badge variant="destructive">{dismissedErrors.length} non recuperabili</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-2">
                    {pendingErrors.length > 0 && (
                      <Button
                        size="sm"
                        onClick={() => activeLogId && fixErrors.mutate(activeLogId)}
                        disabled={fixErrors.isPending}
                      >
                        {fixErrors.isPending ? (
                          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        ) : (
                          <Wand2 className="w-3.5 h-3.5 mr-1.5" />
                        )}
                        Correggi con AI ({pendingErrors.length})
                      </Button>
                    )}
                    {(dismissedErrors.length > 0 || pendingErrors.length > 0) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => exportErrorsToCSV([...pendingErrors, ...dismissedErrors])}
                      >
                        <Download className="w-3.5 h-3.5 mr-1.5" />
                        Esporta CSV errori
                      </Button>
                    )}
                  </div>

                  <ScrollArea className="h-[calc(100vh-420px)]">
                    <div className="space-y-2">
                      {errors.map((err) => (
                        <Alert
                          key={err.id}
                          variant={err.status === "corrected" ? "default" : "destructive"}
                        >
                          <AlertTitle className="text-xs flex items-center gap-2">
                            Riga {err.row_number} — {err.error_type}
                            {err.status === "corrected" && <Badge variant="default" className="text-[9px]">Corretto</Badge>}
                            {err.status === "dismissed" && <Badge variant="destructive" className="text-[9px]">Non recuperabile</Badge>}
                          </AlertTitle>
                          <AlertDescription className="text-xs">
                            {err.error_message}
                            {err.corrected_data && (
                              <pre className="mt-1 text-[10px] bg-background/50 p-1 rounded overflow-x-auto">
                                {JSON.stringify(err.corrected_data, null, 2).substring(0, 300)}
                              </pre>
                            )}
                          </AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
