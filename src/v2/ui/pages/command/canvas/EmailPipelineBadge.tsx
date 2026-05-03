/**
 * EmailPipelineBadge — Striscia orizzontale con le tappe della pipeline mail.
 * Mostra Oracolo → Architetto → Prompt Lab → Giornalista → Bozza, con stato
 * (ok/warn/failed/skipped), dettaglio e tooltip.
 *
 * Pure UI: riceve un array tipato e renderizza chip + frecce. Nessuna logica.
 */
import * as React from "react";
import { Check, AlertTriangle, X, Minus, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type EmailPipelineStatus = "ok" | "warn" | "failed" | "skipped";

export interface EmailPipelineStage {
  readonly id: string;
  readonly label: string;
  readonly status: EmailPipelineStatus;
  /** Sottotitolo compatto: es. "KB·3", "Prompt Lab·2", "gpt-5-mini". */
  readonly detail?: string;
  /** Tooltip esteso (hover/title). */
  readonly tooltip?: string;
}

interface Props {
  readonly pipeline: ReadonlyArray<EmailPipelineStage>;
  /** Es. "5 step · 2.34s" oppure "9/9 bozze · Giornalista 9/9". */
  readonly summary?: string;
}

function statusClasses(status: EmailPipelineStatus): string {
  switch (status) {
    case "ok":
      return "bg-success/10 border-success/30 text-success/90";
    case "warn":
      return "bg-warning/10 border-warning/30 text-warning/90";
    case "failed":
      return "bg-destructive/10 border-destructive/30 text-destructive/90";
    case "skipped":
    default:
      return "bg-muted/30 border-border/40 text-muted-foreground/80";
  }
}

function StatusIcon({ status }: { status: EmailPipelineStatus }): React.ReactElement {
  const cls = "w-3 h-3 shrink-0";
  if (status === "ok") return <Check className={cls} />;
  if (status === "warn") return <AlertTriangle className={cls} />;
  if (status === "failed") return <X className={cls} />;
  return <Minus className={cls} />;
}

export default function EmailPipelineBadge({ pipeline, summary }: Props): React.ReactElement | null {
  if (!pipeline || pipeline.length === 0) return null;
  return (
    <div
      className="rounded-xl px-3 py-2 space-y-1.5"
      style={{
        background: "hsl(240 5% 10% / 0.5)",
        border: "1px solid hsl(0 0% 100% / 0.06)",
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[9px] uppercase tracking-[0.18em] font-mono text-muted-foreground/90">
          Pipeline mail
        </span>
        {summary && (
          <span className="text-[10px] font-mono text-muted-foreground/70 truncate">{summary}</span>
        )}
      </div>
      <div className="flex items-center gap-1 flex-wrap">
        {pipeline.map((stage, i) => (
          <React.Fragment key={stage.id}>
            <span
              title={stage.tooltip ?? stage.label}
              className={cn(
                "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-mono",
                statusClasses(stage.status),
              )}
            >
              <StatusIcon status={stage.status} />
              <span className="font-medium">{stage.label}</span>
              {stage.detail && (
                <span className="text-foreground/60 font-light">· {stage.detail}</span>
              )}
            </span>
            {i < pipeline.length - 1 && (
              <ChevronRight className="w-2.5 h-2.5 text-muted-foreground/40 shrink-0" />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}