import { useState, useMemo, useRef, useEffect } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { capitalizeFirst } from "@/lib/capitalize";
import type { LucideIcon } from "lucide-react";

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
  icon?: string;
}

interface FilterDropdownMultiProps {
  label: string;
  icon?: LucideIcon;
  options: FilterOption[];
  selected: Set<string>;
  onToggle: (value: string) => void;
  searchable?: boolean;
  singleSelect?: boolean;
  capitalize?: boolean;
  placeholder?: string;
  /** Custom color scheme: "default" | "danger" | "info" */
  activeColor?: "default" | "danger" | "info";
}

export function FilterDropdownMulti({
  label,
  icon: Icon,
  options,
  selected,
  onToggle,
  searchable,
  singleSelect,
  capitalize: doCapitalize = true,
  placeholder,
  activeColor = "default",
}: FilterDropdownMultiProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const showSearch = searchable !== false && options.length > 6;

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const list = !q ? options : options.filter(o => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q));
    // Selected first
    return [...list].sort((a, b) => {
      const aS = selected.has(a.value) ? 1 : 0;
      const bS = selected.has(b.value) ? 1 : 0;
      if (aS !== bS) return bS - aS;
      return (b.count || 0) - (a.count || 0);
    });
  }, [options, search, selected]);

  const summary = selected.size === 0
    ? "Tutti"
    : selected.size === 1
      ? doCapitalize ? capitalizeFirst(Array.from(selected)[0]) : Array.from(selected)[0]
      : `${selected.size} sel.`;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={cn(
          "w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs transition-all border",
          selected.size > 0
            ? "bg-primary/10 border-primary/20 text-primary"
            : "border-border/40 text-muted-foreground hover:bg-muted/30"
        )}
      >
        {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
        <span className="font-medium">{label}</span>
        <span className="ml-auto text-[10px] opacity-70 truncate max-w-[120px]">{summary}</span>
        <ChevronDown className={cn("w-3 h-3 shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="mt-1 rounded-lg border border-border/50 bg-popover shadow-lg z-50 overflow-hidden">
          {showSearch && (
            <div className="p-1.5 border-b border-border/30">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={placeholder || "Cerca..."}
                  className="w-full h-7 pl-6 pr-2 text-[11px] bg-muted/30 border border-border/30 rounded-md outline-none focus:border-primary/40"
                  autoFocus
                />
              </div>
            </div>
          )}
          <div className="max-h-[220px] overflow-y-auto p-1">
            {filtered.length === 0 && (
              <div className="px-2 py-3 text-center text-[10px] text-muted-foreground">Nessun risultato</div>
            )}
            {filtered.map(o => {
              const isActive = selected.has(o.value);
              const displayLabel = doCapitalize ? capitalizeFirst(o.label) : o.label;
              return (
                <button
                  key={o.value}
                  onClick={() => {
                    onToggle(o.value);
                    if (singleSelect) setOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] transition-all",
                    isActive ? "bg-primary/15 text-primary" : "hover:bg-muted/40 text-foreground"
                  )}
                >
                  <div className={cn(
                    "w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0",
                    isActive ? "bg-primary border-primary" : "border-border/50"
                  )}>
                    {isActive && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                  </div>
                  {o.icon && <span className="text-sm shrink-0">{o.icon}</span>}
                  <span className="flex-1 text-left truncate">{displayLabel}</span>
                  {o.count !== undefined && (
                    <span className="text-[9px] tabular-nums opacity-60 shrink-0">{o.count}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
