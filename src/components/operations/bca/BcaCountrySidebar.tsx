import {
  Globe, SlidersHorizontal, Plane,
  LayoutList, LayoutGrid, Rows3, Calendar,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { CountryEntry, EventEntry, ViewMode, SortMode } from "./useBcaGrouping";

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
  events?: EventEntry[];
  eventFilter?: string | null;
  onSetEventFilter?: (v: string | null) => void;
}

export function BcaCountrySidebar({
  countries, totalCompanies, totalContacts,
  selectedCountry, onSelectCountry,
  onlyMatched, onSetOnlyMatched,
  onlyWithEmail, onSetOnlyWithEmail,
  hideHolding, holdingCount, onSetHideHolding,
  sortMode, onSetSortMode,
  viewMode, onSetViewMode,
  events = [], eventFilter = null, onSetEventFilter,
}: BcaCountrySidebarProps) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b border-border/30 px-3 pb-2 pt-3">
        <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
          <Globe className="w-3.5 h-3.5 text-primary" /> Paesi
        </span>
        <span className="text-[10px] text-muted-foreground">{countries.length}</span>
      </div>

      <button
        onClick={() => onSelectCountry(null)}
        className={cn("flex shrink-0 items-center gap-2 border-b border-border/20 px-3 py-2 text-left transition-all", selectedCountry === null ? "bg-primary/10 text-primary" : "hover:bg-muted/40 text-foreground")}
      >
        <span className="text-sm">🌍</span>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-semibold truncate">Tutti</div>
          <div className="text-[9px] text-muted-foreground">{totalCompanies} aziende · {totalContacts} contatti</div>
        </div>
      </button>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
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

      <div className="shrink-0 space-y-2.5 border-t border-border/30 p-3">
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

        {onSetEventFilter && events.length > 0 && (
          <div className="space-y-1">
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Evento
            </span>
            <Select
              value={eventFilter ?? "__all__"}
              onValueChange={(v) => onSetEventFilter(v === "__all__" ? null : v)}
            >
              <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__" className="text-xs">Tutti gli eventi</SelectItem>
                {events.map((e) => (
                  <SelectItem key={e.name} value={e.name} className="text-xs">
                    {e.name} ({e.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

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
    </div>
  );
}
