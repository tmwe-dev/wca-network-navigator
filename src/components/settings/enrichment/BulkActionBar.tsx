/**
 * BulkActionBar — Actions shown when rows are selected
 */
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Linkedin, Image, Brain, Download, Rocket, StopCircle, Loader2 } from "lucide-react";
import type { EnrichedRow } from "@/hooks/useEnrichmentData";
import type { BaseEnrichmentProgress } from "@/hooks/useBaseEnrichment";

interface Props {
  selectedCount: number;
  onLinkedInBatch: () => void;
  onBulkLogoSearch: () => void;
  onDeepSearch: (rows: EnrichedRow[]) => void;
  getSelectedRows: () => EnrichedRow[];
  onJobComplete?: () => void;
  // Base enrichment job (state lifted to parent)
  progress: BaseEnrichmentProgress;
  onStartBaseEnrichment: () => void | Promise<void>;
  onStopBaseEnrichment: () => void;
}

export function BulkActionBar({
  selectedCount, onLinkedInBatch, onBulkLogoSearch, onDeepSearch, getSelectedRows,
  progress, onStartBaseEnrichment, onStopBaseEnrichment,
}: Props) {
  const isRunning = progress.status === "running";
  const showProgress = progress.status !== "idle" && progress.total > 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
        <span className="text-xs font-medium text-primary">{selectedCount} selezionati</span>
        <div className="flex items-center gap-1 ml-auto flex-wrap">
          <Button
            size="sm"
            className="h-7 text-[10px] gap-1"
            onClick={isRunning ? onStopBaseEnrichment : onStartBaseEnrichment}
            disabled={selectedCount === 0 && !isRunning}
            title="Pre-fill batch: Google search per slug LinkedIn + logo + scraping sito (zero AI, zero login LinkedIn)"
          >
            {isRunning ? <><StopCircle className="w-3 h-3" /> Stop</> : <><Rocket className="w-3 h-3" /> Arricchimento Base</>}
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={onLinkedInBatch}>
            <Linkedin className="w-3 h-3" /> LinkedIn Batch
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={onBulkLogoSearch}>
            <Image className="w-3 h-3" /> Logo Google
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={() => onDeepSearch(getSelectedRows())}>
            <Brain className="w-3 h-3" /> Deep Search
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1">
            <Download className="w-3 h-3" /> Esporta
          </Button>
        </div>
      </div>

      {showProgress && (
        <div className="border border-border rounded-lg p-2 bg-muted/20 space-y-1">
          <div className="flex items-center justify-between text-[10px]">
            <div className="flex items-center gap-2 text-muted-foreground">
              {isRunning && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
              <span className="font-semibold text-foreground">Arricchimento Base</span>
              <span>{progress.done}/{progress.total}</span>
              {progress.currentName && isRunning && (
                <span className="truncate max-w-[200px] text-foreground">· {progress.currentName}</span>
              )}
            </div>
            <div className="flex items-center gap-3 text-muted-foreground">
              <span className="flex items-center gap-0.5"><Linkedin className="w-2.5 h-2.5 text-primary" /> {progress.slugFound}</span>
              <span className="flex items-center gap-0.5"><Image className="w-2.5 h-2.5 text-muted-foreground" /> {progress.logoFound}</span>
              <span>🌐 {progress.siteScraped}</span>
              {progress.errors > 0 && <span className="text-destructive">⚠ {progress.errors}</span>}
            </div>
          </div>
          <Progress value={progress.total > 0 ? (progress.done / progress.total) * 100 : 0} className="h-1" />
          {progress.status === "paused" && (
            <div className="text-[10px] text-muted-foreground">In pausa. Premi "Arricchimento Base" per riprendere.</div>
          )}
          {progress.status === "done" && (
            <div className="text-[10px] text-primary font-medium">✅ Completato</div>
          )}
        </div>
      )}
    </div>
  );
}
