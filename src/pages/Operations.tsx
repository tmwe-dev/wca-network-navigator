import { useState, useCallback, useMemo, useEffect } from "react"; // restored
import { createPortal } from "react-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Sun, Moon, Bot, Globe, Users, FolderOpen, Eye, CreditCard, Send, Search, Brain, Phone, Mail, Calendar, Building2, CheckSquare, RefreshCw,
} from "lucide-react";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { DeepSearchCanvas } from "@/components/operations/DeepSearchCanvas";
import { useDeepSearch } from "@/hooks/useDeepSearchRunner";

import { ThemeCtx, t } from "@/components/download/theme";
import { type FilterKey } from "@/components/download/CountryGrid";
import { WCA_COUNTRIES } from "@/data/wcaCountries";
import { PartnerListPanel } from "@/components/operations/PartnerListPanel";
import { PartnerDetailCompact } from "@/components/partners/PartnerDetailCompact";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { toast } from "sonner";
import { useCountryStats } from "@/hooks/useCountryStats";
import { usePartner, useToggleFavorite } from "@/hooks/usePartners";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { BusinessCardsView } from "@/components/operations/BusinessCardsView";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/** Read directory totals — shares cache key with CountryGrid */
function useDirectoryTotal() {
  return useQuery({
    queryKey: ["cache-data-by-country"],
    queryFn: async () => {
      const data = await rpcGetDirectoryCounts();
      const result: Record<string, { count: number; verified: boolean }> = {};
      (data || []).forEach((r: any) => {
        result[r.country_code] = { count: Number(r.member_count) || 0, verified: r.is_verified === true };
      });
      return result;
    },
    staleTime: 60_000,
  });
}

