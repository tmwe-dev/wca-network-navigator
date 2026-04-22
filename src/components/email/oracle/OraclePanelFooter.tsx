import { Loader2, Sparkles, Wand2, BookOpen, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppNavigate } from "@/hooks/useAppNavigate";
import OracleContextPanel, {
  type OracleContextSummary,
} from "../OracleContextPanel";

interface FooterProps {
  generating: boolean;
  improving: boolean;
  hasBody: boolean;
  recipientCount: number;
  contextSummary: OracleContextSummary | null;
  onGenerate: () => void;
  onImprove: () => void;
}

export function OraclePanelFooter({
  generating,
  improving,
  hasBody,
  recipientCount,
  contextSummary,
  onGenerate,
  onImprove,
}: FooterProps) {
  const navigate = useAppNavigate();

  return (
    <div className="shrink-0 border-t border-border/30 px-3 py-2.5 space-y-2">
      <button
        onClick={() => navigate("/settings?tab=ai-prompt")}
        className="flex items-center gap-1.5 text-[10px] text-primary hover:underline"
      >
        <BookOpen className="w-3 h-3" /> Gestisci KB & Prompt
        <ExternalLink className="w-2.5 h-2.5" />
      </button>

      <Button
        size="sm"
        className="w-full h-10 text-xs gap-1.5"
        onClick={onGenerate}
        disabled={generating || improving}
      >
        {generating ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Sparkles className="w-3.5 h-3.5" />
        )}
        {generating ? "Generazione..." : "Genera"}
      </Button>

      <Button
        size="sm"
        variant="outline"
        className="w-full h-8 text-xs gap-1.5"
        onClick={onImprove}
        disabled={improving || generating || !hasBody}
      >
        {improving ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Wand2 className="w-3.5 h-3.5 text-warning" />
        )}
        {improving ? "Miglioramento..." : "Migliora"}
      </Button>

      <OracleContextPanel
        summary={contextSummary}
        hasRecipient={recipientCount > 0}
      />
    </div>
  );
}
