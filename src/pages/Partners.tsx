import { useState } from "react";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Search,
  Star,
  StarOff,
  Phone,
  Mail,
  Globe,
  ChevronDown,
  Filter,
  X,
  Building2,
  MapPin,
} from "lucide-react";
import { usePartners, useToggleFavorite, PartnerFilters } from "@/hooks/usePartners";
import {
  getCountryFlag,
  getYearsMember,
  formatPartnerType,
  formatServiceCategory,
  getServiceColor,
} from "@/lib/countries";
import { cn } from "@/lib/utils";

const PARTNER_TYPES = [
  { value: "freight_forwarder", label: "Freight Forwarder" },
  { value: "customs_broker", label: "Customs Broker" },
  { value: "carrier", label: "Carrier" },
  { value: "nvocc", label: "NVOCC" },
  { value: "3pl", label: "3PL" },
  { value: "courier", label: "Courier" },
];

const SERVICES = [
  "air_freight",
  "ocean_fcl",
  "ocean_lcl",
  "road_freight",
  "rail_freight",
  "project_cargo",
  "dangerous_goods",
  "perishables",
  "pharma",
  "ecommerce",
  "relocations",
  "customs_broker",
  "warehousing",
  "nvocc",
];

export default function Partners() {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<PartnerFilters>({});
  const [showFilters, setShowFilters] = useState(true);

  const { data: allPartners } = usePartners({});
  const { data: partners, isLoading } = usePartners({
    search: search.length >= 2 ? search : undefined,
    ...filters,
  });
  const toggleFavorite = useToggleFavorite();

  // Compute unique countries from all partners
  const uniqueCountries = (() => {
    if (!allPartners) return [];
    const map = new Map<string, { code: string; name: string; flag: string; count: number }>();
    for (const p of allPartners) {
      const existing = map.get(p.country_code);
      if (existing) {
        existing.count++;
      } else {
        map.set(p.country_code, {
          code: p.country_code,
          name: p.country_name,
          flag: getCountryFlag(p.country_code),
          count: 1,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  })();

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

  const clearFilters = () => {
    setFilters({});
    setSearch("");
  };

  const hasActiveFilters =
    (filters.partnerTypes?.length || 0) > 0 ||
    (filters.services?.length || 0) > 0 ||
    filters.favorites;

  return (
    <div className="flex gap-6">
      {/* Filters sidebar */}
      <aside
        className={cn(
          "w-72 flex-shrink-0 transition-all duration-300",
          showFilters ? "opacity-100" : "w-0 opacity-0 overflow-hidden"
        )}
      >
        <Card>
          <CardContent className="p-4 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Filtri</h2>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="w-4 h-4 mr-1" />
                  Pulisci
                </Button>
              )}
            </div>

            {/* Country filter */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">Paese</label>
              <Select
                value={filters.countries?.[0] || "all"}
                onValueChange={(v) =>
                  setFilters((prev) => ({
                    ...prev,
                    countries: v === "all" ? undefined : [v],
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tutti i paesi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti i paesi</SelectItem>
                  {uniqueCountries.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.flag} {c.name} ({c.count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                Favorites only
              </Label>
            </div>

            {/* Partner Type */}
            <Collapsible defaultOpen>
              <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-medium">
                Partner Type
                <ChevronDown className="w-4 h-4" />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3 space-y-2">
                {PARTNER_TYPES.map((type) => (
                  <div key={type.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={type.value}
                      checked={(filters.partnerTypes || []).includes(type.value)}
                      onCheckedChange={(checked) =>
                        handleTypeFilter(type.value, checked === true)
                      }
                    />
                    <Label htmlFor={type.value} className="text-sm cursor-pointer">
                      {type.label}
                    </Label>
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>

            {/* Services */}
            <Collapsible defaultOpen>
              <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-medium">
                Services
                <ChevronDown className="w-4 h-4" />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3 space-y-2 max-h-48 overflow-y-auto">
                {SERVICES.map((service) => (
                  <div key={service} className="flex items-center space-x-2">
                    <Checkbox
                      id={service}
                      checked={(filters.services || []).includes(service)}
                      onCheckedChange={(checked) =>
                        handleServiceFilter(service, checked === true)
                      }
                    />
                    <Label htmlFor={service} className="text-sm cursor-pointer">
                      {formatServiceCategory(service)}
                    </Label>
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>
      </aside>

      {/* Main content */}
      <div className="flex-1 space-y-4">
        {/* Search bar */}
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowFilters(!showFilters)}
            className={cn(showFilters && "bg-primary text-primary-foreground")}
          >
            <Filter className="w-4 h-4" />
          </Button>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search partners by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Results count */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {isLoading ? "Loading..." : `${partners?.length || 0} partners found`}
          </p>
        </div>

        {/* Partner cards */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <Skeleton className="w-12 h-12 rounded-lg" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-5 w-48" />
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            : partners?.map((partner) => (
                <Card
                  key={partner.id}
                  className="group hover:shadow-card-hover transition-all"
                >
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      {/* Flag */}
                      <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 text-3xl">
                        {getCountryFlag(partner.country_code)}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <Link
                            to={`/partners/${partner.id}`}
                            className="font-semibold hover:text-primary transition-colors truncate"
                          >
                            {partner.company_name}
                          </Link>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 -mr-2 -mt-1"
                            onClick={() =>
                              toggleFavorite.mutate({
                                id: partner.id,
                                isFavorite: !partner.is_favorite,
                              })
                            }
                          >
                            {partner.is_favorite ? (
                              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                            ) : (
                              <StarOff className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            )}
                          </Button>
                        </div>

                        <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                          <MapPin className="w-3.5 h-3.5" />
                          <span className="truncate">
                            {partner.city}, {partner.country_name}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="secondary" className="text-xs">
                            {formatPartnerType(partner.partner_type)}
                          </Badge>
                          {partner.member_since && (
                            <Badge variant="outline" className="text-xs">
                              {getYearsMember(partner.member_since)} yrs
                            </Badge>
                          )}
                        </div>

                        {/* Services */}
                        {partner.partner_services && partner.partner_services.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-3">
                            {partner.partner_services.slice(0, 3).map((s: any, i: number) => (
                              <span
                                key={i}
                                className={cn(
                                  "text-[10px] px-1.5 py-0.5 rounded font-medium",
                                  getServiceColor(s.service_category)
                                )}
                              >
                                {formatServiceCategory(s.service_category)}
                              </span>
                            ))}
                            {partner.partner_services.length > 3 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                                +{partner.partner_services.length - 3}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Quick actions */}
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                          {partner.phone && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              asChild
                            >
                              <a href={`tel:${partner.phone}`}>
                                <Phone className="w-3 h-3 mr-1" />
                                Call
                              </a>
                            </Button>
                          )}
                          {partner.email && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              asChild
                            >
                              <a href={`mailto:${partner.email}`}>
                                <Mail className="w-3 h-3 mr-1" />
                                Email
                              </a>
                            </Button>
                          )}
                          {partner.website && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              asChild
                            >
                              <a
                                href={`https://${partner.website.replace(/^https?:\/\//, "")}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <Globe className="w-3 h-3 mr-1" />
                                Web
                              </a>
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
        </div>
      </div>
    </div>
  );
}
