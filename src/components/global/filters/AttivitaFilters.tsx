import { Input } from "@/components/ui/input";
import { Search, ListTodo, Zap, ArrowUpDown } from "lucide-react";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { FilterSection, ChipGroup, Chip, ATTIVITA_STATUS, ATTIVITA_PRIORITY } from "./shared";

export function AttivitaFilters() {
  const g = useGlobalFilters();

  return (
    <>
      <FilterSection icon={Search} label="Cerca">
        <Input value={g.filters.search} onChange={e => g.setSearch(e.target.value)} placeholder="Cerca attività..." className="h-8 text-xs bg-muted/30 border-border/40" />
      </FilterSection>
      <FilterSection icon={ListTodo} label="Stato">
        <ChipGroup>
          {ATTIVITA_STATUS.map(o => <Chip key={o.value} active={g.filters.attivitaStatus === o.value} onClick={() => g.setAttivitaStatus(o.value)}>{o.label}</Chip>)}
        </ChipGroup>
      </FilterSection>
      <FilterSection icon={Zap} label="Priorità">
        <ChipGroup>
          {ATTIVITA_PRIORITY.map(o => <Chip key={o.value} active={g.filters.attivitaPriority === o.value} onClick={() => g.setAttivitaPriority(o.value)}>{o.label}</Chip>)}
        </ChipGroup>
      </FilterSection>
      <FilterSection icon={ArrowUpDown} label="Ordina">
        <ChipGroup>
          {[{ value: "date_desc", label: "Più recenti" }, { value: "date_asc", label: "Più vecchi" }, { value: "priority", label: "Priorità" }].map(o => (
            <Chip key={o.value} active={g.filters.sortBy === o.value} onClick={() => g.setSortBy(o.value)}>{o.label}</Chip>
          ))}
        </ChipGroup>
      </FilterSection>
    </>
  );
}
