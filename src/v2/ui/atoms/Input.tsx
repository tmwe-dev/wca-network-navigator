/**
 * Input atom — STEP 4 Design System v2
 */

import * as React from "react";
import { Input as ShadcnInput } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  readonly hasError?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, hasError, ...props }, ref) => (
    <ShadcnInput
      ref={ref}
      className={cn(hasError && "border-destructive focus-visible:ring-destructive", className)}
      {...props}
    />
  )
);
Input.displayName = "InputV2";
