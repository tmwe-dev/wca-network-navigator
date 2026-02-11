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
  Sparkles,
  Loader2,
  Filter,
  Building2,
  Circle,
  ArrowUpRight,
  CheckCircle2,
  Plane,
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
  Trophy,
  ShieldCheck,
  FileText,
  ExternalLink,
} from "lucide-react";
import { usePartners, useToggleFavorite, usePartner } from "@/hooks/usePartners";
import { getPartnerContactQuality } from "@/hooks/useContactCompleteness";
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
import { BulkActionBar } from "@/components/agents/BulkActionBar";
import { AssignActivityDialog } from "@/components/agents/AssignActivityDialog";
import { ActivityList } from "@/components/agents/ActivityList";
import { PartnerFilters } from "@/hooks/usePartners";

const PartnerMiniGlobe = lazy(() =>
  import("@/components/partners/PartnerMiniGlobe").then((m) => ({ default: m.PartnerMiniGlobe }))
);

/* ── Icon resolver ── */
const SERVICE_ICON_MAP: Record<string, any> = {
  Plane, Ship, Truck, TrainFront, Package, AlertTriangle: Plane, // placeholder
  Snowflake, Pill, ShoppingCart, Home, FileCheck, Warehouse, Anchor, Box,
};

// Direct mapping to avoid string lookups
const SERVICE_ICONS: Record<string, any> = {
  air_freight: Plane,
  ocean_fcl: Ship,
  ocean_lcl: Ship,
  road_freight: Truck,
  rail_freight: TrainFront,
  project_cargo: Package,
  dangerous_goods: Plane, // we'll use the proper import below
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
        return <Star key={i} className={`${size} text-white/20`} />;
      })}
    </div>
  );
}

/* ── Trophy row ── */
function TrophyRow({ years, size = "w-3 h-3" }: { years: number; size?: string }) {
  if (years <= 0) return null;
  const display = Math.min(years, 20);
  return (
    <div className="flex items-center gap-0.5 flex-wrap">
      {Array.from({ length: display }).map((_, i) => (
        <Trophy key={i} className={`${size} text-amber-500 fill-amber-500`} />
      ))}
      {years > 20 && <span className="text-[9px] text-white/50 ml-0.5">+{years - 20}</span>}
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
    case "name_asc":
      return sorted.sort((a, b) => a.company_name.localeCompare(b.company_name));
    case "name_desc":
      return sorted.sort((a, b) => b.company_name.localeCompare(a.company_name));
    case "rating_desc":
      return sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    case "years_desc":
      return sorted.sort((a, b) => getYearsMember(b.member_since) - getYearsMember(a.member_since));
    case "country_asc":
      return sorted.sort((a, b) => a.country_name.localeCompare(b.country_name));
    case "branches_desc":
      return sorted.sort((a, b) => {
        const ba = Array.isArray(b.branch_cities) ? b.branch_cities.length : 0;
        const aa = Array.isArray(a.branch_cities) ? a.branch_cities.length : 0;
        return ba - aa;
      });
    case "contacts_desc":
      return sorted.sort((a, b) => {
        const qa = getPartnerContactQuality(a.partner_contacts);
        const qb = getPartnerContactQuality(b.partner_contacts);
        const order = { complete: 0, partial: 1, missing: 2 };
        return (order[qa] || 2) - (order[qb] || 2);
      });
    default:
      return sorted;
  }
}

