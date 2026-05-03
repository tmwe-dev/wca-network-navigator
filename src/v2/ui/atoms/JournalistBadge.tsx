/**
 * JournalistBadge — atomo condiviso per il verdetto del giornalista editoriale.
 * Usato da Email Forge ResultPanel e AIDraftStudio (Cockpit).
 */
import * as React from "react";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { JournalistReviewSummary } from "@/v2/hooks/useEmailForge";

const VERDICT_LABEL: Record<string, string> = {
  pass: "OK",
  pass_with_edits: "CORRETTO",
  warn: "ATTENZIONE",
  block: "BLOCCATO",
};

const VERDICT_CLASS: Record<string, string> = {
  pass: "bg-success/10 text-success border-success/30",
  pass_with_edits: "bg-primary/10 text-primary border-primary/30",
  warn: "bg-warning/10 text-warning border-warning/30",
  block: "bg-destructive/10 text-destructive border-destructive/30",
};

interface Props {
  review: JournalistReviewSummary;
  compact?: boolean;
}

export function JournalistBadge({ review, compact = false }: Props): React.ReactElement {
  const VerdictIcon =
    review.verdict === "block" ? XCircle :
    review.verdict === "warn" ? AlertTriangle : CheckCircle2;

  return (
    <div className="space-y-2">
      <div className={cn("flex items-center gap-2 px-2 py-1.5 rounded border text-xs", VERDICT_CLASS[review.verdict])}>
        <VerdictIcon className="h-3.5 w-3.5 shrink-0" />
        <span className="font-bold uppercase tracking-wide text-[10px]">{VERDICT_LABEL[review.verdict]}</span>
        <span className="font-medium truncate">{review.journalist.label}</span>
        {!review.journalist.auto && <span className="opacity-60 text-[10px]">(override)</span>}
        {review.quality_score >= 0 && (
          <span className="ml-auto font-mono text-[10px] opacity-70">{review.quality_score}/100</span>
        )}
      </div>
      {!compact && review.reasoning && (
        <p className="text-[11px] italic text-foreground/60 px-1">{review.reasoning}</p>
      )}
      {!compact && (review.verdict === "warn" || review.verdict === "block") && review.warnings.length > 0 && (
        <div className={cn(
          "p-2 rounded border text-[11px] space-y-1",
          review.verdict === "block" ? "border-destructive/30 bg-destructive/5" : "border-warning/30 bg-warning/5",
        )}>
          {review.warnings.map((w, i) => (
            <div key={i} className="text-foreground/80">
              <span className="font-mono opacity-50">[{w.type}]</span> {w.description}
              {w.upstream_fix && <div className="ml-2 mt-0.5 italic text-primary/70">→ {w.upstream_fix}</div>}
            </div>
          ))}
        </div>
      )}
      {!compact && review.edits.length > 0 && (
        <details className="text-[11px]">
          <summary className="cursor-pointer text-primary/70">{review.edits.length} correzioni editoriali</summary>
          <div className="mt-1 space-y-2 p-2 rounded border border-border/40 bg-card max-h-60 overflow-auto">
            {review.edits.map((e, i) => (
              <div key={i} className="space-y-0.5">
                <span className="font-mono opacity-40">[{e.type}]</span>
                <div className="line-through text-destructive/70">{e.original_fragment}</div>
                <div className="text-success">{e.edited_fragment}</div>
                <div className="italic text-foreground/50">{e.reason}</div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

export default JournalistBadge;