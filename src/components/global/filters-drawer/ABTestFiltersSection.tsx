import { Search, FlaskConical } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { FilterSection, ChipGroup, Chip } from "./shared";

const AB_STATUS = [
  { value: "all", label: "Tutti" },
  { value: "running", label: "In corso" },
  { value: "completed", label: "Completati" },
];

export function ABTestFiltersSection() {
  const g = useGlobalFilters();
  return (
    <>
      <FilterSection icon={Search} label="Cerca">
        <Input value={g.filters.search} onChange={e => g.setSearch(e.target.value)} placeholder="Cerca test..." className="h-8 text-xs bg-muted/30 border-border/40" />
      </FilterSection>
      <FilterSection icon={FlaskConical} label="Stato">
        <ChipGroup>{AB_STATUS.map(o => <Chip key={o.value} active={g.filters.sortingFilter === o.value} onClick={() => g.setSortingFilter(o.value as never)}>{o.label}</Chip>)}</ChipGroup>
      </FilterSection>
    </>
  );
}
