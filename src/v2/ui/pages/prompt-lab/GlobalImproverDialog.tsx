/**
 * GlobalImproverDialog — UI per il "Migliora tutto" globale del Prompt Lab.
 * LOVABLE-92: aggiunto upload file (PDF/DOCX/TXT), campo materiale di riferimento,
 * system manifest e profilo azienda iniettati nel contesto agent.
 *
 * Flusso: 1) input obiettivo + materiale + file → 2) avvio (collect+improve) → 3) review proposte → 4) save selezionati.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Sparkles, Loader2, CheckCircle2, AlertCircle, FileText, RotateCcw, Save, X, Upload, Trash2, Wrench, Code2, BookOpen, Ban, Undo2, ChevronDown, Clock } from "lucide-react";
import { useGlobalPromptImprover } from "./hooks/useGlobalPromptImprover";
import { rollbackSavedProposals } from "@/data/promptLabGlobalRuns";
import { useAuth } from "@/providers/AuthProvider";
import { useSuggestedImprovements } from "./hooks/useSuggestedImprovements";
import { toast } from "sonner";
import { parseUploadedFile, ACCEPT_STRING, type ParsedFile } from "./utils/fileParser";
import { usePromptLabSignals } from "./hooks/usePromptLabSignals";
import { SignalsBanner } from "./SignalsBanner";
import { ScheduledImproverConfig } from "./ScheduledImproverConfig";

interface GlobalImproverDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Modalità iniziale: "tab" (Prompt Lab) o "agent" (Atlas). */
  defaultGrouping?: "tab" | "agent";
}

