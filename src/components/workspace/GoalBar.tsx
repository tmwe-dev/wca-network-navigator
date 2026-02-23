import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Target, FileText } from "lucide-react";

interface GoalBarProps {
  goal: string;
  baseProposal: string;
  onGoalChange: (v: string) => void;
  onBaseProposalChange: (v: string) => void;
}

export default function GoalBar({ goal, baseProposal, onGoalChange, onBaseProposalChange }: GoalBarProps) {
  return (
    <div className="flex gap-4 p-4 rounded-xl border border-border/50 bg-card/60 backdrop-blur-xl">
      <div className="flex-1 space-y-1.5">
        <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Target className="w-3.5 h-3.5 text-primary" />
          Goal della comunicazione
        </Label>
        <Textarea
          value={goal}
          onChange={(e) => onGoalChange(e.target.value)}
          placeholder="Es. Proporre una collaborazione per spedizioni via mare FCL verso il Far East..."
          className="min-h-[60px] text-sm bg-background/50 border-border/30 resize-none focus:ring-primary/30"
        />
      </div>
      <div className="flex-1 space-y-1.5">
        <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <FileText className="w-3.5 h-3.5 text-primary" />
          Proposta di base
        </Label>
        <Textarea
          value={baseProposal}
          onChange={(e) => onBaseProposalChange(e.target.value)}
          placeholder="Es. Offriamo transit time competitivi di 25 giorni, servizio door-to-door con tracking..."
          className="min-h-[60px] text-sm bg-background/50 border-border/30 resize-none focus:ring-primary/30"
        />
      </div>
    </div>
  );
}
