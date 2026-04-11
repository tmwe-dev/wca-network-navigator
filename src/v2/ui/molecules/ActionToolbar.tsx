/**
 * ActionToolbar molecule — STEP 4 Design System v2
 */

import * as React from "react";
import { cn } from "@/lib/utils";

interface ActionToolbarProps {
  readonly children: React.ReactNode;
  readonly className?: string;
}

export function ActionToolbar({ children, className }: ActionToolbarProps): React.ReactElement {
  return (
    <div className={cn("flex items-center gap-2 flex-wrap", className)}>
      {children}
    </div>
  );
}
