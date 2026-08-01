/**
 * KPICard — Single metric card with icon, value, trend, and color coding
 */
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface KPICardProps {
  label: string;
  value: number | string;
  unit?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color?: "emerald" | "blue" | "amber" | "violet" | "rose" | "slate";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export function KPICard({
  label,
  value,
  unit = "",
  icon: Icon,
  trend,
  color = "slate",
  size = "md",
  loading = false,
}: KPICardProps) {
  const colorMap = {
    emerald: {
      bg: "bg-emerald-500/10",
      icon: "text-emerald-600 dark:text-emerald-400",
      border: "border-emerald-200/30 dark:border-emerald-800/40",
      text: "text-emerald-700 dark:text-emerald-300",
    },
    blue: {
      bg: "bg-blue-500/10",
      icon: "text-blue-600 dark:text-blue-400",
      border: "border-blue-200/30 dark:border-blue-800/40",
      text: "text-blue-700 dark:text-blue-300",
    },
    amber: {
      bg: "bg-amber-500/10",
      icon: "text-amber-600 dark:text-amber-400",
      border: "border-amber-200/30 dark:border-amber-800/40",
      text: "text-amber-700 dark:text-amber-300",
    },
    violet: {
      bg: "bg-violet-500/10",
      icon: "text-violet-600 dark:text-violet-400",
      border: "border-violet-200/30 dark:border-violet-800/40",
      text: "text-violet-700 dark:text-violet-300",
    },
    rose: {
      bg: "bg-rose-500/10",
      icon: "text-rose-600 dark:text-rose-400",
      border: "border-rose-200/30 dark:border-rose-800/40",
      text: "text-rose-700 dark:text-rose-300",
    },
    slate: {
      bg: "bg-slate-500/10",
      icon: "text-slate-600 dark:text-slate-400",
      border: "border-slate-200/30 dark:border-slate-800/40",
      text: "text-slate-700 dark:text-slate-300",
    },
  };

  const sizeMap = {
    sm: {
      container: "p-3",
      iconSize: "w-4 h-4",
      labelSize: "text-xs",
      valueSize: "text-lg",
    },
    md: {
      container: "p-4",
      iconSize: "w-5 h-5",
      labelSize: "text-sm",
      valueSize: "text-2xl",
    },
    lg: {
      container: "p-6",
      iconSize: "w-6 h-6",
      labelSize: "text-base",
      valueSize: "text-3xl",
    },
  };

  const colors = colorMap[color];
  const sizes = sizeMap[size];

  if (loading) {
    return (
      <div
        className={cn(
          "rounded-lg border bg-card/50 backdrop-blur-sm",
          sizes.container,
          colors.border
        )}
      >
        <div className="space-y-2">
          <div className="h-4 w-24 rounded bg-muted animate-pulse" />
          <div className="h-8 w-16 rounded bg-muted animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border transition-all duration-200 hover:shadow-md",
        colors.bg,
        colors.border,
        sizes.container,
        "bg-card/50 backdrop-blur-sm"
      )}
    >
      <div className="space-y-3">
        {/* Header with icon and label */}
        <div className="flex items-start justify-between">
          <div className={cn("rounded-md", colors.bg, "p-2")}>
            <Icon className={cn(sizes.iconSize, colors.icon)} />
          </div>
          {trend && (
            <div
              className={cn(
                "flex items-center gap-1 text-xs font-medium",
                trend.isPositive
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400"
              )}
            >
              {trend.isPositive ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              <span>{Math.abs(trend.value).toFixed(1)}%</span>
            </div>
          )}
        </div>

        {/* Label */}
        <p
          className={cn(
            "font-medium text-muted-foreground",
            sizes.labelSize
          )}
        >
          {label}
        </p>

        {/* Value */}
        <div className="flex items-baseline gap-1">
          <span className={cn("font-bold text-foreground", sizes.valueSize)}>
            {typeof value === "number"
              ? new Intl.NumberFormat("it-IT", {
                  notation: value > 999999 ? "compact" : "standard",
                  maximumFractionDigits: value > 100 ? 0 : 1,
                }).format(value)
              : value}
          </span>
          {unit && (
            <span className={cn("text-muted-foreground", sizes.labelSize)}>
              {unit}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
