import { useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { getCountryFlag } from "@/lib/countries";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, MapPin, Star, X, User, Search, Trophy,
  ChevronUp, ChevronDown, Globe,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getServiceIcon } from "@/components/partners/shared/ServiceIcons";
import { formatServiceCategory } from "@/lib/countries";
import { WCA_COUNTRIES } from "@/data/wcaCountries";
import type { SortField, SortDir, SortEntry, PartnerRowData } from "./CountryWorkbenchTypes";
import { DEFAULT_DIRS } from "./CountryWorkbenchTypes";

interface CountryWorkbenchFiltersProps {
  countryCode: string;
  countryPartners: PartnerRowData[];
  filteredPartners: PartnerRowData[];
  searchTerm: string;
  onSearchChange: (v: string) => void;
  sortStack: SortEntry[];
  onSortToggle: (field: SortField) => void;
  activeServiceFilters: Set<string>;
  onToggleServiceFilter: (svc: string) => void;
  availableServices: string[];
  availableNetworks: string[];
  networkFilter: string | null;
  onNetworkFilterChange: (v: string | null) => void;
  availableBranchCountries: { code: string; name: string }[];
  branchCountryFilter: string | null;
  onBranchCountryFilterChange: (v: string | null) => void;
  allSelected: boolean;
  onSelectAll: () => void;
  onBack: () => void;
}

