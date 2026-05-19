/**
 * FunnemailGlassCard — card glass riusabile, ispirata al prototipo
 * `funnemail-sorgenti`. Usa token semantici esistenti (`--glass-bg`,
 * `--glass-border`) per integrarsi con il design system V2 sia in light
 * che in dark.
 */
import * as React from "react";
import { cn } from "@/lib/utils";

interface FunnemailGlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  readonly hover?: boolean;
}

export function FunnemailGlassCard({
  className,
  hover = false,
  children,
  ...rest
}: FunnemailGlassCardProps): React.ReactElement {
  return (
    <div
      {...rest}
      className={cn(
        "relative rounded-2xl border border-border/60 bg-card/70 backdrop-blur-md",
        "shadow-[0_4px_24px_-12px_hsl(var(--primary)/0.12)]",
        hover && "transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_32px_-12px_hsl(var(--primary)/0.18)] hover:border-primary/30",
        className,
      )}
    >
      {children}
    </div>
  );
}

export default FunnemailGlassCard;