import { Search, ArrowUpDown, Database, Filter, Wifi, Sparkles, Plane } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useGlobalFilters, type CockpitChannelFilter, type CockpitQualityFilter } from "@/contexts/GlobalFiltersContext";
import { FilterSection, ChipGroup, Chip } from "./shared";
import { COCKPIT_SORT, COCKPIT_ORIGIN, COCKPIT_CHANNEL, COCKPIT_QUALITY, COCKPIT_STATUS } from "./constants";

interface CockpitFiltersSectionProps {
  countryStats: Array<{ code: string; count: number; flag: string }>;
  toggleOrigin: (val: string) => void;
  toggleCockpitCountry: (code: string) => void;
  toggleCockpitChannel: (key: CockpitChannelFilter) => void;
  toggleCockpitQuality: (key: CockpitQualityFilter) => void;
}

export function CockpitFiltersSection({
  countryStats, toggleOrigin, toggleCockpitCountry, toggleCockpitChannel, toggleCockpitQuality,
}: CockpitFiltersSectionProps) {
  const g = useGlobalFilters();

  return (
    <>
      <FilterSection icon={Search} label="Cerca">
        <Input value={g.filters.search} onChange={e => g.setSearch(e.target.value)} placeholder="Cerca contatto, azienda..." className="h-8 text-xs bg-muted/30 border-border/40" />
      </FilterSection>
      <FilterSection icon={ArrowUpDown} label="Ordina">
        <ChipGroup>{COCKPIT_SORT.map(o => <Chip key={o.value} active={g.filters.sortBy === o.value} onClick={() => g.setSortBy(o.value)}>{o.label}</Chip>)}</ChipGroup>
      </FilterSection>
      <FilterSection icon={Database} label="Origine">
        <ChipGroup>{COCKPIT_ORIGIN.map(o => <Chip key={o.value} active={g.filters.origin.has(o.value)} onClick={() => toggleOrigin(o.value)}>{o.label}</Chip>)}</ChipGroup>
      </FilterSection>
      {countryStats.length > 0 && (
        <FilterSection icon={Filter} label="Paese">
          <div className="flex flex-wrap gap-1 max-h-[120px] overflow-y-auto">
            {countryStats.slice(0, 24).map(({ code, count, flag }) => (
              <Chip key={code} active={g.filters.cockpitCountries.has(code)} onClick={() => toggleCockpitCountry(code)}>
                {flag} {code} <Badge variant="secondary" className="text-[8px] h-3 px-1 ml-0.5">{count}</Badge>
              </Chip>
            ))}
          </div>
        </FilterSection>
      )}
      <FilterSection icon={Wifi} label="Canale">
        <ChipGroup>{COCKPIT_CHANNEL.map(o => <Chip key={o.key} active={g.filters.cockpitChannels.has(o.key)} onClick={() => toggleCockpitChannel(o.key)}>{o.icon} {o.label}</Chip>)}</ChipGroup>
      </FilterSection>
      <FilterSection icon={Sparkles} label="Qualità">
        <ChipGroup>{COCKPIT_QUALITY.map(o => <Chip key={o.key} active={g.filters.cockpitQuality.has(o.key)} onClick={() => toggleCockpitQuality(o.key)}>{o.label}</Chip>)}</ChipGroup>
      </FilterSection>
      <FilterSection icon={Plane} label="Stato lead">
        <ChipGroup>{COCKPIT_STATUS.map(o => <Chip key={o.value} active={g.filters.cockpitStatus === o.value} onClick={() => g.setCockpitStatus(o.value)}>{o.label}</Chip>)}</ChipGroup>
      </FilterSection>
    </>
  );
}
