/**
 * KBIngestPanel — Carica documenti (PDF/DOCX/TXT/MD) e li indicizza nella Knowledge Base.
 *
 * Pipeline lato edge: Estrazione testo → Chunking → Embedding (text-embedding-3-small)
 * → INSERT in `kb_entries` con vettore, immediatamente richiamabile dagli agenti via
 * `match_kb_entries` (RAG) usato in `_shared/embeddings.ts`.
 */
import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, X, Loader2, CheckCircle2, AlertCircle, BrainCircuit } from "lucide-react";
import { toast } from "sonner";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { queryKeys } from "@/lib/queryKeys";

const ACCEPTED = ".pdf,.docx,.txt,.md,.markdown";
const MAX_BYTES = 10 * 1024 * 1024;

type FileStatus = "pending" | "processing" | "done" | "error";

interface QueuedFile {
  id: string;
  file: File;
  status: FileStatus;
  chunks?: number;
  error?: string;
}

interface IngestResponse {
  success: boolean;
  chunks_created: number;
  total_chars: number;
  kb_ids: string[];
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function KBIngestPanel() {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<QueuedFile[]>([]);
  const [category, setCategory] = useState("imported_documents");
  const [priority, setPriority] = useState(5);
  const [tagsRaw, setTagsRaw] = useState("");
  const [running, setRunning] = useState(false);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next: QueuedFile[] = [];
    for (const f of Array.from(list)) {
      if (f.size > MAX_BYTES) {
        toast.error(`${f.name}: oltre 10MB, scartato`);
        continue;
      }
      next.push({ id: `${f.name}-${f.lastModified}-${f.size}`, file: f, status: "pending" });
    }
    setFiles((prev) => [...prev, ...next]);
  }

  function removeFile(id: string) {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }

  async function processAll() {
    if (files.length === 0) {
      toast.error("Nessun file selezionato");
      return;
    }
    setRunning(true);
    const tags = tagsRaw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    let totalChunks = 0;
    let okCount = 0;

    for (const item of files) {
      if (item.status === "done") continue;
      setFiles((prev) =>
        prev.map((f) => (f.id === item.id ? { ...f, status: "processing", error: undefined } : f)),
      );
      try {
        const b64 = await fileToBase64(item.file);
        const result = await invokeEdge<IngestResponse>("kb-ingest-document", {
          context: "KBIngestPanel.processAll",
          body: {
            fileName: item.file.name,
            mimeType: item.file.type,
            contentBase64: b64,
            category,
            chapter: item.file.name,
            priority,
            tags,
          },
        });
        totalChunks += result.chunks_created;
        okCount += 1;
        setFiles((prev) =>
          prev.map((f) =>
            f.id === item.id ? { ...f, status: "done", chunks: result.chunks_created } : f,
          ),
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setFiles((prev) =>
          prev.map((f) => (f.id === item.id ? { ...f, status: "error", error: msg } : f)),
        );
      }
    }

    setRunning(false);
    if (okCount > 0) {
      toast.success(`Indicizzati ${okCount} file (${totalChunks} chunk in KB)`);
      qc.invalidateQueries({ queryKey: queryKeys.v2.kbEntries() });
      qc.invalidateQueries({ queryKey: queryKeys.v2.kbCount });
    } else {
      toast.error("Nessun file indicizzato. Controlla gli errori.");
    }
  }

  const doneCount = files.filter((f) => f.status === "done").length;
  const progress = files.length > 0 ? (doneCount / files.length) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BrainCircuit className="h-5 w-5" />
          Importa Knowledge Base
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Carica documenti (PDF, DOCX, TXT, MD) — verranno estratti, suddivisi in chunk,
          embeddati con <code className="text-xs">text-embedding-3-small</code> e inseriti in
          <code className="text-xs"> kb_entries</code>. Subito disponibili agli agenti via RAG.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Drop zone */}
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
          }}
          onDrop={(e) => {
            e.preventDefault();
            addFiles(e.dataTransfer.files);
          }}
          className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:bg-muted/50 transition-colors"
        >
          <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm font-medium">Trascina qui i file o clicca per scegliere</p>
          <p className="text-xs text-muted-foreground mt-1">PDF, DOCX, TXT, MD — max 10MB ciascuno</p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPTED}
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />
        </div>

        {/* Form */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label htmlFor="kb-cat" className="text-xs">Categoria</Label>
            <Input
              id="kb-cat"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="imported_documents"
            />
          </div>
          <div>
            <Label htmlFor="kb-prio" className="text-xs">Priorità (1-10)</Label>
            <Input
              id="kb-prio"
              type="number"
              min={1}
              max={10}
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value) || 5)}
            />
          </div>
          <div>
            <Label htmlFor="kb-tags" className="text-xs">Tag (separati da virgola)</Label>
            <Input
              id="kb-tags"
              value={tagsRaw}
              onChange={(e) => setTagsRaw(e.target.value)}
              placeholder="manuale, procedura"
            />
          </div>
        </div>

        {/* File queue */}
        {files.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{files.length} file in coda · {doneCount} processati</span>
              {running && <Loader2 className="h-3 w-3 animate-spin" />}
            </div>
            <Progress value={progress} className="h-1" />
            <div className="space-y-1 max-h-48 overflow-auto">
              {files.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center gap-2 text-sm py-1.5 px-2 rounded border border-border bg-card"
                >
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="flex-1 truncate">{f.file.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {(f.file.size / 1024).toFixed(0)}KB
                  </span>
                  {f.status === "done" && (
                    <Badge variant="secondary" className="gap-1">
                      <CheckCircle2 className="h-3 w-3" /> {f.chunks} chunk
                    </Badge>
                  )}
                  {f.status === "processing" && <Loader2 className="h-4 w-4 animate-spin" />}
                  {f.status === "error" && (
                    <Badge variant="destructive" className="gap-1" title={f.error}>
                      <AlertCircle className="h-3 w-3" /> errore
                    </Badge>
                  )}
                  {!running && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => removeFile(f.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <Button
            variant="outline"
            disabled={running || files.length === 0}
            onClick={() => setFiles([])}
          >
            Svuota coda
          </Button>
          <Button disabled={running || files.length === 0} onClick={processAll}>
            {running ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Indicizzazione…
              </>
            ) : (
              <>
                <BrainCircuit className="h-4 w-4 mr-2" /> Analizza e indicizza
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
