import { useState, useMemo, useCallback } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { getCountryFlag } from "@/lib/countries";
import { cn } from "@/lib/utils";
import { WCA_COUNTRIES } from "@/data/wcaCountries";
import {
  ArrowLeft, CheckSquare, MapPin,
  Star, X, User, Search, Trophy,
  ChevronUp, ChevronDown, Globe,
} from "lucide-react";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { MiniStars } from "@/components/partners/shared/MiniStars";
import { getServiceIcon, TRANSPORT_SERVICES, SPECIALTY_SERVICES } from "@/components/partners/shared/ServiceIcons";
import { getYearsMember, formatServiceCategory } from "@/lib/countries";
import { getRealLogoUrl, asEnrichment, getBranchCountries } from "@/lib/partnerUtils";

/* ── Helpers ── */
const hasService = (p: any, svc: string) =>
  (p.partner_services || []).some((s: any) => s.service_category === svc);

type SortField = "name" | "city" | "rating" | "years";
type SortDir = "asc" | "desc";
type SortEntry = { field: SortField; dir: SortDir };

const ALL_SERVICES = [...TRANSPORT_SERVICES, ...SPECIALTY_SERVICES];

const sortFns: Record<SortField, (a: any, b: any, dir: SortDir) => number> = {
  name: (a, b, dir) => {
    const cmp = (a.company_name || "").localeCompare(b.company_name || "");
    return dir === "asc" ? cmp : -cmp;
  },
  city: (a, b, dir) => {
    const cmp = (a.city || "").localeCompare(b.city || "");
    return dir === "asc" ? cmp : -cmp;
  },
  rating: (a, b, dir) => {
    const cmp = (a.rating || 0) - (b.rating || 0);
    return dir === "asc" ? cmp : -cmp;
  },
  years: (a, b, dir) => {
    const cmp = getYearsMember(a.member_since) - getYearsMember(b.member_since);
    return dir === "asc" ? cmp : -cmp;
  },
};

const DEFAULT_DIRS: Record<SortField, SortDir> = {
  name: "asc",
  city: "asc",
  rating: "desc",
  years: "desc",
};

interface CountryWorkbenchProps {
  countryCode: string;
  partners: any[];
  onBack: () => void;
  onSelectPartner: (id: string) => void;
  selectedId: string | null;
  selectedIds: Set<string>;
  onToggleSelection: (id: string) => void;
  onSelectAllFiltered: (ids: string[]) => void;
}

