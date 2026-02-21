import { useState, useMemo, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Search, Phone, Mail, Globe, MapPin, ChevronRight, Users,
  Filter, Cpu, Box, CheckSquare, Loader2, Sparkles,
} from "lucide-react";
import { usePartners, useToggleFavorite, usePartner } from "@/hooks/usePartners";
import { getPartnerContactQuality } from "@/hooks/useContactCompleteness";
import { useBlacklistByPartnerIds } from "@/hooks/useBlacklist";
import {
  getCountryFlag, getYearsMember, formatServiceCategory,
  getServiceIconColor,
} from "@/lib/countries";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PartnerFiltersSheet from "@/components/partners/PartnerFiltersSheet";
import { BulkActionBar } from "@/components/partners/BulkActionBar";
import { AssignActivityDialog } from "@/components/partners/AssignActivityDialog";
import { PartnerFilters } from "@/hooks/usePartners";
import { PartnerDetailFull } from "@/components/partners/PartnerDetailFull";
import { CountryCards } from "@/components/partners/CountryCards";
import { CountryWorkbench } from "@/components/partners/CountryWorkbench";

import { getServiceIcon, TRANSPORT_SERVICES, SPECIALTY_SERVICES } from "@/components/partners/shared/ServiceIcons";
import { MiniStars } from "@/components/partners/shared/MiniStars";
import { TrophyRow } from "@/components/partners/shared/TrophyRow";
import { CardSocialIcons } from "@/components/partners/shared/CardSocialIcons";
import { getBranchCountries, sortPartners, type SortOption } from "@/lib/partnerUtils";

