/**
 * BulkChangeOriginDialog — Dialog per riassegnare in massa il campo `origin`
 * dei contatti CRM selezionati. Combobox: scegli un'origine esistente o
 * crea una nuova digitando.
 */
import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Tag } from "lucide-react";
import { toast } from "sonner";
import type { CompanyEntity } from "@/v2/ui/molecules/CompanyCardList";

export interface BulkChangeOriginDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selected: CompanyEntity[];
  /** Origini esistenti (con frequenza) per autocomplete. */
  availableOrigins: ReadonlyArray<{ origin: string; count: number }>;
  /** Mutator: esegue la chiamata DAL. */
  onConfirm: (newOrigin: string) => Promise<{ updated: number }>;
  /** Callback dopo conferma (chiude dialog e pulisce selezione). */
  onSuccess?: () => void;
}

function getCurrentOriginsBreakdown(selected: CompanyEntity[]): Array<{ label: string; n: number }> {
  const m = new Map<string, number>();
  for (const s of selected) {
    const raw = (s as unknown as { raw?: { origin?: string | null } }).raw;
    const o = (raw?.origin ?? "").trim() || "—";
    m.set(o, (m.get(o) ?? 0) + 1);
  }
  return Array.from(m.entries())
    .map(([label, n]) => ({ label, n }))
    .sort((a, b) => b.n - a.n);
}

export function BulkChangeOriginDialog({
  open,
  onOpenChange,
  selected,
  availableOrigins,
  onConfirm,
  onSuccess,
}: BulkChangeOriginDialogProps): React.ReactElement {
  const [input, setInput] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) {
      setInput("");
      // focus dopo il mount
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const trimmed = input.trim();
  const filtered = React.useMemo(() => {
    if (!trimmed) return availableOrigins.slice(0, 20);
    const q = trimmed.toLowerCase();
    return availableOrigins.filter((o) => o.origin.toLowerCase().includes(q)).slice(0, 30);
  }, [trimmed, availableOrigins]);

  const exactMatch = availableOrigins.find((o) => o.origin === trimmed);
  const isNew = trimmed.length > 0 && !exactMatch;

  const breakdown = React.useMemo(() => getCurrentOriginsBreakdown(selected), [selected]);

  const canConfirm = trimmed.length > 0 && trimmed.length <= 100 && !submitting && selected.length > 0;

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setSubmitting(true);
    try {
      const res = await onConfirm(trimmed);
      toast.success(`Origine aggiornata su ${res.updated} contatt${res.updated === 1 ? "o" : "i"}`);
      onSuccess?.();
      onOpenChange(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Errore aggiornamento origine";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const pickExisting = (value: string) => {
    setInput(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-primary" />
            Cambia origine — {selected.length} contatt{selected.length === 1 ? "o" : "i"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <div className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground/80 pb-1">
              Origine attuale
            </div>
            <div className="flex flex-wrap gap-1.5">
              {breakdown.map((b) => (
                <span
                  key={b.label}
                  className="text-[11px] px-2 py-0.5 rounded-md border border-border/40 bg-muted/40"
                >
                  {b.label} <span className="text-muted-foreground">· {b.n}</span>
                </span>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="new-origin" className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground/80">
              Nuova origine
            </label>
            <Input
              id="new-origin"
              ref={inputRef}
              value={input}
              maxLength={100}
              placeholder="Cerca o digita una nuova origine…"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleConfirm();
                }
              }}
              className="mt-1"
            />
            {isNew && (
              <div className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                Verrà creata una nuova origine: «{trimmed}»
              </div>
            )}
            {exactMatch && (
              <div className="text-[11px] text-muted-foreground mt-1">
                Origine esistente · {exactMatch.count} contatti già assegnati
              </div>
            )}
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground/80 pb-1">
              {trimmed ? "Suggerimenti" : "Origini più frequenti"}
            </div>
            <div className="max-h-56 overflow-y-auto border border-border/40 rounded-md divide-y divide-border/30">
              {filtered.length === 0 && (
                <div className="px-3 py-2 text-[12px] text-muted-foreground italic">
                  Nessun match — premi Conferma per crearla.
                </div>
              )}
              {filtered.map((o) => (
                <button
                  key={o.origin}
                  type="button"
                  onClick={() => pickExisting(o.origin)}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-[12px] hover:bg-primary/5 text-left"
                >
                  <span className="truncate font-medium text-foreground">{o.origin}</span>
                  <span className="text-[10px] font-mono text-muted-foreground ml-2">{o.count}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Annulla
          </Button>
          <Button onClick={handleConfirm} disabled={!canConfirm}>
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Sposta {selected.length} contatt{selected.length === 1 ? "o" : "i"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default BulkChangeOriginDialog;