export function GlobalImproverDialog({ open, onOpenChange, defaultGrouping = "tab" }: GlobalImproverDialogProps) {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const [goal, setGoal] = useState("");
  const [referenceMaterial, setReferenceMaterial] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<ParsedFile[]>([]);
  const [grouping, setGrouping] = useState<"tab" | "agent">(defaultGrouping);
  const [schedulingOpen, setSchedulingOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { state, startImprovement, saveAccepted, reset, resumeRun, dismissResumable } = useGlobalPromptImprover(userId, goal, referenceMaterial, uploadedFiles, grouping);
  const signals = usePromptLabSignals(userId);
  const { counts: suggestionCounts } = useSuggestedImprovements(userId, true);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      try {
        const parsed = await parseUploadedFile(file);
        setUploadedFiles((prev) => [...prev, parsed]);
        toast.success(`Caricato: ${parsed.name} (${parsed.sizeKb}KB)`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : `Errore caricamento ${file.name}`);
      }
    }
    e.target.value = "";
  }, []);

  const removeFile = useCallback((idx: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const readyProposals = useMemo(
    () => state.proposals.filter((p) => p.status === "ready"),
    [state.proposals],
  );
  const skippedCount = state.proposals.filter((p) => p.status === "skipped").length;
  const minorChangeCount = state.proposals.filter((p) => p.status === "minor_change").length;
  const errorCount = state.proposals.filter((p) => p.status === "error").length;
  // LOVABLE-109: conteggi outcome_type per segnalazioni architetturali
  const contractNeededCount = state.proposals.filter((p) => p.outcomeType === "contract_needed").length;
  const codePolicyCount = state.proposals.filter((p) => p.outcomeType === "code_policy_needed").length;
  const kbFixCount = state.proposals.filter((p) => p.outcomeType === "kb_fix").length;

  function toggle(id: string) {
    setAccepted((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setAccepted(new Set(readyProposals.map((p) => p.block.id)));
  }
  function deselectAll() {
    setAccepted(new Set());
  }

  const [rollbackBusy, setRollbackBusy] = useState(false);

  async function handleSave() {
    if (accepted.size === 0) {
      toast.warning("Nessuna proposta selezionata");
      return;
    }
    await saveAccepted(accepted);
    toast.success(`Salvati ${accepted.size} blocchi`);
    setAccepted(new Set());
  }

  async function handleRollback() {
    if (!state.runId) return;
    setRollbackBusy(true);
    try {
      const count = await rollbackSavedProposals(state.runId);
      toast.success(`Rollback completato: ${count} blocchi ripristinati`);
      handleClose(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore durante il rollback");
    } finally {
      setRollbackBusy(false);
    }
  }

  function handleClose(nextOpen: boolean) {
    // LOVABLE-91: ora il run è persistito su DB, si può chiudere durante improving
    if (!nextOpen) {
      reset();
      setAccepted(new Set());
      setGoal("");
      setReferenceMaterial("");
      setUploadedFiles([]);
      setGrouping(defaultGrouping);
    }
    onOpenChange(nextOpen);
  }

  // Avviso informativo se l'utente chiude il browser durante improving
  useEffect(() => {
    if (!state.loading) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [state.loading]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-5 py-3 border-b flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            Migliora tutto il sistema
          </DialogTitle>
          <DialogDescription className="text-xs">
            Il Lab Agent analizza l'intero ecosistema (system prompt, KB doctrine, prompt operativi, email, playbook, persona) e propone una versione coerente per ogni blocco. Tu approvi cosa salvare.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          {state.phase === "idle" && (
            <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-3">
              {/* LOVABLE-92: Segnalazioni dal feedback loop */}
              <SignalsBanner
                state={signals.state}
                onAnalyze={signals.analyze}
                onDismiss={signals.dismiss}
                onAcknowledge={signals.acknowledge}
                onCopySuggestion={(text) => setReferenceMaterial((prev) => prev ? `${prev}\n\n${text}` : text)}
              />

              {/* LOVABLE-110: Banner suggerimenti approvati pronti per l'Architect */}
              {suggestionCounts.approved > 0 && (
                <div className="rounded border border-green-500/40 bg-green-500/5 p-3 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-green-600 flex-shrink-0" />
                  <div className="text-xs flex-1">
                    <span className="font-medium text-green-700">
                      {suggestionCounts.approved} suggeriment{suggestionCounts.approved === 1 ? "o approvato" : "i approvati"} pronto{suggestionCounts.approved > 1 ? "i" : ""} per l'Architect.
                    </span>
                    <span className="text-muted-foreground ml-1">
                      Verranno integrati automaticamente al prossimo "Migliora tutto".
                    </span>
                  </div>
                </div>
              )}

              {state.hasResumableRun && state.resumableRun && (
                <div className="rounded border border-primary/40 bg-primary/5 p-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <RotateCcw className="h-4 w-4 text-primary flex-shrink-0" />
                    <div className="text-xs min-w-0">
                      <p className="font-medium">Analisi precedente interrotta</p>
                      <p className="text-muted-foreground truncate">
                        {state.resumableRun.progress_current}/{state.resumableRun.progress_total} completati
                        {state.resumableRun.goal ? ` — "${state.resumableRun.goal}"` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={dismissResumable}>
                      <X className="h-3 w-3" />
                      Scarta
                    </Button>
                    <Button size="sm" className="h-7 text-xs gap-1" onClick={resumeRun}>
                      <RotateCcw className="h-3 w-3" />
                      Riprendi
                    </Button>
                  </div>
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Obiettivo del miglioramento (opzionale)
                </label>
                <Textarea
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder='Es: "più risposte da partner UE in fase holding", "ridurre churn lead qualified", "tono più diretto in primo contatto"...'
                  className="mt-1 text-sm min-h-[80px]"
                />
              </div>
              {/* LOVABLE-92: Materiale di riferimento */}
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Materiale di riferimento (opzionale)
                </label>
                <p className="text-[10px] text-muted-foreground mb-1">
                  Incolla qui nuove procedure, servizi, documentazione tecnica, regole — il Lab Agent li userà come contesto per migliorare prompt e KB.
                </p>
                <Textarea
                  value={referenceMaterial}
                  onChange={(e) => setReferenceMaterial(e.target.value)}
                  placeholder="Es: nuova procedura di onboarding partner, descrizione servizio FIndAIr Express, regole compliance GDPR aggiornate..."
                  className="mt-1 text-sm min-h-[60px] font-mono text-xs"
                />
              </div>

              {/* LOVABLE-92: Upload file */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Documenti allegati (opzionale)
                  </label>
                  <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-3 w-3" />
                    Carica file
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPT_STRING}
                    multiple
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mb-1.5">
                  PDF, DOCX, TXT, MD, JSON, CSV — il contenuto viene estratto e iniettato nel contesto dell'analisi.
                </p>
                {uploadedFiles.length > 0 && (
                  <div className="space-y-1">
                    {uploadedFiles.map((f, idx) => (
                      <div key={`${f.name}-${idx}`} className="flex items-center justify-between rounded border bg-muted/20 px-2 py-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <FileText className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          <span className="text-[11px] truncate">{f.name}</span>
                          <span className="text-[10px] text-muted-foreground flex-shrink-0">({f.sizeKb}KB)</span>
                        </div>
                        <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => removeFile(idx)}>
                          <Trash2 className="h-3 w-3 text-muted-foreground" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Toggle raggruppamento: Tab vs Agente */}
              <div className="flex items-center gap-3 rounded border bg-muted/20 p-3">
                <span className="text-xs font-medium text-muted-foreground">Raggruppa per:</span>
                <div className="flex rounded-md border overflow-hidden">
                  <button
                    type="button"
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${grouping === "tab" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
                    onClick={() => setGrouping("tab")}
                  >
                    Tab UI
                  </button>
                  <button
                    type="button"
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${grouping === "agent" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
                    onClick={() => setGrouping("agent")}
                  >
                    Agente runtime
                  </button>
                </div>
                <span className="text-[10px] text-muted-foreground flex-1">
                  {grouping === "tab"
                    ? "Blocchi vicini = stessa tab nell'editor"
                    : "Blocchi vicini = stesso agente AI a runtime (più preciso)"}
                </span>
              </div>

              <div className="rounded border bg-muted/30 p-3 text-xs space-y-1.5">
                <p className="font-medium">Cosa farà il Lab Agent:</p>
                <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                  <li>Carica TUTTI i blocchi modificabili + architettura sistema (tool, edge function, side-effect) + profilo azienda</li>
                  <li>Costruisce una mappa testuale del runtime (dove ogni blocco viene eseguito)</li>
                  <li>Inietta la dottrina KB completa + materiale di riferimento + documenti allegati</li>
                  <li>Per ogni blocco genera una versione migliorata, coerente con tutto il contesto disponibile</li>
                  <li>Ti mostra le proposte: tu approvi blocco per blocco prima del salvataggio</li>
                </ul>
              </div>

              {/* Programmazione settimanale */}
              <Collapsible open={schedulingOpen} onOpenChange={setSchedulingOpen} className="border rounded">
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="w-full justify-between h-8 text-xs">
                    <span className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5" />
                      Programmazione
                    </span>
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${schedulingOpen ? "rotate-180" : ""}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="p-3 border-t">
                  <ScheduledImproverConfig onRunNow={startImprovement} />
                </CollapsibleContent>
              </Collapsible>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => handleClose(false)}>Annulla</Button>
                <Button onClick={startImprovement} disabled={!userId}>
                  <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                  Avvia analisi globale
                </Button>
              </div>
            </div>
          )}

          {(state.phase === "collecting" || state.phase === "improving" || state.phase === "saving") && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 p-5">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <div className="text-sm font-medium">
                {state.phase === "collecting" && "Raccolta blocchi e dottrina..."}
                {state.phase === "improving" && `Miglioramento ${state.progress.current}/${state.progress.total}`}
                {state.phase === "saving" && "Salvataggio in corso..."}
              </div>
              {state.phase === "improving" && state.progress.total > 0 && (
                <div className="w-full max-w-md">
                  <div className="h-2 bg-muted rounded overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${(state.progress.current / state.progress.total) * 100}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground text-center mt-1">
                    {state.proposals[state.progress.current]?.block.label ?? ""}
                  </p>
                  {state.dbSaveCount > 0 && (
                    <p className="text-[10px] text-muted-foreground text-center mt-1.5 flex items-center justify-center gap-1">
                      <Save className="h-3 w-3" />
                      Salvato {state.dbSaveCount}/{state.progress.total} proposte — puoi chiudere senza perdere progressi
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {(state.phase === "review" || state.phase === "done") && (
            <>
              <div className="px-5 py-2 border-b bg-muted/20 flex-shrink-0 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="default" className="gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    {readyProposals.length} migliorabili
                  </Badge>
                  {skippedCount > 0 && (
                    <Badge variant="secondary" className="gap-1">
                      <FileText className="h-3 w-3" />
                      {skippedCount} già ottimi
                    </Badge>
                  )}
                  {errorCount > 0 && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {errorCount} errori
                    </Badge>
                  )}
                  {contractNeededCount > 0 && (
                    <Badge variant="outline" className="gap-1 border-amber-500 text-amber-700">
                      <Wrench className="h-3 w-3" />
                      {contractNeededCount} contratto backend
                    </Badge>
                  )}
                  {codePolicyCount > 0 && (
                    <Badge variant="outline" className="gap-1 border-purple-500 text-purple-700">
                      <Code2 className="h-3 w-3" />
                      {codePolicyCount} policy codice
                    </Badge>
                  )}
                  {kbFixCount > 0 && (
                    <Badge variant="outline" className="gap-1 border-blue-500 text-blue-700">
                      <BookOpen className="h-3 w-3" />
                      {kbFixCount} fix KB
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    Selezionati: <strong>{accepted.size}</strong> / {readyProposals.length}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={selectAll}>
                    Seleziona tutti
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={deselectAll}>
                    Deseleziona
                  </Button>
                </div>
              </div>

              <ScrollArea className="flex-1 min-h-0">
                <div className="p-4 space-y-3">
                  {state.proposals.map((p) => {
                    const isReady = p.status === "ready";
                    const isSaved = p.status === "saved";
                    const isError = p.status === "error";
                    const isSkipped = p.status === "skipped";
                    return (
                      <div
                        key={p.block.id}
                        className={`rounded border p-3 ${
                          isSaved ? "bg-success/10 border-success/40" :
                          isError ? "bg-destructive/10 border-destructive/40" :
                          isSkipped ? "bg-muted/20 opacity-60" :
                          "bg-background"
                        }`}
                      >
                        <div className="flex items-start gap-2 mb-2">
                          {isReady && (
                            <Checkbox
                              checked={accepted.has(p.block.id)}
                              onCheckedChange={() => toggle(p.block.id)}
                              className="mt-0.5"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">{p.tabLabel}</Badge>
                              <span className="text-xs font-medium">{p.block.label}</span>
                              {isSaved && <Badge variant="default" className="bg-success text-success-foreground text-[10px]">Salvato</Badge>}
                              {isError && <Badge variant="destructive" className="text-[10px]">Errore</Badge>}
                              {isSkipped && <Badge variant="secondary" className="text-[10px]">Già ottimo</Badge>}
                              {/* LOVABLE-109: outcome_type badges */}
                              {p.outcomeType === "contract_needed" && (
                                <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-700 gap-0.5">
                                  <Wrench className="h-2.5 w-2.5" /> Contratto backend
                                </Badge>
                              )}
                              {p.outcomeType === "code_policy_needed" && (
                                <Badge variant="outline" className="text-[10px] border-purple-500 text-purple-700 gap-0.5">
                                  <Code2 className="h-2.5 w-2.5" /> Policy codice
                                </Badge>
                              )}
                              {p.outcomeType === "kb_fix" && (
                                <Badge variant="outline" className="text-[10px] border-blue-500 text-blue-700 gap-0.5">
                                  <BookOpen className="h-2.5 w-2.5" /> Fix KB
                                </Badge>
                              )}
                              {p.outcomeType === "no_change" && (
                                <Badge variant="outline" className="text-[10px] gap-0.5">
                                  <Ban className="h-2.5 w-2.5" /> Nessun intervento
                                </Badge>
                              )}
                            </div>
                            {p.tabActivation && (
                              <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
                                <span className="font-medium">Runtime:</span> {p.tabActivation}
                              </p>
                            )}
                            {p.architecturalNote && (
                              <p className="text-[10px] text-amber-700 bg-amber-50 rounded px-1.5 py-0.5 mt-1">
                                <span className="font-medium">Nota architetturale:</span> {p.architecturalNote}
                              </p>
                            )}
                          </div>
                        </div>
                        {isError && (
                          <p className="text-xs text-destructive mt-1">{p.error}</p>
                        )}
                        {(isReady || isSaved) && p.after && (
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            <div>
                              <p className="text-[10px] font-medium text-muted-foreground mb-1">Prima</p>
                              <pre className="text-[11px] font-mono bg-muted/40 rounded p-2 max-h-32 overflow-auto whitespace-pre-wrap">{p.before || "(vuoto)"}</pre>
                            </div>
                            <div>
                              <p className="text-[10px] font-medium text-success mb-1">Dopo</p>
                              <pre className="text-[11px] font-mono bg-success/10 rounded p-2 max-h-32 overflow-auto whitespace-pre-wrap">{p.after}</pre>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>

              <Separator />
              <div className="px-5 py-3 flex items-center justify-between flex-shrink-0">
                <div>
                  {state.phase === "done" && state.runId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1.5 text-destructive hover:text-destructive"
                      onClick={handleRollback}
                      disabled={rollbackBusy}
                    >
                      {rollbackBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />}
                      Annulla ultimo miglioramento
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => handleClose(false)}>
                    {state.phase === "done" ? "Chiudi" : "Annulla"}
                  </Button>
                  {state.phase === "review" && (
                    <Button onClick={handleSave} disabled={accepted.size === 0 || state.loading}>
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                      Salva {accepted.size > 0 ? `${accepted.size} ` : ""}selezionati
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}