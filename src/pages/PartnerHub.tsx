import { useState, useCallback, useMemo, Suspense, lazy } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Search,
  Star,
  StarHalf,
  StarOff,
  Phone,
  Mail,
  Globe,
  MapPin,
  Calendar,
  MessageSquare,
  MessageCircle,
  Clock,
  ChevronRight,
  ChevronDown,
  Users,
  User,
  Sparkles,
  Loader2,
  Filter,
  Building2,
  Circle,
  ArrowUpRight,
  CheckCircle2,
  Plane,
  AlertTriangle,
  Ship,
  Truck,
  TrainFront,
  Package,
  Snowflake,
  Pill,
  ShoppingCart,
  Home,
  FileCheck,
  Warehouse,
  Anchor,
  Box,
  Container,
  Cpu,
  Trophy,
  ShieldCheck,
  ShieldAlert,
  FileText,
  ExternalLink,
} from "lucide-react";
import { usePartners, useToggleFavorite, usePartner } from "@/hooks/usePartners";
import { getPartnerContactQuality } from "@/hooks/useContactCompleteness";
import { useBlacklistByPartnerIds, useBlacklistForPartner } from "@/hooks/useBlacklist";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PartnerRating } from "@/components/partners/PartnerRating";
import PartnerFiltersSheet from "@/components/partners/PartnerFiltersSheet";
import {
  getCountryFlag,
  getYearsMember,
  formatPartnerType,
  formatServiceCategory,
  getServiceIconName,
  getServiceIconColor,
  getPartnerTypeIconName,
} from "@/lib/countries";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { EnrichmentCard } from "@/components/agents/EnrichmentCard";
import { SocialLinks } from "@/components/agents/SocialLinks";
import { useSocialLinks } from "@/hooks/useSocialLinks";
import { BulkActionBar } from "@/components/agents/BulkActionBar";
import { AssignActivityDialog } from "@/components/agents/AssignActivityDialog";
import { ActivityList } from "@/components/agents/ActivityList";
import { PartnerFilters } from "@/hooks/usePartners";

const PartnerMiniGlobe = lazy(() =>
  import("@/components/partners/PartnerMiniGlobe").then((m) => ({ default: m.PartnerMiniGlobe }))
);

/* ── Icon resolver ── */
const SERVICE_ICONS: Record<string, any> = {
  air_freight: Plane,
  ocean_fcl: Ship,
  ocean_lcl: Container,
  road_freight: Truck,
  rail_freight: TrainFront,
  project_cargo: Package,
  dangerous_goods: AlertTriangle,
  perishables: Snowflake,
  pharma: Pill,
  ecommerce: ShoppingCart,
  relocations: Home,
  customs_broker: FileCheck,
  warehousing: Warehouse,
  nvocc: Anchor,
};

const PARTNER_TYPE_ICONS: Record<string, any> = {
  freight_forwarder: Truck,
  customs_broker: FileCheck,
  carrier: Ship,
  nvocc: Anchor,
  "3pl": Warehouse,
  courier: Package,
};

/* ── Network logo mapping ── */
const NETWORK_LOGOS: Record<string, string> = {
  "wca expo": "/logos/wca-expo.png",
  "wca live events & expo": "/logos/wca-expo.png",
  "wca ecommerce": "/logos/wca-ecommerce.png",
  "wca ecommerce solutions": "/logos/wca-ecommerce.png",
  "wca pharma": "/logos/wca-pharma.png",
  "wca time critical": "/logos/wca-time-critical.png",
  "wca perishables": "/logos/wca-perishables.png",
  "wca relocations": "/logos/wca-relocations.png",
  "wca dangerous goods": "/logos/wca-dangerous-goods.png",
  "wca projects": "/logos/wca-projects.png",
  "wca inter global": "/logos/wca-inter-global.png",
  "wca interglobal": "/logos/wca-inter-global.png",
  "wca china global": "/logos/wca-china-global.png",
  "wca advanced professionals": "/logos/wca-advanced-professionals.png",
  "wca first": "/logos/wca-first.png",
  "global affinity alliance": "/logos/gaa-global-affinity.png",
  "gaa": "/logos/gaa-global-affinity.png",
  "lognet global": "/logos/lognet-global.png",
  "lognet": "/logos/lognet-global.png",
  "infinite connection": "/logos/ifc-infinite-connection.png",
  "ifc": "/logos/ifc-infinite-connection.png",
  "elite global logistics network": "/logos/elite-global-logistics.png",
  "egln": "/logos/elite-global-logistics.png",
};

function getNetworkLogo(name: string): string | null {
  const key = name.toLowerCase().trim();
  if (NETWORK_LOGOS[key]) return NETWORK_LOGOS[key];
  for (const [k, v] of Object.entries(NETWORK_LOGOS)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  return null;
}

function getServiceIcon(category: string) {
  return SERVICE_ICONS[category] || Box;
}

/* ── Star display ── */
function MiniStars({ rating, size = "w-3 h-3" }: { rating: number; size?: string }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => {
        if (i + 1 <= Math.floor(rating)) return <Star key={i} className={`${size} fill-amber-400 text-amber-400`} />;
        if (i + 0.5 <= rating) return <StarHalf key={i} className={`${size} fill-amber-400 text-amber-400`} />;
        return <Star key={i} className={`${size} text-muted-foreground/30`} />;
      })}
    </div>
  );
}

/* ── Trophy: single trophy + number ── */
function TrophyRow({ years }: { years: number }) {
  if (years <= 0) return null;
  return (
    <div className="flex items-center gap-1">
      <Trophy className="w-4 h-4 text-amber-500 fill-amber-500" />
      <span className="text-sm font-bold text-amber-500">{years}</span>
      <span className="text-[10px] text-muted-foreground">yrs</span>
    </div>
  );
}