export function CountryWorkbenchFilters({
  countryCode, countryPartners, filteredPartners, searchTerm, onSearchChange,
  sortStack, onSortToggle, activeServiceFilters, onToggleServiceFilter,
  availableServices, availableNetworks, networkFilter, onNetworkFilterChange,
  availableBranchCountries, branchCountryFilter, onBranchCountryFilterChange,
  allSelected, onSelectAll, onBack,
}: CountryWorkbenchFiltersProps) {
  const countryName = WCA_COUNTRIES.find((c) => c.code === countryCode)?.name || countryCode;
  const flag = getCountryFlag(countryCode);
  const hasAnyFilter = activeServiceFilters.size > 0 || !!networkFilter || !!branchCountryFilter;

  const clearAllFilters = useCallback(() => {
    activeServiceFilters.forEach((svc) => onToggleServiceFilter(svc));
    onNetworkFilterChange(null);
    onBranchCountryFilterChange(null);
  }, [activeServiceFilters, onToggleServiceFilter, onNetworkFilterChange, onBranchCountryFilterChange]);

  const sortButtons: { field: SortField; icon: typeof User; label: string }[] = [
    { field: "name", icon: User, label: "Nome" },
    { field: "city", icon: MapPin, label: "Città" },
    { field: "rating", icon: Star, label: "Rating" },
    { field: "years", icon: Trophy, label: "Anni" },
  ];

  return (
    <>
      {/* ═══ HEADER ═══ */}
      <div className="px-4 py-2.5 border-b border-border/60 bg-card/30">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-2xl">{flag}</span>
          <h2 className="text-sm font-bold leading-tight truncate">{countryName}</h2>
          {availableNetworks.length > 0 && (
            <Select
              value={networkFilter || "__all__"}
              onValueChange={(v) => onNetworkFilterChange(v === "__all__" ? null : v)}
            >
              <SelectTrigger className="h-7 text-[11px] w-auto min-w-[100px] max-w-[160px] bg-muted/50 border-border/60">
                <SelectValue placeholder="Network" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__" className="text-xs">Tutti i network</SelectItem>
                {availableNetworks.map((n) => (
                  <SelectItem key={n} value={n} className="text-xs">{n.replace("WCA ", "")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <span className="ml-auto text-lg font-bold text-foreground tabular-nums bg-muted/60 px-3 py-0.5 rounded-lg">
            {(hasAnyFilter || searchTerm)
              ? <>{filteredPartners.length} <span className="text-muted-foreground font-normal text-sm">/ {countryPartners.length}</span></>
              : countryPartners.length}
          </span>
        </div>
      </div>

      {/* ═══ SORT + SERVICE ICONS ═══ */}
      <div className="px-4 py-2 border-b border-border/40 flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-0.5">
          {sortButtons.map((s) => {
            const Icon = s.icon;
            const entry = sortStack.find((e) => e.field === s.field);
            const stackIndex = entry ? sortStack.indexOf(entry) : -1;
            const isActive = !!entry;
            const isAsc = entry?.dir === "asc";
            const DirIcon = isAsc ? ChevronUp : ChevronDown;
            const isDefaultDir = entry?.dir === DEFAULT_DIRS[s.field];
            const colorClass = isActive
              ? isDefaultDir ? "text-primary" : "text-destructive"
              : "text-muted-foreground";
            const bgClass = isActive
              ? isDefaultDir ? "bg-primary/15" : "bg-destructive/15"
              : "hover:bg-accent/50";

            return (
              <Tooltip key={s.field}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onSortToggle(s.field)}
                    className={cn("relative p-1.5 rounded-md transition-all", bgClass, colorClass, !isActive && "hover:text-foreground")}
                  >
                    <Icon className="w-4 h-4" strokeWidth={isActive ? 2.2 : 1.6} />
                    {isActive && (
                      <>
                        <DirIcon className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5" strokeWidth={2.5} />
                        {sortStack.length > 1 && (
                          <span className="absolute -top-1 -left-1 w-3.5 h-3.5 rounded-full bg-background border border-current text-[8px] font-bold flex items-center justify-center">
                            {stackIndex + 1}
                          </span>
                        )}
                      </>
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">{s.label}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {availableServices.length > 0 && (
          <>
            <div className="w-px h-5 bg-border/60" />
            <div className="flex items-center gap-0.5">
              {availableServices.map((svc) => {
                const Icon = getServiceIcon(svc);
                const isActive = activeServiceFilters.has(svc);
                return (
                  <Tooltip key={svc}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => onToggleServiceFilter(svc)}
                        className={cn(
                          "p-1.5 rounded-md border transition-all",
                          isActive
                            ? "bg-primary/20 border-primary/60 text-primary"
                            : "bg-transparent border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/50"
                        )}
                      >
                        <Icon className={cn("w-3.5 h-3.5", isActive ? "text-primary" : "text-muted-foreground")} strokeWidth={1.8} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">{formatServiceCategory(svc)}</TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </>
        )}

        {hasAnyFilter && (
          <button onClick={clearAllFilters}
            className="p-1.5 rounded-full text-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-all ml-auto">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* ═══ BRANCH FILTER ═══ */}
      {availableBranchCountries.length > 0 && (
        <div className="px-4 py-1.5 border-b border-border/40 flex items-center gap-2">
          <Select
            value={branchCountryFilter || "__all__"}
            onValueChange={(v) => onBranchCountryFilterChange(v === "__all__" ? null : v)}
          >
            <SelectTrigger className="h-7 text-[11px] w-auto min-w-[120px] max-w-[180px] bg-muted/50 border-border/60">
              <SelectValue placeholder="Filiali" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__" className="text-xs">Tutte le filiali</SelectItem>
              {availableBranchCountries.map((b) => (
                <SelectItem key={b.code} value={b.code} className="text-xs">
                  {getCountryFlag(b.code)} {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* ═══ SELECT ALL + SEARCH ═══ */}
      <div className="px-4 py-1.5 border-b border-border/30 flex items-center gap-3">
        <div className="flex items-center gap-2 pl-[2px] shrink-0">
          <Checkbox
            checked={allSelected}
            onCheckedChange={onSelectAll}
            className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
          />
          <span className="text-[10px] text-muted-foreground select-none whitespace-nowrap">
            {allSelected ? "Deseleziona" : "Sel. tutti"}
          </span>
        </div>
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Cerca partner..."
            className="h-7 pl-7 text-[11px] bg-muted/50 border-border/60"
          />
        </div>
      </div>
    </>
  );
}
