/**
 * HarmonizeSystemDialog — UI per "Armonizza tutto" (refactor profondo del sistema).
 *
 * Differente da GlobalImproverDialog ("Migliora tutto"):
 *  - confronta DB reale vs libreria desiderata
 *  - propone UPDATE/INSERT/MOVE/DELETE
 *  - classifica gap per resolution_layer (text/contract/code_policy/kb_governance)
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, Layers, Upload, Trash2, Play, X, CheckCircle2, AlertCircle } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { useHarmonizeOrchestrator } from "./hooks/useHarmonizeOrchestrator";
import { parseUploadedFile, ACCEPT_STRING, type ParsedFile } from "./utils/fileParser";
import { HarmonizeReviewPanel } from "./HarmonizeReviewPanel";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HarmonizeSystemDialog({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const [goal, setGoal] = useState("Armonizza l'intero sistema con la libreria TMWE.");
  const [librarySource, setLibrarySource] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<ParsedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { state, start, toggleApproval, approveAllSafe, execute, cancel, reset } = useHarmonizeOrchestrator(userId);

  // Carica la libreria di default da public/kb-source/libreria-tmwe.md
  useEffect(() => {
    if (!open) return;
    fetch("/kb-source/libreria-tmwe.md")
      .then((r) => (r.ok ? r.text() : ""))
      .then((txt) => setLibrarySource(txt))
      .catch(() => setLibrarySource(""));
  }, [open]);

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      try {
        const parsed = await parseUploadedFile(file);
        setUploadedFiles((prev) => [...prev, parsed]);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : `Errore caricamento ${file.name}`);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleStart = useCallback(() => {
    if (!goal.trim()) {
      toast.error("Inserisci un obiettivo per l'armonizzazione.");
      return;
    }
    void start({ goal, librarySource, uploadedFiles });
  }, [goal, librarySource, uploadedFiles, start]);

  const handleClose = useCallback(() => {
    reset();
    onOpenChange(false);
  }, [reset, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(o) : handleClose())}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            Armonizza tutto — Refactor profondo del sistema
          </DialogTitle>
          <DialogDescription>
            Confronta lo stato reale del DB con lo stato desiderato della libreria TMWE e propone
            azioni tipizzate (UPDATE / INSERT / MOVE / DELETE) con evidenza e classificazione del gap.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto pr-2">
          {/* FASE INPUT */}
          {state.phase === "idle" && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold mb-1 block">Obiettivo</label>
                <Textarea value={goal} onChange={(e) => setGoal(e.target.value)} rows={2} />
              </div>

              <div>
                <label className="text-sm font-semibold mb-1 block">
                  Libreria desiderata (caricata da <code>public/kb-source/libreria-tmwe.md</code>)
                </label>
                <Textarea
                  value={librarySource}
                  onChange={(e) => setLibrarySource(e.target.value)}
                  rows={6}
                  className="font-mono text-xs"
                  placeholder="Sostituisci il file public/kb-source/libreria-tmwe.md con il tuo contenuto reale, oppure incolla qui."
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Caratteri: {librarySource.length}. Sezioni rilevate: {(librarySource.match(/^##\s/gm) ?? []).length}.
                </p>
              </div>

              <div>
                <label className="text-sm font-semibold mb-1 block">Documenti aggiuntivi (opzionale)</label>
                <input ref={fileInputRef} type="file" accept={ACCEPT_STRING} multiple onChange={handleUpload} className="hidden" />
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-4 w-4 mr-2" /> Carica file
                </Button>
                {uploadedFiles.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {uploadedFiles.map((f, i) => (
                      <div key={i} className="flex items-center justify-between text-xs bg-muted px-2 py-1 rounded">
                        <span>{f.name} ({f.sizeKb}KB)</span>
                        <Button variant="ghost" size="sm" onClick={() => setUploadedFiles((prev) => prev.filter((_, idx) => idx !== i))}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Button onClick={handleStart} disabled={!userId} className="w-full">
                <Play className="h-4 w-4 mr-2" /> Avvia armonizzazione
              </Button>
            </div>
          )}

          {/* FASI ATTIVE */}
          {(state.phase === "collecting" || state.phase === "analyzing") && (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm font-semibold">
                {state.phase === "collecting" ? "Raccolta inventario..." : "Analisi proposte..."}
              </p>
              {state.collector && (
                <div className="text-xs text-muted-foreground space-y-1 text-center">
                  <div>Reale: {state.collector.realSummary.total} elementi · Desiderato: {state.collector.desiredSummary.total} sezioni</div>
                  <div className="flex gap-2 justify-center flex-wrap">
                    <Badge variant="outline">Testo: {state.collector.classification.text_only}</Badge>
                    <Badge variant="outline">KB governance: {state.collector.classification.needs_kb_governance}</Badge>
                    <Badge variant="outline">Contratto: {state.collector.classification.needs_contract}</Badge>
                    <Badge variant="outline">Policy: {state.collector.classification.needs_code_policy}</Badge>
                  </div>
                </div>
              )}
              {state.progress.total > 0 && (
                <p className="text-xs text-muted-foreground">{state.progress.current} / {state.progress.total} chunk</p>
              )}
              <p className="text-xs text-muted-foreground">{state.proposals.length} proposte generate</p>
              <Button variant="ghost" size="sm" onClick={cancel}><X className="h-4 w-4 mr-1" /> Annulla</Button>
            </div>
          )}

          {/* REVIEW */}
          {state.phase === "review" && (
            <HarmonizeReviewPanel
              proposals={state.proposals}
              approvedIds={state.approvedIds}
              onToggle={toggleApproval}
              onApproveAllSafe={approveAllSafe}
            />
          )}

          {/* EXECUTING */}
          {state.phase === "executing" && (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm">Esecuzione: {state.executedCount} ok · {state.failedCount} falliti</p>
            </div>
          )}

          {/* DONE */}
          {state.phase === "done" && (
            <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              <p className="text-base font-semibold">Armonizzazione completata</p>
              <p className="text-sm text-muted-foreground">
                Eseguite: {state.executedCount} · Fallite: {state.failedCount}
              </p>
            </div>
          )}

          {state.phase === "failed" && (
            <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
              <AlertCircle className="h-10 w-10 text-destructive" />
              <p className="text-sm">{state.error ?? "Errore durante l'armonizzazione."}</p>
            </div>
          )}
        </div>

        {/* FOOTER */}
        {state.phase === "review" && (
          <>
            <Separator />
            <div className="flex items-center justify-between pt-2">
              <span className="text-sm text-muted-foreground">{state.approvedIds.size} proposte selezionate</span>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={cancel}>Annulla run</Button>
                <Button onClick={execute} disabled={state.approvedIds.size === 0}>
                  Esegui {state.approvedIds.size} approvate
                </Button>
              </div>
            </div>
          </>
        )}

        {(state.phase === "done" || state.phase === "failed" || state.phase === "cancelled") && (
          <div className="flex justify-end pt-2">
            <Button onClick={handleClose}>Chiudi</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}