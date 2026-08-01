import { Search, Plane } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { FilterSection, ChipGroup, Chip } from "./shared";
import { COCKPIT_STATUS } from "./constants";

export function CircuitFiltersSection() {
  const g = useGlobalFilters();

  return (
    <>
      <FilterSection icon={Search} label="Cerca">
        <Input value={g.filters.search} onChange={e => g.setSearch(e.target.value)} placeholder="Cerca..." className="h-8 text-xs bg-muted/30 border-border/40" />
      </FilterSection>
      <FilterSection icon={Plane} label="Fase">
        <ChipGroup>{COCKPIT_STATUS.map(o => <Chip key={o.value} active={g.filters.cockpitStatus === o.value} onClick={() => g.setCockpitStatus(o.value)}>{o.label}</Chip>)}</ChipGroup>
      </FilterSection>
    </>
  );
}
