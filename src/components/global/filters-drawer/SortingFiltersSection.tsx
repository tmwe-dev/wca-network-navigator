import { Search, ListTodo, ArrowUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { FilterSection, ChipGroup, Chip } from "./shared";
import { SORTING_FILTERS } from "./constants";

const SORTING_SORT = [
  { value: "date_desc", label: "Più recenti" },
  { value: "date_asc", label: "Più vecchi" },
];

export function SortingFiltersSection() {
  const g = useGlobalFilters();
  return (
    <>
      <FilterSection icon={Search} label="Cerca">
        <Input value={g.filters.sortingSearch} onChange={e => g.setSortingSearch(e.target.value)} placeholder="Cerca approvazioni..." className="h-8 text-xs bg-muted/30 border-border/40" />
      </FilterSection>
      <FilterSection icon={ListTodo} label="Stato">
        <ChipGroup>{SORTING_FILTERS.map(o => <Chip key={o.key} active={g.filters.sortingFilter === o.key} onClick={() => g.setSortingFilter(o.key)}>{o.label}</Chip>)}</ChipGroup>
      </FilterSection>
      <FilterSection icon={ArrowUpDown} label="Ordina">
        <ChipGroup>{SORTING_SORT.map(o => <Chip key={o.value} active={g.filters.sortBy === o.value} onClick={() => g.setSortBy(o.value)}>{o.label}</Chip>)}</ChipGroup>
      </FilterSection>
    </>
  );
}
