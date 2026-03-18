import { useState, useMemo, useCallback } from "react";
import { useCreateActivities } from "@/hooks/useActivities";
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
  Search, Globe, MapPin, Users,
  Filter, CheckSquare, Sparkles,
} from "lucide-react";
import { usePartners, useToggleFavorite, usePartner } from "@/hooks/usePartners";
import { getPartnerContactQuality } from "@/hooks/useContactCompleteness";
import { useCountryStats } from "@/hooks/useCountryStats";
import type { CountrySortBy } from "@/components/partners/CountryCards";

import { useBlacklistByPartnerIds } from "@/hooks/useBlacklist";
import { getCountryFlag, getYearsMember } from "@/lib/countries";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PartnerFiltersSheet from "@/components/partners/PartnerFiltersSheet";
import { UnifiedActionBar } from "@/components/partners/UnifiedActionBar";
import { AssignActivityDialog } from "@/components/partners/AssignActivityDialog";
import { PartnerFilters } from "@/hooks/usePartners";
import { PartnerDetailFull } from "@/components/partners/PartnerDetailFull";
import { CountryCards } from "@/components/partners/CountryCards";
import { CountryWorkbench } from "@/components/partners/CountryWorkbench";
import { sortPartners, type SortOption } from "@/lib/partnerUtils";
import { PartnerListItem } from "@/components/partners/PartnerListItem";
import { useBatchSocialLinks } from "@/hooks/useSocialLinks";
import { useDeepSearch } from "@/hooks/useDeepSearchRunner";
import { PartnerAIBar } from "@/components/partners/PartnerAIBar";

