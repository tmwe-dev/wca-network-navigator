import { useState, useCallback, Suspense, lazy } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  UserCheck,
  UserX,
  AlertTriangle,
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
  getServiceColor,
  getServiceIconName,
} from "@/lib/countries";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { KpiBadges } from "@/components/agents/KpiBadges";
import { EnrichmentCard } from "@/components/agents/EnrichmentCard";
import { SocialLinks } from "@/components/agents/SocialLinks";
import { BulkActionBar } from "@/components/agents/BulkActionBar";
import { AssignActivityDialog } from "@/components/agents/AssignActivityDialog";
import { ActivityList } from "@/components/agents/ActivityList";
import { PartnerFilters } from "@/hooks/usePartners";

const PartnerMiniGlobe = lazy(() =>
  import("@/components/partners/PartnerMiniGlobe").then((m) => ({ default: m.PartnerMiniGlobe }))
);

function getContactStatus(interactions: any[] | undefined) {
  if (!interactions || interactions.length === 0)
    return { label: "Primo contatto", icon: Circle, count: 0 };
  if (interactions.length <= 2)
    return { label: "In conoscenza", icon: ArrowUpRight, count: interactions.length };
  return { label: "Attivo", icon: CheckCircle2, count: interactions.length };
}

const SERVICE_ICON_MAP: Record<string, any> = {
  Plane: Plane, Ship: Ship, Truck: Truck, TrainFront: TrainFront,
  Package: Package, AlertTriangle: AlertTriangle, Snowflake: Snowflake,
  Pill: Pill, ShoppingCart: ShoppingCart, Home: Home, FileCheck: FileCheck,
  Warehouse: Warehouse, Anchor: Anchor, Box: Box,
};

function ServiceIcon({ name, className }: { name: string; className?: string }) {
  const Icon = SERVICE_ICON_MAP[name] || Box;
  return <Icon className={className} />;
}

/* ── Star display for list items ── */
function MiniStars({ rating, size = "w-3 h-3" }: { rating: number; size?: string }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => {
        if (i + 1 <= Math.floor(rating)) return <Star key={i} className={`${size} fill-amber-400 text-amber-400`} />;
        if (i + 0.5 <= rating) return <StarHalf key={i} className={`${size} fill-amber-400 text-amber-400`} />;
        return <Star key={i} className={`${size} text-muted-foreground/20`} />;
      })}
    </div>
  );
}

/* ── Trophy row for years of membership ── */
function TrophyRow({ years }: { years: number }) {
  if (years <= 0) return null;
  const display = Math.min(years, 20);
  return (
    <div className="flex items-center gap-0.5 flex-wrap">
      {Array.from({ length: display }).map((_, i) => (
        <Trophy key={i} className="w-3 h-3 text-amber-500" />
      ))}
      {years > 20 && <span className="text-[9px] text-muted-foreground ml-0.5">+{years - 20}</span>}
    </div>
  );
}

/* ── Extract unique branch countries ── */
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

function cleanPhoneForWhatsApp(phone: string): string {
  return phone.replace(/[\s\-\(\)\+]/g, "").replace(/^00/, "");
}

