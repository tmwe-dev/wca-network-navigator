import { cn } from "@/lib/utils";
import { X } from "lucide-react";

export interface FilterChip {
  key: string;
  label: string;
  group?: string;
}

interface Props {
  chips: FilterChip[];
  active: string[];
  onChange: (active: string[]) => void;
  className?: string;
}

export function QuickFilters({ chips, active, onChange, className }: Props) {
  const toggle = (key: string) => {
    onChange(active.includes(key) ? active.filter(k => k !== key) : [...active, key]);
  };

  const groups = [...new Set(chips.map(c => c.group || ""))];

  return (
    <div className={cn("flex flex-wrap gap-1.5 p-2", className)}>
      {active.length > 0 && (
        <button
          onClick={() => onChange([])}
          className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
        >
          <X className="h-2.5 w-2.5" /> Reset
        </button>
      )}
      {chips.map(chip => (
        <button
          key={chip.key}
          onClick={() => toggle(chip.key)}
          className={cn(
            "px-2.5 py-1 rounded-full text-[11px] font-medium transition-all",
            active.includes(chip.key)
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-muted/60 text-muted-foreground hover:bg-muted"
          )}
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
}