export function CountryWorkbench({
  countryCode, partners, onBack, onSelectPartner,
  selectedId, selectedIds, onToggleSelection, onSelectAllFiltered,
}: CountryWorkbenchProps) {
  const [sortStack, setSortStack] = useState<SortEntry[]>([{ field: "name", dir: "asc" }]);
  const [activeServiceFilters, setActiveServiceFilters] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [networkFilter, setNetworkFilter] = useState<string | null>(null);
  const [branchCountryFilter, setBranchCountryFilter] = useState<string | null>(null);

  const handleSortToggle = useCallback((field: SortField) => {
    setSortStack((prev) => {
      const idx = prev.findIndex((s) => s.field === field);
      if (idx === -1) {
        // Add with default dir
        return [...prev, { field, dir: DEFAULT_DIRS[field] }];
      }
      const entry = prev[idx];
      if (entry.dir === "asc") {
        // asc → desc
        const next = [...prev];
        next[idx] = { field, dir: "desc" };
        return next;
      }
      if (entry.dir === "desc") {
        // desc → asc (for name/city) or remove (for rating/years that default desc)
        if (DEFAULT_DIRS[field] === "desc") {
          // default was desc, went desc→remove? No: desc is first state for these.
          // Flow: off → desc (blue-ish) → asc (red) → off
          const next = [...prev];
          next[idx] = { field, dir: "asc" };
          return next;
        }
        // default was asc: asc→desc→off
        return prev.filter((_, i) => i !== idx);
      }
      return prev;
    });
  }, []);

  // For fields with default=desc, the cycle is: off→desc→asc→off
  // For fields with default=asc, the cycle is: off→asc→desc→off
  // Generalize: off → defaultDir → oppositeDir → off
  const handleSortToggleGeneral = useCallback((field: SortField) => {
    setSortStack((prev) => {
      const idx = prev.findIndex((s) => s.field === field);
      const defaultDir = DEFAULT_DIRS[field];
      const oppositeDir: SortDir = defaultDir === "asc" ? "desc" : "asc";

      if (idx === -1) {
        return [...prev, { field, dir: defaultDir }];
      }
      const entry = prev[idx];
      if (entry.dir === defaultDir) {
        const next = [...prev];
        next[idx] = { field, dir: oppositeDir };
        return next;
      }
      // opposite → remove
      return prev.filter((_, i) => i !== idx);
    });
  }, []);

  const toggleServiceFilter = useCallback((svc: string) => {
    setActiveServiceFilters((prev) => {
      const next = new Set(prev);
      next.has(svc) ? next.delete(svc) : next.add(svc);
      return next;
    });
  }, []);

  const countryName = WCA_COUNTRIES.find((c) => c.code === countryCode)?.name || countryCode;
  const flag = getCountryFlag(countryCode);

  const countryPartners = useMemo(
    () => (partners || []).filter((p: any) => p.country_code === countryCode),
    [partners, countryCode]
  );

  const availableServices = useMemo(() => {
    return ALL_SERVICES.filter((svc) =>
      countryPartners.some((p) => hasService(p, svc))
    );
  }, [countryPartners]);

  const VALID_NETWORKS = useMemo(() => new Set([
    "WCA Inter Global", "WCA First", "WCA Advanced Professionals",
    "WCA China Global", "WCA Projects", "WCA Dangerous Goods",
    "WCA Perishables", "WCA Time Critical", "WCA Pharma",
    "WCA eCommerce", "WCA eCommerce Solutions", "WCA Relocations",
    "WCA Live Events & Expo", "Global Affinity Alliance",
    "Lognet Global", "Infinite Connection",
    "Elite Global Logistics Network",
  ]), []);

  const availableNetworks = useMemo(() => {
    const names = new Set<string>();
    countryPartners.forEach((p) => {
      (p.partner_networks || []).forEach((n: any) => {
        if (VALID_NETWORKS.has(n.network_name)) names.add(n.network_name);
      });
    });
    return Array.from(names).sort();
  }, [countryPartners, VALID_NETWORKS]);

  const availableBranchCountries = useMemo(() => {
    const map = new Map<string, string>();
    countryPartners.forEach((p) => {
      getBranchCountries(p).forEach((b) => map.set(b.code, b.name));
    });
    return Array.from(map.entries())
      .map(([code, name]) => ({ code, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [countryPartners]);

  const filteredPartners = useMemo(() => {
    let list = countryPartners;
    if (searchTerm) list = list.filter((p) => (p.company_name || "").toLowerCase().includes(searchTerm.toLowerCase()));
    for (const svc of activeServiceFilters) list = list.filter((p) => hasService(p, svc));
    if (networkFilter) list = list.filter((p) =>
      (p.partner_networks || []).some((n: any) => n.network_name === networkFilter));
    if (branchCountryFilter) list = list.filter((p) =>
      getBranchCountries(p).some((b) => b.code === branchCountryFilter));
    // Multi-sort
    return [...list].sort((a, b) => {
      for (const { field, dir } of sortStack) {
        const result = sortFns[field](a, b, dir);
        if (result !== 0) return result;
      }
      return 0;
    });
  }, [countryPartners, activeServiceFilters, searchTerm, sortStack, networkFilter, branchCountryFilter]);

  const allSelected = filteredPartners.length > 0 && filteredPartners.every((p: any) => selectedIds.has(p.id));

  const handleSelectAll = useCallback(() => {
    onSelectAllFiltered(allSelected ? [] : filteredPartners.map((p: any) => p.id));
  }, [allSelected, filteredPartners, onSelectAllFiltered]);

  const hasAnyFilter = activeServiceFilters.size > 0 || !!networkFilter || !!branchCountryFilter;

  const clearAllFilters = useCallback(() => {
    setActiveServiceFilters(new Set());
    setNetworkFilter(null);
    setBranchCountryFilter(null);
  }, []);

  const sortButtons: { field: SortField; icon: typeof User; label: string }[] = [
    { field: "name", icon: User, label: "Nome" },
    { field: "city", icon: MapPin, label: "Città" },
    { field: "rating", icon: Star, label: "Rating" },
    { field: "years", icon: Trophy, label: "Anni" },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* ═══ HEADER ═══ */}
      <div className="px-4 py-2.5 border-b border-border/60 bg-card/30">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-2xl">{flag}</span>
          <h2 className="text-sm font-bold leading-tight truncate">{countryName}</h2>
          {availableNetworks.length > 0 && (
            <Select
              value={networkFilter || "__all__"}
              onValueChange={(v) => setNetworkFilter(v === "__all__" ? null : v)}
            >
              <SelectTrigger className="h-7 text-[11px] w-auto min-w-[100px] max-w-[160px] bg-muted/50 border-border/60">
                <SelectValue placeholder="Network" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__" className="text-xs">Tutti i network</SelectItem>
                {availableNetworks.map((n) => (
                  <SelectItem key={n} value={n} className="text-xs">{n.replace("WCA ", "")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <span className="ml-auto text-lg font-bold text-foreground tabular-nums bg-muted/60 px-3 py-0.5 rounded-lg">
            {(hasAnyFilter || searchTerm)
              ? <>{filteredPartners.length} <span className="text-muted-foreground font-normal text-sm">/ {countryPartners.length}</span></>
              : countryPartners.length}
          </span>
        </div>
      </div>

      {/* ═══ SORT + SERVICE ICONS ═══ */}
      <div className="px-4 py-2 border-b border-border/40 flex items-center gap-2 flex-wrap">
        {/* Multi-sort icons */}
        <div className="flex items-center gap-0.5">
          {sortButtons.map((s) => {
            const Icon = s.icon;
            const entry = sortStack.find((e) => e.field === s.field);
            const stackIndex = entry ? sortStack.indexOf(entry) : -1;
            const isActive = !!entry;
            const isAsc = entry?.dir === "asc";
            const DirIcon = isAsc ? ChevronUp : ChevronDown;
            // Blue for first-state (default dir), Red for opposite
            const isDefaultDir = entry?.dir === DEFAULT_DIRS[s.field];
            const colorClass = isActive
              ? isDefaultDir ? "text-primary" : "text-destructive"
              : "text-muted-foreground";
            const bgClass = isActive
              ? isDefaultDir ? "bg-primary/15" : "bg-destructive/15"
              : "hover:bg-accent/50";

            return (
              <Tooltip key={s.field}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleSortToggleGeneral(s.field)}
                    className={cn(
                      "relative p-1.5 rounded-md transition-all",
                      bgClass, colorClass,
                      !isActive && "hover:text-foreground"
                    )}
                  >
                    <Icon className="w-4 h-4" strokeWidth={isActive ? 2.2 : 1.6} />
                    {isActive && (
                      <>
                        <DirIcon className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5" strokeWidth={2.5} />
                        {sortStack.length > 1 && (
                          <span className="absolute -top-1 -left-1 w-3.5 h-3.5 rounded-full bg-background border border-current text-[8px] font-bold flex items-center justify-center">
                            {stackIndex + 1}
                          </span>
                        )}
                      </>
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">{s.label}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {availableServices.length > 0 && (
          <>
            <div className="w-px h-5 bg-border/60" />
            <div className="flex items-center gap-0.5">
              {availableServices.map((svc) => {
                const Icon = getServiceIcon(svc);
                const isActive = activeServiceFilters.has(svc);
                return (
                  <Tooltip key={svc}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => toggleServiceFilter(svc)}
                        className={cn(
                          "p-1.5 rounded-md border transition-all",
                          isActive
                            ? "bg-primary/20 border-primary/60 text-primary"
                            : "bg-transparent border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/50"
                        )}
                      >
                        <Icon className={cn("w-3.5 h-3.5", isActive ? "text-primary" : "text-muted-foreground")} strokeWidth={1.8} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">{formatServiceCategory(svc)}</TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </>
        )}

        {hasAnyFilter && (
          <button onClick={clearAllFilters}
            className="p-1.5 rounded-full text-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-all ml-auto">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* ═══ BRANCH FILTER (if available) ═══ */}
      {availableBranchCountries.length > 0 && (
        <div className="px-4 py-1.5 border-b border-border/40 flex items-center gap-2">
          <Select
            value={branchCountryFilter || "__all__"}
            onValueChange={(v) => setBranchCountryFilter(v === "__all__" ? null : v)}
          >
            <SelectTrigger className="h-7 text-[11px] w-auto min-w-[120px] max-w-[180px] bg-muted/50 border-border/60">
              <SelectValue placeholder="Filiali" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__" className="text-xs">Tutte le filiali</SelectItem>
              {availableBranchCountries.map((b) => (
                <SelectItem key={b.code} value={b.code} className="text-xs">
                  {getCountryFlag(b.code)} {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* ═══ SELECT ALL + SEARCH ═══ */}
      <div className="px-4 py-1.5 border-b border-border/30 flex items-center gap-3">
        <div className="flex items-center gap-2 pl-[2px] shrink-0">
          <Checkbox
            checked={allSelected}
            onCheckedChange={handleSelectAll}
            className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
          />
          <span className="text-[10px] text-muted-foreground select-none whitespace-nowrap">
            {allSelected ? "Deseleziona" : "Sel. tutti"}
          </span>
        </div>
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cerca partner..."
            className="h-7 pl-7 text-[11px] bg-muted/50 border-border/60"
          />
        </div>
      </div>

      {/* ═══ PARTNER LIST ═══ */}
      <ScrollArea className="flex-1">
        <div className="py-1">
          {filteredPartners.map((partner: any, index: number) => {
            const isSelected = selectedIds.has(partner.id);
            const years = getYearsMember(partner.member_since);
            const services = partner.partner_services || [];
            const allServices = [
              ...services.filter((s: any) => TRANSPORT_SERVICES.includes(s.service_category)),
              ...services.filter((s: any) => SPECIALTY_SERVICES.includes(s.service_category)),
            ];
            const networks = partner.partner_networks || [];
            const contacts = partner.partner_contacts || [];
            const primaryContact = contacts.find((c: any) => c.is_primary) || contacts[0];
            const extraContacts = contacts.length > 1 ? contacts.length - 1 : 0;
            const branches = getBranchCountries(partner);

            return (
              <div key={partner.id} onClick={() => onSelectPartner(partner.id)}
                className={cn(
                  "mx-2 mb-1 px-3 py-3 cursor-pointer transition-all rounded-xl flex items-start gap-2",
                  "hover:bg-accent/40",
                  selectedId === partner.id && "bg-accent/60 shadow-sm",
                  isSelected && "bg-primary/[0.06] ring-1 ring-primary/20",
                )}>
                {/* Left: number + checkbox */}
                <div className="flex flex-col items-center shrink-0 gap-0.5">
                  <span className="text-[10px] text-muted-foreground/60 font-mono">{index + 1}</span>
                  <div onClick={(e) => { e.stopPropagation(); onToggleSelection(partner.id); }}>
                    <Checkbox checked={isSelected} className="data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
                  </div>
                </div>

                {/* Logo standalone */}
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted/30 border border-border/40 flex items-center justify-center shrink-0 self-center">
                  {getRealLogoUrl(partner.logo_url) ? (
                    <img src={getRealLogoUrl(partner.logo_url)!} alt="" className="w-full h-full object-contain p-0.5" />
                  ) : (
                    <span className="text-2xl opacity-50">{flag}</span>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-[13px] font-semibold truncate leading-tight text-foreground">{partner.company_name}</p>

                  {primaryContact ? (
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <User className="w-3 h-3 text-muted-foreground shrink-0" />
                      <span className="font-medium text-foreground truncate">{primaryContact.contact_alias || primaryContact.name}</span>
                      {extraContacts > 0 && (
                        <span className="flex items-center gap-0.5 text-[10px] text-foreground/60">
                          +{extraContacts}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-[10px] italic text-destructive/80">Nessun contatto</span>
                  )}

                  {(allServices.length > 0 || branches.length > 0) && (
                    <>
                      <div className="border-t border-border/30 pt-1" />
                      {allServices.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap">
                          {allServices.map((s: any, i: number) => {
                            const Icon = getServiceIcon(s.service_category);
                            return (
                              <Tooltip key={i}>
                                <TooltipTrigger>
                                  <Icon className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.5} />
                                </TooltipTrigger>
                                <TooltipContent>{formatServiceCategory(s.service_category)}</TooltipContent>
                              </Tooltip>
                            );
                          })}
                        </div>
                      )}
                      {branches.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap">
                          {branches.map((b) => (
                            <Tooltip key={b.code}>
                              <TooltipTrigger>
                                <span className="text-sm leading-none">{getCountryFlag(b.code)}</span>
                              </TooltipTrigger>
                              <TooltipContent className="text-xs">{b.name}</TooltipContent>
                            </Tooltip>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Right column: Trophy → Flag+Network → Rating */}
                <div className="flex flex-col items-end gap-1.5 shrink-0 self-start pt-0.5">
                  {years > 0 && (
                    <span className="flex items-center gap-0.5 text-primary">
                      <Trophy className="w-3.5 h-3.5 fill-primary text-primary" />
                      <span className="text-[11px] font-bold">{years}</span>
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <span className="text-sm leading-none">{flag}</span>
                    {networks.length > 0 && (
                      <Tooltip>
                        <TooltipTrigger>
                          <span className="flex items-center gap-0.5 text-muted-foreground">
                            <Globe className="w-3 h-3" />
                            <span className="text-[10px] font-bold">{networks.length}</span>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="text-xs">
                          {networks.map((n: any) => n.network_name.replace("WCA ", "")).join(", ")}
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </span>
                  {partner.rating > 0 && (
                    <div className="flex items-center gap-1">
                      <MiniStars rating={Number(partner.rating)} size="w-2.5 h-2.5" />
                      <span className="text-[10px] font-bold text-primary">{Number(partner.rating).toFixed(1)}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
