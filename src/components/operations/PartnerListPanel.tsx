import { useState, useMemo, useCallback, Suspense, lazy } from "react";
import { useCountryStats } from "@/hooks/useCountryStats";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Search, Star, StarHalf, Phone, Mail, Globe, MapPin, Calendar,
  ChevronRight, ChevronDown, Users, User, Loader2, Filter,
  Building2, Plane, Ship, Truck, TrainFront, Package, AlertTriangle,
  Snowflake, Pill, ShoppingCart, Home, FileCheck, Warehouse,
  Anchor, Box, Container, Trophy, ShieldCheck, FileText,
  ArrowLeft, ExternalLink, MessageSquare, Clock, ArrowUpRight,
  Wand2,
} from "lucide-react";

function coverageColor(count: number, total: number, isDark: boolean) {
  if (total === 0 || count === 0) return isDark ? "text-rose-400/60" : "text-rose-400";
  const pct = count / total;
  if (pct >= 0.8) return isDark ? "text-emerald-400" : "text-emerald-600";
  if (pct >= 0.5) return isDark ? "text-amber-400" : "text-amber-600";
  return isDark ? "text-rose-400" : "text-rose-500";
}
import { usePartners, usePartner, useToggleFavorite } from "@/hooks/usePartners";
import { getPartnerContactQuality } from "@/hooks/useContactCompleteness";
import { useBlacklistForPartner } from "@/hooks/useBlacklist";
import {
  getCountryFlag, getYearsMember, formatPartnerType, formatServiceCategory,
  getServiceIconColor, resolveCountryCode,
} from "@/lib/countries";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { EnrichmentCard } from "@/components/partners/EnrichmentCard";
import { SocialLinks } from "@/components/partners/SocialLinks";
import { ActivityList } from "@/components/partners/ActivityList";
import { PartnerRating } from "@/components/partners/PartnerRating";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { t } from "@/components/download/theme";

const SERVICE_ICONS: Record<string, any> = {
  air_freight: Plane, ocean_fcl: Ship, ocean_lcl: Container, road_freight: Truck,
  rail_freight: TrainFront, project_cargo: Package, dangerous_goods: AlertTriangle,
  perishables: Snowflake, pharma: Pill, ecommerce: ShoppingCart, relocations: Home,
  customs_broker: FileCheck, warehousing: Warehouse, nvocc: Anchor,
};
function getServiceIcon(cat: string) { return SERVICE_ICONS[cat] || Box; }

const TRANSPORT_SERVICES = ["air_freight", "ocean_fcl", "ocean_lcl", "road_freight", "rail_freight", "project_cargo"];

function MiniStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => {
        if (i + 1 <= Math.floor(rating)) return <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />;
        if (i + 0.5 <= rating) return <StarHalf key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />;
        return <Star key={i} className="w-3 h-3 text-muted-foreground/30" />;
      })}
    </div>
  );
}

interface PartnerListPanelProps {
  countryCodes: string[];
  countryNames: string[];
  isDark: boolean;
}

