import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Star,
  ChevronDown,
  Filter,
  X,
  Check,
  ChevronsUpDown,
} from "lucide-react";
import { PartnerFilters } from "@/hooks/usePartners";
import { getCountryFlag } from "@/lib/countries";
import { formatPartnerType, formatServiceCategory } from "@/lib/countries";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const PARTNER_TYPES = [
  { value: "freight_forwarder", label: "Freight Forwarder" },
  { value: "customs_broker", label: "Customs Broker" },
  { value: "carrier", label: "Carrier" },
  { value: "nvocc", label: "NVOCC" },
  { value: "3pl", label: "3PL" },
  { value: "courier", label: "Courier" },
];

const SERVICES = [
  "air_freight", "ocean_fcl", "ocean_lcl", "road_freight", "rail_freight",
  "project_cargo", "dangerous_goods", "perishables", "pharma", "ecommerce",
  "relocations", "customs_broker", "warehousing", "nvocc",
];

interface CountryOption {
  code: string;
  name: string;
  flag: string;
  count: number;
}

interface PartnerFiltersSheetProps {
  filters: PartnerFilters;
  setFilters: React.Dispatch<React.SetStateAction<PartnerFilters>>;
  countries: CountryOption[];
  activeFilterCount: number;
}

export default function PartnerFiltersSheet({
  filters,
  setFilters,
  countries,
  activeFilterCount,
}: PartnerFiltersSheetProps) {
  const [countryOpen, setCountryOpen] = useState(false);

  const sortedCountries = useMemo(
    () => [...countries].sort((a, b) => a.name.localeCompare(b.name)),
    [countries]
  );

  const selectedCountry = sortedCountries.find(
    (c) => c.code === filters.countries?.[0]
  );

  const handleTypeFilter = (type: string, checked: boolean) => {
    setFilters((prev) => ({
      ...prev,
      partnerTypes: checked
        ? [...(prev.partnerTypes || []), type]
        : (prev.partnerTypes || []).filter((t) => t !== type),
    }));
  };

  const handleServiceFilter = (service: string, checked: boolean) => {
    setFilters((prev) => ({
      ...prev,
      services: checked
        ? [...(prev.services || []), service]
        : (prev.services || []).filter((s) => s !== service),
    }));
  };

  const clearFilters = () => setFilters({});

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <Filter className="w-4 h-4" />
          {activeFilterCount > 0 && (
            <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-[10px] bg-primary text-primary-foreground">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-80 overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle>Filtri</SheetTitle>
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="w-4 h-4 mr-1" />
                Pulisci
              </Button>
            )}
          </div>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Country combobox */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Paese</label>
            <Popover open={countryOpen} onOpenChange={setCountryOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between"
                >
                  {selectedCountry
                    ? `${selectedCountry.flag} ${selectedCountry.name}`
                    : "Tutti i paesi"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-0 z-[60]">
                <Command>
                  <CommandInput placeholder="Cerca paese..." />
                  <CommandList>
                    <CommandEmpty>Nessun paese trovato</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        onSelect={() => {
                          setFilters((prev) => ({ ...prev, countries: undefined }));
                          setCountryOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            !filters.countries ? "opacity-100" : "opacity-0"
                          )}
                        />
                        Tutti i paesi
                      </CommandItem>
                      {sortedCountries.map((c) => (
                        <CommandItem
                          key={c.code}
                          onSelect={() => {
                            setFilters((prev) => ({
                              ...prev,
                              countries: [c.code],
                            }));
                            setCountryOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              filters.countries?.[0] === c.code
                                ? "opacity-100"
                                : "opacity-0"
                            )}
                          />
                          {c.flag} {c.name} ({c.count})
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Favorites */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="favorites"
              checked={filters.favorites || false}
              onCheckedChange={(checked) =>
                setFilters((prev) => ({ ...prev, favorites: checked === true }))
              }
            />
            <Label htmlFor="favorites" className="flex items-center gap-1 cursor-pointer">
              <Star className="w-4 h-4 text-amber-500" />
              Solo preferiti
            </Label>
          </div>

          {/* Partner Type */}
          <Collapsible defaultOpen>
            <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-medium">
              Tipo Partner
              <ChevronDown className="w-4 h-4" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 space-y-2">
              {PARTNER_TYPES.map((type) => (
                <div key={type.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`sheet-${type.value}`}
                    checked={(filters.partnerTypes || []).includes(type.value)}
                    onCheckedChange={(checked) =>
                      handleTypeFilter(type.value, checked === true)
                    }
                  />
                  <Label htmlFor={`sheet-${type.value}`} className="text-sm cursor-pointer">
                    {type.label}
                  </Label>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>

          {/* Services */}
          <Collapsible defaultOpen>
            <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-medium">
              Servizi
              <ChevronDown className="w-4 h-4" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 space-y-2 max-h-48 overflow-y-auto">
              {SERVICES.map((service) => (
                <div key={service} className="flex items-center space-x-2">
                  <Checkbox
                    id={`sheet-${service}`}
                    checked={(filters.services || []).includes(service)}
                    onCheckedChange={(checked) =>
                      handleServiceFilter(service, checked === true)
                    }
                  />
                  <Label htmlFor={`sheet-${service}`} className="text-sm cursor-pointer">
                    {formatServiceCategory(service)}
                  </Label>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        </div>
      </SheetContent>
    </Sheet>
  );
}
