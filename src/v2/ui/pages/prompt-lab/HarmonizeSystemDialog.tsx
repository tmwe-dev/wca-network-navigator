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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Layers, Upload, Trash2, Play, X, CheckCircle2, AlertCircle, BookOpen, RotateCw, FileText } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { useHarmonizeOrchestrator } from "./hooks/useHarmonizeOrchestrator";
import { parseUploadedFile, ACCEPT_STRING, type ParsedFile } from "./utils/fileParser";
import { HarmonizeReviewPanel } from "./HarmonizeReviewPanel";
import { useHarmonizerLibraryIngestion } from "./harmonizer/useHarmonizerLibraryIngestion";
import { TMWE_CHUNKS } from "./harmonizer/tmweChunks";
import { useAgenticHarmonizer } from "./harmonizer-v2/useAgenticHarmonizer";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ── Persistenza UI (goal + ultimo file usato) ──
// I file caricati non sono persistibili (sono Blob in memoria), ma persistiamo
// il loro nome così che la UI possa ricordare all'utente cosa ricaricare.
const UI_STORAGE_KEY = "harmonizerV2:dialog:ui";
interface PersistedUi {
  goal?: string;
  agenticGoal?: string;
  ingestionGoal?: string;
  agenticFileName?: string;
  ingestionFileName?: string;
}
function loadUi(): PersistedUi {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(window.localStorage.getItem(UI_STORAGE_KEY) ?? "{}") as PersistedUi; }
  catch { return {}; }
}
function saveUi(patch: Partial<PersistedUi>): void {
  if (typeof window === "undefined") return;
  try {
    const next = { ...loadUi(), ...patch };
    window.localStorage.setItem(UI_STORAGE_KEY, JSON.stringify(next));
  } catch { /* noop */ }
}

