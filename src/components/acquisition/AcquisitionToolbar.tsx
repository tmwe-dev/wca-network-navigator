import { useState } from "react";
import { Check, ChevronDown, Wifi, WifiOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { getCountryFlag } from "@/lib/countries";
import { WCA_COUNTRIES } from "@/data/wcaCountries";
import { WCA_NETWORKS } from "@/data/wcaFilters";
import { useWcaSessionStatus } from "@/hooks/useWcaSessionStatus";

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
  const [countryOpen, setCountryOpen] = useState(false);
  const [networkOpen, setNetworkOpen] = useState(false);
  const { status: wcaStatus } = useWcaSessionStatus();

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
    <div className="space-y-3">
      {/* Row 1: Country + Network selectors + WCA status */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Country selector */}
        <Popover open={countryOpen} onOpenChange={setCountryOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2 min-w-[180px] justify-between">
              <span className="truncate">
                {selectedCountries.length === 0
                  ? "Seleziona Paesi"
                  : `${selectedCountries.length} paes${selectedCountries.length === 1 ? "e" : "i"}`}
              </span>
              <ChevronDown className="w-4 h-4 opacity-50" />
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
            <Button variant="outline" className="gap-2 min-w-[200px] justify-between">
              <span className="truncate">
                {selectedNetworks.length === 0
                  ? "Tutti i Network"
                  : `${selectedNetworks.length} network`}
              </span>
              <ChevronDown className="w-4 h-4 opacity-50" />
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

        {/* WCA Status */}
        <div
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border",
            wcaStatus === "ok"
              ? "border-emerald-500/30 text-emerald-500 bg-emerald-500/10"
              : wcaStatus === "expired" || wcaStatus === "no_cookie"
                ? "border-destructive/30 text-destructive bg-destructive/10"
                : "border-border text-muted-foreground"
          )}
        >
          {wcaStatus === "ok" ? (
            <Wifi className="w-3.5 h-3.5" />
          ) : (
            <WifiOff className="w-3.5 h-3.5" />
          )}
          {wcaStatus === "ok" ? "WCA Connesso" : wcaStatus === "expired" ? "Sessione Scaduta" : "Non connesso"}
        </div>

        {/* Pipeline options */}
        <div className="flex items-center gap-4 ml-auto">
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <Switch checked={includeEnrich} onCheckedChange={onIncludeEnrichChange} />
            Arricchimento Sito
          </label>
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <Switch checked={includeDeepSearch} onCheckedChange={onIncludeDeepSearchChange} />
            Deep Search
          </label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Velocità: {delaySeconds}s</span>
            <Slider
              value={[delaySeconds]}
              onValueChange={([v]) => onDelayChange(v)}
              min={0}
              max={60}
              step={5}
              className="w-24"
            />
          </div>
        </div>
      </div>

      {/* Row 2: Selected country chips */}
      {selectedCountries.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedCountries.map((code) => {
            const country = WCA_COUNTRIES.find((c) => c.code === code);
            return (
              <Badge
                key={code}
                variant="secondary"
                className="gap-1 cursor-pointer hover:bg-destructive/20 transition-colors"
                onClick={() => toggleCountry(code)}
              >
                {getCountryFlag(code)} {country?.name || code}
                <X className="w-3 h-3" />
              </Badge>
            );
          })}
          {selectedCountries.length > 1 && (
            <Badge
              variant="outline"
              className="cursor-pointer hover:bg-destructive/20"
              onClick={() => onCountriesChange([])}
            >
              Rimuovi tutti
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
