/**
 * GlobalImproverDialog — UI per il "Migliora tutto" globale del Prompt Lab.
 * Flusso: 1) input obiettivo → 2) avvio (collect+improve) → 3) review proposte → 4) save selezionati.
 */
import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Sparkles, Loader2, CheckCircle2, AlertCircle, FileText, RotateCcw, Save, X } from "lucide-react";
import { useGlobalPromptImprover } from "./hooks/useGlobalPromptImprover";
import { useAuth } from "@/providers/AuthProvider";
import { toast } from "sonner";

interface GlobalImproverDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalImproverDialog({ open, onOpenChange }: GlobalImproverDialogProps) {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const [goal, setGoal] = useState("");
  const { state, startImprovement, saveAccepted, reset, resumeRun, dismissResumable } = useGlobalPromptImprover(userId, goal);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());

  const readyProposals = useMemo(
    () => state.proposals.filter((p) => p.status === "ready"),
    [state.proposals],
  );
  const skippedCount = state.proposals.filter((p) => p.status === "skipped").length;
  const errorCount = state.proposals.filter((p) => p.status === "error").length;

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

  async function handleSave() {
    if (accepted.size === 0) {
      toast.warning("Nessuna proposta selezionata");
      return;
    }
    await saveAccepted(accepted);
    toast.success(`Salvati ${accepted.size} blocchi`);
    setAccepted(new Set());
  }

  function handleClose(nextOpen: boolean) {
    // LOVABLE-91: ora il run è persistito su DB, si può chiudere durante improving
    if (!nextOpen) {
      reset();
      setAccepted(new Set());
      setGoal("");
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
            <div className="p-5 space-y-3">
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
              <div className="rounded border bg-muted/30 p-3 text-xs space-y-1.5">
                <p className="font-medium">Cosa farà il Lab Agent:</p>
                <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                  <li>Carica TUTTI i blocchi modificabili dal sistema (system prompt, KB doctrine, operative, email, playbook, persona)</li>
                  <li>Costruisce una mappa testuale del runtime (dove ogni blocco viene eseguito)</li>
                  <li>Inietta la dottrina KB completa come riferimento di coerenza</li>
                  <li>Per ogni blocco genera una versione migliorata, libera nella forma ma vincolata dai guard-rail (9 stati lead, no invenzioni, no contraddizioni)</li>
                  <li>Ti mostra le proposte: tu approvi blocco per blocco prima del salvataggio</li>
                </ul>
              </div>
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
                            </div>
                            {p.tabActivation && (
                              <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
                                <span className="font-medium">Runtime:</span> {p.tabActivation}
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
              <div className="px-5 py-3 flex items-center justify-end gap-2 flex-shrink-0">
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
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}