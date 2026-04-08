import { type LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface EmptyStateAction {
  label: string;
  onClick: () => void;
}

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  /** @deprecated Use primaryAction instead */
  actionLabel?: string;
  /** @deprecated Use primaryAction instead */
  onAction?: () => void;
  /** Primary CTA, rendered as filled button */
  primaryAction?: EmptyStateAction;
  /** Secondary CTA, rendered as outline button */
  secondaryAction?: EmptyStateAction;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  primaryAction,
  secondaryAction,
  className,
}: EmptyStateProps) {
  // backward compat: actionLabel + onAction → primaryAction
  const effectivePrimary =
    primaryAction ??
    (actionLabel && onAction ? { label: actionLabel, onClick: onAction } : undefined);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn("flex flex-col items-center justify-center gap-3 py-16 px-6 text-center", className)}
    >
      <div className="w-14 h-14 rounded-2xl bg-muted/40 flex items-center justify-center">
        <Icon className="w-7 h-7 text-muted-foreground/50" />
      </div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="text-xs text-muted-foreground max-w-[320px] leading-relaxed">{description}</p>
      )}
      {(effectivePrimary || secondaryAction) && (
        <div className="mt-2 flex items-center justify-center gap-2 flex-wrap">
          {effectivePrimary && (
            <button
              type="button"
              onClick={effectivePrimary.onClick}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition"
            >
              {effectivePrimary.label}
            </button>
          )}
          {secondaryAction && (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              className="px-4 py-2 text-xs font-medium rounded-lg border border-border text-foreground hover:bg-muted transition"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}
