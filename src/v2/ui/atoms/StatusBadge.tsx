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
  success: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  warning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  error: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  info: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  neutral: "bg-muted text-muted-foreground",
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
