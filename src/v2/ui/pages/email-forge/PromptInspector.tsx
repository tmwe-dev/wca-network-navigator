/**
 * PromptInspector — Prompt LAB editabile.
 * Ogni blocco system/user è una textarea modificabile. Quando l'utente
 * edita anche un solo blocco, il rerun viene fatto inviando come override
 * il system+user prompt finali (assemblati a partire dai blocchi modificati).
 *
 * - Tasto "Reset blocco" per singolo blocco
 * - Tasto "Reset tutto" per tornare ai prompt originali
 * - Tasto "Rigenera con prompt modificati" → invia override al backend
 * - Persistenza locale (localStorage) opzionale per override
 */
import * as React from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Copy, Download, FileText, Sparkles, RotateCcw, Play, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { PromptBlock } from "@/v2/hooks/useEmailForge";

interface Props {
  systemPrompt?: string;
  userPrompt?: string;
  systemBlocks?: PromptBlock[];
  blocks?: PromptBlock[];
  isLoading: boolean;
  /** Quando l'utente clicca "Rigenera", riceve i prompt finali (assemblati dai blocchi editati). */
  onRerun?: (systemPrompt: string, userPrompt: string) => void;
}

const STORAGE_KEY = "email-forge:prompt-overrides:v1";

type Edits = Record<string, string>; // key = `${section}:${label}:${idx}` → contenuto modificato

function downloadTxt(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function blockKey(section: "sys" | "usr", label: string, idx: number) {
  return `${section}:${label}:${idx}`;
}

function loadEdits(): Edits {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Edits) : {};
  } catch { return {}; }
}
function saveEdits(edits: Edits) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(edits)); } catch { /* ignore */ }
}