/* ── Branch countries ── */
function getBranchCountries(partner: any): { code: string; name: string }[] {
  if (!partner.branch_cities || !Array.isArray(partner.branch_cities)) return [];
  const map = new Map<string, string>();
  partner.branch_cities.forEach((b: any) => {
    const code = b?.country_code || b?.country;
    if (code && code !== partner.country_code) {
      map.set(code, b?.country_name || code);
    }
  });
  return Array.from(map.entries()).map(([code, name]) => ({ code, name }));
}

/* ── Sorting logic ── */
type SortOption = "name_asc" | "name_desc" | "rating_desc" | "years_desc" | "country_asc" | "branches_desc" | "contacts_desc";

function sortPartners(partners: any[], sortBy: SortOption): any[] {
  const sorted = [...partners];
  switch (sortBy) {
    case "name_asc": return sorted.sort((a, b) => a.company_name.localeCompare(b.company_name));
    case "name_desc": return sorted.sort((a, b) => b.company_name.localeCompare(a.company_name));
    case "rating_desc": return sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    case "years_desc": return sorted.sort((a, b) => getYearsMember(b.member_since) - getYearsMember(a.member_since));
    case "country_asc": return sorted.sort((a, b) => a.country_name.localeCompare(b.country_name));
    case "branches_desc": return sorted.sort((a, b) => {
      const ba = Array.isArray(b.branch_cities) ? b.branch_cities.length : 0;
      const aa = Array.isArray(a.branch_cities) ? a.branch_cities.length : 0;
      return ba - aa;
    });
    case "contacts_desc": return sorted.sort((a, b) => {
      const qa = getPartnerContactQuality(a.partner_contacts);
      const qb = getPartnerContactQuality(b.partner_contacts);
      const order = { complete: 0, partial: 1, missing: 2 };
      return (order[qa] || 2) - (order[qb] || 2);
    });
    default: return sorted;
  }
}

/* ── Services categorization ── */
const TRANSPORT_SERVICES = ["air_freight", "ocean_fcl", "ocean_lcl", "road_freight", "rail_freight", "project_cargo"];
const SPECIALTY_SERVICES = ["dangerous_goods", "perishables", "pharma", "ecommerce", "relocations", "customs_broker", "warehousing", "nvocc"];

/* ── Social icons for inline card display ── */
const SOCIAL_PLATFORM_ICONS: Record<string, { icon: any; color: string }> = {
  linkedin: { icon: Globe, color: "text-blue-600" },
  facebook: { icon: Globe, color: "text-blue-500" },
  instagram: { icon: Globe, color: "text-pink-500" },
  twitter: { icon: Globe, color: "text-foreground" },
  whatsapp: { icon: MessageCircle, color: "text-green-500" },
};