export default function PartnerHub() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [filterIncomplete, setFilterIncomplete] = useState(false);
  const [filters, setFilters] = useState<PartnerFilters>({});
  const [sortBy, setSortBy] = useState<SortOption>("name_asc");

  // Navigation: "countries" (Level 1) | "country" (Level 2) | "list" (flat list)
  const [viewLevel, setViewLevel] = useState<"countries" | "country" | "list">("countries");
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);

  const [deepSearching, setDeepSearching] = useState(false);
  const [deepSearchProgress, setDeepSearchProgress] = useState<{ current: number; total: number } | null>(null);

  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const mergedFilters: PartnerFilters = {
    ...filters,
    search: search.length >= 2 ? search : undefined,
  };

  const { data: partners, isLoading } = usePartners(mergedFilters);
  const toggleFavorite = useToggleFavorite();

  const partnerIds = useMemo(() => (partners || []).map((p: any) => p.id), [partners]);
  const { data: blacklistedIds } = useBlacklistByPartnerIds(partnerIds);

  const filteredPartners = useMemo(() => {
    let list = filterIncomplete
      ? (partners || []).filter((p: any) => getPartnerContactQuality(p.partner_contacts) !== "complete")
      : partners || [];

    if (filters.networks && filters.networks.length > 0) {
      list = list.filter((p: any) => {
        const pNetworks = (p.partner_networks || []).map((n: any) => n.network_name);
        return filters.networks!.some((fn) => pNetworks.some((pn: string) => pn.toLowerCase().includes(fn.toLowerCase())));
      });
    }
    if (filters.certifications && filters.certifications.length > 0) {
      list = list.filter((p: any) => {
        const pCerts = (p.partner_certifications || []).map((c: any) => c.certification);
        return filters.certifications!.every((fc) => pCerts.includes(fc));
      });
    }
    if (filters.minRating && filters.minRating > 0) {
      list = list.filter((p: any) => (p.rating || 0) >= filters.minRating!);
    }
    if (filters.minYearsMember && filters.minYearsMember > 0) {
      list = list.filter((p: any) => getYearsMember(p.member_since) >= filters.minYearsMember!);
    }
    if (filters.hasBranches) {
      list = list.filter((p: any) => p.has_branches === true);
    }
    if (filters.expiresWithinMonths) {
      const now = new Date();
      if (filters.expiresWithinMonths === "active") {
        list = list.filter((p: any) => {
          if (!p.membership_expires) return false;
          return new Date(p.membership_expires) >= now;
        });
      } else {
        const months = filters.expiresWithinMonths as number;
        const deadline = new Date(now);
        deadline.setMonth(deadline.getMonth() + months);
        list = list.filter((p: any) => {
          if (!p.membership_expires) return false;
          const exp = new Date(p.membership_expires);
          return exp >= now && exp <= deadline;
        });
      }
    }

    return sortPartners(list, sortBy);
  }, [partners, filterIncomplete, sortBy, filters]);

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
    (filters.networks?.length || 0) +
    (filters.certifications?.length || 0) +
    (filters.minRating ? 1 : 0) +
    (filters.minYearsMember ? 1 : 0) +
    (filters.hasBranches ? 1 : 0) +
    (filters.expiresWithinMonths ? 1 : 0) +
    (filters.favorites ? 1 : 0);

  const toggleSelection = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === filteredPartners.length && filteredPartners.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredPartners.map((p: any) => p.id)));
    }
  }, [selectedIds.size, filteredPartners]);

  const handleBulkDeepSearch = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setDeepSearching(true);
    let success = 0, failed = 0;

    for (let i = 0; i < ids.length; i++) {
      setDeepSearchProgress({ current: i + 1, total: ids.length });
      try {
        const { error } = await supabase.functions.invoke("deep-search-partner", {
          body: { partnerId: ids[i] },
        });
        if (error) throw error;
        success++;
      } catch {
        failed++;
      }
    }

    setDeepSearching(false);
    setDeepSearchProgress(null);
    queryClient.invalidateQueries({ queryKey: ["partners"] });
    toast.success(`Deep Search completata: ${success} ok, ${failed} errori`);
  }, [selectedIds, queryClient]);

  const handleBulkEmail = useCallback(() => {
    const ids = Array.from(selectedIds);
    navigate("/email-composer", { state: { partnerIds: ids } });
  }, [selectedIds, navigate]);

  const handleCountrySelect = (countryCode: string) => {
    setSelectedCountry(countryCode);
    setViewLevel("country");
    setSelectedIds(new Set());
  };

  const handleBackToCountries = () => {
    setViewLevel("countries");
    setSelectedCountry(null);
    setSelectedIds(new Set());
  };

  const handleDownloadProfiles = (countryCode: string) => {
    navigate("/", { state: { preselectedCountry: countryCode } });
  };

  // Active events bar
  const renderEventsBar = () => {
    if (!deepSearching || !deepSearchProgress) return null;
    return (
      <div className="px-4 py-2 border-b border-border/50 bg-primary/5">
        <div className="flex items-center gap-2 text-xs">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
          <span className="font-medium">
            Deep Search {deepSearchProgress.current}/{deepSearchProgress.total}...
          </span>
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${(deepSearchProgress.current / deepSearchProgress.total) * 100}%` }}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <TooltipProvider delayDuration={200}>
    <div className="h-[calc(100vh-4rem)] -m-6 relative overflow-hidden">
      {/* Ambient gradient backgrounds */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 dark:block hidden" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-sky-500/[0.07] via-transparent to-transparent dark:block hidden" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-violet-500/[0.05] via-transparent to-transparent dark:block hidden" />
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-sky-50/30 dark:hidden" />

      <ResizablePanelGroup direction="horizontal" className="relative z-10 h-full">
      <ResizablePanel defaultSize={35} minSize={25} maxSize={50}>
      {/* ═══ LEFT PANEL ═══ */}
      <div className="h-full flex flex-col bg-white/[0.03] dark:bg-white/[0.03] bg-white/60 backdrop-blur-xl border-r border-white/[0.08] dark:border-white/[0.08] border-slate-200/60">
        {/* Header */}
        <div className="p-4 border-b border-white/[0.08] dark:border-white/[0.08] border-slate-200/60 space-y-3 bg-gradient-to-br from-sky-500/[0.06] via-transparent to-violet-500/[0.04]">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <Globe className="w-5 h-5 text-primary" />
              Partner
            </h1>
            <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
              <button
                onClick={() => { setViewLevel("countries"); setSelectedCountry(null); }}
                className={cn(
                  "px-2 py-1 text-xs rounded-md transition-all",
                  viewLevel !== "list" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <MapPin className="w-3.5 h-3.5 inline mr-1" />
                Paesi
              </button>
              <button
                onClick={() => setViewLevel("list")}
                className={cn(
                  "px-2 py-1 text-xs rounded-md transition-all",
                  viewLevel === "list" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Users className="w-3.5 h-3.5 inline mr-1" />
                Lista
              </button>
            </div>
          </div>
          {viewLevel === "list" && (
            <>
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
                onClick={handleSelectAll}
                className={cn(
                  "flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-all shrink-0",
                  selectedIds.size > 0 && selectedIds.size === filteredPartners.length
                    ? "bg-primary/10 border-primary/30 text-primary"
                    : "bg-muted border-border text-muted-foreground hover:bg-accent"
                )}
              >
                <CheckSquare className="w-3 h-3" />
                {selectedIds.size > 0 && selectedIds.size === filteredPartners.length ? "Deseleziona" : "Sel. tutti"}
              </button>
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
            </>
          )}
        </div>

        {/* Active events bar */}
        {renderEventsBar()}

        {/* Content based on viewLevel */}
        {viewLevel === "countries" ? (
          <CountryCards
            onSelectCountry={handleCountrySelect}
            onDownloadProfiles={handleDownloadProfiles}
          />
        ) : viewLevel === "country" && selectedCountry ? (
          <CountryWorkbench
            countryCode={selectedCountry}
            partners={partners || []}
            onBack={handleBackToCountries}
            onSelectPartner={setSelectedId}
            selectedId={selectedId}
            selectedIds={selectedIds}
            onToggleSelection={(id) => toggleSelection(id)}
            onSelectAllFiltered={(ids) => {
              if (ids.length === 0) {
                setSelectedIds(new Set());
              } else {
                setSelectedIds(new Set(ids));
              }
            }}
            onDownloadProfiles={handleDownloadProfiles}
          />
        ) : (
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
                        "w-full text-left p-3 transition-all duration-300 cursor-pointer relative group/card",
                        "hover:bg-white/[0.06] dark:hover:bg-white/[0.06] hover:bg-sky-50/50",
                        "hover:scale-[1.01] hover:shadow-lg hover:shadow-sky-500/[0.06]",
                        selectedId === partner.id && "bg-white/[0.08] dark:bg-white/[0.08] bg-sky-50/80 shadow-md shadow-sky-500/[0.08]",
                        selectedIds.has(partner.id) && "bg-primary/5",
                        q === "missing" && "border-l-4 border-l-destructive",
                        q === "partial" && "border-l-4 border-l-amber-400",
                        q === "complete" && "border-l-4 border-l-sky-500",
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
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-semibold text-sm truncate text-foreground">{partner.city}</p>
                              <p className="text-xs text-muted-foreground truncate">{partner.company_name}</p>
                            </div>
                            <div className="flex flex-col items-end gap-0.5 shrink-0 text-right">
                              {partner.member_since && (
                                <span className="text-[10px] text-muted-foreground">
                                  Est. {new Date(partner.member_since).getFullYear()}
                                </span>
                              )}
                              {years > 0 && <TrophyRow years={years} />}
                              {partner.membership_expires && (
                                <span className={cn(
                                  "text-[10px]",
                                  new Date(partner.membership_expires) < new Date() ? "text-destructive" : "text-muted-foreground"
                                )}>
                                  Exp {format(new Date(partner.membership_expires), "MM/yy")}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xl leading-none">{getCountryFlag(partner.country_code)}</span>
                            {partner.rating > 0 && <MiniStars rating={Number(partner.rating)} />}
                            {!!(partner.enrichment_data as any)?.deep_search_at && (
                              <Tooltip>
                                <TooltipTrigger>
                                  <span className="w-5 h-5 bg-sky-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm">D</span>
                                </TooltipTrigger>
                                <TooltipContent>Deep Search – {format(new Date((partner.enrichment_data as any).deep_search_at), "dd/MM/yyyy")}</TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                          {/* Inline contacts status */}
                          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                            {(() => {
                              const contacts = partner.partner_contacts || [];
                              const primaryContact = contacts.find((c: any) => c.is_primary) || contacts[0];
                              if (!primaryContact) return <span className="italic text-muted-foreground/40">Nessun contatto</span>;
                              return (
                                <>
                                  <span className="truncate max-w-[120px]">{primaryContact.name}</span>
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <Mail className={cn("w-3.5 h-3.5", primaryContact.email ? "text-sky-500 fill-sky-500" : "text-muted-foreground/25")} />
                                    </TooltipTrigger>
                                    <TooltipContent>{primaryContact.email || "Email mancante"}</TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <Phone className={cn("w-3.5 h-3.5", (primaryContact.direct_phone || primaryContact.mobile) ? "text-sky-500 fill-sky-500" : "text-muted-foreground/25")} />
                                    </TooltipTrigger>
                                    <TooltipContent>{primaryContact.direct_phone || primaryContact.mobile || "Telefono mancante"}</TooltipContent>
                                  </Tooltip>
                                  {contacts.length > 1 && (
                                    <span className="text-[10px] text-muted-foreground">+{contacts.length - 1}</span>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                          {/* Service icons */}
                          {(() => {
                            const transport = services.filter((s: any) => TRANSPORT_SERVICES.includes(s.service_category));
                            const specialty = services.filter((s: any) => SPECIALTY_SERVICES.includes(s.service_category));
                            return (
                              <>
                                {transport.length > 0 && (
                                  <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                                    {transport.map((s: any, i: number) => {
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
                                {specialty.length > 0 && (
                                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                                    {specialty.map((s: any, i: number) => {
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
                                          <Cpu className="w-4 h-4 text-slate-500 fill-slate-500" />
                                        </TooltipTrigger>
                                        <TooltipContent>Capacità Tecnologiche</TooltipContent>
                                      </Tooltip>
                                    )}
                                  </div>
                                )}
                              </>
                            );
                          })()}
                          {/* Social */}
                          <CardSocialIcons partnerId={partner.id} />
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
        )}
      </div>

      {/* Bulk actions */}
      <BulkActionBar
        count={selectedIds.size}
        onClear={() => setSelectedIds(new Set())}
        onAssignActivity={() => setAssignDialogOpen(true)}
        onDeepSearch={handleBulkDeepSearch}
        onEmail={handleBulkEmail}
        deepSearching={deepSearching}
        deepSearchProgress={deepSearchProgress}
        partnerIds={Array.from(selectedIds)}
      />
      <AssignActivityDialog
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        partnerIds={Array.from(selectedIds)}
        onSuccess={() => setSelectedIds(new Set())}
      />
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={65} minSize={40}>
      {/* ═══ RIGHT PANEL: Detail ═══ */}
      <div className="h-full overflow-y-auto bg-transparent">
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
          <PartnerDetailFull
            partner={selectedPartner}
            onToggleFavorite={() =>
              toggleFavorite.mutate({ id: selectedPartner.id, isFavorite: !selectedPartner.is_favorite })
            }
          />
        ) : null}
      </div>
      </ResizablePanel>
      </ResizablePanelGroup>
    </div>
    </TooltipProvider>
  );
}
