import { Input } from "@/components/ui/input";
import { Search, Plane, ArrowUpDown } from "lucide-react";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { FilterSection, ChipGroup, Chip, COCKPIT_STATUS } from "./shared";

export function CircuitoFilters() {
  const g = useGlobalFilters();

  return (
    <>
      <FilterSection icon={Search} label="Cerca">
        <Input value={g.filters.search} onChange={e => g.setSearch(e.target.value)} placeholder="Cerca..." className="h-8 text-xs bg-muted/30 border-border/40" />
      </FilterSection>
      <FilterSection icon={Plane} label="Fase">
        <ChipGroup>
          {COCKPIT_STATUS.map(o => <Chip key={o.value} active={g.filters.cockpitStatus === o.value} onClick={() => g.setCockpitStatus(o.value)}>{o.label}</Chip>)}
        </ChipGroup>
      </FilterSection>
      <FilterSection icon={ArrowUpDown} label="Ordina">
        <ChipGroup>
          {[{ value: "name", label: "Nome" }, { value: "lastContact", label: "Ultimo contatto" }, { value: "company", label: "Azienda" }].map(o => (
            <Chip key={o.value} active={g.filters.sortBy === o.value} onClick={() => g.setSortBy(o.value)}>{o.label}</Chip>
          ))}
        </ChipGroup>
      </FilterSection>
    </>
  );
}