/* ── Services categorization ── */
const TRANSPORT_SERVICES = ["air_freight", "ocean_fcl", "ocean_lcl", "road_freight", "rail_freight", "project_cargo"];
const SPECIALTY_SERVICES = ["dangerous_goods", "perishables", "pharma", "ecommerce", "relocations", "customs_broker", "warehousing", "nvocc"];

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
    <div className="flex h-[calc(100vh-5rem)] gap-0 -m-6 relative">
      {/* ═══ LEFT PANEL: Partner List ═══ */}
      <div className="w-[400px] flex-shrink-0 border-r flex flex-col bg-card">
        <div className="p-4 border-b space-y-3">
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
                className="pl-10"
              />
            </div>
            <PartnerFiltersSheet
              filters={filters}
              setFilters={setFilters}
              countries={countryOptions}
              activeFilterCount={activeFilterCount}
            />
          </div>
          {/* Sorting + filter row */}
          <div className="flex items-center justify-between gap-2">
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="h-7 text-xs w-[160px]">
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
                "flex items-center gap-1 text-xs px-2 py-1 rounded-md border transition-all shrink-0",
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
                  const whatsappNum = partner.mobile || partner.phone;
                  const hasPersonalEmail = partner.partner_contacts?.some((c: any) => !!c.email);
                  const hasPersonalPhone = partner.partner_contacts?.some((c: any) => !!c.direct_phone || !!c.mobile);
                  const branchCountries = getBranchCountries(partner);
                  const services = partner.partner_services || [];

                  return (
                    <div
                      key={partner.id}
                      onClick={() => setSelectedId(partner.id)}
                      className={cn(
                        "w-full text-left p-3 hover:bg-accent/50 transition-colors cursor-pointer relative",
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
                        {/* Logo */}
                        <div className="relative shrink-0 mt-0.5">
                          {partner.logo_url ? (
                            <>
                              <img
                                src={partner.logo_url}
                                alt=""
                                className="w-9 h-9 rounded-md object-contain bg-muted border"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = "none";
                                  (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
                                }}
                              />
                              <div className="hidden w-9 h-9 rounded-md bg-muted border" />
                            </>
                          ) : (
                            <div className="w-9 h-9 rounded-md bg-muted border" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-sm truncate">{partner.company_name}</span>
                            {partner.is_favorite && <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0" />}
                          </div>
                          {/* City bold + Country on two lines */}
                          <p className="text-sm mt-0.5">
                            <span className="font-semibold">{partner.city}</span>
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <span className="text-lg leading-none">{getCountryFlag(partner.country_code)}</span>
                            {partner.country_name}
                          </p>
                          {/* Stars + trophies inline */}
                          <div className="flex items-center gap-2 mt-1">
                            {partner.rating > 0 && <MiniStars rating={Number(partner.rating)} />}
                            {years > 0 && <TrophyRow years={years} />}
                          </div>
                          {/* Contact icons */}
                          <div className="flex items-center gap-1.5 mt-1">
                            {hasPersonalPhone && <Phone className="w-3 h-3 text-green-500" />}
                            {hasPersonalEmail && <Mail className="w-3 h-3 text-blue-500" />}
                            {whatsappNum && <MessageCircle className="w-3 h-3 text-green-500" />}
                          </div>
                          {/* Branch country flags */}
                          {branchCountries.length > 0 && (
                            <div className="flex items-center gap-0.5 mt-1 flex-wrap">
                              {branchCountries.slice(0, 8).map(({ code }) => (
                                <span key={code} className="text-sm leading-none">{getCountryFlag(code)}</span>
                              ))}
                              {branchCountries.length > 8 && (
                                <span className="text-[9px] text-muted-foreground ml-0.5">+{branchCountries.length - 8}</span>
                              )}
                            </div>
                          )}
                          {/* Service icons */}
                          {services.length > 0 && (
                            <div className="flex items-center gap-1 mt-1 flex-wrap">
                              {services.slice(0, 6).map((s: any, i: number) => {
                                const Icon = getServiceIcon(s.service_category);
                                return <Icon key={i} className={`w-3.5 h-3.5 ${getServiceIconColor(s.service_category)}`} />;
                              })}
                              {services.length > 6 && (
                                <span className="text-[9px] text-muted-foreground">+{services.length - 6}</span>
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
      <div className="flex-1 overflow-y-auto glass-surface">
        {!selectedId ? (
          <div className="flex items-center justify-center h-full text-white/40">
            <div className="text-center space-y-2">
              <Globe className="w-16 h-16 mx-auto opacity-20" />
              <p className="text-lg">Seleziona un partner</p>
              <p className="text-sm text-white/30">
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
  );
}

// ════════════════════════════════════════════════════
// DETAIL PANEL - 2 COLUMN GLASSMORPHISM
// ════════════════════════════════════════════════════

function PartnerDetail({ partner, onToggleFavorite }: { partner: any; onToggleFavorite: () => void }) {
  const [deepSearching, setDeepSearching] = useState(false);
  const queryClient = useQueryClient();

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
    <div className="p-6 space-y-6">
      {/* ═══ HEADER ═══ */}
      <div className="glass-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 flex-1 min-w-0">
            {/* Logo */}
            <div className="shrink-0">
              {partner.logo_url ? (
                <img
                  src={partner.logo_url}
                  alt={partner.company_name}
                  className="w-14 h-14 rounded-xl object-contain bg-white/10 border border-white/20"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-white/10 border border-white/20" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              {/* Row 1: Name + WCA ID */}
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold text-white truncate">{partner.company_name}</h2>
                {partner.wca_id && (
                  <span className="text-xs text-white/40 shrink-0">WCA #{partner.wca_id}</span>
                )}
              </div>
              {/* Row 2: City (bold) + Country with big flag + Type + Office */}
              <div className="mt-1">
                <p className="text-white font-semibold">{partner.city}</p>
                <p className="text-white/60 flex items-center gap-2 mt-0.5">
                  <span className="text-3xl leading-none">{getCountryFlag(partner.country_code)}</span>
                  <span>{partner.country_name}</span>
                  <span className="text-white/20">·</span>
                  <PartnerTypeIcon className="w-5 h-5 text-white/60" />
                  <span className="text-sm">{formatPartnerType(partner.partner_type)}</span>
                  {partner.office_type && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 border border-white/15 text-white/60">
                      {partner.office_type === "head_office" ? "HQ" : "Branch"}
                    </span>
                  )}
                </p>
              </div>
              {/* Row 3: Rating with tooltip + Trophies */}
              <div className="flex items-center gap-4 mt-2">
                {partner.rating > 0 && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1 cursor-help">
                          <MiniStars rating={Number(partner.rating)} size="w-4 h-4" />
                          <span className="text-xs text-white/40 ml-1">High Quality</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[250px]">
                        <p className="text-xs">Valutazione basata su: anzianità WCA, numero filiali, completezza profilo, certificazioni, infrastrutture proprie</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {years > 0 && <TrophyRow years={years} size="w-4 h-4" />}
              </div>
            </div>
          </div>
          {/* Action buttons */}
          <div className="flex gap-2 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="text-white/60 hover:text-white hover:bg-white/10"
              onClick={onToggleFavorite}
            >
              {partner.is_favorite ? <Star className="w-4 h-4 fill-amber-400 text-amber-400" /> : <StarOff className="w-4 h-4" />}
            </Button>
            <Button
              size="sm"
              className="bg-white/10 hover:bg-white/20 text-white border border-white/20"
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
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6">
        {/* ─── LEFT COLUMN (60%) ─── */}
        <div className="space-y-5">
          {/* Transport Services */}
          {transportServices.length > 0 && (
            <div className="glass-section">
              <p className="text-xs text-white/40 uppercase tracking-wider mb-3 font-medium">Servizi di Trasporto</p>
              <div className="grid grid-cols-2 gap-3">
                {transportServices.map((s: any, i: number) => {
                  const Icon = getServiceIcon(s.service_category);
                  return (
                    <div key={i} className="flex items-center gap-3 glass-badge">
                      <Icon className={`w-8 h-8 ${getServiceIconColor(s.service_category)}`} />
                      <span className="text-sm text-white/80">{formatServiceCategory(s.service_category)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Specialty Services */}
          {specialtyServices.length > 0 && (
            <div className="glass-section">
              <p className="text-xs text-white/40 uppercase tracking-wider mb-3 font-medium">Specialità</p>
              <div className="space-y-2">
                {specialtyServices.map((s: any, i: number) => {
                  const Icon = getServiceIcon(s.service_category);
                  return (
                    <div key={i} className="flex items-center gap-3 px-3 py-2">
                      <Icon className={`w-7 h-7 ${getServiceIconColor(s.service_category)}`} />
                      <span className="text-sm text-white/80">{formatServiceCategory(s.service_category)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Company Contacts - Collapsible */}
          <Collapsible>
            <CollapsibleTrigger className="w-full">
              <div className="glass-badge flex items-center gap-3 w-full cursor-pointer hover:bg-white/12 transition-colors">
                <Building2 className="w-8 h-8 text-sky-400" />
                <span className="text-sm text-white/80 font-medium">Contatti Azienda</span>
                <ChevronDown className="w-4 h-4 text-white/30 ml-auto" />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 glass-section space-y-2">
                {partner.phone && (
                  <a href={`tel:${partner.phone}`} className="flex items-center gap-3 text-sm text-white/70 hover:text-white">
                    <Phone className="w-5 h-5 text-green-400" /> {partner.phone}
                  </a>
                )}
                {partner.email && (
                  <a href={`mailto:${partner.email}`} className="flex items-center gap-3 text-sm text-white/70 hover:text-white">
                    <Mail className="w-5 h-5 text-blue-400" /> {partner.email}
                  </a>
                )}
                {partner.website && (
                  <a
                    href={partner.website.startsWith("http") ? partner.website : `https://${partner.website}`}
                    target="_blank"
                    rel="noopener"
                    className="flex items-center gap-3 text-sm text-white/70 hover:text-white"
                  >
                    <Globe className="w-5 h-5 text-sky-400" /> {partner.website}
                  </a>
                )}
                {partner.address && (
                  <div className="flex items-start gap-3 text-sm text-white/50">
                    <MapPin className="w-5 h-5 mt-0.5 text-white/30" /> {partner.address}
                  </div>
                )}
                {partner.member_since && (
                  <div className="flex items-center gap-3 text-sm text-white/50">
                    <Calendar className="w-5 h-5 text-white/30" />
                    Membro dal {format(new Date(partner.member_since), "MMMM yyyy", { locale: it })} ({years} anni)
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Office Contacts - Collapsible */}
          {partner.partner_contacts?.length > 0 && (
            <Collapsible>
              <CollapsibleTrigger className="w-full">
                <div className="glass-badge flex items-center gap-3 w-full cursor-pointer hover:bg-white/12 transition-colors">
                  <Users className="w-8 h-8 text-emerald-400" />
                  <span className="text-sm text-white/80 font-medium">
                    Contatti Ufficio ({partner.partner_contacts.length})
                  </span>
                  <ChevronDown className="w-4 h-4 text-white/30 ml-auto" />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 space-y-2">
                  {partner.partner_contacts.map((c: any) => (
                    <div key={c.id} className="glass-section space-y-1.5">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm text-white">{c.name}</p>
                        {c.is_primary && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30">Primary</span>
                        )}
                      </div>
                      {c.title && <p className="text-xs text-white/40">{c.title}</p>}
                      <div className="flex items-center gap-4 text-sm">
                        {c.email && (
                          <a href={`mailto:${c.email}`} className="flex items-center gap-1.5 text-white/60 hover:text-white">
                            <Mail className="w-4 h-4 text-blue-400" /> {c.email}
                          </a>
                        )}
                        {c.direct_phone && (
                          <a href={`tel:${c.direct_phone}`} className="flex items-center gap-1.5 text-white/60 hover:text-white">
                            <Phone className="w-4 h-4 text-green-400" /> {c.direct_phone}
                          </a>
                        )}
                        {c.mobile && (
                          <a href={`tel:${c.mobile}`} className="flex items-center gap-1.5 text-white/60 hover:text-white">
                            <Phone className="w-4 h-4 text-emerald-400" /> {c.mobile}
                          </a>
                        )}
                      </div>
                      <SocialLinks partnerId={partner.id} contactId={c.id} compact />
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
                <div className="glass-badge flex items-center gap-3 w-full cursor-pointer hover:bg-white/12 transition-colors">
                  <FileText className="w-8 h-8 text-amber-400" />
                  <span className="text-sm text-white/80 font-medium">Profilo Aziendale</span>
                  <ChevronDown className="w-4 h-4 text-white/30 ml-auto" />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 glass-section space-y-4">
                  <p className="text-sm text-white/60 leading-relaxed whitespace-pre-line">{partner.profile_description}</p>
                  {/* Branch countries in profile */}
                  {branchCountries.length > 0 && (
                    <div>
                      <p className="text-xs text-white/30 uppercase tracking-wider mb-2">Branch Offices</p>
                      <div className="flex flex-wrap gap-2">
                        {branchCountries.map(({ code, name }) => (
                          <span key={code} className="flex items-center gap-1.5 text-sm text-white/60 glass-badge py-1 px-2">
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
          <div className="glass-section">
            <p className="text-xs text-white/40 uppercase tracking-wider mb-3 font-medium flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Timeline ({partner.interactions?.length || 0})
            </p>
            {!partner.interactions?.length ? (
              <div className="text-center py-6 text-white/20">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nessuna interazione</p>
              </div>
            ) : (
              <div className="space-y-3">
                {partner.interactions.map((interaction: any) => (
                  <div key={interaction.id} className="flex gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium shrink-0 bg-white/10 text-white/60">
                      {interaction.interaction_type?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-sm text-white">{interaction.subject}</p>
                        <span className="text-xs text-white/30 shrink-0">
                          {format(new Date(interaction.interaction_date), "d MMM yyyy", { locale: it })}
                        </span>
                      </div>
                      {interaction.notes && <p className="text-xs text-white/40 mt-1 line-clamp-2">{interaction.notes}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Reminders */}
          {partner.reminders?.length > 0 && (
            <div className="glass-section">
              <p className="text-xs text-white/40 uppercase tracking-wider mb-3 font-medium">Promemoria</p>
              <div className="space-y-2">
                {partner.reminders.map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
                    <div>
                      <p className="font-medium text-sm text-white">{r.title}</p>
                      <p className="text-xs text-white/40">
                        Scadenza: {format(new Date(r.due_date), "d MMM yyyy", { locale: it })}
                      </p>
                    </div>
                    <span className={cn(
                      "text-xs px-2 py-0.5 rounded-full",
                      r.status === "completed" ? "bg-emerald-500/20 text-emerald-300" : "bg-sky-500/20 text-sky-300"
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
        <div className="space-y-5">
          {/* Social Links - Large */}
          <div className="glass-section">
            <p className="text-xs text-white/40 uppercase tracking-wider mb-3 font-medium">Social</p>
            <SocialLinks partnerId={partner.id} />
          </div>

          {/* Branch Countries */}
          {branchCountries.length > 0 && (
            <div className="glass-section">
              <p className="text-xs text-white/40 uppercase tracking-wider mb-3 font-medium">
                Paesi Collegati ({branchCountries.length})
              </p>
              <div className="grid grid-cols-2 gap-3">
                {branchCountries.map(({ code, name }) => (
                  <div key={code} className="flex flex-col items-center gap-1 glass-badge py-3">
                    <span className="text-4xl">{getCountryFlag(code)}</span>
                    <span className="text-xs text-white/60 text-center">{name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Key Markets from enrichment */}
          {enrichment?.key_markets && Array.isArray(enrichment.key_markets) && enrichment.key_markets.length > 0 && (
            <div className="glass-section">
              <p className="text-xs text-white/40 uppercase tracking-wider mb-3 font-medium">Mercati Principali</p>
              <div className="grid grid-cols-2 gap-3">
                {enrichment.key_markets.map((market: string, i: number) => (
                  <div key={i} className="flex flex-col items-center gap-1 glass-badge py-3">
                    <Globe className="w-6 h-6 text-sky-400" />
                    <span className="text-xs text-white/60 text-center">{market}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mini Globe */}
          {hasBranches && (
            <div className="glass-section">
              <p className="text-xs text-white/40 uppercase tracking-wider mb-3 font-medium">Mappa Filiali</p>
              <Suspense fallback={<Skeleton className="w-full h-[200px] rounded-xl" />}>
                <PartnerMiniGlobe
                  partnerCountryCode={partner.country_code}
                  partnerCity={partner.city}
                  branchCities={partner.branch_cities}
                />
              </Suspense>
            </div>
          )}

          {/* Networks */}
          {partner.partner_networks?.length > 0 && (
            <div className="glass-section">
              <p className="text-xs text-white/40 uppercase tracking-wider mb-3 font-medium">Network</p>
              <div className="space-y-3">
                {partner.partner_networks.map((n: any) => (
                  <div key={n.id} className="glass-badge flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center border border-white/15">
                      <Globe className="w-6 h-6 text-sky-400" />
                    </div>
                    <div>
                      <p className="text-sm text-white font-medium">{n.network_name}</p>
                      {n.expires && (
                        <p className="text-xs text-white/30">Scade {format(new Date(n.expires), "MMM yyyy")}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Certifications */}
          {partner.partner_certifications?.length > 0 && (
            <div className="glass-section">
              <p className="text-xs text-white/40 uppercase tracking-wider mb-3 font-medium">Certificazioni</p>
              <div className="space-y-2">
                {partner.partner_certifications.map((c: any, i: number) => (
                  <div key={i} className="glass-badge flex items-center gap-3">
                    <ShieldCheck className="w-7 h-7 text-emerald-400" />
                    <span className="text-sm text-white/80">{c.certification}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* KPI Summary */}
          <div className="glass-section">
            <p className="text-xs text-white/40 uppercase tracking-wider mb-3 font-medium">KPI</p>
            <div className="grid grid-cols-2 gap-3">
              {years > 0 && (
                <div className="glass-badge flex flex-col items-center py-3">
                  <Calendar className="w-6 h-6 text-sky-400 mb-1" />
                  <p className="text-lg font-semibold text-white">{years}</p>
                  <p className="text-[10px] text-white/40">Anni WCA</p>
                </div>
              )}
              {Array.isArray(partner.branch_cities) && partner.branch_cities.length > 0 && (
                <div className="glass-badge flex flex-col items-center py-3">
                  <Building2 className="w-6 h-6 text-sky-400 mb-1" />
                  <p className="text-lg font-semibold text-white">{partner.branch_cities.length}</p>
                  <p className="text-[10px] text-white/40">Filiali</p>
                </div>
              )}
              {branchCountries.length > 0 && (
                <div className="glass-badge flex flex-col items-center py-3">
                  <Globe className="w-6 h-6 text-sky-400 mb-1" />
                  <p className="text-lg font-semibold text-white">{branchCountries.length + 1}</p>
                  <p className="text-[10px] text-white/40">Paesi</p>
                </div>
              )}
              {partner.partner_certifications?.length > 0 && (
                <div className="glass-badge flex flex-col items-center py-3">
                  <ShieldCheck className="w-6 h-6 text-emerald-400 mb-1" />
                  <p className="text-lg font-semibold text-white">{partner.partner_certifications.length}</p>
                  <p className="text-[10px] text-white/40">Certificazioni</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
