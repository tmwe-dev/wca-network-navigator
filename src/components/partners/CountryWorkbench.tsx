import { useState, useMemo, useCallback } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { getCountryFlag } from "@/lib/countries";
import { cn } from "@/lib/utils";
import { WCA_COUNTRIES } from "@/data/wcaCountries";
import {
  ArrowLeft, CheckSquare, MapPin,
  Send, Star, X, User, Search, Trophy,
  ChevronUp, ChevronDown, Users,
} from "lucide-react";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import { MiniStars } from "@/components/partners/shared/MiniStars";
import { getServiceIcon, TRANSPORT_SERVICES, SPECIALTY_SERVICES } from "@/components/partners/shared/ServiceIcons";
import { getYearsMember, formatServiceCategory } from "@/lib/countries";
import { getRealLogoUrl, asEnrichment } from "@/lib/partnerUtils";

/* ── Helpers ── */
const hasDeepSearch = (p: any) => !!asEnrichment(p.enrichment_data)?.deep_search_at;
const hasRating3Plus = (p: any) => (p.rating || 0) >= 3;
const hasService = (p: any, svc: string) =>
  (p.partner_services || []).some((s: any) => s.service_category === svc);

type GenericFilter = "deep_search" | "rating_3";
type SortField = "name" | "city" | "rating" | "years";
type SortDir = "asc" | "desc";

