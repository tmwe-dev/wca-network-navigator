import { useState, useMemo, useCallback } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { getCountryFlag } from "@/lib/countries";
import { cn } from "@/lib/utils";
import { WCA_COUNTRIES } from "@/data/wcaCountries";
import {
  ArrowLeft, Phone, Mail, CheckSquare, MapPin, Star, Linkedin,
} from "lucide-react";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import { MiniStars } from "@/components/partners/shared/MiniStars";
import { TrophyRow } from "@/components/partners/shared/TrophyRow";
import { getServiceIcon, TRANSPORT_SERVICES, SPECIALTY_SERVICES } from "@/components/partners/shared/ServiceIcons";
import { getNetworkLogo } from "@/components/partners/shared/NetworkLogos";
import { getYearsMember, formatServiceCategory, getServiceIconColor } from "@/lib/countries";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/* ── Helpers ── */
const hasPhone = (p: any) =>
  (p.partner_contacts || []).some((c: any) => c.mobile || c.direct_phone);
const hasEmail = (p: any) =>
  (p.partner_contacts || []).some((c: any) => c.email);
const hasDeepSearch = (p: any) => !!(p.enrichment_data as any)?.deep_search_at;
const hasServices = (p: any) => (p.partner_services || []).length > 0;
const hasRating3Plus = (p: any) => (p.rating || 0) >= 3;

type FilterTag = "with_phone" | "with_email" | "deep_search" | "rating_3" | "with_services";

const FILTER_FNS: Record<FilterTag, (p: any) => boolean> = {
  with_phone: hasPhone,
  with_email: hasEmail,
  deep_search: hasDeepSearch,
  rating_3: hasRating3Plus,
  with_services: hasServices,
};

/* ── Props ── */
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