function EditableBlock({
  block, idx, section, edited, onChange, onReset,
}: {
  block: PromptBlock;
  idx: number;
  section: "sys" | "usr";
  edited: string | undefined;
  onChange: (val: string) => void;
  onReset: () => void;
}) {
  const value = edited ?? block.content;
  const isDirty = edited !== undefined && edited !== block.content;
  return (
    <AccordionItem
      value={blockKey(section, block.label, idx)}
      className={`border rounded-md bg-card px-2 ${isDirty ? "border-primary/60" : "border-border/40"}`}
    >
      <AccordionTrigger className="py-2 hover:no-underline">
        <div className="flex items-center gap-2 text-xs flex-1">
          <Badge variant="outline" className="font-mono text-[10px]">{idx + 1}</Badge>
          <span className="font-medium">{block.label}</span>
          <span className="text-muted-foreground">· {value.length.toLocaleString()} char</span>
          {isDirty && (
            <Badge className="bg-primary/10 text-primary hover:bg-primary/10 border-0 text-[9px] ml-auto mr-2">
              modificato
            </Badge>
          )}
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="space-y-1.5">
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="font-mono text-[11px] leading-relaxed min-h-[140px] max-h-[480px] bg-muted/40"
            spellCheck={false}
          />
          <div className="flex items-center justify-between">
            <div className="text-[10px] text-muted-foreground">
              Modifica libera: il rerun userà questo testo al posto dell'originale.
            </div>
            {isDirty && (
              <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={onReset}>
                <RotateCcw className="w-3 h-3 mr-1" /> Ripristina
              </Button>
            )}
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

export function PromptInspector({ systemPrompt, userPrompt, systemBlocks, blocks, isLoading, onRerun }: Props) {
  const [edits, setEdits] = React.useState<Edits>(() => loadEdits());

  // Persisti automaticamente le modifiche locali
  React.useEffect(() => { saveEdits(edits); }, [edits]);

  // Quando arriva un nuovo prompt dal backend, NON tocco gli edits locali (l'utente potrebbe
  // voler riapplicare le sue modifiche al nuovo prompt), ma offro "Reset tutto" come escape.

  const setBlockEdit = (section: "sys" | "usr", label: string, idx: number, val: string) => {
    setEdits((prev) => ({ ...prev, [blockKey(section, label, idx)]: val }));
  };
  const resetBlock = (section: "sys" | "usr", label: string, idx: number) => {
    setEdits((prev) => {
      const next = { ...prev };
      delete next[blockKey(section, label, idx)];
      return next;
    });
  };
  const resetAll = () => {
    setEdits({});
    toast.success("Tutte le modifiche ai prompt sono state azzerate");
  };

  // Calcola system/user prompt finali assemblando i blocchi (con eventuali override)
  const composed = React.useMemo(() => {
    const composeSection = (section: "sys" | "usr", arr: PromptBlock[] | undefined): { text: string; dirty: boolean } => {
      if (!arr || arr.length === 0) return { text: "", dirty: false };
      let dirty = false;
      const parts = arr.map((b, i) => {
        const k = blockKey(section, b.label, i);
        const v = edits[k];
        if (v !== undefined && v !== b.content) dirty = true;
        return v ?? b.content;
      });
      return { text: parts.join("\n\n"), dirty };
    };
    const sys = composeSection("sys", systemBlocks);
    const usr = composeSection("usr", blocks);
    // Fallback: se non abbiamo systemBlocks, usa il systemPrompt grezzo
    const finalSystem = systemBlocks && systemBlocks.length > 0 ? sys.text : (systemPrompt ?? "");
    const finalUser = blocks && blocks.length > 0 ? usr.text : (userPrompt ?? "");
    return { systemPrompt: finalSystem, userPrompt: finalUser, dirty: sys.dirty || usr.dirty };
  }, [edits, systemBlocks, blocks, systemPrompt, userPrompt]);

  const fullPrompt = `=== SYSTEM ===\n${composed.systemPrompt}\n\n=== USER ===\n${composed.userPrompt}`;

  const handleCopy = async () => {
    if (!composed.systemPrompt && !composed.userPrompt) return;
    await navigator.clipboard.writeText(fullPrompt);
    toast.success("Prompt copiato negli appunti");
  };
  const handleDownload = () => {
    if (!composed.systemPrompt && !composed.userPrompt) return;
    downloadTxt(`email-forge-prompt-${Date.now()}.txt`, fullPrompt);
  };
  const handleRerun = () => {
    if (!onRerun) return;
    onRerun(composed.systemPrompt, composed.userPrompt);
  };

  if (isLoading && !systemBlocks?.length && !blocks?.length) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground gap-2">
        <Sparkles className="w-4 h-4 animate-pulse" />
        Costruzione prompt in corso…
      </div>
    );
  }

  if (!systemBlocks?.length && !blocks?.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center text-sm text-muted-foreground p-6">
        <FileText className="w-10 h-10 mb-3 opacity-40" />
        <p className="font-medium">Nessun prompt ancora generato</p>
        <p className="text-xs mt-1 max-w-xs">
          Configura le scelte nel pannello Oracolo a sinistra e clicca <strong>Genera</strong> per
          ispezionare e <strong>modificare</strong> i blocchi che compongono il prompt.
        </p>
      </div>
    );
  }

  const totalBlocks = (systemBlocks?.length ?? 0) + (blocks?.length ?? 0);
  const dirtyCount = Object.keys(edits).filter((k) => {
    const [section, ...rest] = k.split(":");
    const idx = Number(rest.pop());
    const label = rest.join(":");
    const arr = section === "sys" ? systemBlocks : blocks;
    const orig = arr?.[idx];
    return orig && orig.label === label && edits[k] !== orig.content;
  }).length;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/40 shrink-0 gap-2">
        <div className="text-xs font-medium flex items-center gap-2 min-w-0">
          <FileText className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">
            Prompt Lab ·{" "}
            <span className="text-muted-foreground">
              {totalBlocks} blocchi · {fullPrompt.length.toLocaleString()} char
            </span>
          </span>
          {dirtyCount > 0 && (
            <Badge className="bg-primary/10 text-primary hover:bg-primary/10 border-0 text-[9px]">
              {dirtyCount} modificato{dirtyCount > 1 ? "i" : ""}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {dirtyCount > 0 && (
            <Button size="sm" variant="ghost" onClick={resetAll} className="h-7 px-2 text-[10px]" title="Azzera tutte le modifiche">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={handleCopy} className="h-7 px-2" title="Copia prompt completo">
            <Copy className="w-3.5 h-3.5" />
          </Button>
          <Button size="sm" variant="ghost" onClick={handleDownload} className="h-7 px-2" title="Scarica .txt">
            <Download className="w-3.5 h-3.5" />
          </Button>
          {onRerun && (
            <Button
              size="sm"
              onClick={handleRerun}
              disabled={isLoading}
              className="h-7 px-2 text-[10px] gap-1"
              variant={dirtyCount > 0 ? "default" : "secondary"}
              title={dirtyCount > 0 ? "Rigenera usando i prompt modificati" : "Rigenera con i prompt attuali"}
            >
              <Play className="w-3 h-3" />
              {dirtyCount > 0 ? "Rigenera con modifiche" : "Rigenera"}
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-4">
        {systemBlocks && systemBlocks.length > 0 && (
          <section>
            <h3 className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
              <Badge className="bg-primary/10 text-primary hover:bg-primary/10 border-0 text-[9px]">SYSTEM</Badge>
              Identità + guardrails — clicca per espandere e modificare
            </h3>
            <Accordion type="multiple" className="space-y-1">
              {systemBlocks.map((b, idx) => (
                <EditableBlock
                  key={blockKey("sys", b.label, idx)}
                  block={b}
                  idx={idx}
                  section="sys"
                  edited={edits[blockKey("sys", b.label, idx)]}
                  onChange={(v) => setBlockEdit("sys", b.label, idx, v)}
                  onReset={() => resetBlock("sys", b.label, idx)}
                />
              ))}
            </Accordion>
          </section>
        )}

        {blocks && blocks.length > 0 && (
          <section>
            <h3 className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
              <Badge className="bg-secondary text-secondary-foreground hover:bg-secondary border-0 text-[9px]">USER</Badge>
              Contesto dinamico (in ordine) — clicca per espandere e modificare
            </h3>
            <Accordion type="multiple" className="space-y-1">
              {blocks.map((b, idx) => (
                <EditableBlock
                  key={blockKey("usr", b.label, idx)}
                  block={b}
                  idx={idx}
                  section="usr"
                  edited={edits[blockKey("usr", b.label, idx)]}
                  onChange={(v) => setBlockEdit("usr", b.label, idx, v)}
                  onReset={() => resetBlock("usr", b.label, idx)}
                />
              ))}
            </Accordion>
          </section>
        )}

        <div className="text-[10px] text-muted-foreground border-t border-border/30 pt-3 flex items-start gap-2">
          <Save className="w-3 h-3 mt-0.5 shrink-0" />
          <span>
            Le modifiche restano salvate localmente nel browser. Usa <strong>Rigenera con modifiche</strong> per
            inviare al modello AI il prompt modificato; usa <strong>Ripristina</strong> sul singolo blocco o{" "}
            <strong>cestino</strong> per azzerare tutto.
          </span>
        </div>
      </div>
    </div>
  );
}
