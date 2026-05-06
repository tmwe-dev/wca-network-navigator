/**
 * FinderApiCanvas — pannello laterale con risultati TMWE e proposta KB.
 */
import { X, BookPlus, Check, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FinderToolResult, FinderKbProposal } from "./useFinderApi";

interface Props {
  results: FinderToolResult[];
  kbProposal: FinderKbProposal | null;
  onSaveKb: () => void;
  onDismissKb: () => void;
  onClose: () => void;
}

export function FinderApiCanvas({ results, kbProposal, onSaveKb, onDismissKb, onClose }: Props) {
  return (
    <aside
      className="w-1/2 border-l border-border/30 overflow-y-auto p-6 space-y-6 relative z-10"
      style={{ background: "hsl(240 5% 4% / 0.6)", backdropFilter: "blur(20px)" }}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-mono uppercase tracking-[0.2em] text-primary/80">Risultati API</h2>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Chiudi">
          <X className="w-4 h-4" />
        </button>
      </div>

      {results.length === 0 && !kbProposal && (
        <p className="text-xs text-muted-foreground">Nessun risultato ancora.</p>
      )}

      {results.map((r, i) => (
        <div key={i} className="rounded-lg border border-border/30 p-4 bg-background/40">
          <div className="flex items-center gap-2 mb-3">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${r.ok ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"}`}>
              {r.ok ? "OK" : "ERROR"}
            </span>
            <code className="text-xs text-primary/90">{r.op}</code>
          </div>
          <pre className="text-[11px] leading-relaxed text-foreground/80 overflow-x-auto whitespace-pre-wrap break-all max-h-80">
            {JSON.stringify(r.data, null, 2)}
          </pre>
        </div>
      ))}

      {kbProposal && (
        <div className="rounded-lg border border-primary/40 p-4 bg-primary/5 space-y-3">
          <div className="flex items-center gap-2">
            <BookPlus className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-medium">Proposta articolo KB</h3>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Titolo</p>
            <p className="text-sm font-medium">{kbProposal.title}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Contenuto</p>
            <p className="text-sm whitespace-pre-line">{kbProposal.body}</p>
          </div>
          {kbProposal.trigger_op && (
            <p className="text-[11px] text-muted-foreground">
              Trigger op: <code className="text-primary">{kbProposal.trigger_op}</code>
            </p>
          )}
          <div className="flex gap-2 pt-2">
            <Button size="sm" onClick={onSaveKb} className="gap-1">
              <Check className="w-3.5 h-3.5" /> Salva in KB
            </Button>
            <Button size="sm" variant="outline" onClick={onDismissKb} className="gap-1">
              <Trash2 className="w-3.5 h-3.5" /> Scarta
            </Button>
          </div>
        </div>
      )}
    </aside>
  );
}