/* ── Inline social for card ── */
function CardSocialIcons({ partnerId }: { partnerId: string }) {
  const { data: links = [] } = useSocialLinks(partnerId);
  const companyLinks = links.filter((l) => !l.contact_id);
  if (companyLinks.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5 mt-1">
      {companyLinks.map((link) => {
        const label = link.platform.charAt(0).toUpperCase() + link.platform.slice(1);
        return (
          <Tooltip key={link.id}>
            <TooltipTrigger asChild>
              <a href={link.url} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()}>
                {link.platform === "linkedin" ? (
                  <svg viewBox="0 0 24 24" className="w-4 h-4 text-blue-600 fill-blue-600"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                ) : link.platform === "facebook" ? (
                  <svg viewBox="0 0 24 24" className="w-4 h-4 text-blue-500 fill-blue-500"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                ) : link.platform === "whatsapp" ? (
                  <MessageCircle className="w-4 h-4 text-green-500 fill-green-500" />
                ) : (
                  <Globe className="w-4 h-4 text-muted-foreground fill-muted-foreground" />
                )}
              </a>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════

export default function PartnerHub() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [filterIncomplete, setFilterIncomplete] = useState(false);
  const [filters, setFilters] = useState<PartnerFilters>({});
  const [sortBy, setSortBy] = useState<SortOption>("name_asc");

  const mergedFilters: PartnerFilters = {
    ...filters,
    search: search.length >= 2 ? search : undefined,
  };

  const { data: partners, isLoading } = usePartners(mergedFilters);
  const toggleFavorite = useToggleFavorite();

  // Blacklist data for all visible partners
  const partnerIds = useMemo(() => (partners || []).map((p: any) => p.id), [partners]);
  const { data: blacklistedIds } = useBlacklistByPartnerIds(partnerIds);

  const filteredPartners = useMemo(() => {
    let list = filterIncomplete
      ? (partners || []).filter((p: any) => getPartnerContactQuality(p.partner_contacts) !== "complete")
      : partners || [];
    return sortPartners(list, sortBy);
  }, [partners, filterIncomplete, sortBy]);

  const { data: selectedPartner, isLoading: detailLoading } = usePartner(selectedId || "");

  const countryOptions = useMemo(() => {
    if (!partners) return [];
    const map: Record<string, { code: string; name: string; flag: string; count: number }> = {};
    partners.forEach((p: any) => {
      if (!map[p.country_code]) {
        map[p.country_code] = { code: p.country_code, name: p.country_name, flag: getCountryFlag(p.country_code), count: 0 };
      }
      map[p.country_code].count++;
    });
    return Object.values(map);
  }, [partners]);

  const activeFilterCount =
    (filters.countries?.length || 0) +
    (filters.partnerTypes?.length || 0) +
    (filters.services?.length || 0) +
    (filters.favorites ? 1 : 0);

  const toggleSelection = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <TooltipProvider delayDuration={200}>
    <div className="flex flex-col md:flex-row h-[calc(100vh-5rem)] gap-0 -m-6 relative">
      {/* ═══ LEFT PANEL: Partner List ═══ */}
      <div className="w-full md:w-[400px] flex-shrink-0 border-r flex flex-col bg-card">
        <div className="p-4 border-b space-y-3 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 backdrop-blur-sm">
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            Partner
          </h1>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Cerca partner..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 rounded-xl"
              />
            </div>
            <PartnerFiltersSheet
              filters={filters}
              setFilters={setFilters}
              countries={countryOptions}
              activeFilterCount={activeFilterCount}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="h-7 text-xs w-[160px] rounded-lg">
                <SelectValue placeholder="Ordina..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name_asc">Nome A-Z</SelectItem>
                <SelectItem value="name_desc">Nome Z-A</SelectItem>
                <SelectItem value="rating_desc">Rating ↓</SelectItem>
                <SelectItem value="years_desc">Anni WCA ↓</SelectItem>
                <SelectItem value="country_asc">Paese A-Z</SelectItem>
                <SelectItem value="branches_desc">Filiali ↓</SelectItem>
                <SelectItem value="contacts_desc">Contatti completi</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground shrink-0">
              {isLoading ? "..." : `${filteredPartners.length} partner`}
            </p>
            <button
              onClick={() => setFilterIncomplete(!filterIncomplete)}
              className={cn(
                "flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-all shrink-0",
                filterIncomplete
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "bg-muted border-border text-muted-foreground hover:bg-accent"
              )}
            >
              <Filter className="w-3 h-3" />
              Incompleti
            </button>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="divide-y">
            {isLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="p-4 space-y-2">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                ))
              : filteredPartners.map((partner: any) => {
                  const q = getPartnerContactQuality(partner.partner_contacts);
                  const years = getYearsMember(partner.member_since);
                  const services = partner.partner_services || [];
                  const branchCountries = getBranchCountries(partner);

                  return (
                    <div
                      key={partner.id}
                      onClick={() => setSelectedId(partner.id)}
                      className={cn(
                        "w-full text-left p-3 hover:bg-accent/50 transition-all cursor-pointer relative",
                        selectedId === partner.id && "bg-accent",
                        selectedIds.has(partner.id) && "bg-primary/5",
                        q === "missing" && "border-l-4 border-l-destructive",
                        q === "partial" && "border-l-4 border-l-amber-400",
                        q === "complete" && "border-l-4 border-l-primary",
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-1" onClick={(e) => toggleSelection(partner.id, e)}>
                          <Checkbox checked={selectedIds.has(partner.id)} />
                        </div>
                        <div className="relative shrink-0 mt-0.5">
                          {partner.logo_url ? (
                            <>
                              <img
                                src={partner.logo_url}
                                alt=""
                                className="w-9 h-9 rounded-lg object-contain bg-muted border"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = "none";
                                  (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
                                }}
                              />
                              <div className="hidden w-9 h-9 rounded-lg bg-muted border" />
                            </>
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-muted border" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-medium text-sm truncate">{partner.company_name}</span>
                              {blacklistedIds?.has(partner.id) && (
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Badge variant="destructive" className="text-[9px] px-1 py-0 gap-0.5 shrink-0">
                                      <ShieldAlert className="w-2.5 h-2.5" /> BL
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>Questa azienda è nella Blacklist WCA</TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                            {partner.is_favorite && (
                              <Tooltip>
                                <TooltipTrigger><Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0" /></TooltipTrigger>
                                <TooltipContent>Preferito</TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                          <p className="text-sm mt-0.5">
                            <span className="font-semibold">{partner.city}</span>
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Tooltip>
                              <TooltipTrigger><span className="text-lg leading-none">{getCountryFlag(partner.country_code)}</span></TooltipTrigger>
                              <TooltipContent>{partner.country_name}</TooltipContent>
                            </Tooltip>
                            {partner.country_name}
                          </p>
                          {/* Stars + single trophy */}
                          <div className="flex items-center gap-2 mt-1">
                            {partner.rating > 0 && <MiniStars rating={Number(partner.rating)} />}
                            {years > 0 && (
                              <Tooltip>
                                <TooltipTrigger><div><TrophyRow years={years} /></div></TooltipTrigger>
                                <TooltipContent>{years} anni membro WCA</TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                          {/* Contacts inline with status icons */}
                          {partner.partner_contacts?.length > 0 && (
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              {partner.partner_contacts.slice(0, 4).map((c: any, idx: number) => (
                                <Tooltip key={c.id || idx}>
                                  <TooltipTrigger>
                                    <div className="flex items-center gap-0.5">
                                      <User className="w-3.5 h-3.5 text-muted-foreground fill-muted-foreground" />
                                      <Mail className={cn("w-3 h-3", c.email ? "text-blue-500 fill-blue-500" : "text-muted-foreground/25")} />
                                      <Phone className={cn("w-3 h-3", (c.direct_phone || c.mobile) ? "text-green-500 fill-green-500" : "text-muted-foreground/25")} />
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="font-medium">{c.name || "Contatto"}</p>
                                    {c.title && <p className="text-[10px] text-muted-foreground">{c.title}</p>}
                                    <p className="text-[10px]">{c.email ? `✓ Email` : `✗ Email mancante`}</p>
                                    <p className="text-[10px]">{(c.direct_phone || c.mobile) ? `✓ Telefono` : `✗ Telefono mancante`}</p>
                                  </TooltipContent>
                                </Tooltip>
                              ))}
                              {partner.partner_contacts.length > 4 && (
                                <span className="text-[9px] text-muted-foreground">+{partner.partner_contacts.length - 4}</span>
                              )}
                            </div>
                          )}
                          {/* Social links inline */}
                          <CardSocialIcons partnerId={partner.id} />
                          {/* Transport services row */}
                          {(() => {
                            const transport = services.filter((s: any) => TRANSPORT_SERVICES.includes(s.service_category));
                            const specialty = services.filter((s: any) => SPECIALTY_SERVICES.includes(s.service_category));
                            return (
                              <>
                                {transport.length > 0 && (
                                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                    {transport.map((s: any, i: number) => {
                                      const Icon = getServiceIcon(s.service_category);
                                      return (
                                        <Tooltip key={i}>
                                          <TooltipTrigger>
                                            <Icon className={`w-5 h-5 ${getServiceIconColor(s.service_category)}`} fill="currentColor" />
                                          </TooltipTrigger>
                                          <TooltipContent>{formatServiceCategory(s.service_category)}</TooltipContent>
                                        </Tooltip>
                                      );
                                    })}
                                  </div>
                                )}
                                {specialty.length > 0 && (
                                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                    {specialty.map((s: any, i: number) => {
                                      const Icon = getServiceIcon(s.service_category);
                                      return (
                                        <Tooltip key={i}>
                                          <TooltipTrigger>
                                            <Icon className={`w-4 h-4 ${getServiceIconColor(s.service_category)}`} fill="currentColor" />
                                          </TooltipTrigger>
                                          <TooltipContent>{formatServiceCategory(s.service_category)}</TooltipContent>
                                        </Tooltip>
                                      );
                                    })}
                                    {partner.partner_type === "courier" && (
                                      <Tooltip>
                                        <TooltipTrigger>
                                          <span className="w-4 h-4 rounded bg-amber-500 text-white text-[8px] font-bold flex items-center justify-center">XP</span>
                                        </TooltipTrigger>
                                        <TooltipContent>Corriere Espresso</TooltipContent>
                                      </Tooltip>
                                    )}
                                    {(partner.enrichment_data as any)?.has_technology && (
                                      <Tooltip>
                                        <TooltipTrigger>
                                          <Cpu className="w-4 h-4 text-violet-500 fill-violet-500" />
                                        </TooltipTrigger>
                                        <TooltipContent>Capacità Tecnologiche</TooltipContent>
                                      </Tooltip>
                                    )}
                                  </div>
                                )}
                              </>
                            );
                          })()}
                          {/* Branch country flags */}
                          {branchCountries.length > 0 && (
                            <div className="flex items-center gap-0.5 mt-1.5 flex-wrap">
                              {branchCountries.slice(0, 10).map(({ code, name }) => (
                                <Tooltip key={code}>
                                  <TooltipTrigger><span className="text-base leading-none">{getCountryFlag(code)}</span></TooltipTrigger>
                                  <TooltipContent>{name}</TooltipContent>
                                </Tooltip>
                              ))}
                              {branchCountries.length > 10 && (
                                <span className="text-[9px] text-muted-foreground ml-0.5">+{branchCountries.length - 10}</span>
                              )}
                            </div>
                          )}
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
                      </div>
                    </div>
                  );
                })}
          </div>
        </ScrollArea>
      </div>

      {/* Bulk actions */}
      <BulkActionBar
        count={selectedIds.size}
        onClear={() => setSelectedIds(new Set())}
        onAssignActivity={() => setAssignDialogOpen(true)}
        partnerIds={Array.from(selectedIds)}
      />
      <AssignActivityDialog
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        partnerIds={Array.from(selectedIds)}
        onSuccess={() => setSelectedIds(new Set())}
      />

      {/* ═══ RIGHT PANEL: Detail ═══ */}
      <div className="flex-1 overflow-y-auto bg-card">
        {!selectedId ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center space-y-2">
              <Globe className="w-16 h-16 mx-auto opacity-20" />
              <p className="text-lg">Seleziona un partner</p>
              <p className="text-sm text-muted-foreground/60">
                {filteredPartners.length} partner disponibili
              </p>
            </div>
          </div>
        ) : detailLoading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : selectedPartner ? (
          <PartnerDetail
            partner={selectedPartner}
            onToggleFavorite={() =>
              toggleFavorite.mutate({ id: selectedPartner.id, isFavorite: !selectedPartner.is_favorite })
            }
          />
        ) : null}
      </div>
    </div>
    </TooltipProvider>
  );
}

// ════════════════════════════════════════════════════
// DETAIL PANEL - GLASSMORPHISM DESIGN
// ════════════════════════════════════════════════════

function PartnerDetail({ partner, onToggleFavorite }: { partner: any; onToggleFavorite: () => void }) {
  const [deepSearching, setDeepSearching] = useState(false);
  const queryClient = useQueryClient();
  const { data: blacklistEntries = [] } = useBlacklistForPartner(partner.id);
  const isBlacklisted = blacklistEntries.length > 0;

  const handleDeepSearch = useCallback(async () => {
    setDeepSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke("deep-search-partner", {
        body: { partnerId: partner.id },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success(`Deep Search completata: ${data.socialLinksFound} social trovati${data.logoFound ? ", logo trovato" : ""}`);
        queryClient.invalidateQueries({ queryKey: ["partner", partner.id] });
        queryClient.invalidateQueries({ queryKey: ["social-links", partner.id] });
      } else {
        toast.error(data?.error || "Errore nella Deep Search");
      }
    } catch (e: any) {
      toast.error(e?.message || "Errore nella Deep Search");
    } finally {
      setDeepSearching(false);
    }
  }, [partner.id, queryClient]);

  const hasBranches = Array.isArray(partner.branch_cities) && partner.branch_cities.length > 0;
  const branchCountries = getBranchCountries(partner);
  const years = getYearsMember(partner.member_since);
  const services = partner.partner_services || [];
  const transportServices = services.filter((s: any) => TRANSPORT_SERVICES.includes(s.service_category));
  const specialtyServices = services.filter((s: any) => SPECIALTY_SERVICES.includes(s.service_category));
  const PartnerTypeIcon = PARTNER_TYPE_ICONS[partner.partner_type || ""] || Box;
  const enrichment = partner.enrichment_data as any;

  return (
    <div className="p-6 space-y-5">
      {/* Blacklist Warning */}
      {isBlacklisted && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 flex items-start gap-3">
          <ShieldAlert className="w-6 h-6 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-destructive">⚠️ BLACKLIST WCA</p>
            <p className="text-sm text-destructive/80 mt-0.5">
              Questa azienda risulta nella blacklist WCA con {blacklistEntries.length} segnalazione/i.
              {blacklistEntries[0]?.total_owed_amount && (
                <> Importo totale dovuto: <strong>${Number(blacklistEntries[0].total_owed_amount).toLocaleString()}</strong></>
              )}
              {blacklistEntries[0]?.status && <> — Status: <strong>{blacklistEntries[0].status}</strong></>}
            </p>
            {blacklistEntries[0]?.claims && (
              <details className="mt-2">
                <summary className="text-xs font-medium cursor-pointer text-destructive/70">Dettaglio claims</summary>
                <pre className="text-[10px] text-destructive/60 mt-1 whitespace-pre-wrap">{blacklistEntries[0].claims}</pre>
              </details>
            )}
          </div>
        </div>
      )}
      {/* ═══ HEADER ═══ */}
      <div className="bg-gradient-to-br from-primary/5 via-card to-accent/10 backdrop-blur-sm border border-primary/10 rounded-2xl p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 flex-1 min-w-0">
            <div className="shrink-0">
              {partner.logo_url ? (
                <img
                  src={partner.logo_url}
                  alt={partner.company_name}
                  className="w-14 h-14 rounded-xl object-contain bg-muted/50 border border-primary/10"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-muted/50 border border-primary/10" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold text-foreground truncate">{partner.company_name}</h2>
                {partner.wca_id && (
                  <span className="text-xs text-muted-foreground shrink-0">WCA #{partner.wca_id}</span>
                )}
              </div>
              <div className="mt-1">
                <p className="text-foreground font-semibold">{partner.city}</p>
                <p className="text-muted-foreground flex items-center gap-2 mt-0.5">
                  <span className="text-3xl leading-none">{getCountryFlag(partner.country_code)}</span>
                  <span>{partner.country_name}</span>
                  <span className="text-border">·</span>
                  <Tooltip>
                    <TooltipTrigger><PartnerTypeIcon className="w-5 h-5 text-muted-foreground fill-muted-foreground" /></TooltipTrigger>
                    <TooltipContent>{formatPartnerType(partner.partner_type)}</TooltipContent>
                  </Tooltip>
                  <span className="text-sm">{formatPartnerType(partner.partner_type)}</span>
                  {partner.office_type && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground border">
                      {partner.office_type === "head_office" ? "HQ" : "Branch"}
                    </span>
                  )}
                </p>
              </div>
              {/* Rating + Trophy single */}
              <div className="flex items-center gap-4 mt-2">
                {partner.rating > 0 && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1 cursor-help">
                        <MiniStars rating={Number(partner.rating)} size="w-4 h-4" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[250px]">
                      <p className="text-xs">Valutazione basata su: anzianità WCA, numero filiali, completezza profilo, certificazioni, infrastrutture proprie</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                {years > 0 && (
                  <Tooltip>
                    <TooltipTrigger><div><TrophyRow years={years} /></div></TooltipTrigger>
                    <TooltipContent>{years} anni membro WCA</TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>
          </div>
          {/* Action buttons */}
          <div className="flex gap-2 shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onToggleFavorite}
                  className={cn("rounded-xl transition-all", partner.is_favorite && "shadow-sm shadow-amber-400/30")}
                >
                  {partner.is_favorite ? <Star className="w-5 h-5 fill-amber-400 text-amber-400" /> : <StarOff className="w-5 h-5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{partner.is_favorite ? "Rimuovi dai preferiti" : "Aggiungi ai preferiti"}</TooltipContent>
            </Tooltip>
            <Button
              size="sm"
              className="rounded-xl bg-gradient-to-r from-primary to-sky-400 text-primary-foreground hover:opacity-90 transition-all shadow-sm shadow-primary/20"
              onClick={handleDeepSearch}
              disabled={deepSearching}
            >
              {deepSearching ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
              Deep Search
            </Button>
          </div>
        </div>
      </div>

      {/* ═══ TWO COLUMN LAYOUT ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-5">
        {/* ─── LEFT COLUMN (60%) ─── */}
        <div className="space-y-4">
          {/* Transport Services */}
          {transportServices.length > 0 && (
            <div className="bg-gradient-to-br from-sky-500/5 via-card to-blue-500/5 backdrop-blur-sm border border-sky-500/10 rounded-2xl p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3 font-medium">Servizi di Trasporto</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {transportServices.map((s: any, i: number) => {
                  const Icon = getServiceIcon(s.service_category);
                  const color = getServiceIconColor(s.service_category);
                  return (
                    <div key={i} className="flex items-center gap-3 bg-card/80 backdrop-blur-sm border border-primary/5 rounded-xl px-3 py-2.5 shadow-sm hover:shadow-md transition-shadow">
                      <Icon className={`w-7 h-7 ${color}`} fill="currentColor" />
                      <span className="text-sm text-foreground font-medium">{formatServiceCategory(s.service_category)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Specialty Services */}
          {specialtyServices.length > 0 && (
            <div className="bg-gradient-to-br from-violet-500/5 via-card to-pink-500/5 backdrop-blur-sm border border-violet-500/10 rounded-2xl p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3 font-medium">Specialità</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {specialtyServices.map((s: any, i: number) => {
                  const Icon = getServiceIcon(s.service_category);
                  const color = getServiceIconColor(s.service_category);
                  return (
                    <div key={i} className="flex items-center gap-3 bg-card/80 backdrop-blur-sm border border-primary/5 rounded-xl px-3 py-2.5 shadow-sm hover:shadow-md transition-shadow">
                      <Icon className={`w-7 h-7 ${color}`} fill="currentColor" />
                      <span className="text-sm text-foreground font-medium">{formatServiceCategory(s.service_category)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Company Contacts - Collapsible */}
          <Collapsible>
            <CollapsibleTrigger className="w-full">
              <div className="bg-gradient-to-r from-sky-500/10 via-card to-transparent hover:from-sky-500/15 text-foreground flex items-center gap-3 w-full cursor-pointer transition-all rounded-xl px-4 py-3 border border-sky-500/10 shadow-sm">
                <Building2 className="w-7 h-7 text-sky-400 fill-sky-400" />
                <span className="text-sm font-medium">Contatti Azienda</span>
                <ChevronDown className="w-4 h-4 text-muted-foreground ml-auto" />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 bg-card/80 backdrop-blur-sm border border-primary/5 rounded-xl p-4 space-y-2.5">
                {/* Phone */}
                <div className="flex items-center gap-3 text-sm">
                  <Phone className={cn("w-5 h-5", partner.phone ? "text-green-500 fill-green-500" : "text-muted-foreground/30")} />
                  {partner.phone ? (
                    <a href={`tel:${partner.phone}`} className="text-foreground hover:text-primary transition-colors">{partner.phone}</a>
                  ) : (
                    <span className="text-muted-foreground/40 italic">Telefono non disponibile</span>
                  )}
                </div>
                {/* Email */}
                <div className="flex items-center gap-3 text-sm">
                  <Mail className={cn("w-5 h-5", partner.email ? "text-blue-500 fill-blue-500" : "text-muted-foreground/30")} />
                  {partner.email ? (
                    <a href={`mailto:${partner.email}`} className="text-foreground hover:text-primary transition-colors">{partner.email}</a>
                  ) : (
                    <span className="text-muted-foreground/40 italic">Email non disponibile</span>
                  )}
                </div>
                {/* Website */}
                <div className="flex items-center gap-3 text-sm">
                  <Globe className={cn("w-5 h-5", partner.website ? "text-sky-400 fill-sky-400" : "text-muted-foreground/30")} />
                  {partner.website ? (
                    <a
                      href={partner.website.startsWith("http") ? partner.website : `https://${partner.website}`}
                      target="_blank"
                      rel="noopener"
                      className="text-foreground hover:text-primary transition-colors"
                    >
                      {partner.website}
                    </a>
                  ) : (
                    <span className="text-muted-foreground/40 italic">Sito web non disponibile</span>
                  )}
                </div>
                {/* Fax */}
                <div className="flex items-center gap-3 text-sm">
                  <FileText className={cn("w-5 h-5", partner.fax ? "text-foreground fill-foreground" : "text-muted-foreground/30")} />
                  {partner.fax ? (
                    <span className="text-foreground">{partner.fax}</span>
                  ) : (
                    <span className="text-muted-foreground/40 italic">Fax non disponibile</span>
                  )}
                </div>
                {/* Address */}
                <div className="flex items-start gap-3 text-sm">
                  <MapPin className={cn("w-5 h-5 mt-0.5", partner.address ? "text-rose-400 fill-rose-400" : "text-muted-foreground/30")} />
                  {partner.address ? (
                    <span className="text-foreground">{partner.address}</span>
                  ) : (
                    <span className="text-muted-foreground/40 italic">Indirizzo non disponibile</span>
                  )}
                </div>
                {/* Member since */}
                {partner.member_since && (
                  <div className="flex items-center gap-3 text-sm">
                    <Calendar className="w-5 h-5 text-primary fill-primary" />
                    <span className="text-foreground">
                      Membro dal {format(new Date(partner.member_since), "MMMM yyyy", { locale: it })} ({years} anni)
                    </span>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Office Contacts - Collapsible */}
          {partner.partner_contacts?.length > 0 && (
            <Collapsible>
              <CollapsibleTrigger className="w-full">
                <div className="bg-gradient-to-r from-emerald-500/10 via-card to-transparent hover:from-emerald-500/15 text-foreground flex items-center gap-3 w-full cursor-pointer transition-all rounded-xl px-4 py-3 border border-emerald-500/10 shadow-sm">
                  <Users className="w-7 h-7 text-emerald-400 fill-emerald-400" />
                  <span className="text-sm font-medium">
                    Contatti Ufficio ({partner.partner_contacts.length})
                  </span>
                  <ChevronDown className="w-4 h-4 text-muted-foreground ml-auto" />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 space-y-2">
                  {partner.partner_contacts.map((c: any) => (
                    <div key={c.id} className="bg-card/80 backdrop-blur-sm border border-primary/5 rounded-xl p-4 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-muted-foreground fill-muted-foreground" />
                        <p className="font-medium text-sm text-foreground">{c.name}</p>
                        {c.is_primary && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">Primary</span>
                        )}
                        {/* Status icons for data quality */}
                        <div className="flex items-center gap-1 ml-auto">
                          <Tooltip>
                            <TooltipTrigger>
                              <Mail className={cn("w-4 h-4", c.email ? "text-blue-500 fill-blue-500" : "text-muted-foreground/25")} />
                            </TooltipTrigger>
                            <TooltipContent>{c.email || "Email mancante"}</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger>
                              <Phone className={cn("w-4 h-4", (c.direct_phone || c.mobile) ? "text-green-500 fill-green-500" : "text-muted-foreground/25")} />
                            </TooltipTrigger>
                            <TooltipContent>{c.direct_phone || c.mobile || "Telefono mancante"}</TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                      {c.title && <p className="text-xs text-muted-foreground ml-6">{c.title}</p>}
                      <div className="flex items-center gap-4 text-sm ml-6 flex-wrap">
                        {c.email && (
                          <a href={`mailto:${c.email}`} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
                            <Mail className="w-3.5 h-3.5 text-blue-400 fill-blue-400" /> {c.email}
                          </a>
                        )}
                        {c.direct_phone && (
                          <a href={`tel:${c.direct_phone}`} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
                            <Phone className="w-3.5 h-3.5 text-green-400 fill-green-400" /> {c.direct_phone}
                          </a>
                        )}
                        {c.mobile && (
                          <a href={`tel:${c.mobile}`} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
                            <Phone className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" /> {c.mobile}
                          </a>
                        )}
                      </div>
                      <div className="ml-6">
                        <SocialLinks partnerId={partner.id} contactId={c.id} compact />
                      </div>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Company Profile - Collapsible */}
          {partner.profile_description && (
            <Collapsible>
              <CollapsibleTrigger className="w-full">
                <div className="bg-gradient-to-r from-amber-500/10 via-card to-transparent hover:from-amber-500/15 text-foreground flex items-center gap-3 w-full cursor-pointer transition-all rounded-xl px-4 py-3 border border-amber-500/10 shadow-sm">
                  <FileText className="w-7 h-7 text-amber-400 fill-amber-400" />
                  <span className="text-sm font-medium">Profilo Aziendale</span>
                  <ChevronDown className="w-4 h-4 text-muted-foreground ml-auto" />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 bg-card/80 backdrop-blur-sm border border-primary/5 rounded-xl p-4 space-y-4">
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{partner.profile_description}</p>
                  {branchCountries.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Branch Offices</p>
                      <div className="flex flex-wrap gap-2">
                        {branchCountries.map(({ code, name }) => (
                          <span key={code} className="flex items-center gap-1.5 text-sm text-muted-foreground bg-secondary/50 border rounded-lg py-1 px-2">
                            <span className="text-lg">{getCountryFlag(code)}</span> {name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Enrichment */}
          <EnrichmentCard partner={partner} />

          {/* Activities */}
          <ActivityList partnerId={partner.id} />

          {/* Timeline */}
          <div className="bg-card/80 backdrop-blur-sm border border-primary/5 rounded-2xl p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3 font-medium flex items-center gap-2">
              <MessageSquare className="w-4 h-4 fill-muted-foreground" />
              Timeline ({partner.interactions?.length || 0})
            </p>
            {!partner.interactions?.length ? (
              <div className="text-center py-6 text-muted-foreground">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nessuna interazione</p>
              </div>
            ) : (
              <div className="space-y-3">
                {partner.interactions.map((interaction: any) => (
                  <div key={interaction.id} className="flex gap-3 p-3 rounded-xl bg-muted/50 border hover:shadow-sm transition-shadow">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium shrink-0 bg-gradient-to-br from-primary/20 to-accent/20 text-foreground border border-primary/10">
                      {interaction.interaction_type?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-sm text-foreground">{interaction.subject}</p>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {format(new Date(interaction.interaction_date), "d MMM yyyy", { locale: it })}
                        </span>
                      </div>
                      {interaction.notes && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{interaction.notes}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Reminders */}
          {partner.reminders?.length > 0 && (
            <div className="bg-card/80 backdrop-blur-sm border border-primary/5 rounded-2xl p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3 font-medium">Promemoria</p>
              <div className="space-y-2">
                {partner.reminders.map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border hover:shadow-sm transition-shadow">
                    <div>
                      <p className="font-medium text-sm text-foreground">{r.title}</p>
                      <p className="text-xs text-muted-foreground">
                        Scadenza: {format(new Date(r.due_date), "d MMM yyyy", { locale: it })}
                      </p>
                    </div>
                    <span className={cn(
                      "text-xs px-2 py-0.5 rounded-full",
                      r.status === "completed" ? "bg-emerald-500/20 text-emerald-500" : "bg-primary/10 text-primary"
                    )}>
                      {r.status === "completed" ? "Completato" : "In attesa"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ─── RIGHT COLUMN (40%) ─── */}
        <div className="space-y-4">
          {/* Social Links - Large */}
          <div className="bg-gradient-to-br from-blue-500/5 via-card to-violet-500/5 backdrop-blur-sm border border-blue-500/10 rounded-2xl p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3 font-medium">Social</p>
            <SocialLinks partnerId={partner.id} />
          </div>

          {/* Branch Countries */}
          {branchCountries.length > 0 && (
            <div className="bg-card/80 backdrop-blur-sm border border-primary/5 rounded-2xl p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3 font-medium">
                Paesi Collegati ({branchCountries.length})
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                {branchCountries.map(({ code, name }) => (
                  <div key={code} className="flex flex-col items-center gap-1 bg-muted/50 border rounded-xl py-3 px-2 hover:shadow-sm transition-shadow">
                    <span className="text-4xl">{getCountryFlag(code)}</span>
                    <span className="text-xs text-muted-foreground text-center">{name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Key Markets from enrichment */}
          {enrichment?.key_markets && Array.isArray(enrichment.key_markets) && enrichment.key_markets.length > 0 && (
            <div className="bg-card/80 backdrop-blur-sm border border-primary/5 rounded-2xl p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3 font-medium">Mercati Principali</p>
              <div className="grid grid-cols-2 gap-2.5">
                {enrichment.key_markets.map((market: string, i: number) => (
                  <div key={i} className="flex flex-col items-center gap-1 bg-muted/50 border rounded-xl py-3 px-2">
                    <Globe className="w-6 h-6 text-primary fill-primary" />
                    <span className="text-xs text-muted-foreground text-center">{market}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mini Globe */}
          {hasBranches && (
            <div className="bg-card/80 backdrop-blur-sm border border-primary/5 rounded-2xl p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3 font-medium">Mappa Filiali</p>
              <Suspense fallback={<Skeleton className="w-full h-[200px] rounded-xl" />}>
                <PartnerMiniGlobe
                  partnerCountryCode={partner.country_code}
                  partnerCity={partner.city}
                  branchCities={partner.branch_cities}
                />
              </Suspense>
            </div>
          )}

          {/* Networks - doubled logos */}
          {partner.partner_networks?.length > 0 && (
            <div className="bg-gradient-to-br from-primary/5 via-card to-accent/5 backdrop-blur-sm border border-primary/10 rounded-2xl p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3 font-medium">Network</p>
              <div className="space-y-3">
                {partner.partner_networks.map((n: any) => {
                  const logo = getNetworkLogo(n.network_name);
                  return (
                    <div key={n.id} className="bg-card/80 backdrop-blur-sm border border-primary/5 rounded-xl px-4 py-3 flex items-center gap-4 hover:shadow-md transition-shadow">
                      {logo ? (
                        <img src={logo} alt={n.network_name} className="w-20 h-20 object-contain rounded-lg" />
                      ) : (
                        <div className="w-20 h-20 rounded-lg bg-muted/50 flex items-center justify-center border border-primary/10">
                          <Globe className="w-10 h-10 text-primary fill-primary" />
                        </div>
                      )}
                      <div>
                        <p className="text-sm text-foreground font-medium">{n.network_name}</p>
                        {n.expires && (
                          <p className="text-xs text-muted-foreground">Scade {format(new Date(n.expires), "MMM yyyy")}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Certifications */}
          {partner.partner_certifications?.length > 0 && (
            <div className="bg-card/80 backdrop-blur-sm border border-primary/5 rounded-2xl p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3 font-medium">Certificazioni</p>
              <div className="space-y-2">
                {partner.partner_certifications.map((c: any, i: number) => (
                  <div key={i} className="bg-muted/50 border rounded-xl px-3 py-2.5 flex items-center gap-3 hover:shadow-sm transition-shadow">
                    <ShieldCheck className="w-6 h-6 text-emerald-400 fill-emerald-400" />
                    <span className="text-sm text-foreground font-medium">{c.certification}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* KPI Summary */}
          <div className="bg-gradient-to-br from-primary/5 via-card to-sky-500/5 backdrop-blur-sm border border-primary/10 rounded-2xl p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3 font-medium">KPI</p>
            <div className="grid grid-cols-2 gap-2.5">
              {years > 0 && (
                <div className="bg-card/80 border border-primary/5 rounded-xl flex flex-col items-center py-3 px-2 hover:shadow-sm transition-shadow">
                  <Calendar className="w-6 h-6 text-primary fill-primary mb-1" />
                  <p className="text-lg font-semibold text-foreground">{years}</p>
                  <p className="text-[10px] text-muted-foreground">Anni WCA</p>
                </div>
              )}
              {Array.isArray(partner.branch_cities) && partner.branch_cities.length > 0 && (
                <div className="bg-card/80 border border-primary/5 rounded-xl flex flex-col items-center py-3 px-2 hover:shadow-sm transition-shadow">
                  <Building2 className="w-6 h-6 text-primary fill-primary mb-1" />
                  <p className="text-lg font-semibold text-foreground">{partner.branch_cities.length}</p>
                  <p className="text-[10px] text-muted-foreground">Filiali</p>
                </div>
              )}
              {branchCountries.length > 0 && (
                <div className="bg-card/80 border border-primary/5 rounded-xl flex flex-col items-center py-3 px-2 hover:shadow-sm transition-shadow">
                  <Globe className="w-6 h-6 text-primary fill-primary mb-1" />
                  <p className="text-lg font-semibold text-foreground">{branchCountries.length + 1}</p>
                  <p className="text-[10px] text-muted-foreground">Paesi</p>
                </div>
              )}
              {partner.partner_certifications?.length > 0 && (
                <div className="bg-card/80 border border-primary/5 rounded-xl flex flex-col items-center py-3 px-2 hover:shadow-sm transition-shadow">
                  <ShieldCheck className="w-6 h-6 text-emerald-400 fill-emerald-400 mb-1" />
                  <p className="text-lg font-semibold text-foreground">{partner.partner_certifications.length}</p>
                  <p className="text-[10px] text-muted-foreground">Certificazioni</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
