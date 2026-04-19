import { Search, ArrowUpDown, Filter, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { FilterSection, ChipGroup, Chip } from "./shared";

const SORT_FIELDS: Array<{ value: "name" | "city" | "contacts"; label: string }> = [
  { value: "name", label: "Nome" },
  { value: "city", label: "Città" },
  { value: "contacts", label: "Contatti" },
];

export function CampaignsFiltersSection() {
  const g = useGlobalFilters();

  const toggleSort = (field: "name" | "city" | "contacts") => {
    if (g.filters.campaignsSortField === field) {
      g.setFilter("campaignsSortAsc", !g.filters.campaignsSortAsc);
    } else {
      g.setFilter("campaignsSortField", field);
      g.setFilter("campaignsSortAsc", field !== "contacts");
    }
  };

  return (
    <>
      <FilterSection icon={Search} label="Cerca">
        <Input
          value={g.filters.campaignsSearch}
          onChange={(e) => g.setFilter("campaignsSearch", e.target.value)}
          placeholder="Nome, città, email..."
          className="h-8 text-xs bg-muted/30 border-border/40"
        />
      </FilterSection>

      <FilterSection icon={ArrowUpDown} label="Ordina">
        <ChipGroup>
          {SORT_FIELDS.map((f) => (
            <Chip
              key={f.value}
              active={g.filters.campaignsSortField === f.value}
              onClick={() => toggleSort(f.value)}
            >
              {f.label}
              {g.filters.campaignsSortField === f.value && (g.filters.campaignsSortAsc ? " ↑" : " ↓")}
            </Chip>
          ))}
        </ChipGroup>
      </FilterSection>

      <FilterSection icon={Filter} label="Tipo partner">
        <Input
          value={g.filters.campaignsTypeFilter === "all" ? "" : g.filters.campaignsTypeFilter}
          onChange={(e) => g.setFilter("campaignsTypeFilter", e.target.value || "all")}
          placeholder="es. freight_forwarder (vuoto = tutti)"
          className="h-8 text-xs bg-muted/30 border-border/40"
        />
      </FilterSection>

      <FilterSection icon={Sparkles} label="Filtro AI">
        <Input
          value={g.filters.campaignsAiQuery}
          onChange={(e) => g.setFilter("campaignsAiQuery", e.target.value)}
          placeholder="es. 'iata pharma'..."
          className="h-8 text-xs bg-card border-emerald-500/40 placeholder:text-emerald-400/40 focus-visible:ring-emerald-500/40"
        />
      </FilterSection>
    </>
  );
}