export function PartnerListPanel({ countryCodes, countryNames, isDark }: PartnerListPanelProps) {
  const th = t(isDark);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"name_asc" | "rating_desc" | "contacts_desc">("name_asc");
  const [filterIncomplete, setFilterIncomplete] = useState(false);
  const [generatingAliases, setGeneratingAliases] = useState(false);

  const { data: partners, isLoading } = usePartners({
    countries: countryCodes,
    search: search.length >= 2 ? search : undefined,
  });

  const toggleFavorite = useToggleFavorite();
  const queryClient = useQueryClient();

  const handleGenerateAliases = useCallback(async () => {
    if (!countryCodes.length) return;
    setGeneratingAliases(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-aliases", {
        body: { countryCodes },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success(`Alias generati: ${data.processed} aziende, ${data.contacts} contatti`);
        queryClient.invalidateQueries({ queryKey: ["partners"] });
      } else {
        toast.error(data?.error || "Errore nella generazione alias");
      }
    } catch (e: any) {
      toast.error(e?.message || "Errore");
    } finally {
      setGeneratingAliases(false);
    }
  }, [countryCodes, queryClient]);

  const filteredPartners = useMemo(() => {
    let list = filterIncomplete
      ? (partners || []).filter((p: any) => getPartnerContactQuality(p.partner_contacts) !== "complete")
      : partners || [];

    const sorted = [...list];
    switch (sortBy) {
      case "name_asc": return sorted.sort((a: any, b: any) => a.company_name.localeCompare(b.company_name));
      case "rating_desc": return sorted.sort((a: any, b: any) => (b.rating || 0) - (a.rating || 0));
      case "contacts_desc": return sorted.sort((a: any, b: any) => {
        const qa = getPartnerContactQuality(a.partner_contacts);
        const qb = getPartnerContactQuality(b.partner_contacts);
        const order: Record<string, number> = { complete: 0, partial: 1, missing: 2 };
        return (order[qa] || 2) - (order[qb] || 2);
      });
      default: return sorted;
    }
  }, [partners, filterIncomplete, sortBy]);

  const { data: selectedPartner, isLoading: detailLoading } = usePartner(selectedId || "");

  if (selectedId && selectedPartner) {
    return (
      <div className="h-full overflow-auto">
        <PartnerDetail
          partner={selectedPartner}
          onBack={() => setSelectedId(null)}
          onToggleFavorite={() => toggleFavorite.mutate({ id: selectedPartner.id, isFavorite: !selectedPartner.is_favorite })}
          isDark={isDark}
        />
      </div>
    );
  }

  const { data: countryStatsData } = useCountryStats();

  // Aggregate stats for selected countries
  const aggregatedStats = useMemo(() => {
    if (!countryStatsData) return null;
    let total = 0, withProfile = 0, withoutProfile = 0, withEmail = 0, withPhone = 0;
    countryCodes.forEach(cc => {
      const s = countryStatsData.byCountry[cc];
      if (s) {
        total += s.total_partners;
        withProfile += s.with_profile;
        withoutProfile += s.without_profile;
        withEmail += s.with_email;
        withPhone += s.with_phone;
      }
    });
    return { total, withProfile, withoutProfile, withEmail, withPhone };
  }, [countryStatsData, countryCodes]);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="h-full flex flex-col">
        {/* Country Summary Stats */}
        {aggregatedStats && aggregatedStats.total > 0 && (
          <div className={`px-3 pt-3 pb-1 flex-shrink-0`}>
            <div className={`flex items-center gap-3 flex-wrap text-[11px] font-mono rounded-lg border px-3 py-2 ${isDark ? "bg-white/[0.03] border-white/[0.06]" : "bg-slate-50/80 border-slate-200/60"}`}>
              <span className={`flex items-center gap-1 font-bold ${isDark ? "text-slate-200" : "text-slate-700"}`}>
                <Users className="w-3.5 h-3.5" />{aggregatedStats.total}
              </span>
              <span className={`flex items-center gap-1 ${aggregatedStats.withoutProfile > 0 ? (isDark ? "text-orange-400" : "text-orange-600") : (isDark ? "text-emerald-400" : "text-emerald-600")}`}>
                <FileText className="w-3.5 h-3.5" />{aggregatedStats.withProfile}
                {aggregatedStats.withoutProfile > 0 && <span className="text-[9px]">({aggregatedStats.withoutProfile} ✗)</span>}
              </span>
              <span className={`flex items-center gap-1 ${coverageColor(aggregatedStats.withEmail, aggregatedStats.total, isDark)}`}>
                <Mail className="w-3.5 h-3.5" />{aggregatedStats.withEmail}
              </span>
              <span className={`flex items-center gap-1 ${coverageColor(aggregatedStats.withPhone, aggregatedStats.total, isDark)}`}>
                <Phone className="w-3.5 h-3.5" />{aggregatedStats.withPhone}
              </span>
            </div>
          </div>
        )}
        {/* Search + Sort */}
        <div className="p-3 space-y-2 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${th.dim}`} />
              <Input
                placeholder="Cerca partner..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className={`pl-10 h-9 rounded-xl text-sm ${th.input}`}
              />
            </div>
            <Select value={sortBy} onValueChange={v => setSortBy(v as any)}>
              <SelectTrigger className={`w-[140px] h-9 rounded-xl text-xs ${th.selTrigger}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={th.selContent}>
                <SelectItem value="name_asc">Nome A-Z</SelectItem>
                <SelectItem value="rating_desc">Rating ↓</SelectItem>
                <SelectItem value="contacts_desc">Contatti ↓</SelectItem>
              </SelectContent>
            </Select>
            <button
              onClick={() => setFilterIncomplete(!filterIncomplete)}
              className={`flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border transition-all shrink-0 ${
                filterIncomplete
                  ? isDark ? "bg-sky-500/15 text-sky-300 border-sky-500/25" : "bg-sky-50 text-sky-700 border-sky-200"
                  : isDark ? "bg-white/[0.05] border-white/[0.1] text-slate-400" : "bg-white/70 border-slate-200 text-slate-500"
              }`}
            >
              <Filter className="w-3 h-3" />
              Incompleti
            </button>
            <button
              onClick={handleGenerateAliases}
              disabled={generatingAliases || !countryCodes.length}
              className={`flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border transition-all shrink-0 ${
                isDark ? "bg-white/[0.05] border-white/[0.1] text-slate-400 hover:bg-white/[0.1]" : "bg-white/70 border-slate-200 text-slate-500 hover:bg-white"
              } disabled:opacity-40`}
            >
              {generatingAliases ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
              Alias
            </button>
          </div>
          <p className={`text-xs ${th.dim}`}>
            {isLoading ? "Caricamento..." : `${filteredPartners.length} partner in ${countryNames.join(", ")}`}
          </p>
        </div>

        {/* Partner List */}
        <ScrollArea className="flex-1">
          <div className={`${isDark ? "divide-white/[0.06]" : "divide-slate-200/60"} divide-y`}>
            {isLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="p-3 space-y-2">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                ))
              : filteredPartners.map((partner: any) => {
                  const q = getPartnerContactQuality(partner.partner_contacts);
                  const years = getYearsMember(partner.member_since);
                  const contacts = partner.partner_contacts || [];
                  const primaryContact = contacts.find((c: any) => c.is_primary) || contacts[0];

                  return (
                    <div
                      key={partner.id}
                      onClick={() => setSelectedId(partner.id)}
                      className={cn(
                        "p-3 cursor-pointer transition-all duration-200 group",
                        isDark ? "hover:bg-white/[0.06]" : "hover:bg-sky-50/50",
                        q === "missing" && "border-l-4 border-l-red-500",
                        q === "partial" && "border-l-4 border-l-amber-400",
                        q === "complete" && "border-l-4 border-l-emerald-500",
                      )}
                    >
                      <div className="flex items-start gap-3">
                        {partner.logo_url ? (
                          <img src={partner.logo_url} alt="" className="w-8 h-8 rounded-lg object-contain bg-white/10 border border-white/10 shrink-0" onError={e => (e.target as HTMLImageElement).style.display = 'none'} />
                        ) : (
                          <div className={`w-8 h-8 rounded-lg shrink-0 ${isDark ? "bg-white/[0.06]" : "bg-slate-100"}`} />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className={`font-semibold text-sm truncate ${th.h2}`}>{partner.city}</p>
                              <p className={`text-xs truncate ${th.sub}`}>
                                {partner.company_name}
                                {partner.company_alias && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400">{partner.company_alias}</span>}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {years > 0 && (
                                <span className="flex items-center gap-0.5">
                                  <Trophy className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                                  <span className="text-xs font-bold text-amber-500">{years}</span>
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-lg leading-none">{getCountryFlag(partner.country_code)}</span>
                            {partner.rating > 0 && <MiniStars rating={Number(partner.rating)} />}
                          </div>
                          {/* Contact info */}
                          <div className="flex items-center gap-2 mt-1.5 text-xs">
                            {primaryContact ? (
                              <>
                                <span className={`truncate max-w-[100px] ${th.dim}`}>{primaryContact.name}</span>
                                <Mail className={cn("w-3.5 h-3.5", primaryContact.email ? "text-sky-500" : isDark ? "text-white/15" : "text-slate-200")} />
                                <Phone className={cn("w-3.5 h-3.5", (primaryContact.direct_phone || primaryContact.mobile) ? "text-sky-500" : isDark ? "text-white/15" : "text-slate-200")} />
                                {contacts.length > 1 && <span className={`text-[10px] ${th.dim}`}>+{contacts.length - 1}</span>}
                              </>
                            ) : (
                              <span className={`italic ${th.dim}`}>Nessun contatto</span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className={`w-4 h-4 shrink-0 mt-1 ${th.dim} opacity-0 group-hover:opacity-100 transition-opacity`} />
                      </div>
                    </div>
                  );
                })}
          </div>
        </ScrollArea>
      </div>
    </TooltipProvider>
  );
}

/* ══════════════════════════════════════════════ */
/* PARTNER DETAIL - Inline in the panel          */
/* ══════════════════════════════════════════════ */

function PartnerDetail({ partner, onBack, onToggleFavorite, isDark }: { partner: any; onBack: () => void; onToggleFavorite: () => void; isDark: boolean }) {
  const th = t(isDark);
  const queryClient = useQueryClient();
  const [deepSearching, setDeepSearching] = useState(false);
  const { data: blacklistEntries = [] } = useBlacklistForPartner(partner.id);
  const isBlacklisted = blacklistEntries.length > 0;
  const years = getYearsMember(partner.member_since);
  const enrichment = partner.enrichment_data as any;
  const branchCountries = getBranchCountries(partner);

  const handleDeepSearch = useCallback(async () => {
    setDeepSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke("deep-search-partner", { body: { partnerId: partner.id } });
      if (error) throw error;
      if (data?.success) {
        toast.success(`Deep Search completata: ${data.socialLinksFound} social trovati`);
        queryClient.invalidateQueries({ queryKey: ["partner", partner.id] });
      } else { toast.error(data?.error || "Errore"); }
    } catch (e: any) { toast.error(e?.message || "Errore"); }
    finally { setDeepSearching(false); }
  }, [partner.id, queryClient]);

  const contacts = partner.partner_contacts || [];
  const services = partner.partner_services || [];
  const networks = partner.partner_networks || [];
  const transportServices = services.filter((s: any) => TRANSPORT_SERVICES.includes(s.service_category));
  const specialtyServices = services.filter((s: any) => !TRANSPORT_SERVICES.includes(s.service_category));

  return (
    <div className="p-4 space-y-4">
      {/* Back + Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className={`p-1.5 rounded-lg transition-colors ${th.back}`}>
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className={`text-lg font-bold truncate ${th.h2}`}>
            {partner.company_name}
            {partner.company_alias && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 font-normal align-middle">{partner.company_alias}</span>}
          </h2>
          <p className={`text-sm ${th.sub}`}>
            {getCountryFlag(partner.country_code)} {partner.city}, {partner.country_name}
          </p>
        </div>
        {isBlacklisted && <Badge variant="destructive" className="text-xs">Blacklist</Badge>}
        <div className="flex gap-1.5">
          <Button size="sm" variant="outline" onClick={onToggleFavorite} className="h-7 text-xs">
            <Star className={cn("w-3.5 h-3.5", partner.is_favorite && "fill-amber-400 text-amber-400")} />
          </Button>
          <Button size="sm" variant="outline" onClick={handleDeepSearch} disabled={deepSearching} className="h-7 text-xs">
            {deepSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            Deep
          </Button>
          {partner.website && (
            <Button size="sm" variant="outline" asChild className="h-7 text-xs">
              <a href={partner.website.startsWith("http") ? partner.website : `https://${partner.website}`} target="_blank" rel="noopener">
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </Button>
          )}
        </div>
      </div>

      {/* Rating + KPIs */}
      <div className="flex items-center gap-4 flex-wrap">
        {partner.rating > 0 && <PartnerRating rating={Number(partner.rating)} ratingDetails={partner.rating_details as any} />}
        {years > 0 && (
          <div className="flex items-center gap-1">
            <Trophy className="w-4 h-4 text-amber-500 fill-amber-500" />
            <span className={`text-sm font-bold text-amber-500`}>{years} anni WCA</span>
          </div>
        )}
        {partner.membership_expires && (
          <span className={cn("text-xs", new Date(partner.membership_expires) < new Date() ? "text-red-500" : th.dim)}>
            Exp {format(new Date(partner.membership_expires), "MM/yy")}
          </span>
        )}
      </div>

      {/* Contacts */}
      {contacts.length > 0 && (
        <div className={`rounded-xl border p-3 space-y-2 ${isDark ? "bg-white/[0.03] border-white/[0.08]" : "bg-white/50 border-white/80"}`}>
          <p className={`text-xs uppercase tracking-wider font-medium ${th.dim}`}>Contatti ({contacts.length})</p>
          {contacts.map((c: any) => (
            <div key={c.id} className={`p-2.5 rounded-lg border ${isDark ? "bg-white/[0.02] border-white/[0.06]" : "bg-white/60 border-slate-200/60"}`}>
              <div className="flex items-center gap-2">
                <User className={`w-4 h-4 ${th.dim}`} />
                <span className={`text-sm font-medium ${th.h2}`}>{c.name}</span>
                {c.contact_alias && <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">{c.contact_alias}</span>}
                {c.is_primary && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-sky-500/10 text-sky-500 border border-sky-500/20">Primary</span>}
                <div className="flex items-center gap-1 ml-auto">
                  <Mail className={cn("w-3.5 h-3.5", c.email ? "text-sky-500" : isDark ? "text-white/15" : "text-slate-200")} />
                  <Phone className={cn("w-3.5 h-3.5", (c.direct_phone || c.mobile) ? "text-sky-500" : isDark ? "text-white/15" : "text-slate-200")} />
                </div>
              </div>
              {c.title && <p className={`text-xs ml-6 ${th.dim}`}>{c.title}</p>}
              <div className="flex items-center gap-3 text-xs ml-6 mt-1 flex-wrap">
                {c.email && <a href={`mailto:${c.email}`} className={`hover:underline ${th.body}`}>{c.email}</a>}
                {c.direct_phone && <a href={`tel:${c.direct_phone}`} className={`hover:underline ${th.body}`}>{c.direct_phone}</a>}
                {c.mobile && <a href={`tel:${c.mobile}`} className={`hover:underline ${th.body}`}>{c.mobile}</a>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Services */}
      {services.length > 0 && (
        <div className={`rounded-xl border p-3 ${isDark ? "bg-white/[0.03] border-white/[0.08]" : "bg-white/50 border-white/80"}`}>
          <p className={`text-xs uppercase tracking-wider font-medium mb-2 ${th.dim}`}>Servizi</p>
          <div className="flex flex-wrap gap-2">
            {services.map((s: any, i: number) => {
              const Icon = getServiceIcon(s.service_category);
              return (
                <Tooltip key={i}>
                  <TooltipTrigger>
                    <div className={`p-2 rounded-lg border ${isDark ? "bg-white/[0.04] border-white/[0.08]" : "bg-white/60 border-slate-200"}`}>
                      <Icon className={cn("w-5 h-5", getServiceIconColor(s.service_category))} />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>{formatServiceCategory(s.service_category)}</TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </div>
      )}

      {/* Company info */}
      <div className={`rounded-xl border p-3 space-y-2 ${isDark ? "bg-white/[0.03] border-white/[0.08]" : "bg-white/50 border-white/80"}`}>
        <p className={`text-xs uppercase tracking-wider font-medium ${th.dim}`}>Info Azienda</p>
        {partner.phone && <div className="flex items-center gap-2 text-sm"><Phone className="w-4 h-4 text-sky-500" /><span className={th.body}>{partner.phone}</span></div>}
        {partner.email && <div className="flex items-center gap-2 text-sm"><Mail className="w-4 h-4 text-sky-500" /><a href={`mailto:${partner.email}`} className={`hover:underline ${th.body}`}>{partner.email}</a></div>}
        {partner.website && <div className="flex items-center gap-2 text-sm"><Globe className="w-4 h-4 text-sky-400" /><a href={partner.website.startsWith("http") ? partner.website : `https://${partner.website}`} target="_blank" rel="noopener" className={`hover:underline ${th.body}`}>{partner.website}</a></div>}
        {partner.address && <div className="flex items-center gap-2 text-sm"><MapPin className="w-4 h-4 text-rose-400" /><span className={th.body}>{partner.address}</span></div>}
        {partner.member_since && <div className="flex items-center gap-2 text-sm"><Calendar className="w-4 h-4 text-sky-500" /><span className={th.body}>Membro dal {format(new Date(partner.member_since), "MMMM yyyy", { locale: it })}</span></div>}
      </div>

      {/* Networks */}
      {networks.length > 0 && (
        <div className={`rounded-xl border p-3 ${isDark ? "bg-white/[0.03] border-white/[0.08]" : "bg-white/50 border-white/80"}`}>
          <p className={`text-xs uppercase tracking-wider font-medium mb-2 ${th.dim}`}>Network</p>
          <div className="space-y-1.5">
            {networks.map((n: any) => (
              <div key={n.id} className={`flex items-center gap-2 p-2 rounded-lg ${isDark ? "bg-white/[0.03]" : "bg-white/60"}`}>
                <Globe className={`w-4 h-4 ${th.dim}`} />
                <span className={`text-sm ${th.body}`}>{n.network_name}</span>
                {n.expires && <span className={`text-xs ml-auto ${th.dim}`}>Exp {format(new Date(n.expires), "MM/yy")}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Social */}
      <SocialLinks partnerId={partner.id} />

      {/* Enrichment */}
      <EnrichmentCard partner={partner} />

      {/* Activities */}
      <ActivityList partnerId={partner.id} />

      {/* Profile */}
      {partner.profile_description && (
        <Collapsible>
          <CollapsibleTrigger className="w-full">
            <div className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer ${isDark ? "bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.06]" : "bg-white/50 border-white/80 hover:bg-white/70"}`}>
              <FileText className={`w-4 h-4 ${th.dim}`} />
              <span className={`text-xs font-medium ${th.body}`}>Profilo Aziendale</span>
              <ChevronDown className={`w-3.5 h-3.5 ml-auto ${th.dim}`} />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <p className={`text-sm leading-relaxed whitespace-pre-line mt-2 p-3 rounded-xl ${isDark ? "bg-white/[0.02] text-slate-300" : "bg-white/40 text-slate-600"}`}>
              {partner.profile_description}
            </p>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

function getBranchCountries(partner: any): { code: string; name: string }[] {
  if (!partner.branch_cities || !Array.isArray(partner.branch_cities)) return [];
  const map = new Map<string, string>();
  partner.branch_cities.forEach((b: any) => {
    const code = b?.country_code || b?.country;
    if (code && code !== partner.country_code) map.set(code, b?.country_name || code);
  });
  return Array.from(map.entries()).map(([code, name]) => ({ code, name }));
}
