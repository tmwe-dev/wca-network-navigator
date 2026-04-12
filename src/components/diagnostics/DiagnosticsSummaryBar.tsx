/**
 * DiagnosticsSummaryBar — summary counts bar
 */
import type { DiagnosticsSummary } from "@/hooks/diagnostics/types";

interface Props {
  readonly summary: DiagnosticsSummary;
  readonly visible: boolean;
}

export function DiagnosticsSummaryBar({ summary, visible }: Props) {
  if (!visible) return null;
  return (
    <div className="flex gap-4 p-3 rounded-lg border border-border bg-muted/30 text-sm font-medium">
      <span className="text-foreground">{summary.total} test</span>
      <span className="text-emerald-500">✓ {summary.pass}</span>
      <span className="text-destructive">✕ {summary.fail}</span>
      <span className="text-primary">⚠ {summary.warn}</span>
      {summary.running > 0 && <span className="text-primary">⏳ {summary.running}</span>}
    </div>
  );
}