export default function PartnerHub() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [filterIncomplete, setFilterIncomplete] = useState(false);
  const [filters, setFilters] = useState<PartnerFilters>({});

  const mergedFilters: PartnerFilters = {
    ...filters,
    search: search.length >= 2 ? search : undefined,
  };

  const { data: partners, isLoading } = usePartners(mergedFilters);
  const toggleFavorite = useToggleFavorite();

  const filteredPartners = filterIncomplete
    ? (partners || []).filter((p: any) => getPartnerContactQuality(p.partner_contacts) !== "complete")
    : partners;

  const { data: selectedPartner, isLoading: detailLoading } = usePartner(selectedId || "");

  // Build country options for filters
  const countryOptions = (() => {
    if (!partners) return [];
    const map: Record<string, { code: string; name: string; flag: string; count: number }> = {};
    partners.forEach((p: any) => {
      if (!map[p.country_code]) {
        map[p.country_code] = { code: p.country_code, name: p.country_name, flag: getCountryFlag(p.country_code), count: 0 };
      }
      map[p.country_code].count++;
    });
    return Object.values(map);
  })();

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
      {/* Left: Partner list */}
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
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {isLoading ? "Caricamento..." : `${filteredPartners?.length || 0} partner`}
            </p>
            <button
              onClick={() => setFilterIncomplete(!filterIncomplete)}
              className={cn(
                "flex items-center gap-1 text-xs px-2 py-1 rounded-md border transition-all",
                filterIncomplete
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "bg-muted border-border text-muted-foreground hover:bg-accent"
              )}
            >
              <Filter className="w-3 h-3" />
              Solo incompleti
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
              : filteredPartners?.map((partner: any) => {
                  const q = getPartnerContactQuality(partner.partner_contacts);
                  const years = getYearsMember(partner.member_since);
                  const whatsappNum = partner.mobile || partner.phone;
                  const hasPersonalEmail = partner.partner_contacts?.some((c: any) => !!c.email);
                  const hasPersonalPhone = partner.partner_contacts?.some((c: any) => !!c.direct_phone || !!c.mobile);
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
                        {/* Logo or empty */}
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
                              <span className="absolute -bottom-0.5 -right-0.5 text-xs leading-none">
                                {getCountryFlag(partner.country_code)}
                              </span>
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
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {partner.city} · {formatPartnerType(partner.partner_type)}
                          </p>
                          {/* Star rating */}
                          {partner.rating > 0 && (
                            <div className="mt-1">
                              <MiniStars rating={Number(partner.rating)} size="w-3 h-3" />
                            </div>
                          )}
                          {/* Trophies for years */}
                          {years > 0 && (
                            <div className="mt-1">
                              <TrophyRow years={years} />
                            </div>
                          )}
                          {/* Contact availability icons */}
                          <div className="flex items-center gap-1.5 mt-1">
                            {hasPersonalPhone && <Phone className="w-3 h-3 text-primary" />}
                            {hasPersonalEmail && <Mail className="w-3 h-3 text-primary" />}
                            {whatsappNum && <MessageCircle className="w-3 h-3 text-primary" />}
                            {q === "missing" && (
                              <span className="text-[9px] text-destructive flex items-center gap-0.5">
                                <UserX className="w-3 h-3" /> No contatti
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
                      </div>
                    </div>
                  );
                })}
          </div>
        </ScrollArea>
      </div>

      {/* Bulk action bar */}
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

      {/* Right: Detail */}
      <div className="flex-1 overflow-y-auto bg-background">
        {!selectedId ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center space-y-2">
              <Globe className="w-16 h-16 mx-auto opacity-20" />
              <p className="text-lg">Seleziona un partner</p>
              <p className="text-sm text-muted-foreground/70">
                {filteredPartners?.length || 0} partner disponibili
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

// ─── Detail Panel ───────────────────────────────────────────

function PartnerDetail({ partner, onToggleFavorite }: { partner: any; onToggleFavorite: () => void }) {
  const status = getContactStatus(partner.interactions);
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

  return (
    <div className="p-6 space-y-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 flex-1 min-w-0">
          {/* Logo */}
          <div className="relative shrink-0">
            {partner.logo_url ? (
              <>
                <img
                  src={partner.logo_url}
                  alt={partner.company_name}
                  className="w-14 h-14 rounded-xl object-contain bg-muted border"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                    (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
                  }}
                />
                <div className="hidden w-14 h-14 rounded-xl bg-muted border" />
                <span className="absolute -bottom-1 -right-1 text-lg leading-none">{getCountryFlag(partner.country_code)}</span>
              </>
            ) : (
              <div className="w-14 h-14 rounded-xl bg-muted border" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-semibold truncate">{partner.company_name}</h2>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
              <MapPin className="w-4 h-4" />
              {partner.city}, {partner.country_name}
              {partner.wca_id && <Badge variant="outline" className="text-xs ml-1">WCA #{partner.wca_id}</Badge>}
            </div>

            {/* Star rating + trophies */}
            <div className="flex items-center gap-4 mt-2">
              {partner.rating > 0 && (
                <PartnerRating rating={Number(partner.rating)} ratingDetails={partner.rating_details as any} size="md" />
              )}
              {getYearsMember(partner.member_since) > 0 && (
                <TrophyRow years={getYearsMember(partner.member_since)} />
              )}
            </div>

            {/* Status + type badges */}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {(() => { const StatusIcon = status.icon; return (
                <Badge variant="secondary" className="text-xs gap-1">
                  <StatusIcon className="w-3 h-3" /> {status.label}
                </Badge>
              ); })()}
              <Badge variant="secondary" className="text-xs">{formatPartnerType(partner.partner_type)}</Badge>
              {partner.office_type && (
                <Badge variant="outline" className="text-xs">
                  {partner.office_type === "head_office" ? "HQ" : "Branch"}
                </Badge>
              )}
            </div>

            {/* Contact availability icons */}
            {(() => {
              const q = getPartnerContactQuality(partner.partner_contacts);
              const hasPersonalEmail = partner.partner_contacts?.some((c: any) => !!c.email);
              const hasPersonalPhone = partner.partner_contacts?.some((c: any) => !!c.direct_phone || !!c.mobile);
              const whatsappNum = partner.mobile || partner.phone;
              return (
                <div className="flex items-center gap-2 mt-2">
                  {hasPersonalPhone && (
                    <span className="flex items-center gap-1 text-xs text-primary">
                      <Phone className="w-3.5 h-3.5" /> Telefono
                    </span>
                  )}
                  {hasPersonalEmail && (
                    <span className="flex items-center gap-1 text-xs text-primary">
                      <Mail className="w-3.5 h-3.5" /> Email
                    </span>
                  )}
                  {whatsappNum && (
                    <span className="flex items-center gap-1 text-xs text-primary">
                      <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                    </span>
                  )}
                  {q === "missing" && (
                    <span className="flex items-center gap-1 text-xs text-destructive">
                      <UserX className="w-3.5 h-3.5" /> No contatti personali
                    </span>
                  )}
                </div>
              );
            })()}

            <div className="mt-2">
              <SocialLinks partnerId={partner.id} />
            </div>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={onToggleFavorite}>
            {partner.is_favorite ? <Star className="w-4 h-4 fill-amber-400 text-amber-400" /> : <StarOff className="w-4 h-4" />}
          </Button>
          <Button variant="default" size="sm" onClick={handleDeepSearch} disabled={deepSearching}>
            {deepSearching ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
            Deep Search
          </Button>
        </div>
      </div>

      {/* ── Branch Countries (tags) ── */}
      {(() => {
        const branchCountries = getBranchCountries(partner);
        if (branchCountries.length === 0) return null;
        return (
          <div>
            <p className="text-xs text-muted-foreground mb-2 font-medium flex items-center gap-1">
              <Globe className="w-3.5 h-3.5" /> Paesi Collegati ({branchCountries.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {branchCountries.map(({ code, name }) => (
                <Badge key={code} variant="outline" className="text-xs gap-1">
                  {getCountryFlag(code)} {name}
                </Badge>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ── Services & Specialties ── */}
      {partner.partner_services?.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-2 font-medium">Specialità & Servizi</p>
          <div className="flex flex-wrap gap-1.5">
            {partner.partner_services.map((s: any, i: number) => (
              <Badge key={i} variant="secondary" className="text-xs gap-1">
                <ServiceIcon name={getServiceIconName(s.service_category)} className="w-3 h-3" />
                {formatServiceCategory(s.service_category)}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* ── Info grid + Mini globe ── */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6">
        {/* Left: Contact info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Contatti Azienda</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {partner.phone && (
              <a href={`tel:${partner.phone}`} className="flex items-center gap-2 text-sm hover:text-primary">
                <Phone className="w-4 h-4 text-muted-foreground" /> {partner.phone}
              </a>
            )}
            {partner.email && (
              <a href={`mailto:${partner.email}`} className="flex items-center gap-2 text-sm hover:text-primary">
                <Mail className="w-4 h-4 text-muted-foreground" /> {partner.email}
              </a>
            )}
            {partner.website && (
              <a
                href={partner.website.startsWith("http") ? partner.website : `https://${partner.website}`}
                target="_blank"
                rel="noopener"
                className="flex items-center gap-2 text-sm hover:text-primary"
              >
                <Globe className="w-4 h-4 text-muted-foreground" /> {partner.website}
              </a>
            )}
            {partner.address && (
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                <span className="text-muted-foreground">{partner.address}</span>
              </div>
            )}
            {partner.member_since && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  Membro dal {format(new Date(partner.member_since), "MMMM yyyy", { locale: it })} ({getYearsMember(partner.member_since)} anni)
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: Mini Globe */}
        {hasBranches && (
          <Suspense fallback={<Skeleton className="w-[200px] h-[200px] rounded-xl" />}>
            <PartnerMiniGlobe
              partnerCountryCode={partner.country_code}
              partnerCity={partner.city}
              branchCities={partner.branch_cities}
            />
          </Suspense>
        )}
      </div>

      {/* ── Office Contacts ── */}
      {partner.partner_contacts?.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="w-4 h-4" />
              Contatti Ufficio ({partner.partner_contacts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {partner.partner_contacts.map((c: any) => (
                <div key={c.id} className="p-3 rounded-lg border space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{c.name}</p>
                      {c.is_primary && <Badge className="text-[9px] px-1.5 py-0 bg-primary/10 text-primary">Primary</Badge>}
                    </div>
                    <SocialLinks partnerId={partner.id} contactId={c.id} compact />
                  </div>
                  {c.title && <p className="text-xs text-muted-foreground">{c.title}</p>}
                  <div className="flex items-center gap-4 text-sm">
                    {c.email && (
                      <a href={`mailto:${c.email}`} className="flex items-center gap-1.5 hover:text-primary">
                        <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>{c.email}</span>
                      </a>
                    )}
                    {c.direct_phone && (
                      <a href={`tel:${c.direct_phone}`} className="flex items-center gap-1.5 hover:text-primary">
                        <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>{c.direct_phone}</span>
                      </a>
                    )}
                    {c.mobile && (
                      <a href={`tel:${c.mobile}`} className="flex items-center gap-1.5 hover:text-primary">
                        <Phone className="w-3.5 h-3.5 text-emerald-500" />
                        <span>{c.mobile}</span>
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Profile Description (collapsible) ── */}
      {partner.profile_description && (
        <Collapsible defaultOpen={partner.profile_description.length < 300}>
          <Card>
            <CollapsibleTrigger className="w-full">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold">Profilo Aziendale</CardTitle>
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{partner.profile_description}</p>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* ── Enrichment ── */}
      <EnrichmentCard partner={partner} />

      {/* ── Networks & Certifications ── */}
      {(partner.partner_networks?.length > 0 || partner.partner_certifications?.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          {partner.partner_networks?.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Network</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {partner.partner_networks.map((n: any) => (
                    <div key={n.id} className="flex items-center justify-between text-sm">
                      <span>{n.network_name}</span>
                      {n.expires && (
                        <span className="text-xs text-muted-foreground">Scade {format(new Date(n.expires), "MMM yyyy")}</span>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          {partner.partner_certifications?.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Certificazioni</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {partner.partner_certifications.map((c: any, i: number) => (
                    <Badge key={i} variant="outline">{c.certification}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── Activities ── */}
      <ActivityList partnerId={partner.id} />

      {/* ── CRM Timeline ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Timeline Interazioni ({partner.interactions?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!partner.interactions?.length ? (
            <div className="text-center py-6 text-muted-foreground">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nessuna interazione registrata</p>
            </div>
          ) : (
            <div className="space-y-3">
              {partner.interactions.map((interaction: any) => (
                <div key={interaction.id} className="flex gap-3 p-3 rounded-lg border">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium shrink-0 bg-muted text-muted-foreground">
                    {interaction.interaction_type?.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm">{interaction.subject}</p>
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
        </CardContent>
      </Card>

      {/* ── Reminders ── */}
      {partner.reminders?.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Promemoria</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {partner.reminders.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="font-medium text-sm">{r.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Scadenza: {format(new Date(r.due_date), "d MMM yyyy", { locale: it })}
                    </p>
                  </div>
                  <Badge variant={r.status === "completed" ? "secondary" : "default"} className="text-xs">
                    {r.status === "completed" ? "Completato" : "In attesa"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
