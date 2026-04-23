import { Search, Zap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { FilterSection, ChipGroup, Chip } from "./shared";
import { ATTIVITA_PRIORITY } from "./constants";

export function CodaAIFiltersSection() {
  const g = useGlobalFilters();
  return (
    <>
      <FilterSection icon={Search} label="Cerca">
        <Input value={g.filters.search} onChange={e => g.setSearch(e.target.value)} placeholder="Cerca azioni AI..." className="h-8 text-xs bg-muted/30 border-border/40" />
      </FilterSection>
      <FilterSection icon={Zap} label="Priorità">
        <ChipGroup>{ATTIVITA_PRIORITY.map(o => <Chip key={o.value} active={g.filters.attivitaPriority === o.value} onClick={() => g.setAttivitaPriority(o.value)}>{o.label}</Chip>)}</ChipGroup>
      </FilterSection>
    </>
  );
}
