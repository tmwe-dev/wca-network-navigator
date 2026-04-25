/**
 * ProposalNavigator — frecce avanti/indietro + contatore + skip non distruttivo.
 */
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, SkipForward } from "lucide-react";

interface Props {
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onSkip: () => void;
}

export function ProposalNavigator({ index, total, onPrev, onNext, onSkip }: Props) {
  const canPrev = index > 0;
  const canNext = index < total - 1;
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2 bg-muted/30 rounded-md border">
      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={onPrev} disabled={!canPrev}>
        <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Precedente
      </Button>
      <div className="text-xs font-mono text-muted-foreground tabular-nums">
        <span className="font-semibold text-foreground">{index + 1}</span> di <span>{total}</span>
      </div>
      <div className="flex gap-1">
        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={onSkip} disabled={!canNext} title="Salta senza decidere">
          <SkipForward className="w-3.5 h-3.5 mr-1" /> Salta
        </Button>
        <Button size="sm" variant="default" className="h-7 px-2" onClick={onNext} disabled={!canNext}>
          Successiva <ChevronRight className="w-3.5 h-3.5 ml-1" />
        </Button>
      </div>
    </div>
  );
}