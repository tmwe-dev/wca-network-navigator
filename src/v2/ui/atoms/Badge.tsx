/**
 * Badge atom — STEP 4 Design System v2
 */

import * as React from "react";
import { Badge as ShadcnBadge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface BadgeProps {
  readonly variant?: "default" | "secondary" | "destructive" | "outline";
  readonly className?: string;
  readonly children: React.ReactNode;
}

export function Badge({ variant = "default", className, children }: BadgeProps): React.ReactElement {
  return (
    <ShadcnBadge variant={variant} className={cn(className)}>
      {children}
    </ShadcnBadge>
  );
}
