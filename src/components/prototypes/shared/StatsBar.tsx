import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatItem {
  label: string;
  value: number | string;
  icon: typeof Activity;
  color?: string;
}

interface Props {
  stats: StatItem[];
  className?: string;
}

export function StatsBar({ stats, className }: Props) {
  return (
    <div className={cn("flex items-center gap-4 px-3 py-2 text-xs", className)}>
      {stats.map((s, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <s.icon className={cn("h-3 w-3", s.color || "text-primary/70")} />
          <span className="font-semibold text-foreground">{s.value}</span>
          <span className="text-muted-foreground">{s.label}</span>
        </div>
      ))}
    </div>
  );
}
