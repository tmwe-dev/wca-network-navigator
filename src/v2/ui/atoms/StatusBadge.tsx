/**
 * StatusBadge atom — STEP 4 Design System v2
 * Badge colorato per stati dominio.
 */

import * as React from "react";
import { cn } from "@/lib/utils";

type StatusVariant = "success" | "warning" | "error" | "info" | "neutral";

interface StatusBadgeProps {
  readonly status: StatusVariant;
  readonly label: string;
  readonly className?: string;
}

const variantStyles: Record<StatusVariant, string> = {
  success: "bg-success/15 text-success border border-success/30",
  warning: "bg-warning/15 text-warning border border-warning/30",
  error: "bg-destructive/15 text-destructive border border-destructive/30",
  info: "bg-info/15 text-info border border-info/30",
  neutral: "bg-muted text-muted-foreground border border-border",
};

export function StatusBadge({ status, label, className }: StatusBadgeProps): React.ReactElement {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variantStyles[status],
        className
      )}
    >
      {label}
    </span>
  );
}
