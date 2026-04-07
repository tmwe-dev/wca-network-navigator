import { Input } from "@/components/ui/input";
import { Search, Layers } from "lucide-react";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { FilterSection, ChipGroup, Chip, SORTING_FILTERS } from "./shared";

export function InUscitaFilters() {
  const g = useGlobalFilters();

  return (
    <>
      <FilterSection icon={Search} label="Cerca">
        <Input value={g.filters.sortingSearch} onChange={e => g.setSortingSearch(e.target.value)} placeholder="Cerca..." className="h-8 text-xs bg-muted/30 border-border/40" />
      </FilterSection>
      <FilterSection icon={Layers} label="Stato coda">
        <ChipGroup>
          {SORTING_FILTERS.map(o => <Chip key={o.key} active={g.filters.sortingFilter === o.key} onClick={() => g.setSortingFilter(o.key)}>{o.label}</Chip>)}
        </ChipGroup>
      </FilterSection>
    </>
  );
}
