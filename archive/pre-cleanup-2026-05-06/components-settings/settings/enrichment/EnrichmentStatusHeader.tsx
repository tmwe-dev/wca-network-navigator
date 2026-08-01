/**
 * EnrichmentStatusHeader — pannello globale: "X su Y arricchiti" + progress bar + CTA.
 * (LOVABLE-76C) Lo score si basa su LinkedIn + Sito + Logo (3 dimensioni).
 */
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, StopCircle } from "lucide-react";

interface Props {
  totalCount: number;
  completeCount: number;
  partialCount: number;
  missingCount: number;
  isRunning: boolean;
  progressDone: number;
  progressTotal: number;
  selectedCount: number;
  onStart: () => void | Promise<void>;
  onStop: () => void;
}

export function EnrichmentStatusHeader({
  totalCount, completeCount, partialCount, missingCount,
  isRunning, progressDone, progressTotal, selectedCount,
  onStart, onStop,
}: Props): React.ReactElement {
  const pct = totalCount > 0 ? Math.round((completeCount / totalCount) * 100) : 0;
  const partialPct = totalCount > 0 ? Math.round((partialCount / totalCount) * 100) : 0;

  return (
    <div className="p-4 rounded-lg bg-card border border-border/60">
      <div className="flex items-center justify-between gap-6 flex-wrap">
        {/* COL 1 — titolo + numeri */}
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-foreground">Stato Arricchimento</h3>
          <p className="text-sm text-foreground/70 mt-0.5">
            <span className="font-semibold text-foreground">{completeCount}</span> su {totalCount} completi ({pct}%)
            {partialCount > 0 && (
              <span className="text-foreground/60"> · {partialCount} parziali</span>
            )}
          </p>
        </div>

        {/* COL 2 — progress bar */}
        <div className="flex-1 min-w-[180px] max-w-xs">
          <div className="h-3 bg-muted rounded-full overflow-hidden flex">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{ width: `${pct}%` }}
              title={`${completeCount} completi`}
            />
            <div
              className="h-full bg-amber-500 transition-all"
              style={{ width: `${partialPct}%` }}
              title={`${partialCount} parziali`}
            />
          </div>
          <div className="flex justify-between mt-1 text-xs text-foreground/60">
            <span>{completeCount} completi</span>
            <span>{missingCount} da arricchire</span>
          </div>
        </div>

        {/* COL 3 — CTA */}
        <div className="shrink-0">
          {isRunning ? (
            <Button size="lg" variant="destructive" onClick={onStop} className="gap-2">
              <StopCircle className="w-4 h-4" />
              Stop ({progressDone}/{progressTotal})
            </Button>
          ) : (
            <Button
              size="lg"
              onClick={onStart}
              disabled={selectedCount === 0}
              className="gap-2"
              title={selectedCount === 0 ? "Seleziona almeno una riga per arricchire" : undefined}
            >
              <Sparkles className="w-4 h-4" />
              {selectedCount > 0
                ? `Arricchisci ${selectedCount} selezionati`
                : missingCount > 0
                ? `Seleziona per arricchire i ${missingCount} mancanti`
                : "Tutti arricchiti"}
            </Button>
          )}
        </div>
      </div>

      {isRunning && progressTotal > 0 && (
        <div className="mt-3 pt-3 border-t border-border/60 flex items-center gap-2 text-xs text-foreground/70">
          <Loader2 className="w-3 h-3 animate-spin text-primary" />
          <span>Arricchimento in corso: {progressDone} di {progressTotal}</span>
        </div>
      )}
    </div>
  );
}