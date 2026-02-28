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
import {
  Upload, FileText, Loader2, CheckCircle2, AlertCircle,
  Sparkles, Users, Mail, Phone, Trash2, ArrowRight,
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
  type ImportLog,
  type ImportedContact,
} from "@/hooks/useImportLogs";
import ExcelJS from "exceljs";

// Parse CSV/Excel file to rows
async function parseFile(file: File): Promise<any[]> {
  if (file.name.endsWith(".csv")) {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/['"]/g, ""));
    return lines.slice(1).map((line) => {
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
  }

  // Excel
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const headers: string[] = [];
  const rows: any[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      row.eachCell((cell) => {
        headers.push(String(cell.value || "").trim().toLowerCase());
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
  return rows;
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
  const [activeLogId, setActiveLogId] = useState<string | null>(null);
  const [tab, setTab] = useState("upload");

  const { data: logs = [] } = useImportLogs();
  const { data: activeLog } = useImportLog(activeLogId);
  const { data: contacts = [] } = useImportedContacts(activeLogId);
  const { data: errors = [] } = useImportErrors(activeLogId);

  const createImport = useCreateImport();
  const processImport = useProcessImport();
  const toggleSelection = useToggleContactSelection();
  const transferToPartners = useTransferToPartners();
  const createActivities = useCreateActivitiesFromImport();

  const [uploading, setUploading] = useState(false);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.match(/\.(csv|xlsx?)$/i)) {
      toast({ title: "Formato non supportato", description: "Usa CSV o Excel (.xlsx)", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const rows = await parseFile(file);
      if (rows.length === 0) {
        toast({ title: "File vuoto", description: "Nessun dato trovato nel file", variant: "destructive" });
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non autenticato");

      const log = await createImport.mutateAsync({ file, rows, userId: user.id });
      setActiveLogId(log.id);
      setTab("contacts");
      toast({ title: "File caricato", description: `${rows.length} righe importate nello staging` });
    } catch (err) {
      console.error(err);
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
    const eligible = contacts.filter((c) => !c.is_transferred);
    eligible.forEach((c) => toggleSelection.mutate({ id: c.id, selected }));
  }, [contacts, toggleSelection]);

  const progress = activeLog
    ? activeLog.total_batches > 0
      ? Math.round((activeLog.processing_batch / activeLog.total_batches) * 100)
      : 0
    : 0;

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Import Contatti</h1>
          <p className="text-sm text-muted-foreground">Carica, normalizza con AI e trasferisci contatti</p>
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

            <TabsContent value="upload" className="mt-4 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="w-5 h-5" />Carica File
                  </CardTitle>
                  <CardDescription>
                    CSV o Excel (.xlsx). Le colonne vengono mappate automaticamente.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>File CSV / Excel</Label>
                    <Input
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={handleFileUpload}
                      disabled={uploading}
                    />
                  </div>
                  {uploading && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />Caricamento in corso…
                    </div>
                  )}

                  <Alert>
                    <FileText className="w-4 h-4" />
                    <AlertTitle>Colonne supportate</AlertTitle>
                    <AlertDescription className="text-xs">
                      company_name / ragione_sociale / azienda, name / nome / contatto,
                      email / mail, phone / telefono / tel, mobile / cellulare,
                      country / paese, city / citta, address / indirizzo, zip_code / cap,
                      note, origin / origine
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="contacts" className="mt-4 space-y-4">
              {/* AI processing bar */}
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
                    {activeLog.status === "processing" && (
                      <Progress value={progress} className="h-1.5" />
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Action bar */}
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

              {/* Contact list */}
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
                          className={`flex items-center gap-3 px-3 py-2 text-sm ${
                            c.is_transferred ? "opacity-50" : ""
                          }`}
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
                          {c.is_transferred && (
                            <Badge variant="secondary" className="text-[10px]">Trasferito</Badge>
                          )}
                        </div>
                      ))}
                      {contacts.length === 0 && (
                        <p className="text-center text-sm text-muted-foreground py-12">
                          Nessun contatto nello staging
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="errors" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-destructive" />
                    Errori di importazione ({errors.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[calc(100vh-360px)]">
                    <div className="space-y-2">
                      {errors.map((err) => (
                        <Alert key={err.id} variant="destructive">
                          <AlertTitle className="text-xs">
                            Riga {err.row_number} — {err.error_type}
                          </AlertTitle>
                          <AlertDescription className="text-xs">
                            {err.error_message}
                            {err.raw_data && (
                              <pre className="mt-1 text-[10px] bg-background/50 p-1 rounded overflow-x-auto">
                                {JSON.stringify(err.raw_data, null, 2).substring(0, 200)}
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
