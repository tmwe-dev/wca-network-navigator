import { Search, ListTodo, Zap, ArrowUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { FilterSection, ChipGroup, Chip } from "./shared";
import { ATTIVITA_PRIORITY } from "./constants";

const AGENDA_TYPES = [
  { value: "all", label: "Tutti" },
  { value: "reminder", label: "Promemoria" },
  { value: "activity", label: "Attività" },
  { value: "followup", label: "Follow-up" },
];

const AGENDA_SORT = [
  { value: "date_desc", label: "Più recenti" },
  { value: "date_asc", label: "Più vecchi" },
  { value: "priority", label: "Priorità" },
];

export function AgendaFiltersSection() {
  const g = useGlobalFilters();

  return (
    <>
      <FilterSection icon={Search} label="Cerca">
        <Input value={g.filters.search} onChange={e => g.setSearch(e.target.value)} placeholder="Cerca attività, evento..." className="h-8 text-xs bg-muted/30 border-border/40" />
      </FilterSection>
      <FilterSection icon={ListTodo} label="Tipo">
        <ChipGroup>
          {AGENDA_TYPES.map(o => (
            <Chip key={o.value} active={g.filters.agendaType === o.value} onClick={() => g.setAgendaType(o.value)}>{o.label}</Chip>
          ))}
        </ChipGroup>
      </FilterSection>
      <FilterSection icon={Zap} label="Priorità">
        <ChipGroup>{ATTIVITA_PRIORITY.map(o => <Chip key={o.value} active={g.filters.agendaPriority === o.value} onClick={() => g.setAgendaPriority(o.value)}>{o.label}</Chip>)}</ChipGroup>
      </FilterSection>
      <FilterSection icon={ArrowUpDown} label="Ordina">
        <ChipGroup>
          {AGENDA_SORT.map(o => (
            <Chip key={o.value} active={g.filters.sortBy === o.value} onClick={() => g.setSortBy(o.value)}>{o.label}</Chip>
          ))}
        </ChipGroup>
      </FilterSection>
    </>
  );
}