export function HarmonizeSystemDialog({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const persistedUi = loadUi();
  const [goal, setGoal] = useState(persistedUi.goal ?? "Armonizza l'intero sistema con la libreria TMWE.");
  const [librarySource, setLibrarySource] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<ParsedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { state, start, toggleApproval, approveAllSafe, loadRunForReview, execute, cancel, reset } = useHarmonizeOrchestrator(userId);

  // ── Ingestion pipeline (tab "Documento grande") ──
  const ingestion = useHarmonizerLibraryIngestion(userId);
  const ingestionFileRef = useRef<HTMLInputElement>(null);
  const [ingestionFile, setIngestionFile] = useState<ParsedFile | null>(null);
  const [ingestionGoal, setIngestionGoal] = useState(
    persistedUi.ingestionGoal ?? "Ingerisci la libreria TMWE in 7 chunk con sessione persistente.",
  );
  const lastIngestionFileName = persistedUi.ingestionFileName;

  // ── Agentic V2 (entity-by-entity) ──
  const agentic = useAgenticHarmonizer(userId);
  const agenticFileRef = useRef<HTMLInputElement>(null);
  const [agenticFile, setAgenticFile] = useState<ParsedFile | null>(null);
  const [agenticGoal, setAgenticGoal] = useState(
    persistedUi.agenticGoal ?? "Armonizza entity-by-entity con micro-call AI dedicate.",
  );
  const lastAgenticFileName = persistedUi.agenticFileName;

  // Persisti i goal a ogni cambio (debounce-less: scrittura veloce su localStorage).
  useEffect(() => { saveUi({ goal }); }, [goal]);
  useEffect(() => { saveUi({ agenticGoal }); }, [agenticGoal]);
  useEffect(() => { saveUi({ ingestionGoal }); }, [ingestionGoal]);

  const handleAgenticUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = await parseUploadedFile(file);
      setAgenticFile(parsed);
      saveUi({ agenticFileName: parsed.name });
      toast.success(`File caricato: ${parsed.name} (${parsed.sizeKb}KB)`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Errore caricamento ${file.name}`);
    }
    if (agenticFileRef.current) agenticFileRef.current.value = "";
  }, []);

  const handleAgenticStart = useCallback(() => {
    if (!agenticFile) {
      toast.error("Carica prima il file della libreria.");
      return;
    }
    void agentic.start({ sourceFile: agenticFile, goal: agenticGoal });
  }, [agenticFile, agenticGoal, agentic]);

  const handleAgenticResume = useCallback(() => {
    // Il resume usa il file appena ricaricato se disponibile, altrimenti
    // il sourceText persistito in localStorage dalla sessione precedente.
    const hasPersistedSource = Boolean(agentic.state.sourceText);
    if (!agenticFile && !hasPersistedSource) {
      toast.error("Nessun sorgente disponibile: ricarica il file per riprendere.");
      return;
    }
    void agentic.resume(agenticFile ? { sourceFile: agenticFile, goal: agenticGoal } : { goal: agenticGoal });
  }, [agenticFile, agenticGoal, agentic]);

  const handleOpenAgenticReview = useCallback(() => {
    if (!agentic.state.reviewRun) return;
    loadRunForReview(agentic.state.reviewRun);
  }, [agentic.state.reviewRun, loadRunForReview]);

  // Il resume è abilitato se c'è un file appena caricato OPPURE se nello stato
  // persistito è disponibile il testo sorgente originale.
  const canResumeAgentic = Boolean(agenticFile) || Boolean(agentic.state.sourceText);

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

  const handleIngestionUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = await parseUploadedFile(file);
      setIngestionFile(parsed);
      saveUi({ ingestionFileName: parsed.name });
      toast.success(`File caricato: ${parsed.name} (${parsed.sizeKb}KB)`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Errore caricamento ${file.name}`);
    }
    if (ingestionFileRef.current) ingestionFileRef.current.value = "";
  }, []);

  const handleIngestionStart = useCallback(() => {
    if (!ingestionFile) {
      toast.error("Carica prima il file della libreria.");
      return;
    }
    void ingestion.start({ sourceFile: ingestionFile, goal: ingestionGoal });
  }, [ingestionFile, ingestionGoal, ingestion]);

  const handleIngestionResume = useCallback(() => {
    if (!ingestionFile) {
      toast.error("Ricarica il file sorgente per riprendere la sessione.");
      return;
    }
    void ingestion.resume(ingestionFile, ingestionGoal);
  }, [ingestionFile, ingestionGoal, ingestion]);

  const sessionFactsCount = Object.keys(ingestion.state.session?.facts_registry ?? {}).length;
  const sessionConflictsCount = ingestion.state.session?.conflicts_found.length ?? 0;
  const sessionCrossRefsCount = ingestion.state.session?.cross_references.length ?? 0;
  const sessionBootstrapEntities = (ingestion.state.session?.entities_created ?? []).filter((e) => e.created_in_chunk < 0).length;
  const sessionRunCreatedEntities = (ingestion.state.session?.entities_created ?? []).filter((e) => e.created_in_chunk >= 0).length;

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
          <div className="pt-2">
            <a
              href="/docs/guida-formato-documenti-ai.md"
              download="guida-formato-documenti-ai.md"
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <FileText className="h-3.5 w-3.5" />
              Scarica la guida “Come preparare i documenti per l’AI” (.md)
            </a>
          </div>
        </DialogHeader>

        <Tabs defaultValue="classic" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="self-start">
            <TabsTrigger value="classic">
              <Layers className="h-4 w-4 mr-1" /> Modalità classica
            </TabsTrigger>
            <TabsTrigger value="ingestion">
              <BookOpen className="h-4 w-4 mr-1" /> Ingestione documento grande
            </TabsTrigger>
            <TabsTrigger value="agentic">
              <Sparkles className="h-4 w-4 mr-1" /> Agentic V2
            </TabsTrigger>
          </TabsList>

          <TabsContent value="classic" className="flex-1 overflow-auto pr-2 mt-4">
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
          </TabsContent>

          <TabsContent value="ingestion" className="flex-1 overflow-auto pr-2 mt-4">
            {/* Banner sessione ripresabile */}
            {ingestion.state.resumable && ingestion.state.phase === "idle" && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 mb-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-xs">
                    <p className="font-semibold flex items-center gap-1">
                      <RotateCw className="h-3.5 w-3.5" /> Sessione interrotta trovata
                    </p>
                    <p className="text-muted-foreground mt-1">
                      File: <code>{ingestion.state.resumable.source_file}</code> · Chunk completati: {ingestion.state.resumable.current_chunk}/{ingestion.state.resumable.total_chunks}.
                      Ricarica lo stesso file e clicca "Riprendi".
                    </p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button size="sm" variant="outline" onClick={handleIngestionResume} disabled={!ingestionFile}>
                      Riprendi
                    </Button>
                    <Button size="sm" variant="ghost" onClick={ingestion.dismissResumable}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* INPUT */}
            {(ingestion.state.phase === "idle" || ingestion.state.phase === "starting") && (
              <div className="space-y-4">
                <div className="rounded-md border border-border bg-muted/30 p-3 text-xs">
                  <p className="font-semibold mb-1">Pipeline ingestione 7-chunk</p>
                  <p className="text-muted-foreground">
                    Adatta a documenti grandi (~80K+ token). La sessione tiene traccia di facts, conflitti e
                    cross-references tra chunk diversi. In caso di errore puoi riprendere dal chunk fallito.
                  </p>
                </div>

                <div>
                  <label className="text-sm font-semibold mb-1 block">Obiettivo dell'ingestione</label>
                  <Textarea value={ingestionGoal} onChange={(e) => setIngestionGoal(e.target.value)} rows={2} />
                </div>

                <div>
                  <label className="text-sm font-semibold mb-1 block">Documento sorgente</label>
                  <input ref={ingestionFileRef} type="file" accept={ACCEPT_STRING} onChange={handleIngestionUpload} className="hidden" />
                  <Button variant="outline" size="sm" onClick={() => ingestionFileRef.current?.click()}>
                    <Upload className="h-4 w-4 mr-2" /> {ingestionFile ? "Sostituisci file" : "Carica libreria"}
                  </Button>
                  {ingestionFile && (
                    <div className="mt-2 flex items-center gap-2 text-xs bg-muted px-2 py-1 rounded">
                      <span className="font-mono">{ingestionFile.name}</span>
                      <Badge variant="outline">{ingestionFile.sizeKb}KB</Badge>
                      <Badge variant="outline">{ingestionFile.content.split("\n").length} righe</Badge>
                    </div>
                  )}
                </div>

                <div className="rounded-md border border-border p-2">
                  <p className="text-xs font-semibold mb-2">Mappa chunk previsti ({TMWE_CHUNKS.length})</p>
                  <ul className="text-xs space-y-1">
                    {TMWE_CHUNKS.map((c) => (
                      <li key={c.index} className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">#{c.index}</Badge>
                        <span className="font-medium">{c.name}</span>
                        <span className="text-muted-foreground">L{c.sourceLines[0]}–{c.sourceLines[1]}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Button onClick={handleIngestionStart} disabled={!userId || !ingestionFile} className="w-full">
                  <Play className="h-4 w-4 mr-2" /> Avvia pipeline 7-chunk
                </Button>
              </div>
            )}

            {/* RUNNING */}
            {ingestion.state.phase === "running" && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <p className="text-sm font-semibold">
                    Pipeline in esecuzione · {ingestion.state.totalProposals} proposte totali finora
                  </p>
                </div>
                <div className="space-y-2">
                  {ingestion.state.chunks.map((c) => {
                    const def = TMWE_CHUNKS[c.chunkIndex];
                    return (
                      <div key={c.chunkIndex} className="rounded border border-border p-2">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            {c.status === "running" && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                            {c.status === "completed" && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
                            {c.status === "error" && <AlertCircle className="h-3 w-3 text-destructive" />}
                            <Badge variant="outline" className="text-[10px]">#{c.chunkIndex}</Badge>
                            <span className="font-medium">{c.chunkName}</span>
                          </div>
                          <div className="flex gap-1">
                            <Badge variant="secondary" className="text-[10px]">prop {c.proposals}</Badge>
                            <Badge variant="secondary" className="text-[10px]">facts {c.facts}</Badge>
                            <Badge variant="secondary" className="text-[10px]">conf {c.conflicts}</Badge>
                            <Badge variant="secondary" className="text-[10px]">ent {c.entities}</Badge>
                          </div>
                        </div>
                        {c.errorMsg && (
                          <p className="text-[11px] text-destructive mt-1">{c.errorMsg}</p>
                        )}
                        {def && c.status === "pending" && (
                          <p className="text-[10px] text-muted-foreground mt-1">{def.description}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
                <Button variant="ghost" size="sm" onClick={ingestion.cancel}>
                  <X className="h-4 w-4 mr-1" /> Annulla
                </Button>
              </div>
            )}

            {/* ERROR (con retry per chunk) */}
            {ingestion.state.phase === "error" && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-5 w-5" />
                  <p className="text-sm font-semibold">Errore in un chunk</p>
                </div>
                <p className="text-xs text-muted-foreground">{ingestion.state.error}</p>
                <div className="space-y-2">
                  {ingestion.state.chunks.filter((c) => c.status === "error").map((c) => (
                    <div key={c.chunkIndex} className="flex items-center justify-between text-xs border border-destructive/40 rounded p-2">
                      <span>#{c.chunkIndex} {c.chunkName}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!ingestionFile}
                        onClick={() => ingestionFile && void ingestion.retryChunk(c.chunkIndex, ingestionFile.content, ingestionGoal)}
                      >
                        <RotateCw className="h-3 w-3 mr-1" /> Ritenta
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* REVIEW (post-pipeline) */}
            {ingestion.state.phase === "review" && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-emerald-600">
                  <CheckCircle2 className="h-5 w-5" />
                  <p className="text-sm font-semibold">Pipeline completata · {ingestion.state.totalProposals} proposte pronte</p>
                </div>
                <div className="rounded border border-border p-3 text-xs space-y-1">
                  <p>
                    <strong>Sessione:</strong> {ingestion.state.session?.id.slice(0, 8)}…
                  </p>
                  <p><strong>File:</strong> {ingestion.state.session?.source_file}</p>
                  <p>
                    <strong>Chunk completati:</strong>{" "}
                    {ingestion.state.chunks.filter((c) => c.status === "completed").length}/{TMWE_CHUNKS.length}
                  </p>
                  <p>
                    <strong>Fatti registrati:</strong>{" "}
                    {sessionFactsCount}
                  </p>
                  <p>
                    <strong>Conflitti aperti:</strong> {sessionConflictsCount}
                  </p>
                  <p>
                    <strong>Cross-references:</strong> {sessionCrossRefsCount}
                  </p>
                  <p>
                    <strong>Entità create dal run:</strong> {sessionRunCreatedEntities}
                  </p>
                  <p>
                    <strong>Entità bootstrap da DB:</strong> {sessionBootstrapEntities}
                  </p>
                </div>
                {sessionConflictsCount > 0 && (
                  <div className="rounded border border-amber-500/40 bg-amber-500/5 p-3 text-xs">
                    <p className="font-semibold mb-1">Top conflitti da risolvere</p>
                    <ul className="space-y-1">
                      {ingestion.state.session?.conflicts_found.slice(0, 10).map((c, i) => (
                        <li key={i} className="flex gap-2">
                          <Badge variant="outline" className="text-[10px]">{c.status}</Badge>
                          <div>
                            <p className="font-medium">{c.topic}</p>
                            <p className="text-muted-foreground">
                              A: {c.source_a.value} · B: {c.source_b.value}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Le proposte sono salvate sul run figlio. Apri "Modalità classica" → review (run id:{" "}
                  <code>{ingestion.state.run?.id.slice(0, 8)}…</code>) per approvare ed eseguire.
                </p>
              </div>
            )}

            {ingestion.state.phase === "cancelled" && (
              <p className="text-sm text-muted-foreground py-8 text-center">Sessione annullata.</p>
            )}
          </TabsContent>

          <TabsContent value="agentic" className="flex-1 overflow-auto pr-2 mt-4">
            <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-xs mb-4">
              <p className="font-semibold mb-1 flex items-center gap-1"><Sparkles className="h-3.5 w-3.5" /> Pipeline V2 — Entity by Entity</p>
              <p className="text-muted-foreground">
                Splitta il documento per heading, costruisce un Compact Index del DB (~5KB),
                processa ogni entità con una micro-call AI dedicata (~2K token).
                Token overflow impossibile, retry granulare per entità.
              </p>
            </div>

            {/* Banner ripristino dopo refresh: stato in cache, lavoro precedente recuperato. */}
            {(agentic.state.phase === "cancelled" || agentic.state.phase === "done") && agentic.state.entities.length > 0 && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold flex items-center gap-1">
                    <RotateCw className="h-3.5 w-3.5" /> Sessione ripristinata da cache
                  </p>
                  <p className="text-muted-foreground mt-1">
                    Lavoro precedente recuperato: {agentic.state.entities.length} entità processate
                    {agentic.state.output ? <> (run id <code>{agentic.state.output.runId.slice(0, 8)}…</code>)</> : null}.
                    {lastAgenticFileName ? <> Per ripartire ricarica <code>{lastAgenticFileName}</code>.</> : null}
                  </p>
                </div>
                <div className="flex flex-shrink-0 gap-2">
                  <Button size="sm" variant="outline" onClick={handleAgenticResume} disabled={!canResumeAgentic}>
                    <Play className="h-3 w-3 mr-1" /> Riprendi
                  </Button>
                  <Button size="sm" variant="ghost" onClick={agentic.reset}>
                    <X className="h-3 w-3 mr-1" /> Pulisci
                  </Button>
                </div>
              </div>
            )}

            {agentic.state.phase === "idle" && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-semibold mb-1 block">Obiettivo</label>
                  <Textarea value={agenticGoal} onChange={(e) => setAgenticGoal(e.target.value)} rows={2} />
                </div>
                <div>
                  <label className="text-sm font-semibold mb-1 block">Documento sorgente</label>
                  <input ref={agenticFileRef} type="file" accept={ACCEPT_STRING} onChange={handleAgenticUpload} className="hidden" />
                  <Button variant="outline" size="sm" onClick={() => agenticFileRef.current?.click()}>
                    <Upload className="h-4 w-4 mr-2" /> {agenticFile ? "Sostituisci file" : "Carica libreria"}
                  </Button>
                  {agenticFile && (
                    <div className="mt-2 flex items-center gap-2 text-xs bg-muted px-2 py-1 rounded">
                      <span className="font-mono">{agenticFile.name}</span>
                      <Badge variant="outline">{agenticFile.sizeKb}KB</Badge>
                      <Badge variant="outline">{agenticFile.content.split("\n").length} righe</Badge>
                    </div>
                  )}
                  {!agenticFile && lastAgenticFileName && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Ultimo file usato: <code>{lastAgenticFileName}</code>
                    </p>
                  )}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button onClick={handleAgenticStart} disabled={!userId || !agenticFile} className="w-full">
                    <Play className="h-4 w-4 mr-2" /> Avvia pipeline agentica
                  </Button>
                  {agentic.state.entities.length > 0 && (
                    <Button onClick={handleAgenticResume} disabled={!userId || !canResumeAgentic} variant="outline" className="w-full">
                      <RotateCw className="h-4 w-4 mr-2" /> Riprendi dal checkpoint
                    </Button>
                  )}
                </div>
              </div>
            )}

            {(agentic.state.phase === "parsing" || agentic.state.phase === "indexing") && (
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm font-semibold">
                  {agentic.state.phase === "parsing" ? "Parsing entità..." : "Costruzione Compact Index..."}
                </p>
              </div>
            )}

            {agentic.state.phase === "processing" && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <p className="text-sm font-semibold">
                    Elaborazione {agentic.state.currentIndex + 1} / {agentic.state.total}
                  </p>
                </div>
                <div className="space-y-1 max-h-[400px] overflow-auto">
                  {agentic.state.entities.slice(0, agentic.state.currentIndex + 5).map((e, i) => (
                    <div key={e.id ?? i} className="flex items-center gap-2 text-xs border border-border rounded p-1.5">
                      {e.status === "processing" && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                      {e.status === "done" && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
                      {e.status === "skipped" && <X className="h-3 w-3 text-muted-foreground" />}
                      {e.status === "needs_review" && <AlertCircle className="h-3 w-3 text-amber-500" />}
                      {e.status === "error" && <AlertCircle className="h-3 w-3 text-destructive" />}
                      <Badge variant="outline" className="text-[10px]">{e.inferredTable}</Badge>
                      <span className="flex-1 truncate">{e.title}</span>
                      {e.decision && <Badge variant="secondary" className="text-[10px]">{e.decision}</Badge>}
                    </div>
                  ))}
                </div>
                <Button variant="ghost" size="sm" onClick={agentic.cancel}>
                  <X className="h-4 w-4 mr-1" /> Annulla
                </Button>
              </div>
            )}

            {agentic.state.phase === "done" && agentic.state.stats && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-emerald-600">
                  <CheckCircle2 className="h-5 w-5" />
                  <p className="text-sm font-semibold">Pipeline completata</p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded border p-2"><strong>{agentic.state.stats.total}</strong> totali</div>
                  <div className="rounded border p-2"><strong>{agentic.state.stats.inserts}</strong> INSERT</div>
                  <div className="rounded border p-2"><strong>{agentic.state.stats.updates}</strong> UPDATE</div>
                  <div className="rounded border p-2"><strong>{agentic.state.stats.skips}</strong> SKIP</div>
                  <div className="rounded border p-2"><strong>{agentic.state.stats.needsReview}</strong> REVIEW</div>
                  <div className="rounded border p-2"><strong>{agentic.state.stats.errors}</strong> errori</div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Insert rate: {(agentic.state.stats.insertRate * 100).toFixed(0)}% · Fatti estratti: {agentic.state.stats.factsExtracted}
                </div>
                {agentic.state.warnings.length > 0 && (
                  <div className="rounded border border-amber-500/40 bg-amber-500/5 p-2 text-xs space-y-1">
                    {agentic.state.warnings.map((w, i) => (
                      <p key={i}><Badge variant="outline" className="text-[10px] mr-1">{w.level}</Badge>{w.message}</p>
                    ))}
                  </div>
                )}
                {(agentic.state.output || agentic.state.reviewRun) && (
                  <p className="text-xs text-muted-foreground">
                    Run id: <code>{(agentic.state.output?.runId ?? agentic.state.reviewRun?.id ?? "").slice(0, 8)}…</code> · Proposte salvate: {agentic.state.reviewRun?.proposals.length ?? 0}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={handleOpenAgenticReview} disabled={!agentic.state.reviewRun || agentic.state.reviewRun.proposals.length === 0}>
                    Apri review e salva nel DB
                  </Button>
                  <Button variant="outline" size="sm" onClick={agentic.reset}>Nuova pipeline</Button>
                </div>
              </div>
            )}

            {agentic.state.phase === "error" && (
              <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
                <AlertCircle className="h-10 w-10 text-destructive" />
                <p className="text-sm">{agentic.state.error}</p>
                <Button variant="outline" size="sm" onClick={agentic.reset}>Riprova</Button>
              </div>
            )}
          </TabsContent>
        </Tabs>

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