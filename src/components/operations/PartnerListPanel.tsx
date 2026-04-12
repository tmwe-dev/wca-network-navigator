import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useAppNavigate } from "@/hooks/useAppNavigate";
import { useInView } from "@/hooks/useInView";
import { SendEmailDialog } from "@/components/operations/SendEmailDialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  Search, Telescope, Inbox, LayoutGrid, Plane, RotateCcw, X, ArrowUpDown,
} from "lucide-react";
import { UnifiedBulkActionBar } from "@/components/shared/UnifiedBulkActionBar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePartnersPaginated } from "@/hooks/usePartnersPaginated";
import { useToggleFavorite } from "@/hooks/usePartners";
import { getCountryFlag, getYearsMember } from "@/lib/countries";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

import { usePartnerListStats } from "@/hooks/usePartnerListStats";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { IconIndicator, FilterActionBar } from "./partner-list/SubComponents";
import { PartnerVirtualList } from "./PartnerVirtualList";
import { insertCockpitQueueItems } from "@/data/cockpitQueue";
import { createActivities } from "@/data/activities";

/* ── Props ── */
interface PartnerListPanelProps {
  countryCodes: string[];
  countryNames: string[];
  isDark: boolean;
  onDeepSearch?: (partnerIds: string[]) => void;
  onGenerateAliases?: (countryCodes: string[], type: "company" | "contact") => void;
  deepSearchRunning?: boolean;
  aliasGenerating?: boolean;
  directoryOnly?: boolean;
  onDirectoryOnlyChange?: (v: boolean) => void;
  onSelectPartner?: (id: string | null) => void;
  selectedPartnerId?: string | null;
}

