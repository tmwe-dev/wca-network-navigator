/**
 * BulkActionBar — Actions shown when rows are selected
 */
import { Button } from "@/components/ui/button";
import { Linkedin, Image, Brain, Download } from "lucide-react";
import type { EnrichedRow } from "@/hooks/useEnrichmentData";

interface Props {
  selectedCount: number;
  onLinkedInBatch: () => void;
  onBulkLogoSearch: () => void;
  onDeepSearch: (rows: EnrichedRow[]) => void;
  getSelectedRows: () => EnrichedRow[];
}

export function BulkActionBar({ selectedCount, onLinkedInBatch, onBulkLogoSearch, onDeepSearch, getSelectedRows }: Props) {
  return (
    <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
      <span className="text-xs font-medium text-primary">{selectedCount} selezionati</span>
      <div className="flex items-center gap-1 ml-auto">
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
  );
}
