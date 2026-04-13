import {
  Globe, SlidersHorizontal, Plane,
  LayoutList, LayoutGrid, Rows3,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { CountryEntry, ViewMode, SortMode } from "./useBcaGrouping";

interface BcaCountrySidebarProps {
  countries: CountryEntry[];
  totalCompanies: number;
  totalContacts: number;
  selectedCountry: string | null;
  onSelectCountry: (code: string | null) => void;
  onlyMatched: boolean;
  onSetOnlyMatched: (v: boolean) => void;
  onlyWithEmail: boolean;
  onSetOnlyWithEmail: (v: boolean) => void;
  hideHolding: boolean;
  holdingCount: number;
  onSetHideHolding: (v: boolean) => void;
  sortMode: SortMode;
  onSetSortMode: (v: SortMode) => void;
  viewMode: ViewMode;
  onSetViewMode: (v: ViewMode) => void;
}

export function BcaCountrySidebar({
  countries, totalCompanies, totalContacts,
  selectedCountry, onSelectCountry,
  onlyMatched, onSetOnlyMatched,
  onlyWithEmail, onSetOnlyWithEmail,
  hideHolding, holdingCount, onSetHideHolding,
  sortMode, onSetSortMode,
  viewMode, onSetViewMode,
}: BcaCountrySidebarProps) {
  return (
    <>
      <div className="px-3 pt-3 pb-2 border-b border-border/30 flex items-center justify-between">
        <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
          <Globe className="w-3.5 h-3.5 text-primary" /> Paesi
        </span>
        <span className="text-[10px] text-muted-foreground">{countries.length}</span>
      </div>

      <button
        onClick={() => onSelectCountry(null)}
        className={cn("flex items-center gap-2 px-3 py-2 text-left border-b border-border/20 transition-all", selectedCountry === null ? "bg-primary/10 text-primary" : "hover:bg-muted/40 text-foreground")}
      >
        <span className="text-sm">🌍</span>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-semibold truncate">Tutti</div>
          <div className="text-[9px] text-muted-foreground">{totalCompanies} aziende · {totalContacts} contatti</div>
        </div>
      </button>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {countries.map(c => {
          const isActive = selectedCountry === (c.code ?? "__none__");
          return (
            <button
              key={c.code ?? "__none__"}
              onClick={() => onSelectCountry(c.code ?? "__none__")}
              className={cn("w-full flex items-center gap-2 px-3 py-1.5 text-left transition-all border-b border-border/10", isActive ? "bg-primary/10 text-primary" : "hover:bg-muted/40 text-foreground")}
            >
              <span className="text-base leading-none flex-shrink-0">{c.flag}</span>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-medium truncate">{c.label}</div>
                <div className="text-[9px] text-muted-foreground">{c.companyCount} az. · {c.contactCount} cont.</div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="border-t border-border/30 p-3 space-y-2.5">
        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
          <SlidersHorizontal className="w-3 h-3" /> Filtri
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">Solo WCA match</span>
            <Switch checked={onlyMatched} onCheckedChange={onSetOnlyMatched} className="scale-[0.65]" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">Solo con email</span>
            <Switch checked={onlyWithEmail} onCheckedChange={onSetOnlyWithEmail} className="scale-[0.65]" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Plane className="w-3 h-3" /> Nascondi in circuito ({holdingCount})</span>
            <Switch checked={hideHolding} onCheckedChange={onSetHideHolding} className="scale-[0.65]" />
          </div>
        </div>

        <div className="space-y-1">
          <span className="text-[10px] text-muted-foreground">Ordina per</span>
          <Select value={sortMode} onValueChange={v => onSetSortMode(v as SortMode)}>
            <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="matched_first" className="text-xs">Match prima</SelectItem>
              <SelectItem value="name_asc" className="text-xs">Nome A→Z</SelectItem>
              <SelectItem value="name_desc" className="text-xs">Nome Z→A</SelectItem>
              <SelectItem value="contacts_desc" className="text-xs">Contatti ↓</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <span className="text-[10px] text-muted-foreground">Visualizzazione</span>
          <div className="flex items-center gap-1">
            {([["compact", LayoutList, "Compatta"], ["card", LayoutGrid, "Griglia"], ["expanded", Rows3, "Espansa"]] as const).map(([mode, Icon, label]) => (
              <TooltipProvider key={mode} delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button onClick={() => onSetViewMode(mode)} className={cn("p-1.5 rounded-md transition-all", viewMode === mode ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/40")}>
                      <Icon className="w-3.5 h-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="text-[10px]">{label}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
