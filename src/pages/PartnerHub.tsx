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
  StarOff,
  Phone,
  Mail,
  Globe,
  MapPin,
  Calendar,
  MessageSquare,
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
    return { label: "Primo contatto", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300", count: 0 };
  if (interactions.length <= 2)
    return { label: "In conoscenza", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300", count: interactions.length };
  return { label: "Attivo", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300", count: interactions.length };
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
                  ? "bg-red-100 border-red-300 text-red-700 dark:bg-red-900/30 dark:border-red-500/40 dark:text-red-400"
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
                  return (
                    <div
                      key={partner.id}
                      onClick={() => setSelectedId(partner.id)}
                      className={cn(
                        "w-full text-left p-3 hover:bg-accent/50 transition-colors cursor-pointer",
                        selectedId === partner.id && "bg-accent",
                        selectedIds.has(partner.id) && "bg-primary/5"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-1" onClick={(e) => toggleSelection(partner.id, e)}>
                          <Checkbox checked={selectedIds.has(partner.id)} />
                        </div>
                        {/* Logo or flag */}
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
                              <span className="hidden text-2xl leading-none">{getCountryFlag(partner.country_code)}</span>
                              <span className="absolute -bottom-0.5 -right-0.5 text-xs leading-none">
                                {getCountryFlag(partner.country_code)}
                              </span>
                            </>
                          ) : (
                            <span className="text-2xl leading-none">{getCountryFlag(partner.country_code)}</span>
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
                          <div className="flex items-center gap-2 mt-1">
                            {partner.rating && (
                              <span className="text-[10px] text-muted-foreground">★ {Number(partner.rating).toFixed(1)}</span>
                            )}
                            <KpiBadges partner={partner} compact />
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            {q === "complete" && (
                              <span className="text-[9px] flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400">
                                <UserCheck className="w-3 h-3" /> OK
                              </span>
                            )}
                            {q === "partial" && (
                              <span className="text-[9px] flex items-center gap-0.5 text-amber-600 dark:text-amber-400">
                                <AlertTriangle className="w-3 h-3" /> Parziale
                              </span>
                            )}
                            {q === "missing" && (
                              <span className="text-[9px] flex items-center gap-0.5 text-red-600 dark:text-red-400">
                                <UserX className="w-3 h-3" /> No contatti
                              </span>
                            )}
                            {/* Quick contact icons */}
                            {partner.email && <Mail className="w-3 h-3 text-muted-foreground" />}
                            {partner.phone && <Phone className="w-3 h-3 text-muted-foreground" />}
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
                <span className={cn("text-5xl", partner.logo_url && "hidden")}>{getCountryFlag(partner.country_code)}</span>
                <span className="absolute -bottom-1 -right-1 text-lg leading-none">{getCountryFlag(partner.country_code)}</span>
              </>
            ) : (
              <span className="text-5xl">{getCountryFlag(partner.country_code)}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-semibold truncate">{partner.company_name}</h2>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
              <MapPin className="w-4 h-4" />
              {partner.city}, {partner.country_name}
              {partner.wca_id && <Badge variant="outline" className="text-xs ml-1">WCA #{partner.wca_id}</Badge>}
            </div>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge className={cn("text-xs", status.color)}>{status.label}</Badge>
              <Badge variant="secondary" className="text-xs">{formatPartnerType(partner.partner_type)}</Badge>
              {partner.office_type && (
                <Badge variant="outline" className="text-xs">
                  {partner.office_type === "head_office" ? "HQ" : "Branch"}
                </Badge>
              )}
              {partner.rating && (
                <PartnerRating rating={Number(partner.rating)} ratingDetails={partner.rating_details as any} size="sm" />
              )}
            </div>
            <KpiBadges partner={partner} />
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

      {/* ── Services ── */}
      {partner.partner_services?.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-2 font-medium">Servizi & Specialità</p>
          <div className="flex flex-wrap gap-1.5">
            {partner.partner_services.map((s: any, i: number) => (
              <Badge key={i} className={cn(getServiceColor(s.service_category))}>{formatServiceCategory(s.service_category)}</Badge>
            ))}
          </div>
        </div>
      )}

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
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium shrink-0",
                      interaction.interaction_type === "call" && "bg-green-100 text-green-700",
                      interaction.interaction_type === "email" && "bg-blue-100 text-blue-700",
                      interaction.interaction_type === "meeting" && "bg-purple-100 text-purple-700",
                      interaction.interaction_type === "note" && "bg-muted text-muted-foreground"
                    )}
                  >
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
