import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Search, X, FileText, Check } from "lucide-react";
import { t } from "@/components/download/theme";
import { getAtecoRank, calcScore } from "@/data/atecoRanking";
import type { ProspectFilters } from "@/components/prospects/ProspectAdvancedFilters";
import { useAtecoGrid, groups, passesRankingFilter } from "./ateco-grid/useAtecoGrid";
import { FilterMultiSelect } from "./ateco-grid/AtecoFilterBar";
import { AtecoSectionRow } from "./ateco-grid/AtecoSectionRow";

interface AtecoGridProps {
  selected: string[];
  onToggle: (code: string) => void;
  onRemove: (code: string) => void;
  onSelectMultiple?: (codes: string[]) => void;
  isDark: boolean;
  regionFilter: string[];
  onRegionChange: (r: string[]) => void;
  provinceFilter: string[];
  onProvinceChange: (p: string[]) => void;
  rankingFilters?: ProspectFilters;
}

export function AtecoGrid({
  selected, onToggle, onRemove, onSelectMultiple, isDark,
  regionFilter, onRegionChange, provinceFilter, onProvinceChange, rankingFilters,
}: AtecoGridProps) {
  const th = t(isDark);
  const grid = useAtecoGrid({
    selected, onToggle, onRemove, regionFilter, onRegionChange, provinceFilter, onProvinceChange, rankingFilters,
  });

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      {/* Region & Province filters */}
      <div className="space-y-2">
        <FilterMultiSelect label="Regione" placeholder="Tutte le regioni" options={grid.regionOptions}
          selected={regionFilter} onToggle={grid.handleRegionToggle} onClear={grid.handleRegionClear} />
        <FilterMultiSelect label="Provincia" placeholder="Tutte le province" options={grid.provinceOptions}
          selected={provinceFilter} onToggle={grid.handleProvinceToggle} onClear={grid.handleProvinceClear} />
      </div>

      {/* Search */}
      <div className="relative">
        <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${th.dim}`} />
        <Input placeholder="Cerca ATECO..." value={grid.search} onChange={e => grid.setSearch(e.target.value)}
          className={`pl-12 h-11 rounded-2xl text-base ${th.input}`} />
      </div>

      {/* Only in DB toggle */}
      <div className={`flex items-center justify-between px-3 py-2 rounded-xl border transition-all ${
        grid.onlyInDb ? "bg-primary/10 border-primary/25" : isDark ? "bg-white/[0.03] border-white/[0.07]" : "bg-card border-border"
      }`}>
        <div className="flex items-center gap-2">
          <span className={`text-[11px] font-medium ${grid.onlyInDb ? "text-primary" : "text-muted-foreground"}`}>Solo nel DB</span>
          {grid.totalInDb > 0 && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{grid.totalInDb.toLocaleString()}</span>
          )}
        </div>
        <Switch checked={grid.onlyInDb} onCheckedChange={grid.setOnlyInDb} className="scale-75 origin-right" />
      </div>

      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 items-center">
          {selected.map(code => (
            <button key={code} onClick={() => onRemove(code)}
              className="group flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all bg-primary/10 text-primary border border-primary/20">
              {code} <X className="w-3 h-3 opacity-50 group-hover:opacity-100" />
            </button>
          ))}
        </div>
      )}

      {/* Select all filtered button */}
      {(() => {
        const hasRankFilter = rankingFilters && (rankingFilters.rank_volume_min > 0 || rankingFilters.rank_valore_min > 0 ||
          rankingFilters.rank_intl.length > 0 || rankingFilters.rank_score_min > 0);
        if (!hasRankFilter || !onSelectMultiple) return null;
        const visibleCodes = groups.filter(g => passesRankingFilter(getAtecoRank(g.codice), rankingFilters)).map(g => g.codice);
        const unselectedCount = visibleCodes.filter(c => !grid.selectedSet.has(c)).length;
        return (
          <div className="flex items-center justify-between px-2 py-1.5 rounded-xl text-xs bg-primary/10 border border-primary/20">
            <span className="text-primary">{visibleCodes.length} categorie filtrate</span>
            {unselectedCount > 0 && (
              <button onClick={() => onSelectMultiple(visibleCodes)}
                className="px-2.5 py-1 rounded-lg font-medium transition-all bg-primary text-primary-foreground hover:bg-primary/90">
                Seleziona tutti ({visibleCodes.length})
              </button>
            )}
          </div>
        );
      })()}

      {/* ATECO Tree */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="flex flex-col gap-0.5 pr-2">
          {grid.filteredSections.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <FileText className="w-16 h-16 mx-auto text-muted-foreground/20" />
              <p className={`text-sm ${th.sub}`}>Nessun codice ATECO trovato</p>
            </div>
          ) : (
            grid.filteredSections.map(section => (
              <AtecoSectionRow key={section.codice} section={section} isDark={isDark}
                expanded={grid.expanded} selectedSet={grid.selectedSet} nodeCount={grid.nodeCount}
                onlyInDb={grid.onlyInDb} rankingFilters={rankingFilters}
                onToggleExpand={grid.toggleExpand} onToggleBranch={grid.toggleBranch} onToggleCode={onToggle} />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
