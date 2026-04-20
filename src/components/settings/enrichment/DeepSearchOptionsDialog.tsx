import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Brain, Loader2, Zap, ThumbsUp, Trophy, Info } from "lucide-react";
import {
  ALL_QUALITIES, getDeepSearchMeta, presetToCockpitConfig, type DeepSearchQuality,
} from "@/lib/deepSearchPresets";

interface DeepSearchOptionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  onConfirm: (options: Record<string, boolean>) => void;
  loading?: boolean;
}

const QUALITY_ICONS = { fast: Zap, standard: ThumbsUp, premium: Trophy } as const;

export function DeepSearchOptionsDialog({
  open, onOpenChange, count, onConfirm, loading,
}: DeepSearchOptionsDialogProps) {
  const [quality, setQuality] = useState<DeepSearchQuality>("standard");
  const meta = getDeepSearchMeta(quality);
  const totalSeconds = meta.estimatedSecondsPerRecord * count;

  const handleConfirm = () => {
    // Le opzioni sono determinate automaticamente dal preset Quality.
    onConfirm(presetToCockpitConfig(quality));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">Configura Deep Search</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {count} record selezionat{count === 1 ? "o" : "i"} — scegli la profondità di analisi
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* Selettore Quality */}
          <div className="grid grid-cols-3 gap-1.5">
            {ALL_QUALITIES.map((q) => {
              const Icon = QUALITY_ICONS[q];
              const m = getDeepSearchMeta(q);
              const active = q === quality;
              return (
                <button
                  key={q}
                  type="button"
                  onClick={() => setQuality(q)}
                  className={`flex flex-col items-center justify-center gap-1 rounded border px-2 py-2 transition-colors ${
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card hover:bg-muted text-muted-foreground"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-xs font-medium">{m.label}</span>
                  <span className="text-[10px] text-muted-foreground">~{m.estimatedSecondsPerRecord}s</span>
                </button>
              );
            })}
          </div>

          {/* Badge informativo cosa include */}
          <div className="rounded border border-primary/20 bg-primary/5 p-2 flex items-start gap-2">
            <Info className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-foreground">{meta.label} include:</div>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {meta.includedLabels.map((l) => (
                  <Badge key={l} variant="secondary" className="text-[10px] py-0 px-1.5 h-4 font-normal">{l}</Badge>
                ))}
              </div>
              <div className="text-[10px] text-muted-foreground mt-1.5 leading-tight">{meta.description}</div>
            </div>
          </div>

          {/* Stima tempo totale */}
          <div className="text-[11px] text-muted-foreground text-center">
            Tempo stimato totale: <span className="font-mono text-foreground">~{Math.ceil(totalSeconds / 60)} min</span>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
            Annulla
          </Button>
          <Button
            size="sm"
            className="text-xs gap-1.5"
            disabled={loading}
            onClick={handleConfirm}
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3" />}
            Avvia Deep Search {meta.label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