/** Portal: renders Network controls into the global header slot */
function HeaderBarPortal({ networkView, setNetworkView, globalStats, deepSearch }: {
  networkView: "partners" | "bca";
  setNetworkView: (v: "partners" | "bca") => void;
  globalStats: any;
  deepSearch: any;
}) {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const el = document.getElementById("campaign-header-controls");
    setContainer(el);
  }, []);

  if (!container) return null;

  return createPortal(
    <div className="flex items-center gap-3 min-w-0 flex-1">
      <Globe className="w-4 h-4 text-primary/70 animate-spin-slow flex-shrink-0" />
      <span className="text-xs font-semibold text-foreground hidden sm:inline">Network</span>

      <div className="flex items-center rounded-lg border border-border/60 bg-card/60 p-0.5">
        <button
          onClick={() => setNetworkView("partners")}
          className={cn("flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium transition-all",
            networkView === "partners" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Users className="w-3 h-3" /> Partner
        </button>
        <button
          onClick={() => setNetworkView("bca")}
          className={cn("flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium transition-all",
            networkView === "bca" ? "bg-accent/50 text-accent-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <CreditCard className="w-3 h-3" /> BCA
        </button>
      </div>

      {globalStats && (
        <span className="hidden md:flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
          <Users className="w-3 h-3" />
          <span className="font-mono">{globalStats.totalPartners}</span> partner
        </span>
      )}

      {(deepSearch.running || deepSearch.results.length > 0) && !deepSearch.canvasOpen && (
        <button onClick={() => deepSearch.setCanvasOpen(true)} className="p-1 rounded-md bg-accent/20 hover:bg-accent/30 text-accent-foreground" title="Deep Search">
          <Eye className="w-3.5 h-3.5" />
        </button>
      )}
    </div>,
    container
  );
}

export default function Operations({ activeView }: { activeView?: "partners" | "bca" }) {
  const [internalView, setInternalView] = useState<"partners" | "bca">("partners");
  const networkView = activeView ?? internalView;
  const setNetworkView = activeView ? (() => {}) as any : setInternalView;
  const [isDark, setIsDark] = useState(() => {
    const s = localStorage.getItem("dl_theme");
    return s !== null ? s === "dark" : true;
  });
  const toggleTheme = () => setIsDark(p => { const n = !p; localStorage.setItem("dl_theme", n ? "dark" : "light"); return n; });
  const isMobile = useIsMobile();

  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);
  const { filters } = useGlobalFilters();
  const filterMode = (filters.quality === "all" ? "all" : filters.quality) as FilterKey;
  const directoryOnly = filters.networkDirectoryOnly;
  const [aiOpen, setAiOpen] = useState(false);
  const deepSearch = useDeepSearch();
  const [aliasGenerating, setAliasGenerating] = useState(false);
  const queryClient = useQueryClient();
  const { data: countryStatsData } = useCountryStats();
  const { data: dirData } = useDirectoryTotal();
  const dirTotals = dirData ? {
    scannedCountries: Object.keys(dirData).length,
    totalDirectory: Object.values(dirData).reduce((sum, v) => sum + v.count, 0),
  } : null;
  const globalStats = countryStatsData ? {
    totalPartners: countryStatsData.global.total,
    withEmail: countryStatsData.global.withEmail,
    withPhone: countryStatsData.global.withPhone,
    withProfile: countryStatsData.global.withProfile,
    withoutProfile: countryStatsData.global.withoutProfile,
    scannedCountries: dirTotals?.scannedCountries || 0,
    totalDirectory: dirTotals?.totalDirectory || 0,
  } : null;

  const toggleFavorite = useToggleFavorite();

  // Reset selected partner when filters change (country, quality, directory)
  useEffect(() => {
    setSelectedPartnerId(null);
  }, [filters.networkSelectedCountries, filters.quality, filters.networkDirectoryOnly]);

  // Listen for partner selection from search results in FiltersDrawer
  useEffect(() => {
    const handler = (e: Event) => {
      const partnerId = (e as CustomEvent).detail?.partnerId;
      if (partnerId) {
        // Small delay to let the search filter update first
        setTimeout(() => setSelectedPartnerId(partnerId), 100);
      }
    };
    window.addEventListener("network-select-partner", handler);
    return () => window.removeEventListener("network-select-partner", handler);
  }, []);

  // Use countries from global filters
  const activeCountryCodes = useMemo(() => Array.from(filters.networkSelectedCountries), [filters.networkSelectedCountries]);
  const activeCountryNames = useMemo(() => {
    const WCA = (window as any).__WCA_COUNTRIES;
    return activeCountryCodes.map(code => {
      const found = WCA_COUNTRIES.find((c: any) => c.code === code);
      return found?.name || code;
    });
  }, [activeCountryCodes]);
  const hasSelection = activeCountryCodes.length > 0;

  const { data: selectedPartner } = usePartner(selectedPartnerId || "");

  const handleDeepSearch = useCallback((partnerIds: string[]) => {
    deepSearch.start(partnerIds);
  }, [deepSearch]);

  const handleStopDeepSearch = useCallback(() => {
    deepSearch.stop();
  }, [deepSearch]);

  const handleGenerateAliases = useCallback(async (codes: string[], type: "company" | "contact") => {
    if (aliasGenerating) return;
    setAliasGenerating(true);
    const toastId = toast.loading("Generazione alias in corso...");
    try {
      const data = await invokeEdge<any>("generate-aliases", { body: { countryCodes: codes }, context: "Operations.generate_aliases" });
      if (data?.success) {
        toast.success(`Alias generati: ${data.processed ?? 0} aziende, ${data.contacts ?? 0} contatti (su ${data.total ?? 0} elaborati)`, { id: toastId });
        queryClient.invalidateQueries({ queryKey: ["partners"] });
        queryClient.invalidateQueries({ queryKey: ["country-stats"] });
      } else {
        toast.error(data?.error || "Errore generazione alias", { id: toastId });
      }
    } catch (e: any) {
      toast.error(e?.message || "Errore", { id: toastId });
    } finally {
      setAliasGenerating(false);
    }
  }, [aliasGenerating, queryClient]);

  // WCA sync is now handled globally by useWcaSync in AppLayout

  const hasDetailOpen = !isMobile && selectedPartnerId;

  return (
    <ThemeCtx.Provider value={isDark}>
      <div className="h-full min-h-0 relative flex flex-col overflow-hidden bg-background">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,hsl(var(--primary)/0.06),transparent)]" />

        <div className="relative z-10 flex-1 min-h-0 flex flex-col">
          {/* Portal into global header */}
          <HeaderBarPortal
            networkView={networkView}
            setNetworkView={setNetworkView}
            globalStats={globalStats}
            deepSearch={deepSearch}
          />

          {/* ═══ MAIN ═══ */}
          {networkView === "bca" ? (
            <BusinessCardsView />
          ) : (
          <div className={cn(
            "flex-1 min-h-0 px-4 pb-3 gap-3 overflow-hidden",
            isMobile ? "flex flex-col" : "flex"
          )}>
            {/* COL 1: Partner List */}
            <div className="flex-1 min-w-0 min-h-0 flex flex-col gap-2">
              <div className={cn(
                "flex-1 min-h-0 rounded-xl border overflow-hidden relative",
                "bg-card/50 backdrop-blur-sm border-border"
              )}>
                <PartnerListPanel
                  countryCodes={activeCountryCodes}
                  countryNames={activeCountryNames}
                  isDark={isDark}
                  onDeepSearch={handleDeepSearch}
                  onGenerateAliases={handleGenerateAliases}
                  deepSearchRunning={deepSearch.running}
                  aliasGenerating={aliasGenerating}
                  directoryOnly={directoryOnly}
                  onDirectoryOnlyChange={(v: boolean) => {}}
                  onSelectPartner={setSelectedPartnerId}
                  selectedPartnerId={selectedPartnerId}
                />

                {/* Deep Search Canvas overlay */}
                <DeepSearchCanvas
                  open={deepSearch.canvasOpen}
                  onClose={() => deepSearch.setCanvasOpen(false)}
                  onStop={handleStopDeepSearch}
                  current={deepSearch.current}
                  results={deepSearch.results}
                  running={deepSearch.running}
                  isDark={isDark}
                />
              </div>
            </div>

            {/* COL 3: Partner Detail */}
            {hasDetailOpen && (
              <div className="w-[380px] flex-shrink-0 min-h-0 flex flex-col rounded-xl border border-border bg-card/50 backdrop-blur-sm overflow-hidden animate-in slide-in-from-right-8 duration-200">
                {selectedPartnerId && selectedPartner ? (
                  <>
                    <div className="flex items-center px-3 py-1.5 flex-shrink-0 border-b border-border">
                      <span className="text-xs font-medium text-muted-foreground px-2 py-1">Dettaglio Partner</span>
                    </div>
                    <div className="flex-1 min-h-0 overflow-auto">
                      <PartnerDetailCompact
                        partner={selectedPartner}
                        onBack={() => setSelectedPartnerId(null)}
                        onToggleFavorite={() => toggleFavorite.mutate({ id: selectedPartner.id, isFavorite: !selectedPartner.is_favorite })}
                        isDark={isDark}
                      />
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground/40">
                    <Users className="w-8 h-8 mb-2" />
                    <p className="text-xs font-medium">Caricamento...</p>
                  </div>
                )}
              </div>
            )}
          </div>
          )}
        </div>
      </div>
      
    </ThemeCtx.Provider>
  );
}

/* ── Stat Pill — tri-state color by value ── */
function StatPill({ icon: Icon, value, label, isDark, onClick, active, variant = "info" }: {
  icon: any; value: number; label: string; isDark: boolean;
  onClick?: () => void; active?: boolean;
  variant?: "info" | "warn" | "ok";
}) {
  const isComplete = variant === "ok" || (variant === "warn" && value === 0);
  const pillClass = isComplete || value === 0
    ? "bg-emerald-500/15 border-emerald-500/25 text-emerald-300"
    : value <= 10
      ? "bg-amber-500/15 border-amber-500/25 text-amber-300"
      : "bg-red-500/15 border-red-500/25 text-red-300";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={cn(
            "flex items-center gap-1 px-2 py-1 rounded-full border text-[10px] font-bold tabular-nums transition-all flex-shrink-0",
            pillClass,
            active && "ring-1 ring-current shadow-[0_0_8px_currentColor]"
          )}
        >
          <Icon className="w-3 h-3" />
          {value.toLocaleString()}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">{label}</TooltipContent>
    </Tooltip>
  );
}
