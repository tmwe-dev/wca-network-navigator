import { useState, useMemo, useCallback } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { getCountryFlag } from "@/lib/countries";
import { cn } from "@/lib/utils";
import { WCA_COUNTRIES } from "@/data/wcaCountries";
import {
  ArrowLeft, Phone, Mail, CheckSquare, MapPin,
  Send, Star, Package, X, User,
} from "lucide-react";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import { MiniStars } from "@/components/partners/shared/MiniStars";
import { TrophyRow } from "@/components/partners/shared/TrophyRow";
import { getServiceIcon, TRANSPORT_SERVICES, SPECIALTY_SERVICES } from "@/components/partners/shared/ServiceIcons";
import { getYearsMember, formatServiceCategory } from "@/lib/countries";
import { getRealLogoUrl, asEnrichment } from "@/lib/partnerUtils";
import { format } from "date-fns";

/* ── Helpers ── */
const hasPhone = (p: any) =>
  (p.partner_contacts || []).some((c: any) => c.mobile || c.direct_phone);
const hasEmail = (p: any) =>
  (p.partner_contacts || []).some((c: any) => c.email);
const hasDeepSearch = (p: any) => !!asEnrichment(p.enrichment_data)?.deep_search_at;
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

  const filterChips: { key: FilterTag; label: string; icon: typeof Phone; color: string; activeColor: string; count: number }[] = [
    { key: "with_phone", label: "Telefono", icon: Phone, color: "text-emerald-500", activeColor: "bg-emerald-500/15 border-emerald-500/40 text-emerald-400", count: dynamicCounts.with_phone },
    { key: "with_email", label: "Email", icon: Mail, color: "text-sky-500", activeColor: "bg-sky-500/15 border-sky-500/40 text-sky-400", count: dynamicCounts.with_email },
    { key: "deep_search", label: "Deep Search", icon: Send, color: "text-sky-500", activeColor: "bg-sky-500/15 border-sky-500/40 text-sky-400", count: dynamicCounts.deep_search },
    { key: "rating_3", label: "Rating 3+", icon: Star, color: "text-amber-500", activeColor: "bg-amber-500/15 border-amber-500/40 text-amber-400", count: dynamicCounts.rating_3 },
    { key: "with_services", label: "Servizi", icon: Package, color: "text-sky-500", activeColor: "bg-sky-500/15 border-sky-500/40 text-sky-400", count: dynamicCounts.with_services },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* ═══ HEADER ═══ */}
      <div className="px-4 py-3 border-b border-border/40 bg-card/30">
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

      {/* ═══ FILTER CHIPS ═══ */}
      <div className="px-4 py-2 border-b border-border/30">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {filterChips.map((f) => {
            const Icon = f.icon;
            return (
              <button key={f.key} onClick={() => toggleFilter(f.key)}
                className={cn(
                  "flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-full border transition-all whitespace-nowrap font-medium",
                  activeFilters.has(f.key)
                    ? f.activeColor
                    : "bg-muted/50 border-border/50 text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                )}>
                <Icon className={cn("w-3.5 h-3.5", activeFilters.has(f.key) ? "" : f.color)} strokeWidth={1.8} />
                {f.label}
                <span className={cn(
                  "min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold leading-none",
                  activeFilters.has(f.key) ? "bg-white/10" : "bg-muted-foreground/10"
                )}>
                  {f.count}
                </span>
              </button>
            );
          })}
          {activeFilters.size > 0 && (
            <button onClick={() => setActiveFilters(new Set())}
              className="flex items-center gap-1 text-[10px] px-2 py-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-destructive/10 hover:text-destructive transition-all">
              <X className="w-3 h-3" /> Reset
            </button>
          )}
        </div>
      </div>

      {/* ═══ LIST HEADER ═══ */}
      <div className="px-4 py-1.5 flex items-center justify-between border-b border-border/20">
        <span className="text-[11px] text-muted-foreground font-medium">
          <span className="font-bold text-foreground">{filteredPartners.length}</span>
          {activeFilters.size > 0 && <span> / {countryPartners.length}</span>}
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
            const allServices = [...services.filter((s: any) => TRANSPORT_SERVICES.includes(s.service_category)), ...services.filter((s: any) => SPECIALTY_SERVICES.includes(s.service_category))];
            const networks = partner.partner_networks || [];
            const primaryContact = (partner.partner_contacts || []).find((c: any) => c.is_primary) || (partner.partner_contacts || [])[0];
            const contactEmail = primaryContact?.email;
            const contactPhone = primaryContact?.direct_phone || primaryContact?.mobile;

            return (
              <div key={partner.id} onClick={() => onSelectPartner(partner.id)}
                className={cn(
                  "mx-2 mb-1 px-3 py-2.5 cursor-pointer transition-all rounded-xl flex items-start gap-2",
                  "hover:bg-accent/40",
                  selectedId === partner.id && "bg-accent/60 shadow-sm",
                  isSelected && "bg-primary/[0.06] ring-1 ring-primary/20",
                )}>
                {/* Progressive number */}
                <span className="text-[10px] text-muted-foreground/50 font-mono w-5 shrink-0 text-right mt-2.5">
                  {index + 1}
                </span>

                {/* Checkbox */}
                <div onClick={(e) => { e.stopPropagation(); onToggleSelection(partner.id); }} className="shrink-0 mt-1.5">
                  <Checkbox checked={isSelected} className="data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
                </div>

                {/* Logo */}
                <div className="w-9 h-9 shrink-0 mt-0.5 rounded-lg overflow-hidden bg-muted/30 border border-border/30 flex items-center justify-center">
                  {getRealLogoUrl(partner.logo_url) ? (
                    <img src={getRealLogoUrl(partner.logo_url)!} alt="" className="w-full h-full object-contain p-0.5" />
                  ) : (
                    <span className="text-lg opacity-50">{flag}</span>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {/* Row 1: Name + rating */}
                  <div className="flex items-center gap-1.5 min-w-0">
                    <p className="text-[13px] font-semibold truncate leading-tight">{partner.company_name}</p>
                    {partner.rating > 0 && <MiniStars rating={Number(partner.rating)} />}
                  </div>

                  {/* Row 2: City + years */}
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                    <span className="flex items-center gap-0.5 truncate">
                      <MapPin className="w-3 h-3 shrink-0 opacity-50" />{partner.city}
                    </span>
                    {years > 0 && <TrophyRow years={years} />}
                  </div>

                  {/* Row 3: Contact info — always visible */}
                  <div className="mt-1.5 space-y-0.5">
                    {primaryContact ? (
                      <>
                        <div className="flex items-center gap-1.5 text-[11px]">
                          <User className="w-3 h-3 text-muted-foreground/50 shrink-0" />
                          <span className="font-medium text-foreground truncate">{primaryContact.contact_alias || primaryContact.name}</span>
                          {(partner.partner_contacts || []).length > 1 && (
                            <span className="text-[10px] text-muted-foreground">+{(partner.partner_contacts || []).length - 1}</span>
                          )}
                        </div>
                        {contactEmail && (
                          <a href={`mailto:${contactEmail}`} onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1.5 text-[11px] text-sky-400 hover:underline truncate ml-[18px]">
                            <Mail className="w-3 h-3 shrink-0" />{contactEmail}
                          </a>
                        )}
                        {contactPhone && (
                          <a href={`tel:${contactPhone}`} onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1.5 text-[11px] text-emerald-400 truncate ml-[18px]">
                            <Phone className="w-3 h-3 shrink-0" />{contactPhone}
                          </a>
                        )}
                      </>
                    ) : (
                      <span className="text-[10px] italic text-destructive/60">Nessun contatto</span>
                    )}
                  </div>

                  {/* Row 4: Service icons */}
                  {allServices.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      {allServices.slice(0, 6).map((s: any, i: number) => {
                        const Icon = getServiceIcon(s.service_category);
                        return (
                          <Tooltip key={i}>
                            <TooltipTrigger>
                              <Icon className="w-3.5 h-3.5 text-sky-500/70" strokeWidth={1.5} />
                            </TooltipTrigger>
                            <TooltipContent>{formatServiceCategory(s.service_category)}</TooltipContent>
                          </Tooltip>
                        );
                      })}
                      {allServices.length > 6 && (
                        <span className="text-[9px] text-muted-foreground">+{allServices.length - 6}</span>
                      )}
                    </div>
                  )}

                  {/* Row 5: Networks (compact) */}
                  {networks.length > 0 && (
                    <div className="flex items-center gap-1 mt-1.5">
                      {networks.slice(0, 3).map((n: any) => (
                        <span key={n.id} className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/[0.08] text-amber-500/80 font-medium truncate max-w-[80px]">
                          {n.network_name.replace("WCA ", "").substring(0, 10)}
                        </span>
                      ))}
                      {networks.length > 3 && (
                        <span className="text-[9px] text-muted-foreground/60">+{networks.length - 3}</span>
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
