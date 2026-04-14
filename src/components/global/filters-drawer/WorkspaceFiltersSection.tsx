import { Search, Mail, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useGlobalFilters, type WorkspaceFilterKey } from "@/contexts/GlobalFiltersContext";
import { FilterSection, ChipGroup, Chip } from "./shared";
import { EMAIL_GEN, WS_CHIPS } from "./constants";

interface WorkspaceFiltersSectionProps {
  toggleWs: (key: WorkspaceFilterKey) => void;
}

export function WorkspaceFiltersSection({ toggleWs }: WorkspaceFiltersSectionProps) {
  const g = useGlobalFilters();

  return (
    <>
      <FilterSection icon={Search} label="Cerca">
        <Input value={g.filters.search} onChange={e => g.setSearch(e.target.value)} placeholder="Cerca..." className="h-8 text-xs bg-muted/30 border-border/40" />
      </FilterSection>
      <FilterSection icon={Mail} label="Stato email">
        <ChipGroup>{EMAIL_GEN.map(o => <Chip key={o.key} active={g.filters.emailGenFilter === o.key} onClick={() => g.setEmailGenFilter(o.key)}>{o.label}</Chip>)}</ChipGroup>
      </FilterSection>
      <FilterSection icon={Users} label="Contatti">
        <ChipGroup>{WS_CHIPS.map(o => <Chip key={o.key} active={g.filters.workspaceFilters.has(o.key)} onClick={() => toggleWs(o.key)}>{o.label}</Chip>)}</ChipGroup>
      </FilterSection>
    </>
  );
}