export function PartnerListPanel({
  countryCodes, countryNames, isDark,
  onDeepSearch, onGenerateAliases,
  deepSearchRunning, aliasGenerating,
  directoryOnly: directoryOnlyProp, onDirectoryOnlyChange,
  onSelectPartner, selectedPartnerId,
}: PartnerListPanelProps) {
  const g = useGlobalFilters();
  const navigate = useNavigate();
  type ProgressFilterKey = "deep" | null;
  const [progressFilter, setProgressFilter] = useState<ProgressFilterKey>(null);
  const [emailTarget, setEmailTarget] = useState<{ email: string; name: string; company: string; partnerId: string } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [hideHolding, setHideHolding] = useState(true);
  const [activeCountryTab, setActiveCountryTab] = useState<string | null>(null);
  const tabsRef = useRef<HTMLDivElement>(null);

  const activeSearch = g.filters.networkSearch.trim();
  const activeSort = g.filters.networkSort;
  const activeQuality = g.filters.networkQuality;
  const hasSelectedCountries = countryCodes.length > 0;

  const {
    data: paginatedData,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = usePartnersPaginated({
    countries: countryCodes,
    search: activeSearch.length >= 2 ? activeSearch : undefined,
    quality: activeQuality !== "all" ? activeQuality : undefined,
    hideHolding,
    sort: activeSort,
  });

  const partners = useMemo(() => {
    if (!paginatedData) return [];
    return paginatedData.pages.flatMap(p => p.partners);
  }, [paginatedData]);

  // Infinite scroll sentinel
  const { ref: loadMoreRef, inView: loadMoreInView } = useInView();
  useEffect(() => {
    if (loadMoreInView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [loadMoreInView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const toggleFavorite = useToggleFavorite();

  const { stats, verified, missingDeep } = usePartnerListStats({ countryCodes, partners });
  const totalCount = paginatedData?.pages?.[0]?.total ?? stats.total;
  const currentSortLabel = useMemo(() => {
    switch (activeSort) {
      case "rating": return "Rating";
      case "recent": return "Più recenti";
      default: return "Nome";
    }
  }, [activeSort]);
  const headerTitle = useMemo(() => {
    if (countryCodes.length === 0) return "Tutti i paesi";
    if (countryCodes.length === 1) return countryNames[0] || countryCodes[0];
    return `${countryCodes.length} paesi`;
  }, [countryCodes, countryNames]);

  // ── Filtered & sorted partners ──
  const holdingCount = useMemo(() => {
    return (partners || []).filter((p: any) => p.lead_status && p.lead_status !== "new").length;
  }, [partners]);

  const filteredPartners = useMemo(() => {
    let list = partners || [];

    if (progressFilter === "deep") {
      list = list.filter((p: any) => !(p.enrichment_data && (p.enrichment_data as any)?.deep_search_at));
    }

    // Country tab filter
    if (activeCountryTab) {
      list = list.filter((p: any) => p.country_code === activeCountryTab);
    }

    return list;
  }, [partners, progressFilter, activeCountryTab]);

  // Country tab counts for the tab bar
  const countryTabCounts = useMemo(() => {
    if (countryCodes.length <= 1) return [];
    let list = partners || [];
    if (progressFilter === "deep") {
      list = list.filter((p: any) => !(p.enrichment_data && (p.enrichment_data as any)?.deep_search_at));
    }
    const counts: Record<string, number> = {};
    for (const p of list as any[]) {
      const cc = p.country_code || "??";
      counts[cc] = (counts[cc] || 0) + 1;
    }
    return countryCodes.map(cc => ({ code: cc, name: countryNames[countryCodes.indexOf(cc)] || cc, count: counts[cc] || 0 }));
  }, [countryCodes, countryNames, partners, progressFilter]);

  // Reset active tab when countries change
  useEffect(() => {
    setActiveCountryTab(null);
  }, [countryCodes.join(",")]);

  const togglePartnerSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const handleSendTo = useCallback(async (destination: "cockpit" | "workspace") => {
    if (selectedIds.size === 0) return;
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id;
    if (!userId) { toast.error("Utente non autenticato"); return; }
    const partnerList = (partners || []).filter((p: any) => selectedIds.has(p.id));

    if (destination === "cockpit") {
      const items: { source_type: string; source_id: string; partner_id: string; user_id: string; status: string }[] = [];
      for (const p of partnerList as any[]) {
        const contacts = (p.partner_contacts || []) as any[];
        if (contacts.length > 0) {
          for (const c of contacts) {
            items.push({ source_type: "partner_contact", source_id: c.id, partner_id: p.id, user_id: userId, status: "queued" });
          }
        } else {
          items.push({ source_type: "partner_contact", source_id: p.id, partner_id: p.id, user_id: userId, status: "queued" });
        }
      }
      if (items.length > 0) {
        await insertCockpitQueueItems(items);
        // Store for auto-preselection in Cockpit
        const { addCockpitPreselection } = await import("@/lib/cockpitPreselection");
        addCockpitPreselection(items.map(i => i.source_id));
      }
      toast.success(`${partnerList.length} partner inviati a Cockpit`);
    } else {
      const inserts = partnerList.map((p: any) => {
        const contacts = p.partner_contacts || [];
        const primary = contacts.find((c: any) => c.is_primary) || contacts[0];
        return {
          activity_type: "send_email" as const,
          title: `Email a ${p.company_name}`,
          source_type: "partner",
          source_id: p.id,
          partner_id: p.id,
          selected_contact_id: primary?.id || null,
          status: "pending" as const,
          source_meta: {
            company_name: p.company_name,
            country_code: p.country_code,
            city: p.city,
            contact_name: primary?.name || null,
            contact_email: primary?.email || null,
          },
          user_id: userId,
        };
      });
      await createActivities(inserts as any);
      toast.success(`${inserts.length} partner inviati a Workspace`);
    }
    setSelectedIds(new Set());
    const tab = destination === "cockpit" ? "cockpit" : "workspace";
    navigate(`/outreach?tab=${tab}`);
  }, [selectedIds, partners, navigate]);

  const handleSelectPartner = useCallback((id: string) => {
    if (onSelectPartner) onSelectPartner(id);
  }, [onSelectPartner]);

  // Auto-select first partner when list loads and nothing is selected
  useEffect(() => {
    if (!selectedPartnerId && filteredPartners.length > 0 && onSelectPartner) {
      onSelectPartner((filteredPartners[0] as any).id);
    }
  }, [filteredPartners, selectedPartnerId, onSelectPartner]);

  const toggleProgressFilter = (key: ProgressFilterKey) => {
    setProgressFilter(prev => prev === key ? null : key);
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="h-full min-h-0 flex flex-col overflow-hidden">
        {/* ═══ COMPACT HEADER ═══ */}
        <div className="px-3 pt-2.5 pb-1 flex-shrink-0 space-y-2">
          {/* ROW 1: Country + count + deep search filter */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-0.5 flex-shrink-0">
              {hasSelectedCountries ? (
                <>
                  {countryCodes.slice(0, 5).map(cc => (
                    <span key={cc} className="text-lg leading-none">{getCountryFlag(cc)}</span>
                  ))}
                  {countryCodes.length > 5 && <span className={cn("text-[10px] font-bold ml-0.5", "text-muted-foreground")}>+{countryCodes.length - 5}</span>}
                </>
              ) : (
                <span className="text-lg leading-none">🌍</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-bold truncate text-foreground">
                {headerTitle}
              </h2>
              <span className="text-[10px] font-mono text-muted-foreground">
                {stats.total} partner
              </span>
            </div>
            {/* Deep Search filter only */}
            <IconIndicator icon={Telescope} count={stats.total - stats.withDeep} label="Senza Deep Search" isDark={isDark} onClick={() => toggleProgressFilter("deep")} active={progressFilter === "deep"} verified={verified.deep} />
          </div>

          {/* ROW 2: Active filters summary + Reset */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {activeSearch && (
              <button
                onClick={() => g.setNetworkSearch("")}
                className="inline-flex max-w-[180px] items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary hover:bg-primary/20 transition-colors group"
              >
                <Search className="h-3 w-3" />
                <span className="truncate">{activeSearch}</span>
                <X className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            )}
            {hasSelectedCountries && (
              <button
                onClick={() => g.setNetworkSelectedCountries(new Set())}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary hover:bg-primary/20 transition-colors group"
              >
                🌍 {countryCodes.length} paesi
                <X className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            )}
            {activeQuality !== "all" && (
              <button
                onClick={() => g.setNetworkQuality("all")}
                className="inline-flex items-center rounded-full bg-muted/40 px-2 py-1 text-[10px] font-medium text-muted-foreground hover:bg-muted/60 transition-colors group"
              >
                Filtro attivo
                <X className="h-2.5 w-2.5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="inline-flex items-center gap-1 rounded-full bg-muted/40 px-2 py-1 text-[10px] font-medium text-muted-foreground hover:bg-muted/60 transition-colors cursor-pointer">
                  <ArrowUpDown className="h-2.5 w-2.5" />
                  Ordine: {currentSortLabel}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[120px]">
                {[
                  { value: "name", label: "Nome" },
                  { value: "rating", label: "Rating" },
                  { value: "recent", label: "Più recenti" },
                ].map(o => (
                  <DropdownMenuItem
                    key={o.value}
                    onClick={() => g.setNetworkSort(o.value)}
                    className={cn("text-xs", activeSort === o.value && "font-bold text-primary")}
                  >
                    {o.label}
                    {activeSort === o.value && " ✓"}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Reset all filters */}
            {(activeSearch || hasSelectedCountries || activeQuality !== "all" || activeSort !== "name") && (
              <button
                onClick={() => {
                  g.setNetworkSearch("");
                  g.setNetworkQuality("all");
                  g.setNetworkSort("name");
                  g.setNetworkSelectedCountries(new Set());
                  g.setNetworkDirectoryOnly(false);
                }}
                className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-1 text-[10px] font-medium text-destructive hover:bg-destructive/20 transition-colors"
              >
                <RotateCcw className="h-2.5 w-2.5" /> Reset
              </button>
            )}

            <span className="ml-auto text-[10px] tabular-nums whitespace-nowrap text-muted-foreground">
              {isLoading ? "..." : `${filteredPartners.length}${totalCount > 0 ? ` / ${totalCount}` : ""}${progressFilter ? " filtrati" : ""}`}
            </span>
          </div>

          {/* Filter Action Bar (deep search only) */}
          {progressFilter && filteredPartners.length > 0 && (
            <FilterActionBar
              filter={progressFilter}
              count={filteredPartners.length}
              isDark={isDark}
              onDownload={() => {}}
              onDeepSearch={() => {
                const ids = filteredPartners.map((p: any) => p.id);
                if (ids.length > 0) onDeepSearch?.(ids);
              }}
              onGenerateAlias={(type) => onGenerateAliases?.(countryCodes, type)}
              deepSearchRunning={deepSearchRunning}
              aliasGenerating={aliasGenerating}
            />
          )}

          {/* ROW 3: Select all + Hide holding pattern toggle */}
          <div className="flex items-center gap-2">
            <Checkbox
              checked={filteredPartners.length > 0 && selectedIds.size === filteredPartners.length}
              onCheckedChange={(checked) => {
                if (checked) setSelectedIds(new Set(filteredPartners.map((p: any) => p.id)));
                else setSelectedIds(new Set());
              }}
              aria-label="Seleziona tutti"
              className="shrink-0"
            />
            <span className="text-[10px] text-muted-foreground">Tutti</span>
            <div className="w-px h-3 bg-border/50 mx-1" />
            <Switch checked={hideHolding} onCheckedChange={setHideHolding} className="scale-75" />
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Plane className="w-3 h-3" />Nascondi in circuito ({holdingCount})
            </span>
          </div>

          {/* SELECTION ACTION BAR */}
          {selectedIds.size > 0 && (
            <UnifiedBulkActionBar
              count={selectedIds.size}
              sourceType="partner"
              onClear={() => setSelectedIds(new Set())}
              onCockpit={() => handleSendTo("cockpit")}
              onWorkspace={() => handleSendTo("workspace")}
              onDeepSearch={onDeepSearch ? () => {
                const ids = Array.from(selectedIds);
                if (ids.length > 0) onDeepSearch(ids);
              } : undefined}
              deepSearchLoading={deepSearchRunning}
              onLinkedIn={() => {
                const partner = (partners || []).find((p: any) => selectedIds.has(p.id));
                if (partner) {
                  const name = (partner as any).company_name || "";
                  window.open(`https://www.google.com/search?q=${encodeURIComponent(name + " LinkedIn")}`, "_blank");
                }
              }}
              onWhatsApp={() => {
                const partnerList = (partners || []).filter((p: any) => selectedIds.has(p.id));
                for (const p of partnerList as any[]) {
                  const contacts = p.partner_contacts || [];
                  const c = contacts.find((c: any) => c.mobile || c.direct_phone);
                  if (c) {
                    const phone = (c.mobile || c.direct_phone || "").replace(/[^0-9+]/g, "");
                    if (phone) { window.open(`https://wa.me/${phone.replace("+", "")}`, "_blank"); break; }
                  }
                }
              }}
              onCampaign={() => {
                navigate("/email-composer", {
                  state: { partnerIds: Array.from(selectedIds) },
                });
              }}
            />
          )}
        </div>

        {/* ═══ COUNTRY TABS ═══ */}
        {countryTabCounts.length > 1 && (
          <div ref={tabsRef} className="flex items-center gap-1 px-3 py-1.5 border-b border-border/30 overflow-x-auto scrollbar-none flex-shrink-0">
            <button
              onClick={() => setActiveCountryTab(null)}
              className={cn(
                "shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors",
                activeCountryTab === null
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              )}
            >
              Tutti
            </button>
            {countryTabCounts.map(({ code, name, count }) => (
              <button
                key={code}
                onClick={() => setActiveCountryTab(code === activeCountryTab ? null : code)}
                className={cn(
                  "shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors",
                  activeCountryTab === code
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                )}
              >
                <span>{getCountryFlag(code)}</span>
                <span className="truncate max-w-[80px]">{name}</span>
                <span className="opacity-70">({count})</span>
              </button>
            ))}
          </div>
        )}

        {/* ═══ PARTNER LIST (Virtualized) ═══ */}
        <PartnerVirtualList
          partners={filteredPartners}
          isLoading={isLoading}
          isDark={isDark}
          selectedPartnerId={selectedPartnerId}
          onSelect={handleSelectPartner}
          onEmailClick={(target) => setEmailTarget(target)}
          selectedIds={selectedIds}
          onToggleSelect={togglePartnerSelect}
          loadMoreRef={loadMoreRef}
          hasNextPage={!!hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
        />
      </div>
      {emailTarget && (
        <SendEmailDialog open={!!emailTarget} onOpenChange={(open) => { if (!open) setEmailTarget(null); }}
          recipientEmail={emailTarget.email} recipientName={emailTarget.name} companyName={emailTarget.company} partnerId={emailTarget.partnerId} isDark={isDark} />
      )}
    </TooltipProvider>
  );
}
