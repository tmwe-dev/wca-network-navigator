import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Upload, FileText, Loader2, AlertCircle,
  Sparkles, Users, ClipboardPaste,
  FileSearch, Download, Wand2, FolderOpen, Trash2,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ImportErrorMonitor } from "@/components/import/ImportErrorMonitor";
import { ContactsGridTab } from "@/components/import/ContactsGridTab";
import { ImportAssistant } from "@/components/import/ImportAssistant";
import { ImportMappingPreview } from "@/components/import/ImportMappingPreview";
import { useImportWizard } from "@/hooks/useImportWizard";

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
  const w = useImportWizard();

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Import Contatti</h1>
          <p className="text-sm text-muted-foreground">Carica file o incolla testo — l'AI analizza e mappa automaticamente</p>
        </div>
      </div>

      {/* ====== UPLOAD DIALOG ====== */}
      <Dialog open={w.uploadDialogOpen} onOpenChange={w.setUploadDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Importa Contatti
            </DialogTitle>
            <DialogDescription>
              Carica file di contatti o biglietti da visita. Formati supportati: CSV, Excel, TXT, JSON.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={w.dialogTab} onValueChange={(v) => w.setDialogTab(v as "file" | "paste")}>
            <TabsList className="w-full">
              <TabsTrigger value="file" className="flex-1">
                <FileText className="w-3.5 h-3.5 mr-1.5" />File
              </TabsTrigger>
              <TabsTrigger value="paste" className="flex-1">
                <ClipboardPaste className="w-3.5 h-3.5 mr-1.5" />Incolla Testo
              </TabsTrigger>
            </TabsList>

            <TabsContent value="file" className="mt-4 space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={w.importSource === "business_card" ? "default" : "outline"}
                  onClick={() => w.setImportSource("business_card")}
                >
                  Biglietti da visita
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={w.importSource === "standard" ? "default" : "outline"}
                  onClick={() => w.setImportSource("standard")}
                >
                  Import standard
                </Button>
              </div>
              <div
                onDragOver={w.handleDragOver}
                onDragLeave={w.handleDragLeave}
                onDrop={w.handleDrop}
                onClick={() => w.fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  w.isDragging
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-primary/50 hover:bg-accent/30"
                }`}
              >
                <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm font-medium">Trascina qui il tuo file o clicca per selezionare</p>
                <p className="text-xs text-muted-foreground mt-1">.csv, .xlsx, .xls, .txt, .json</p>
                {w.importSource === "business_card" && (
                  <p className="text-xs text-muted-foreground mt-2">L'import sarà marcato come origine Biglietti da visita.</p>
                )}
              </div>
              <input
                ref={w.fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls,.txt,.json"
                onChange={w.handleFileInputChange}
                className="hidden"
              />
              <Button
                variant="outline"
                className="w-full"
                onClick={() => w.fileInputRef.current?.click()}
                disabled={w.uploading}
              >
                <FolderOpen className="w-4 h-4 mr-1.5" />
                Sfoglia file
              </Button>
            </TabsContent>

            <TabsContent value="paste" className="mt-4 space-y-3">
              <Textarea
                placeholder={"Es:\nMario Rossi - Global Logistics Srl - mario@globallog.it - +39 02 1234567 - Milano\nAnna Bianchi - Fast Cargo SpA - anna.bianchi@fastcargo.com - Roma"}
                value={w.pasteText}
                onChange={(e) => w.setPasteText(e.target.value)}
                className="min-h-[180px] font-mono text-xs"
              />
              <Button
                onClick={w.handlePasteAnalyze}
                disabled={!w.pasteText.trim() || w.analyzeStructure.isPending}
                className="w-full"
              >
                {w.analyzeStructure.isPending ? (
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 mr-1.5" />
                )}
                Analizza con AI
              </Button>
            </TabsContent>
          </Tabs>

          {(w.uploading || w.analyzeStructure.isPending) && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              {w.analyzeStructure.isPending ? "Analisi AI in corso…" : "Lettura file…"}
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
                {w.logs.map((log) => (
                  <div
                    key={log.id}
                    className={`group relative w-full text-left p-2 rounded-md text-xs transition-colors cursor-pointer ${
                      w.activeLogId === log.id ? "bg-accent" : "hover:bg-accent/50"
                    }`}
                    onClick={() => { w.setActiveLogId(log.id); w.setTab("contacts"); }}
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
                                onClick={() => w.handleDeleteImport(log.id)}
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
                {w.logs.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-8">Nessun import</p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Right: Main content */}
        <div className="lg:col-span-3">
          <Tabs value={w.tab} onValueChange={w.setTab}>
            <TabsList>
              <TabsTrigger value="upload">
                <Upload className="w-3.5 h-3.5 mr-1.5" />Upload
              </TabsTrigger>
              <TabsTrigger value="contacts" disabled={!w.activeLogId}>
                <Users className="w-3.5 h-3.5 mr-1.5" />Contatti ({w.contacts.length})
              </TabsTrigger>
              <TabsTrigger value="errors" disabled={!w.activeLogId || w.errors.length === 0}>
                <AlertCircle className="w-3.5 h-3.5 mr-1.5" />Errori ({w.errors.length})
              </TabsTrigger>
            </TabsList>

            {/* ====== UPLOAD TAB ====== */}
            <TabsContent value="upload" className="mt-4 space-y-4">
              {!w.aiMapping && (
                <Card>
                  <CardContent className="py-8 flex flex-col items-center gap-4">
                    <Upload className="w-12 h-12 text-muted-foreground" />
                    <div className="text-center">
                      <p className="font-medium">Carica un file o incolla testo</p>
                      <p className="text-sm text-muted-foreground">CSV, Excel (.xlsx), TXT, JSON — anche per biglietti da visita con mapping AI automatico</p>
                    </div>
                    <Button onClick={() => w.setUploadDialogOpen(true)} disabled={w.uploading}>
                      {w.uploading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Upload className="w-4 h-4 mr-1.5" />}
                      Upload
                    </Button>
                  </CardContent>
                </Card>
              )}

              {w.aiMapping && (
                <ImportMappingPreview
                  aiMapping={w.aiMapping}
                  pendingFile={w.pendingFile}
                  pendingRows={w.pendingRows}
                  groupName={w.groupName}
                  setGroupName={w.setGroupName}
                  importSource={w.importSource}
                  uploading={w.uploading}
                  onConfirm={w.handleConfirmMapping}
                  onCancel={() => { w.setAiMapping(null); w.setGroupName(""); }}
                  onMappingTargetChange={w.handleMappingTargetChange}
                />
              )}
            </TabsContent>

            {/* ====== CONTACTS TAB ====== */}
            <TabsContent value="contacts" className="mt-4 space-y-4">
              {w.activeLog && (
                <>
                  <Card>
                    <CardContent className="py-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {statusBadge(w.activeLog.status)}
                          <span className="text-sm">
                            {w.activeLog.total_rows} righe importate
                            {w.activeLog.error_rows > 0 && ` · ${w.activeLog.error_rows} errori`}
                          </span>
                        </div>
                      </div>
                      {w.activeLog.status === "processing" && <Progress value={w.progress} className="h-1.5" />}
                    </CardContent>
                  </Card>

                  {/* Data Quality Dashboard */}
                  {w.contacts.length > 0 && (() => {
                    const withCompany = w.contacts.filter(c => c.company_name).length;
                    const withName = w.contacts.filter(c => c.name).length;
                    const withEmail = w.contacts.filter(c => c.email).length;
                    const withPhone = w.contacts.filter(c => c.phone || c.mobile).length;
                    const withCountry = w.contacts.filter(c => c.country).length;
                    const allEmpty = w.contacts.filter(c => !c.company_name && !c.name && !c.email).length;
                    const problemRows = w.contacts.filter(c => !c.company_name && !c.name).length;
                    const total = w.contacts.length;

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
                                  <Button size="sm" variant="outline" onClick={w.handleProcess} disabled={w.processImport.isPending || allEmpty === total}>
                                    <Wand2 className="w-3.5 h-3.5 mr-1" />
                                    Correggi con AI (~{Math.ceil(problemRows / 25)} chiamate)
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={w.handleExportIncomplete}>
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

              <ContactsGridTab contacts={w.contacts} activeLogId={w.activeLogId} />
            </TabsContent>

            {/* ====== ERRORS TAB ====== */}
            <TabsContent value="errors" className="mt-4 space-y-4">
              <ImportErrorMonitor
                errors={w.errors}
                pendingErrors={w.pendingErrors}
                correctedErrors={w.correctedErrors}
                dismissedErrors={w.dismissedErrors}
                activeLogId={w.activeLogId}
                fixErrors={w.fixErrors}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <ImportAssistant
        activeLogId={w.activeLogId}
        activeFileName={w.activeLog?.file_name}
      />
    </div>
  );
}