export default function PartnerHub() {
  const [search, setSearch] = useState("");
  const [countrySearch, setCountrySearch] = useState("");
  const [countrySortBy, setCountrySortBy] = useState<CountrySortBy>("total");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [filterIncomplete, setFilterIncomplete] = useState(false);
  const [filters, setFilters] = useState<PartnerFilters>({});
  const [sortBy, setSortBy] = useState<SortOption>("name_asc");

  // Navigation: "countries" (Level 1) | "country" (Level 2) | "list" (flat list)
  const [viewLevel, setViewLevel] = useState<"countries" | "country" | "list">("countries");
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [showAI, setShowAI] = useState(false);

  const { data: countryStatsData } = useCountryStats();

  
  const [sendingToWorkspace, setSendingToWorkspace] = useState(false);
  const [aliasGenerating, setAliasGenerating] = useState<"company" | "contact" | null>(null);

  const deepSearch = useDeepSearch();

  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const mergedFilters: PartnerFilters = {
    ...filters,
    search: search.length >= 2 ? search : undefined,
    countries: viewLevel === "country" && selectedCountry
      ? [selectedCountry]
      : filters.countries,
  };

  const { data: partners, isLoading } = usePartners(mergedFilters);
  const toggleFavorite = useToggleFavorite();
  const createActivities = useCreateActivities();

  const partnerIds = useMemo(() => (partners || []).map((p: any) => p.id), [partners]);
  const { data: blacklistedIds } = useBlacklistByPartnerIds(partnerIds);
  const { data: socialLinksMap } = useBatchSocialLinks(partnerIds);

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

  const handleBulkDeepSearch = useCallback(() => {
    const ids = filteredPartners
      .filter((p: any) => selectedIds.has(p.id))
      .map((p: any) => p.id);
    if (ids.length === 0) return;
    deepSearch.start(ids);
  }, [selectedIds, filteredPartners, deepSearch]);

  const handleStopDeepSearch = useCallback(() => {
    deepSearch.stop();
  }, [deepSearch]);

  const handleBulkEmail = useCallback(() => {
    const ids = Array.from(selectedIds);
    navigate("/email-composer", { state: { partnerIds: ids } });
  }, [selectedIds, navigate]);

  const handleSendToWorkspace = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    // Check which partners have at least one email (partner email or contact email)
    const allPartners = filteredPartners || [];
    const selected = allPartners.filter((p: any) => ids.includes(p.id));
    const withEmail = selected.filter((p: any) => {
      if (p.email) return true;
      const contacts = p.partner_contacts || [];
      return contacts.some((c: any) => c.email);
    });
    const withoutEmail = selected.length - withEmail.length;

    if (withEmail.length === 0) {
      toast.error("Nessun partner selezionato ha un indirizzo email disponibile");
      return;
    }
    if (withoutEmail > 0) {
      toast.warning(`${withoutEmail} partner esclusi perché senza email`);
    }

    setSendingToWorkspace(true);
    try {
      await createActivities.mutateAsync(
        withEmail.map((p: any) => ({
          partner_id: p.id,
          activity_type: "send_email" as const,
          title: "Outreach email",
          priority: "medium",
        }))
      );
      toast.success(`${withEmail.length} attività create — apertura Workspace...`);
      setSelectedIds(new Set());
      navigate("/workspace");
    } catch (e) {
      toast.error("Errore nella creazione delle attività");
    } finally {
      setSendingToWorkspace(false);
    }
  }, [selectedIds, filteredPartners, createActivities, navigate]);

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

  const handleCountryDeepSearch = useCallback((partnerIds: string[]) => {
    if (partnerIds.length === 0) return;
    setSelectedIds(new Set(partnerIds));
    deepSearch.start(partnerIds);
  }, [deepSearch]);

  const handleGenerateAliases = useCallback(async (countryCode: string, type: "company" | "contact") => {
    setAliasGenerating(type);
    const toastId = toast.loading("Generazione alias in corso...");
    try {
      const { error } = await supabase.functions.invoke("generate-aliases", {
        body: { countryCode, type },
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      toast.success(`Alias ${type === "company" ? "azienda" : "contatti"} generati con successo`, { id: toastId });
    } catch (e: any) {
      toast.error(`Errore generazione alias: ${e.message || "sconosciuto"}`, { id: toastId });
    } finally {
      setAliasGenerating(null);
    }
  }, [queryClient]);

  // Single partner deep search handler
  const handleSingleDeepSearch = useCallback(async (partnerId: string) => {
    deepSearch.start([partnerId]);
  }, [deepSearch]);

  // Unified action bar handlers for single-partner context
  const handleUnifiedEmail = useCallback(() => {
    if (selectedIds.size > 0) {
      handleBulkEmail();
    } else if (selectedId) {
      navigate("/email-composer", { state: { partnerIds: [selectedId] } });
    }
  }, [selectedIds, selectedId, navigate, handleBulkEmail]);

  const handleUnifiedWorkspace = useCallback(async () => {
    if (selectedIds.size > 0) {
      handleSendToWorkspace();
    } else if (selectedId) {
      // Check email for single partner
      const partner = (filteredPartners || []).find((p: any) => p.id === selectedId);
      const hasEmail = partner?.email || (partner?.partner_contacts || []).some((c: any) => c.email);
      if (!hasEmail) {
        toast.error("Questo partner non ha un indirizzo email disponibile");
        return;
      }
      setSendingToWorkspace(true);
      try {
        await createActivities.mutateAsync([{
          partner_id: selectedId,
          activity_type: "send_email" as const,
          title: "Outreach email",
          priority: "medium",
        }]);
        toast.success("Attività creata — apertura Workspace...");
        navigate("/workspace");
      } catch { toast.error("Errore"); }
      finally { setSendingToWorkspace(false); }
    }
  }, [selectedIds, selectedId, filteredPartners, createActivities, navigate, handleSendToWorkspace]);

  const handleUnifiedAssignActivity = useCallback(() => {
    if (selectedIds.size === 0 && selectedId) {
      setSelectedIds(new Set([selectedId]));
    }
    setAssignDialogOpen(true);
  }, [selectedIds, selectedId]);

  return (
    <TooltipProvider delayDuration={200}>
    <div className="h-[calc(100vh-3.25rem)] relative overflow-hidden flex flex-col">
      {/* ═══ UNIFIED ACTION BAR ═══ */}
      <UnifiedActionBar
        selectedIds={selectedIds}
        focusedPartner={selectedPartner || null}
        onClearSelection={() => setSelectedIds(new Set())}
        onAssignActivity={handleUnifiedAssignActivity}
        onDeepSearch={handleBulkDeepSearch}
        onStopDeepSearch={handleStopDeepSearch}
        onEmail={handleUnifiedEmail}
        onSendToWorkspace={handleUnifiedWorkspace}
        sendingToWorkspace={sendingToWorkspace}
        deepSearching={deepSearch.running}
        deepSearchProgress={deepSearch.current ? { current: deepSearch.current.index, total: deepSearch.current.total } : null}
        onSingleDeepSearch={handleSingleDeepSearch}
        singleDeepSearching={deepSearch.running && deepSearch.current?.total === 1}
      />
      <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0">
      <ResizablePanel defaultSize={35} minSize={25} maxSize={50}>
      {/* ═══ LEFT PANEL ═══ */}
      <div className="h-full flex flex-col border-r border-border bg-background">
        {/* Header — restructured */}
        <div className="h-[52px] flex items-center gap-3 px-4 border-b border-border/30 bg-background shrink-0">
          {/* Left: toggle with totals */}
          <div className="flex items-center gap-0.5 rounded-lg border border-border/40 p-0.5 shrink-0">
            <button
              onClick={() => { setViewLevel("countries"); setSelectedCountry(null); setCountrySortBy("name"); }}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md transition-all font-medium tabular-nums",
                viewLevel !== "list"
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              )}
            >
              <MapPin className="w-3 h-3 shrink-0" />
              <span className="font-bold">{countryStatsData ? Object.keys(countryStatsData.byCountry).length : "…"}</span>
              <span>Paesi</span>
            </button>
            <button
              onClick={() => { setViewLevel(viewLevel === "list" ? "list" : "countries"); setCountrySortBy("total"); }}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md transition-all font-medium tabular-nums",
                viewLevel === "list"
                  ? "bg-accent text-accent-foreground"
                  : countrySortBy === "total"
                    ? "bg-accent/60 text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              )}
            >
              <Users className="w-3 h-3 shrink-0" />
              <span className="font-bold">{countryStatsData ? countryStatsData.global.total.toLocaleString() : "…"}</span>
              <span>Partner</span>
            </button>
          </div>

          {/* Center: search */}
          {viewLevel !== "country" && (
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder={viewLevel === "list" ? "Cerca partner..." : "Cerca paese..."}
                value={viewLevel === "list" ? search : countrySearch}
                onChange={(e) => viewLevel === "list" ? setSearch(e.target.value) : setCountrySearch(e.target.value)}
                className="pl-9 h-8 text-[13px] rounded-lg border-border/40"
              />
            </div>
          )}

          {/* AI toggle */}
          <Button
            variant={showAI ? "default" : "ghost"}
            size="sm"
            className={cn("h-7 w-7 p-0 shrink-0", showAI && "shadow-sm")}
            onClick={() => setShowAI(!showAI)}
            title="Assistente AI"
          >
            <Sparkles className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* AI Bar — collapsible */}
        {showAI && (
          <div className="px-3 py-2 border-b border-violet-500/15 bg-gradient-to-r from-violet-500/[0.04] to-purple-500/[0.03]">
            <PartnerAIBar
              viewContext={{
                viewLevel,
                selectedCountry,
                totalPartners: filteredPartners?.length ?? 0,
                selectedCount: selectedIds.size,
              }}
            />
          </div>
        )}

        {/* Filters bar (list view only) */}
        {viewLevel === "list" && (
          <div className="px-4 py-2 border-b border-border/30 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <PartnerFiltersSheet
                filters={filters}
                setFilters={setFilters}
                countries={countryOptions}
                activeFilterCount={activeFilterCount}
              />
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                <SelectTrigger className="h-7 text-xs w-[140px] rounded-md">
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
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleSelectAll}
                className={cn(
                  "flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium transition-all shrink-0",
                  "micro-badge-blue",
                  selectedIds.size > 0 && selectedIds.size === filteredPartners.length
                    && "ring-1 ring-current shadow-[0_0_8px_currentColor]"
                )}
              >
                <CheckSquare className="w-3 h-3" />
                {selectedIds.size > 0 && selectedIds.size === filteredPartners.length ? "Deseleziona" : "Sel. tutti"}
              </button>
              <button
                onClick={() => setFilterIncomplete(!filterIncomplete)}
                className={cn(
                  "flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium transition-all shrink-0",
                  "micro-badge-red",
                  filterIncomplete && "ring-1 ring-current shadow-[0_0_8px_currentColor]"
                )}
              >
                <Filter className="w-3 h-3" />
                Incompleti
              </button>
            </div>
          </div>
        )}




        {/* Content based on viewLevel */}
        {viewLevel === "countries" ? (
          <CountryCards
            onSelectCountry={handleCountrySelect}
            search={countrySearch}
            sortBy={countrySortBy}
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
          />
        ) : (
        <ScrollArea className="flex-1">
          <div className="divide-y divide-border">
            {isLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="p-4 space-y-2">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                ))
              : filteredPartners.map((partner: any) => (
                  <PartnerListItem
                    key={partner.id}
                    partner={partner}
                    isSelected={selectedId === partner.id}
                    isChecked={selectedIds.has(partner.id)}
                    socialLinks={socialLinksMap?.get(partner.id) || []}
                    onSelect={setSelectedId}
                    onToggleSelection={toggleSelection}
                  />
                ))}
          </div>
        </ScrollArea>
        )}
      </div>

      <AssignActivityDialog
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        partnerIds={Array.from(selectedIds)}
        partnerNames={Object.fromEntries(
          (filteredPartners || []).filter((p: any) => selectedIds.has(p.id)).map((p: any) => [p.id, p.company_alias || p.company_name])
        )}
        partnerContactInfo={(filteredPartners || []).filter((p: any) => selectedIds.has(p.id)).map((p: any) => ({
          id: p.id,
          name: p.company_alias || p.company_name,
          hasEmail: !!(p.email || (p.partner_contacts || []).some((c: any) => c.email)),
          hasPhone: !!((p.partner_contacts || []).some((c: any) => c.mobile || c.direct_phone) || p.phone || p.mobile),
        }))}
        onSuccess={() => setSelectedIds(new Set())}
      />
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={65} minSize={40}>
      {/* ═══ RIGHT PANEL: Detail ═══ */}
      <div className="h-full overflow-y-auto">
        {!selectedId ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center space-y-1">
              <Globe className="w-10 h-10 mx-auto opacity-15" />
              <p className="text-sm font-medium">Seleziona un partner</p>
              <p className="text-xs text-muted-foreground/60">
                {filteredPartners.length} disponibili
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
