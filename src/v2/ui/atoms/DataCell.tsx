/**
 * DataCell atom — STEP 4 Design System v2
 * Cella dati per tabelle con truncation e tooltip.
 */

import * as React from "react";
import { cn } from "@/lib/utils";

interface DataCellProps {
  readonly value: string | number | null | undefined;
  readonly fallback?: string;
  readonly className?: string;
  readonly maxWidth?: string;
}

export function DataCell({ value, fallback = "—", className, maxWidth = "max-w-[200px]" }: DataCellProps): React.ReactElement {
  const displayValue = value != null && value !== "" ? String(value) : fallback;

  return (
    <span
      className={cn("block truncate", maxWidth, className)}
      title={displayValue !== fallback ? displayValue : undefined}
    >
      {displayValue}
    </span>
  );
}
