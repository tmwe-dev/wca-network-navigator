/**
 * ErrorMessage atom — STEP 4 Design System v2
 */

import * as React from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ErrorMessageProps {
  readonly message: string;
  readonly className?: string;
  readonly onDismiss?: () => void;
}

export function ErrorMessage({ message, className, onDismiss }: ErrorMessageProps): React.ReactElement {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive",
        className
      )}
      role="alert"
    >
      <AlertCircle className="h-4 w-4 shrink-0" />
      <span className="flex-1">{message}</span>
      {onDismiss ? (
        <button onClick={onDismiss} className="text-destructive hover:text-destructive/80 text-xs font-medium">
          ✕
        </button>
      ) : null}
    </div>
  );
}
