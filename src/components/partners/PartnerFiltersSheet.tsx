import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Star,
  ChevronDown,
  Filter,
  X,
  Check,
  ChevronsUpDown,
  Globe,
  Network,
  ShieldCheck,
  Clock,
  Building2,
  Trophy,
  CalendarClock,
  Package,
} from "lucide-react";
import { PartnerFilters } from "@/hooks/usePartners";
import { getCountryFlag } from "@/lib/countries";
import { formatServiceCategory } from "@/lib/countries";
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

const WCA_NETWORKS = [
  "WCA Inter Global",
  "WCA First",
  "WCA Advanced Professionals",
  "WCA China Global",
  "WCA Projects",
  "WCA Dangerous Goods",
  "WCA Perishables",
  "WCA Time Critical",
  "WCA Pharma",
  "WCA eCommerce",
  "WCA eCommerce Solutions",
  "WCA Relocations",
  "WCA Live Events & Expo",
  "Global Affinity Alliance",
  "Lognet Global",
  "Infinite Connection",
  "Elite Global Logistics Network",
];

const CERTIFICATIONS = ["IATA", "ISO", "AEO", "C-TPAT", "BASC"] as const;

const EXPIRATION_OPTIONS = [
  { value: "3", label: "Scade entro 3 mesi" },
  { value: "6", label: "Scade entro 6 mesi" },
  { value: "12", label: "Scade entro 1 anno" },
  { value: "active", label: "Attiva (non scaduta)" },
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

  const selectedCountries = sortedCountries.filter(
    (c) => filters.countries?.includes(c.code)
  );

  const handleCountryToggle = (code: string) => {
    setFilters((prev) => {
      const current = prev.countries || [];
      const next = current.includes(code)
        ? current.filter((c) => c !== code)
        : [...current, code];
      return { ...prev, countries: next.length > 0 ? next : undefined };
    });
  };

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

  const handleNetworkFilter = (network: string, checked: boolean) => {
    setFilters((prev) => ({
      ...prev,
      networks: checked
        ? [...(prev.networks || []), network]
        : (prev.networks || []).filter((n) => n !== network),
    }));
  };

  const handleCertFilter = (cert: string, checked: boolean) => {
    setFilters((prev) => ({
      ...prev,
      certifications: checked
        ? [...(prev.certifications || []), cert]
        : (prev.certifications || []).filter((c) => c !== cert),
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
            <SheetTitle>Filtri Avanzati</SheetTitle>
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="w-4 h-4 mr-1" />
                Pulisci
              </Button>
            )}
          </div>
        </SheetHeader>

        <div className="space-y-5 mt-6">
          {/* ── Countries (multi-select) ── */}
          <Collapsible defaultOpen>
            <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-medium">
              <span className="flex items-center gap-2"><Globe className="w-4 h-4 text-primary" /> Paesi</span>
              <ChevronDown className="w-4 h-4" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              {selectedCountries.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {selectedCountries.map((c) => (
                    <Badge key={c.code} variant="secondary" className="text-xs gap-1 cursor-pointer" onClick={() => handleCountryToggle(c.code)}>
                      {c.flag} {c.name}
                      <X className="w-3 h-3" />
                    </Badge>
                  ))}
                </div>
              )}
              <Popover open={countryOpen} onOpenChange={setCountryOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between text-sm">
                    {selectedCountries.length > 0
                      ? `${selectedCountries.length} selezionati`
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
                        {sortedCountries.map((c) => (
                          <CommandItem key={c.code} onSelect={() => handleCountryToggle(c.code)}>
                            <Check className={cn("mr-2 h-4 w-4", filters.countries?.includes(c.code) ? "opacity-100" : "opacity-0")} />
                            {c.flag} {c.name} ({c.count})
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </CollapsibleContent>
          </Collapsible>

          {/* ── Favorites ── */}
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

          {/* ── Partner Type ── */}
          <Collapsible defaultOpen>
            <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-medium">
              <span className="flex items-center gap-2"><Building2 className="w-4 h-4 text-primary" /> Tipo Partner</span>
              <ChevronDown className="w-4 h-4" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 space-y-2">
              {PARTNER_TYPES.map((type) => (
                <div key={type.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`sheet-${type.value}`}
                    checked={(filters.partnerTypes || []).includes(type.value)}
                    onCheckedChange={(checked) => handleTypeFilter(type.value, checked === true)}
                  />
                  <Label htmlFor={`sheet-${type.value}`} className="text-sm cursor-pointer">{type.label}</Label>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>

          {/* ── Services ── */}
          <Collapsible defaultOpen>
            <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-medium">
              <span className="flex items-center gap-2"><Package className="w-4 h-4 text-primary" /> Servizi</span>
              <ChevronDown className="w-4 h-4" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 space-y-2 max-h-48 overflow-y-auto">
              {SERVICES.map((service) => (
                <div key={service} className="flex items-center space-x-2">
                  <Checkbox
                    id={`sheet-${service}`}
                    checked={(filters.services || []).includes(service)}
                    onCheckedChange={(checked) => handleServiceFilter(service, checked === true)}
                  />
                  <Label htmlFor={`sheet-${service}`} className="text-sm cursor-pointer">{formatServiceCategory(service)}</Label>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>

          {/* ── WCA Networks ── */}
          <Collapsible>
            <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-medium">
              <span className="flex items-center gap-2"><Network className="w-4 h-4 text-primary" /> Network WCA</span>
              <ChevronDown className="w-4 h-4" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 space-y-2 max-h-56 overflow-y-auto">
              {WCA_NETWORKS.map((network) => (
                <div key={network} className="flex items-center space-x-2">
                  <Checkbox
                    id={`net-${network}`}
                    checked={(filters.networks || []).includes(network)}
                    onCheckedChange={(checked) => handleNetworkFilter(network, checked === true)}
                  />
                  <Label htmlFor={`net-${network}`} className="text-sm cursor-pointer">{network}</Label>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>

          {/* ── Certifications ── */}
          <Collapsible>
            <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-medium">
              <span className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-primary" /> Certificazioni</span>
              <ChevronDown className="w-4 h-4" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 space-y-2">
              {CERTIFICATIONS.map((cert) => (
                <div key={cert} className="flex items-center space-x-2">
                  <Checkbox
                    id={`cert-${cert}`}
                    checked={(filters.certifications || []).includes(cert)}
                    onCheckedChange={(checked) => handleCertFilter(cert, checked === true)}
                  />
                  <Label htmlFor={`cert-${cert}`} className="text-sm cursor-pointer">{cert}</Label>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>

          {/* ── Min Rating ── */}
          <Collapsible>
            <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-medium">
              <span className="flex items-center gap-2"><Star className="w-4 h-4 text-primary" /> Rating minimo</span>
              <ChevronDown className="w-4 h-4" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Min: {filters.minRating ?? 0} stelle</span>
                {(filters.minRating ?? 0) > 0 && (
                  <Button variant="ghost" size="sm" className="h-5 text-xs px-1" onClick={() => setFilters((p) => ({ ...p, minRating: undefined }))}>Reset</Button>
                )}
              </div>
              <Slider
                value={[filters.minRating ?? 0]}
                onValueChange={([v]) => setFilters((p) => ({ ...p, minRating: v > 0 ? v : undefined }))}
                min={0} max={5} step={0.5}
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>0</span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* ── Min Years WCA ── */}
          <Collapsible>
            <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-medium">
              <span className="flex items-center gap-2"><Trophy className="w-4 h-4 text-primary" /> Anni in WCA</span>
              <ChevronDown className="w-4 h-4" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Min: {filters.minYearsMember ?? 0} anni</span>
                {(filters.minYearsMember ?? 0) > 0 && (
                  <Button variant="ghost" size="sm" className="h-5 text-xs px-1" onClick={() => setFilters((p) => ({ ...p, minYearsMember: undefined }))}>Reset</Button>
                )}
              </div>
              <Slider
                value={[filters.minYearsMember ?? 0]}
                onValueChange={([v]) => setFilters((p) => ({ ...p, minYearsMember: v > 0 ? v : undefined }))}
                min={0} max={30} step={1}
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>0</span><span>5</span><span>10</span><span>15</span><span>20</span><span>25</span><span>30</span>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* ── Expiration ── */}
          <Collapsible>
            <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-medium">
              <span className="flex items-center gap-2"><CalendarClock className="w-4 h-4 text-primary" /> Scadenza WCA</span>
              <ChevronDown className="w-4 h-4" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <Select
                value={filters.expiresWithinMonths?.toString() || ""}
                onValueChange={(v) => setFilters((p) => ({
                  ...p,
                  expiresWithinMonths: v ? (v === "active" ? v as any : parseInt(v)) : undefined,
                }))}
              >
                <SelectTrigger className="w-full text-sm">
                  <SelectValue placeholder="Qualsiasi scadenza" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Qualsiasi</SelectItem>
                  {EXPIRATION_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CollapsibleContent>
          </Collapsible>

          {/* ── Has Branches ── */}
          <div className="flex items-center justify-between">
            <Label htmlFor="has-branches" className="flex items-center gap-2 cursor-pointer text-sm font-medium">
              <Building2 className="w-4 h-4 text-primary" />
              Ha filiali
            </Label>
            <Switch
              id="has-branches"
              checked={filters.hasBranches || false}
              onCheckedChange={(checked) =>
                setFilters((p) => ({ ...p, hasBranches: checked || undefined }))
              }
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
