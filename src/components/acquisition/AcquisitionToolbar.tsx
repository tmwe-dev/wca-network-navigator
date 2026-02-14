import { useState } from "react";
import { useScrapingSettings } from "@/hooks/useScrapingSettings";
import { Check, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { getCountryFlag } from "@/lib/countries";
import { WCA_COUNTRIES } from "@/data/wcaCountries";
import { WCA_NETWORKS } from "@/data/wcaFilters";

interface AcquisitionToolbarProps {
  selectedCountries: string[];
  onCountriesChange: (codes: string[]) => void;
  selectedNetworks: string[];
  onNetworksChange: (nets: string[]) => void;
  delaySeconds: number;
  onDelayChange: (v: number) => void;
  includeEnrich: boolean;
  onIncludeEnrichChange: (v: boolean) => void;
  includeDeepSearch: boolean;
  onIncludeDeepSearchChange: (v: boolean) => void;
}

export function AcquisitionToolbar({
  selectedCountries,
  onCountriesChange,
  selectedNetworks,
  onNetworksChange,
  delaySeconds,
  onDelayChange,
  includeEnrich,
  onIncludeEnrichChange,
  includeDeepSearch,
  onIncludeDeepSearchChange,
}: AcquisitionToolbarProps) {
  const { settings: scrapingSettings } = useScrapingSettings();
  const sliderMin = Math.max(scrapingSettings.baseDelay - scrapingSettings.variation, 10);
  const sliderMax = scrapingSettings.baseDelay + scrapingSettings.variation + 30;
  const [countryOpen, setCountryOpen] = useState(false);
  const [networkOpen, setNetworkOpen] = useState(false);

  const toggleCountry = (code: string) => {
    onCountriesChange(
      selectedCountries.includes(code)
        ? selectedCountries.filter((c) => c !== code)
        : [...selectedCountries, code]
    );
  };

  const toggleNetwork = (net: string) => {
    onNetworksChange(
      selectedNetworks.includes(net)
        ? selectedNetworks.filter((n) => n !== net)
        : [...selectedNetworks, net]
    );
  };

  return (
    <div className="space-y-2">
      {/* Selectors stacked */}
      <div className="flex flex-col gap-2">
        {/* Country selector */}
        <Popover open={countryOpen} onOpenChange={setCountryOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 w-full justify-between text-xs">
              <span className="truncate">
                {selectedCountries.length === 0
                  ? "Seleziona Paesi"
                  : `${selectedCountries.length} paes${selectedCountries.length === 1 ? "e" : "i"}`}
              </span>
              <ChevronDown className="w-3.5 h-3.5 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[280px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Cerca paese..." />
              <CommandList>
                <CommandEmpty>Nessun paese trovato</CommandEmpty>
                <CommandGroup>
                  {WCA_COUNTRIES.map((c) => (
                    <CommandItem
                      key={c.code}
                      value={`${c.name} ${c.code}`}
                      onSelect={() => toggleCountry(c.code)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedCountries.includes(c.code) ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span className="mr-2">{getCountryFlag(c.code)}</span>
                      {c.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Network selector */}
        <Popover open={networkOpen} onOpenChange={setNetworkOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 w-full justify-between text-xs">
              <span className="truncate">
                {selectedNetworks.length === 0
                  ? "Tutti i Network"
                  : `${selectedNetworks.length} network`}
              </span>
              <ChevronDown className="w-3.5 h-3.5 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Cerca network..." />
              <CommandList>
                <CommandEmpty>Nessun network trovato</CommandEmpty>
                <CommandGroup>
                  {WCA_NETWORKS.map((net) => (
                    <CommandItem
                      key={net}
                      value={net}
                      onSelect={() => toggleNetwork(net)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedNetworks.includes(net) ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {net}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* Selected country chips */}
      {selectedCountries.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedCountries.map((code) => {
            const country = WCA_COUNTRIES.find((c) => c.code === code);
            return (
              <Badge
                key={code}
                variant="secondary"
                className="gap-1 cursor-pointer hover:bg-destructive/20 transition-colors text-[10px] px-1.5 py-0.5"
                onClick={() => toggleCountry(code)}
              >
                {getCountryFlag(code)} {country?.name || code}
                <X className="w-2.5 h-2.5" />
              </Badge>
            );
          })}
          {selectedCountries.length > 1 && (
            <Badge
              variant="outline"
              className="cursor-pointer hover:bg-destructive/20 text-[10px] px-1.5 py-0.5"
              onClick={() => onCountriesChange([])}
            >
              Rimuovi tutti
            </Badge>
          )}
        </div>
      )}

      {/* Pipeline options compact */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer">
          <Switch checked={includeEnrich} onCheckedChange={onIncludeEnrichChange} className="scale-75" />
          Enrich
        </label>
        <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer">
          <Switch checked={includeDeepSearch} onCheckedChange={onIncludeDeepSearchChange} className="scale-75" />
          Deep Search
        </label>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground whitespace-nowrap">{delaySeconds}s</span>
          <Slider
            value={[delaySeconds]}
            onValueChange={([v]) => onDelayChange(v)}
            min={sliderMin}
            max={sliderMax}
            step={1}
            className="w-20"
          />
        </div>
      </div>
    </div>
  );
}
