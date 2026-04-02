import { type LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, actionLabel, onAction, className }: EmptyStateProps) {
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
        <p className="text-xs text-muted-foreground max-w-[280px] leading-relaxed">{description}</p>
      )}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
        >
          {actionLabel} →
        </button>
      )}
    </motion.div>
  );
}