/* ══════════════════════════════════════ */
/*           MAIN COMPONENT              */
/* ══════════════════════════════════════ */
export function CountryWorkbench({
  countryCode, partners, onBack, onSelectPartner,
  selectedId, selectedIds, onToggleSelection, onSelectAllFiltered,
}: CountryWorkbenchProps) {
  const [activeFilters, setActiveFilters] = useState<Set<FilterTag>>(new Set());

  const toggleFilter = useCallback((tag: FilterTag) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      next.has(tag) ? next.delete(tag) : next.add(tag);
      return next;
    });
  }, []);

  const countryName = WCA_COUNTRIES.find((c) => c.code === countryCode)?.name || countryCode;
  const flag = getCountryFlag(countryCode);

  const countryPartners = useMemo(
    () => (partners || []).filter((p: any) => p.country_code === countryCode),
    [partners, countryCode]
  );

  /* ── LinkedIn links for all country partners ── */
  const partnerIds = useMemo(() => countryPartners.map((p: any) => p.id), [countryPartners]);
  const { data: linkedinMap } = useQuery({
    queryKey: ["linkedin-links-hub", countryCode, partnerIds],
    queryFn: async () => {
      if (!partnerIds.length) return {} as Record<string, string>;
      const { data, error } = await supabase
        .from("partner_social_links")
        .select("partner_id, url")
        .eq("platform", "linkedin")
        .in("partner_id", partnerIds);
      if (error) throw error;
      const map: Record<string, string> = {};
      (data || []).forEach((r) => { map[r.partner_id] = r.url; });
      return map;
    },
    enabled: partnerIds.length > 0,
    staleTime: 30_000,
  });

  /* ── Dynamic filter counts ── */
  const dynamicCounts = useMemo(() => {
    const countFor = (excludeTag: FilterTag, predicate: (p: any) => boolean) => {
      let list = countryPartners;
      for (const tag of activeFilters) {
        if (tag === excludeTag) continue;
        list = list.filter(FILTER_FNS[tag]);
      }
      return list.filter(predicate).length;
    };
    return {
      with_phone: countFor("with_phone", hasPhone),
      with_email: countFor("with_email", hasEmail),
      deep_search: countFor("deep_search", hasDeepSearch),
      rating_3: countFor("rating_3", hasRating3Plus),
      with_services: countFor("with_services", hasServices),
    };
  }, [countryPartners, activeFilters]);

  const filteredPartners = useMemo(() => {
    let list = countryPartners;
    for (const tag of activeFilters) list = list.filter(FILTER_FNS[tag]);
    return list.sort((a: any, b: any) => (b.rating || 0) - (a.rating || 0) || a.company_name.localeCompare(b.company_name));
  }, [countryPartners, activeFilters]);

  const allSelected = filteredPartners.length > 0 && filteredPartners.every((p: any) => selectedIds.has(p.id));

  const handleSelectAll = useCallback(() => {
    onSelectAllFiltered(allSelected ? [] : filteredPartners.map((p: any) => p.id));
  }, [allSelected, filteredPartners, onSelectAllFiltered]);

  /* ── Filter chips config ── */
  const filterChips: { key: FilterTag; label: string; count: number }[] = [
    { key: "with_phone", label: "Con Tel", count: dynamicCounts.with_phone },
    { key: "with_email", label: "Con Email", count: dynamicCounts.with_email },
    { key: "deep_search", label: "Deep Search", count: dynamicCounts.deep_search },
    { key: "rating_3", label: "Rating 3+", count: dynamicCounts.rating_3 },
    { key: "with_services", label: "Con Servizi", count: dynamicCounts.with_services },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* ═══ HEADER ═══ */}
      <div className="px-3 py-2 border-b border-border/50">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-xl">{flag}</span>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold leading-tight truncate">{countryName}</h2>
            <p className="text-[10px] text-muted-foreground">{countryPartners.length} partner</p>
          </div>
        </div>
      </div>

      {/* ═══ FILTER CHIPS ═══ */}
      <div className="px-3 py-1.5 border-b border-border/50">
        <div className="flex flex-wrap items-center gap-1">
          {filterChips.map((f) => (
            <button key={f.key} onClick={() => toggleFilter(f.key)}
              className={cn("text-xs px-2 py-1 rounded-md border transition-all",
                activeFilters.has(f.key) ? "bg-primary/10 border-primary/30 text-primary font-medium" : "bg-muted border-border text-muted-foreground hover:bg-accent")}>
              {f.label} <span className="font-semibold ml-0.5">{f.count}</span>
            </button>
          ))}
          {activeFilters.size > 0 && (
            <button onClick={() => setActiveFilters(new Set())}
              className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground hover:bg-accent">
              Reset
            </button>
          )}
        </div>
      </div>

      {/* ═══ LIST HEADER ═══ */}
      <div className="px-4 py-2 flex items-center justify-between border-b border-border/50">
        <span className="text-xs text-muted-foreground">{filteredPartners.length} partner</span>
        <button onClick={handleSelectAll}
          className={cn("flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-all",
            allSelected ? "bg-primary/10 border-primary/30 text-primary" : "bg-muted border-border text-muted-foreground hover:bg-accent")}>
          <CheckSquare className="w-3 h-3" />
          {allSelected ? "Deseleziona" : "Sel. tutti"}
        </button>
      </div>

      {/* ═══ PARTNER LIST ═══ */}
      <ScrollArea className="flex-1">
        <div className="divide-y divide-border/50">
          {filteredPartners.map((partner: any) => {
            const isSelected = selectedIds.has(partner.id);
            const years = getYearsMember(partner.member_since);
            const services = partner.partner_services || [];
            const transportServices = services.filter((s: any) => TRANSPORT_SERVICES.includes(s.service_category));
            const specialtyServices = services.filter((s: any) => SPECIALTY_SERVICES.includes(s.service_category));
            const networks = partner.partner_networks || [];

            const linkedinUrl = linkedinMap?.[partner.id];

            return (
              <div key={partner.id} onClick={() => onSelectPartner(partner.id)}
                className={cn(
                  "px-4 py-2.5 cursor-pointer transition-colors flex items-start gap-2.5",
                  "hover:bg-accent/50",
                  selectedId === partner.id && "bg-accent",
                  isSelected && "bg-primary/5",
                )}>
                <div onClick={(e) => { e.stopPropagation(); onToggleSelection(partner.id); }} className="shrink-0 mt-1">
                  <Checkbox checked={isSelected} />
                </div>
                <div className="flex-1 min-w-0">
                  {/* Name + Rating */}
                   <div className="flex items-center gap-2">
                     <p className="text-sm font-medium truncate">{partner.company_name}</p>
                     {partner.rating > 0 && <MiniStars rating={Number(partner.rating)} />}
                     {linkedinUrl && (
                       <a href={linkedinUrl} target="_blank" rel="noopener noreferrer"
                         onClick={(e) => e.stopPropagation()} title="LinkedIn">
                         <Linkedin className="w-3.5 h-3.5 text-[#0A66C2] shrink-0 hover:scale-110 transition-transform" />
                       </a>
                     )}
                  </div>

                  {/* City + Deep Search badge */}
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                    <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{partner.city}</span>
                    {hasDeepSearch(partner) && (
                      <Tooltip>
                        <TooltipTrigger>
                          <span className="w-4 h-4 bg-sky-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">D</span>
                        </TooltipTrigger>
                        <TooltipContent>Deep Search – {format(new Date((partner.enrichment_data as any).deep_search_at), "dd/MM/yyyy")}</TooltipContent>
                      </Tooltip>
                    )}
                    {years > 0 && <TrophyRow years={years} />}
                  </div>

                  {/* Transport service icons */}
                  {transportServices.length > 0 && (
                    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                      {transportServices.map((s: any, i: number) => {
                        const Icon = getServiceIcon(s.service_category);
                        return (
                          <Tooltip key={i}>
                            <TooltipTrigger>
                              <Icon className={cn("w-4 h-4", getServiceIconColor(s.service_category))} />
                            </TooltipTrigger>
                            <TooltipContent>{formatServiceCategory(s.service_category)}</TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                  )}

                  {/* Specialty service icons */}
                  {specialtyServices.length > 0 && (
                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      {specialtyServices.map((s: any, i: number) => {
                        const Icon = getServiceIcon(s.service_category);
                        return (
                          <Tooltip key={i}>
                            <TooltipTrigger>
                              <Icon className={cn("w-4 h-4", getServiceIconColor(s.service_category))} />
                            </TooltipTrigger>
                            <TooltipContent>{formatServiceCategory(s.service_category)}</TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                  )}

                  {/* Network badges */}
                  {networks.length > 0 && (
                    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                      {networks.slice(0, 4).map((n: any) => (
                        <Tooltip key={n.id}>
                          <TooltipTrigger>
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
                              {n.network_name.replace("WCA ", "").substring(0, 12)}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>{n.network_name}</TooltipContent>
                        </Tooltip>
                      ))}
                      {networks.length > 4 && (
                        <span className="text-[9px] text-muted-foreground">+{networks.length - 4}</span>
                      )}
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
