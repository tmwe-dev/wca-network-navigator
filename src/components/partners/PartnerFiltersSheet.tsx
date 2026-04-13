import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem,
} from "@/components/ui/command";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Star, ChevronDown, Filter, X, Check, ChevronsUpDown, Globe, Network, ShieldCheck, Building2, Trophy, CalendarClock, Handshake } from "lucide-react";
import { PartnerFilters } from "@/hooks/usePartners";
import { formatServiceCategory } from "@/lib/countries";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { getServiceIcon, TRANSPORT_SERVICES, SPECIALTY_SERVICES } from "@/components/partners/shared/ServiceIcons";

const PARTNER_TYPES = [
  { value: "freight_forwarder", label: "Freight Forwarder" },
  { value: "customs_broker", label: "Customs Broker" },
  { value: "carrier", label: "Carrier" },
  { value: "nvocc", label: "NVOCC" },
  { value: "3pl", label: "3PL" },
  { value: "courier", label: "Courier" },
];

const SERVICES = [
  ...TRANSPORT_SERVICES,
  ...SPECIALTY_SERVICES,
];

const WCA_NETWORKS = [
  "WCA Inter Global", "WCA First", "WCA Advanced Professionals", "WCA China Global",
  "WCA Projects", "WCA Dangerous Goods", "WCA Perishables", "WCA Time Critical",
  "WCA Pharma", "WCA eCommerce", "WCA eCommerce Solutions", "WCA Relocations",
  "WCA Live Events & Expo", "Global Affinity Alliance", "Lognet Global",
  "Infinite Connection", "Elite Global Logistics Network",
];

const CERTIFICATIONS = ["IATA", "ISO", "AEO", "C-TPAT", "BASC"] as const;

const EXPIRATION_OPTIONS = [
  { value: "3", label: "Scade entro 3 mesi" },
  { value: "6", label: "Scade entro 6 mesi" },
  { value: "12", label: "Scade entro 1 anno" },
  { value: "active", label: "Attiva (non scaduta)" },
];

interface CountryOption { code: string; name: string; flag: string; count: number; }

interface PartnerFiltersSheetProps {
  filters: PartnerFilters;
  setFilters: React.Dispatch<React.SetStateAction<PartnerFilters>>;
  countries: CountryOption[];
  activeFilterCount: number;
}

/* ── Chip toggle for service/network/cert filters ── */
function FilterChip({ active, icon: Icon, label, onClick, color = "sky" }: {
  active: boolean;
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  color?: "sky" | "violet" | "emerald" | "amber" | "rose";
}) {
  const colors: Record<string, string> = {
    sky: active ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground",
    violet: active ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground",
    emerald: active ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500" : "border-border text-muted-foreground",
    amber: active ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground",
    rose: active ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground",
  };
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-all hover:shadow-sm",
        colors[color],
      )}
    >
      <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
      <span>{label}</span>
    </button>
  );
}

