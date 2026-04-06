import { useState, useMemo, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useInView } from "@/hooks/useInView";
import { SendEmailDialog } from "@/components/operations/SendEmailDialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  Search, Telescope, Inbox, LayoutGrid, Plane, RotateCcw, X, ArrowUpDown,
} from "lucide-react";
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

    // Quality, holding and sort are now applied server-side in usePartnersPaginated
    // Only keep client-side filters that can't be pushed to SQL
    if (progressFilter === "deep") {
      list = list.filter((p: any) => !(p.enrichment_data && (p.enrichment_data as any)?.deep_search_at));
    }

    return list;
  }, [partners, progressFilter]);

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
        const { error } = await supabase.from("cockpit_queue").upsert(items as any, { onConflict: "user_id,source_type,source_id", ignoreDuplicates: true });
        if (error) { toast.error("Errore: " + error.message); return; }
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
      const { error } = await supabase.from("activities").insert(inserts as any);
      if (error) { toast.error("Errore: " + error.message); return; }
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

          {/* ROW 3: Hide holding pattern toggle */}
          <div className="flex items-center gap-2">
            <Switch checked={hideHolding} onCheckedChange={setHideHolding} className="scale-75" />
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Plane className="w-3 h-3" />Nascondi in circuito ({holdingCount})
            </span>
          </div>

          {/* SELECTION ACTION BAR */}
          {selectedIds.size > 0 && (
            <div className={cn("flex items-center gap-2 p-2 rounded-lg border animate-in fade-in slide-in-from-top-2", "bg-primary/5 border-primary/20")}>
              <span className="text-xs font-bold text-primary">{selectedIds.size} selezionati</span>
              <div className="flex-1" />
              <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={() => handleSendTo("cockpit")}>
                <Inbox className="w-3 h-3" /> Cockpit
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={() => handleSendTo("workspace")}>
                <LayoutGrid className="w-3 h-3" /> Workspace
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => setSelectedIds(new Set())}>
                ✕
              </Button>
            </div>
          )}
        </div>

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