const GENERIC_FILTER_FNS: Record<GenericFilter, (p: any) => boolean> = {
  deep_search: hasDeepSearch,
  rating_3: hasRating3Plus,
};

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
  const [activeGenericFilters, setActiveGenericFilters] = useState<Set<GenericFilter>>(new Set());
  const [activeServiceFilters, setActiveServiceFilters] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const toggleGenericFilter = useCallback((tag: GenericFilter) => {
    setActiveGenericFilters((prev) => {
      const next = new Set(prev);
      next.has(tag) ? next.delete(tag) : next.add(tag);
      return next;
    });
  }, []);

  const toggleServiceFilter = useCallback((svc: string) => {
    setActiveServiceFilters((prev) => {
      const next = new Set(prev);
      next.has(svc) ? next.delete(svc) : next.add(svc);
      return next;
    });
  }, []);

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "name" || field === "city" ? "asc" : "desc");
    }
  }, [sortField]);

  const countryName = WCA_COUNTRIES.find((c) => c.code === countryCode)?.name || countryCode;
  const flag = getCountryFlag(countryCode);

  const countryPartners = useMemo(
    () => (partners || []).filter((p: any) => p.country_code === countryCode),
    [partners, countryCode]
  );

  // Which services exist in this country
  const availableServices = useMemo(() => {
    return ALL_SERVICES.filter((svc) =>
      countryPartners.some((p) => hasService(p, svc))
    );
  }, [countryPartners]);

  // Apply search + generic filters + service filters (AND)
  const filteredPartners = useMemo(() => {
    let list = countryPartners;
    if (searchTerm) list = list.filter((p) => (p.company_name || "").toLowerCase().includes(searchTerm.toLowerCase()));
    for (const tag of activeGenericFilters) list = list.filter(GENERIC_FILTER_FNS[tag]);
    for (const svc of activeServiceFilters) list = list.filter((p) => hasService(p, svc));
    return [...list].sort((a, b) => sortFns[sortField](a, b, sortDir));
  }, [countryPartners, activeGenericFilters, activeServiceFilters, searchTerm, sortField, sortDir]);

  // Dynamic counts for generic filters
  const genericCounts = useMemo(() => {
    const base = (() => {
      let list = countryPartners;
      if (searchTerm) list = list.filter((p) => (p.company_name || "").toLowerCase().includes(searchTerm.toLowerCase()));
      for (const svc of activeServiceFilters) list = list.filter((p) => hasService(p, svc));
      return list;
    })();
    return {
      deep_search: base.filter((p) => !activeGenericFilters.has("deep_search") || true).filter(hasDeepSearch).length,
      rating_3: base.filter((p) => !activeGenericFilters.has("rating_3") || true).filter(hasRating3Plus).length,
    };
  }, [countryPartners, activeGenericFilters, activeServiceFilters, searchTerm]);

  // Dynamic counts for service filters
  const serviceCounts = useMemo(() => {
    // Base: search + generic filters applied, but exclude current service from service filters
    let base = countryPartners;
    if (searchTerm) base = base.filter((p) => (p.company_name || "").toLowerCase().includes(searchTerm.toLowerCase()));
    for (const tag of activeGenericFilters) base = base.filter(GENERIC_FILTER_FNS[tag]);

    const counts: Record<string, number> = {};
    for (const svc of availableServices) {
      let list = base;
      for (const activeSvc of activeServiceFilters) {
        if (activeSvc === svc) continue;
        list = list.filter((p) => hasService(p, activeSvc));
      }
      counts[svc] = list.filter((p) => hasService(p, svc)).length;
    }
    return counts;
  }, [countryPartners, activeGenericFilters, activeServiceFilters, availableServices, searchTerm]);

  const allSelected = filteredPartners.length > 0 && filteredPartners.every((p: any) => selectedIds.has(p.id));

  const handleSelectAll = useCallback(() => {
    onSelectAllFiltered(allSelected ? [] : filteredPartners.map((p: any) => p.id));
  }, [allSelected, filteredPartners, onSelectAllFiltered]);

  const hasAnyFilter = activeGenericFilters.size > 0 || activeServiceFilters.size > 0;

  const clearAllFilters = useCallback(() => {
    setActiveGenericFilters(new Set());
    setActiveServiceFilters(new Set());
  }, []);

  const sortButtons: { field: SortField; icon: typeof User; label: string }[] = [
    { field: "name", icon: User, label: "Nome" },
    { field: "city", icon: MapPin, label: "Città" },
    { field: "rating", icon: Star, label: "Rating" },
    { field: "years", icon: Trophy, label: "Anni" },
  ];

  const genericChips: { key: GenericFilter; icon: typeof Send; activeColor: string; iconColor: string; count: number }[] = [
    { key: "deep_search", icon: Send, activeColor: "bg-sky-500/25 border-sky-500/60", iconColor: "text-sky-400", count: genericCounts.deep_search },
    { key: "rating_3", icon: Star, activeColor: "bg-amber-500/25 border-amber-500/60", iconColor: "text-amber-400", count: genericCounts.rating_3 },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* ═══ HEADER ═══ */}
      <div className="px-4 py-3 border-b border-border/60 bg-card/30">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-2xl">{flag}</span>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold leading-tight truncate">{countryName}</h2>
          </div>
          <span className="text-lg font-bold text-foreground tabular-nums bg-muted/60 px-3 py-0.5 rounded-lg">
            {countryPartners.length}
          </span>
        </div>
      </div>

      {/* ═══ SEARCH ═══ */}
      <div className="px-4 py-2 border-b border-border/40">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cerca partner..."
            className="h-8 pl-8 text-xs bg-muted/50 border-border/60"
          />
        </div>
      </div>

      {/* ═══ SORT + GENERIC FILTERS ═══ */}
      <div className="px-4 py-2 border-b border-border/40 flex items-center gap-3">
        {/* Sort icons */}
        <div className="flex items-center gap-0.5">
          {sortButtons.map((s) => {
            const Icon = s.icon;
            const isActive = sortField === s.field;
            const DirIcon = sortDir === "asc" ? ChevronUp : ChevronDown;
            return (
              <Tooltip key={s.field}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleSort(s.field)}
                    className={cn(
                      "relative p-1.5 rounded-md transition-all",
                      isActive
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                    )}
                  >
                    <Icon className="w-4 h-4" strokeWidth={isActive ? 2.2 : 1.6} />
                    {isActive && (
                      <DirIcon className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 text-primary" strokeWidth={2.5} />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">{s.label}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        <div className="w-px h-5 bg-border/60" />

        {/* Generic filter chips */}
        <div className="flex items-center gap-1">
          {genericChips.map((f) => {
            const Icon = f.icon;
            const isActive = activeGenericFilters.has(f.key);
            return (
              <Tooltip key={f.key}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => toggleGenericFilter(f.key)}
                    className={cn(
                      "flex items-center gap-1 px-2 py-1.5 rounded-full border transition-all text-[11px] font-bold tabular-nums",
                      isActive
                        ? cn(f.activeColor, f.iconColor)
                        : "bg-muted/60 border-border/60 text-foreground/80 hover:bg-accent/50"
                    )}
                  >
                    <Icon className={cn("w-4 h-4", isActive ? "" : f.iconColor)} strokeWidth={1.8} />
                    <span>{f.count}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  {f.key === "deep_search" && "Deep Search"}
                  {f.key === "rating_3" && "Rating ≥ 3"}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>

      {/* ═══ SERVICE FILTERS ═══ */}
      {availableServices.length > 0 && (
        <div className="px-4 py-2 border-b border-border/40 flex items-center gap-1 flex-wrap">
          {availableServices.map((svc) => {
            const Icon = getServiceIcon(svc);
            const isActive = activeServiceFilters.has(svc);
            const count = serviceCounts[svc] || 0;
            return (
              <Tooltip key={svc}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => toggleServiceFilter(svc)}
                    className={cn(
                      "flex items-center gap-1 px-2 py-1.5 rounded-full border transition-all text-[11px] font-bold tabular-nums",
                      isActive
                        ? "bg-primary/20 border-primary/60 text-primary"
                        : "bg-muted/60 border-border/60 text-foreground/80 hover:bg-accent/50"
                    )}
                  >
                    <Icon className={cn("w-3.5 h-3.5", isActive ? "text-primary" : "text-sky-400/80")} strokeWidth={1.8} />
                    <span>{count}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">{formatServiceCategory(svc)}</TooltipContent>
              </Tooltip>
            );
          })}
          {hasAnyFilter && (
            <button onClick={clearAllFilters}
              className="p-1.5 rounded-full text-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-all ml-1">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* ═══ LIST HEADER ═══ */}
      <div className="px-4 py-1.5 flex items-center justify-between border-b border-border/30">
        <span className="text-[11px] text-muted-foreground font-medium">
          <span className="font-bold text-foreground">{filteredPartners.length}</span>
          {(hasAnyFilter || searchTerm) && <span> / {countryPartners.length}</span>}
          {" "}partner
        </span>
        <button onClick={handleSelectAll}
          className={cn(
            "flex items-center gap-1 text-[11px] px-2 py-1 rounded-full transition-all font-medium",
            allSelected
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
          )}>
          <CheckSquare className="w-3 h-3" />
          {allSelected ? "Deseleziona" : "Sel. tutti"}
        </button>
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

            return (
              <div key={partner.id} onClick={() => onSelectPartner(partner.id)}
                className={cn(
                  "mx-2 mb-1 px-3 py-3 cursor-pointer transition-all rounded-xl flex items-start gap-2",
                  "hover:bg-accent/40",
                  selectedId === partner.id && "bg-accent/60 shadow-sm",
                  isSelected && "bg-primary/[0.06] ring-1 ring-primary/20",
                )}>
                {/* Progressive number */}
                <span className="text-[10px] text-muted-foreground/60 font-mono w-5 shrink-0 text-right mt-2.5">
                  {index + 1}
                </span>

                {/* Checkbox */}
                <div onClick={(e) => { e.stopPropagation(); onToggleSelection(partner.id); }} className="shrink-0 mt-1.5">
                  <Checkbox checked={isSelected} className="data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
                </div>

                {/* Logo */}
                <div className="w-9 h-9 shrink-0 mt-0.5 rounded-lg overflow-hidden bg-muted/30 border border-border/40 flex items-center justify-center">
                  {getRealLogoUrl(partner.logo_url) ? (
                    <img src={getRealLogoUrl(partner.logo_url)!} alt="" className="w-full h-full object-contain p-0.5" />
                  ) : (
                    <span className="text-lg opacity-50">{flag}</span>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 space-y-1">
                  {/* Row 1: Name + Years badge */}
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[13px] font-semibold truncate leading-tight text-foreground">{partner.company_name}</p>
                    {years > 0 && (
                      <span className="flex items-center gap-0.5 shrink-0 text-amber-400">
                        <Trophy className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                        <span className="text-[11px] font-bold">{years}</span>
                      </span>
                    )}
                  </div>

                  {/* Row 2: Rating */}
                  {partner.rating > 0 && (
                    <div className="flex items-center gap-1.5">
                      <MiniStars rating={Number(partner.rating)} />
                      <span className="text-[11px] font-medium text-amber-400">{Number(partner.rating).toFixed(1)}</span>
                    </div>
                  )}

                  {/* Row 3: Contact name only */}
                  {primaryContact ? (
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <User className="w-3 h-3 text-muted-foreground shrink-0" />
                      <span className="font-medium text-foreground truncate">{primaryContact.contact_alias || primaryContact.name}</span>
                      {extraContacts > 0 && (
                        <span className="flex items-center gap-0.5 text-[10px] text-foreground/60">
                          <Users className="w-3 h-3" />
                          <span>+{extraContacts}</span>
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-[10px] italic text-destructive/80">Nessun contatto</span>
                  )}

                  {/* Separator + Services + Networks */}
                  {(allServices.length > 0 || networks.length > 0) && (
                    <>
                      <div className="border-t border-border/30 pt-1" />
                      {/* Services row — ALL icons */}
                      {allServices.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {allServices.map((s: any, i: number) => {
                            const Icon = getServiceIcon(s.service_category);
                            return (
                              <Tooltip key={i}>
                                <TooltipTrigger>
                                  <Icon className="w-3.5 h-3.5 text-sky-400/80" strokeWidth={1.5} />
                                </TooltipTrigger>
                                <TooltipContent>{formatServiceCategory(s.service_category)}</TooltipContent>
                              </Tooltip>
                            );
                          })}
                        </div>
                      )}
                      {/* Networks row — ALL names */}
                      {networks.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {networks.map((n: any) => (
                            <span key={n.id} className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 font-medium truncate max-w-[100px]">
                              {n.network_name.replace("WCA ", "")}
                            </span>
                          ))}
                        </div>
                      )}
                    </>
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