export default function PartnerFiltersSheet({
  filters, setFilters, countries, activeFilterCount,
}: PartnerFiltersSheetProps) {
  const [countryOpen, setCountryOpen] = useState(false);

  const sortedCountries = useMemo(
    () => [...countries].sort((a, b) => a.name.localeCompare(b.name)),
    [countries],
  );
  const selectedCountries = sortedCountries.filter((c) => filters.countries?.includes(c.code));

  const handleCountryToggle = (code: string) => {
    setFilters((prev) => {
      const current = prev.countries || [];
      const next = current.includes(code) ? current.filter((c) => c !== code) : [...current, code];
      return { ...prev, countries: next.length > 0 ? next : undefined };
    });
  };

  const toggle = (field: "partnerTypes" | "services" | "networks" | "certifications", value: string) => {
    setFilters((prev) => {
      const current = (prev[field] || []) as string[];
      const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
      return { ...prev, [field]: next.length > 0 ? next : undefined };
    });
  };

  const clearFilters = () => setFilters({});

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="relative" aria-label="Filtra">
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
                <X className="w-4 h-4 mr-1" /> Pulisci
              </Button>
            )}
          </div>
        </SheetHeader>

        <div className="space-y-5 mt-6">
          {/* ── Countries ── */}
          <Collapsible defaultOpen>
            <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-medium">
              <span className="flex items-center gap-2"><Globe className="w-4 h-4 text-primary" strokeWidth={1.5} /> Paesi</span>
              <ChevronDown className="w-4 h-4" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              {selectedCountries.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {selectedCountries.map((c) => (
                    <Badge key={c.code} variant="secondary" className="text-xs gap-1 cursor-pointer" onClick={() => handleCountryToggle(c.code)}>
                      {c.flag} {c.name} <X className="w-3 h-3" />
                    </Badge>
                  ))}
                </div>
              )}
              <Popover open={countryOpen} onOpenChange={setCountryOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between text-sm">
                    {selectedCountries.length > 0 ? `${selectedCountries.length} selezionati` : "Tutti i paesi"}
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

          {/* ── Quick Filters (favorites, met personally) ── */}
          <div className="space-y-2">
            <FilterChip
              active={filters.favorites || false}
              icon={Star}
              label="Solo preferiti"
              onClick={() => setFilters((p) => ({ ...p, favorites: !p.favorites || undefined }))}
              color="amber"
            />
            <FilterChip
              active={filters.metPersonally || false}
              icon={Handshake}
              label="Incontrati personalmente"
              onClick={() => setFilters((p) => ({ ...p, metPersonally: !p.metPersonally || undefined }))}
              color="emerald"
            />
          </div>

          {/* ── Rating ── */}
          <Collapsible>
            <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-medium">
              <span className="flex items-center gap-2"><Star className="w-4 h-4 text-primary" strokeWidth={1.5} /> Rating minimo</span>
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

          {/* ── Partner Type ── */}
          <Collapsible defaultOpen>
            <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-medium">
              <span className="flex items-center gap-2"><Building2 className="w-4 h-4 text-primary" strokeWidth={1.5} /> Tipo Partner</span>
              <ChevronDown className="w-4 h-4" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <div className="flex flex-wrap gap-1.5">
                {PARTNER_TYPES.map((type) => (
                  <FilterChip
                    key={type.value}
                    active={(filters.partnerTypes || []).includes(type.value)}
                    icon={Building2}
                    label={type.label}
                    onClick={() => toggle("partnerTypes", type.value)}
                    color="sky"
                  />
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* ── Transport Services ── */}
          <Collapsible defaultOpen>
            <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-medium">
              <span className="flex items-center gap-2 text-primary">✈️ Trasporto</span>
              <ChevronDown className="w-4 h-4" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <div className="flex flex-wrap gap-1.5">
                {TRANSPORT_SERVICES.map((service) => {
                  const Icon = getServiceIcon(service);
                  return (
                    <FilterChip
                      key={service}
                      active={(filters.services || []).includes(service)}
                      icon={Icon}
                      label={formatServiceCategory(service)}
                      onClick={() => toggle("services", service)}
                      color="sky"
                    />
                  );
                })}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* ── Specialty Services ── */}
          <Collapsible defaultOpen>
            <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-medium">
              <span className="flex items-center gap-2 text-primary">⚡ Specialità</span>
              <ChevronDown className="w-4 h-4" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <div className="flex flex-wrap gap-1.5">
                {SPECIALTY_SERVICES.map((service) => {
                  const Icon = getServiceIcon(service);
                  return (
                    <FilterChip
                      key={service}
                      active={(filters.services || []).includes(service)}
                      icon={Icon}
                      label={formatServiceCategory(service)}
                      onClick={() => toggle("services", service)}
                      color="violet"
                    />
                  );
                })}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* ── WCA Networks ── */}
          <Collapsible>
            <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-medium">
              <span className="flex items-center gap-2"><Network className="w-4 h-4 text-primary" strokeWidth={1.5} /> Network WCA</span>
              <ChevronDown className="w-4 h-4" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <div className="flex flex-wrap gap-1.5 max-h-56 overflow-y-auto">
                {WCA_NETWORKS.map((network) => (
                  <FilterChip
                    key={network}
                    active={(filters.networks || []).includes(network)}
                    icon={Globe}
                    label={network.replace("WCA ", "")}
                    onClick={() => toggle("networks", network)}
                    color="emerald"
                  />
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* ── Certifications ── */}
          <Collapsible>
            <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-medium">
              <span className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-500" strokeWidth={1.5} /> Certificazioni</span>
              <ChevronDown className="w-4 h-4" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <div className="flex flex-wrap gap-1.5">
                {CERTIFICATIONS.map((cert) => (
                  <FilterChip
                    key={cert}
                    active={(filters.certifications || []).includes(cert)}
                    icon={ShieldCheck}
                    label={cert}
                    onClick={() => toggle("certifications", cert)}
                    color="emerald"
                  />
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* ── Min Years WCA ── */}
          <Collapsible>
            <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-medium">
              <span className="flex items-center gap-2"><Trophy className="w-4 h-4 text-primary" strokeWidth={1.5} /> Anni in WCA</span>
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
            </CollapsibleContent>
          </Collapsible>

          {/* ── Expiration ── */}
          <Collapsible>
            <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-medium">
              <span className="flex items-center gap-2"><CalendarClock className="w-4 h-4 text-primary" strokeWidth={1.5} /> Scadenza WCA</span>
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
              <Building2 className="w-4 h-4 text-primary" strokeWidth={1.5} /> Ha filiali
            </Label>
            <Switch
              id="has-branches"
              checked={filters.hasBranches || false}
              onCheckedChange={(checked) => setFilters((p) => ({ ...p, hasBranches: checked || undefined }))}
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
