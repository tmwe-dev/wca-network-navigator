import { Search, Filter, EyeOff, ArrowUpDown, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { FilterSection, ChipGroup, Chip } from "./shared";

const VOLUME_OPTIONS = [
  { value: "all", label: "Tutti" },
  { value: "2", label: ">2" },
  { value: "5", label: ">5" },
  { value: "10", label: ">10" },
  { value: "50", label: ">50" },
];

const SORT_OPTIONS = [
  { value: "name-asc", label: "A-Z", icon: null },
  { value: "count-desc", label: "N. email", icon: null },
  { value: "ai_group", label: "AI smart", icon: Sparkles },
];

export function EmailIntelligenceFiltersSection() {
  const g = useGlobalFilters();
  return (
    <>
      <FilterSection icon={Search} label="Cerca mittente">
        <Input
          value={g.filters.emailIntelSearch}
          onChange={(e) => g.setFilter("emailIntelSearch", e.target.value)}
          placeholder="Email o azienda…"
          className="h-8 text-xs bg-muted/30 border-border/40"
        />
      </FilterSection>
      <FilterSection icon={Filter} label="Volume minimo email">
        <ChipGroup>
          {VOLUME_OPTIONS.map((o) => (
            <Chip
              key={o.value}
              active={g.filters.emailIntelVolume === o.value}
              onClick={() => g.setFilter("emailIntelVolume", o.value)}
            >
              {o.label}
            </Chip>
          ))}
        </ChipGroup>
      </FilterSection>
      <FilterSection icon={ArrowUpDown} label="Ordina">
        <ChipGroup>
          {SORT_OPTIONS.map((o) => {
            const Icon = o.icon;
            return (
              <Chip
                key={o.value}
                active={g.filters.emailIntelSort === o.value}
                onClick={() => g.setFilter("emailIntelSort", o.value)}
              >
                {Icon ? <Icon className="h-3 w-3 mr-1 inline" /> : null}
                {o.label}
              </Chip>
            );
          })}
        </ChipGroup>
      </FilterSection>
      <FilterSection icon={EyeOff} label="Visualizzazione">
        <div className="flex items-center justify-between gap-2 px-1 py-1">
          <Label htmlFor="hide-classified-drawer" className="text-xs text-foreground cursor-pointer">
            Nascondi mittenti già classificati
          </Label>
          <Switch
            id="hide-classified-drawer"
            checked={g.filters.emailIntelHideClassified}
            onCheckedChange={(v) => g.setFilter("emailIntelHideClassified", v)}
          />
        </div>
      </FilterSection>
    </>
  );
}