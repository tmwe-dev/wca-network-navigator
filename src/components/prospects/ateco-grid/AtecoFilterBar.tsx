import { useState } from "react";
import { Check, X, ChevronsUpDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";

interface FilterMultiSelectProps {
  label: string;
  placeholder: string;
  options: Array<{ value: string; label: string; sub?: string }>;
  selected: string[];
  onToggle: (v: string) => void;
  onClear: () => void;
}

export function FilterMultiSelect({ label, placeholder, options, selected, onToggle, onClear }: FilterMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const selectedSet = new Set(selected);
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider font-semibold mb-2 text-muted-foreground">{label}</p>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs border transition-all bg-card border-border text-foreground hover:bg-muted/50">
            <span className={selected.length === 0 ? "text-muted-foreground" : ""}>
              {selected.length === 0 ? placeholder : `${selected.length} sel.`}
            </span>
            <ChevronsUpDown className="w-3 h-3 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-0 z-50 bg-card border-border" align="start">
          <Command className="bg-card">
            <CommandInput placeholder="Cerca..." className="text-xs" />
            <CommandList className="max-h-[300px] overflow-auto">
              <CommandEmpty className="text-xs text-muted-foreground">Nessun risultato</CommandEmpty>
              {selected.length > 0 && (
                <CommandGroup>
                  <CommandItem onSelect={onClear} className="text-xs text-destructive">
                    <X className="w-3 h-3 mr-1" /> Deseleziona tutto
                  </CommandItem>
                </CommandGroup>
              )}
              <CommandGroup>
                {options.map(opt => (
                  <CommandItem key={opt.value} value={`${opt.value} ${opt.label}`} onSelect={() => onToggle(opt.value)} className="text-xs">
                    <div className={`w-3.5 h-3.5 mr-2 rounded border flex items-center justify-center flex-shrink-0 ${
                      selectedSet.has(opt.value) ? "bg-primary border-primary" : "border-border"
                    }`}>
                      {selectedSet.has(opt.value) && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                    </div>
                    <span>{opt.label}</span>
                    {opt.sub && <span className="ml-auto text-[10px] text-muted-foreground">{opt.sub}</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {selected.map(v => (
            <button key={v} onClick={() => onToggle(v)}
              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary border border-primary/20">
              {v} <X className="w-2.5 h-2.5 opacity-60" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
