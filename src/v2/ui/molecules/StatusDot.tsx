/**
 * StatusDot — pallino di stato semantico (8px) previsto dal contratto di pagina.
 * Sostituisce i badge testuali colorati nelle righe di elenco.
 */
import * as React from "react";
import { cn } from "@/lib/utils";

export type StatusTone = "muted" | "success" | "warning" | "danger" | "accent";

const TONE_CLASS: Record<StatusTone, string> = {
  muted: "bg-muted-foreground/50",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
  accent: "bg-primary",
};

export function StatusDot({
  tone,
  label,
  className,
}: {
  readonly tone: StatusTone;
  readonly label?: string;
  readonly className?: string;
}) {
  return (
    <span
      aria-label={label}
      title={label}
      className={cn("inline-block h-2 w-2 rounded-full shrink-0", TONE_CLASS[tone], className)}
    />
  );
}

export default StatusDot;
