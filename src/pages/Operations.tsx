import { useState, useCallback, useMemo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Sun, Moon, Bot, Globe, Users, FolderOpen, Eye,
} from "lucide-react";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { DeepSearchCanvas } from "@/components/operations/DeepSearchCanvas";
import { useDeepSearch } from "@/hooks/useDeepSearchRunner";
import { AiAssistantDialog } from "@/components/operations/AiAssistantDialog";
import { ThemeCtx, t } from "@/components/download/theme";
import { CountryGrid, type FilterKey } from "@/components/download/CountryGrid";
import { PartnerListPanel } from "@/components/operations/PartnerListPanel";
import { PartnerDetailCompact } from "@/components/partners/PartnerDetailCompact";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCountryStats } from "@/hooks/useCountryStats";
import { usePartner, useToggleFavorite } from "@/hooks/usePartners";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** Read directory totals — shares cache key with CountryGrid */
function useDirectoryTotal() {
  return useQuery({
    queryKey: ["cache-data-by-country"],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_directory_counts");
      const result: Record<string, { count: number; verified: boolean }> = {};
      (data || []).forEach((r: any) => {
        result[r.country_code] = { count: Number(r.member_count) || 0, verified: r.is_verified === true };
      });
      return result;
    },
    staleTime: 60_000,
  });
}

export default function Operations() {
  const [isDark, setIsDark] = useState(() => {
    const s = localStorage.getItem("dl_theme");
    return s !== null ? s === "dark" : true;
  });
  const toggleTheme = () => setIsDark(p => { const n = !p; localStorage.setItem("dl_theme", n ? "dark" : "light"); return n; });
  const isMobile = useIsMobile();

  const [selectedCountries, setSelectedCountries] = useState<{ code: string; name: string }[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);
  const [directoryOnly, setDirectoryOnly] = useState(false);
  const { filters } = useGlobalFilters();
  const filterMode = (filters.quality === "all" ? "all" : filters.quality) as FilterKey;
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

  const activeCountryCodes = useMemo(() => selectedCountries.map(c => c.code), [selectedCountries]);
  const activeCountryNames = useMemo(() => selectedCountries.map(c => c.name), [selectedCountries]);
  const hasSelection = selectedCountries.length > 0;

  const { data: selectedPartner } = usePartner(selectedPartnerId || "");

  const handleCountryClick = useCallback((code: string, name: string) => {
    setSelectedCountries(prev => {
      const exists = prev.some(c => c.code === code);
      const next = exists ? prev.filter(c => c.code !== code) : [...prev, { code, name }];
      if (next.length === 0) setSelectedPartnerId(null);
      return next;
    });
  }, []);

  const handleRemoveCountry = useCallback((code: string) => {
    setSelectedCountries(prev => {
      const next = prev.filter(c => c.code !== code);
      if (next.length === 0) setSelectedPartnerId(null);
      return next;
    });
  }, []);

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
      const { data, error } = await supabase.functions.invoke("generate-aliases", { body: { countryCodes: codes } });
      if (error) throw error;
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

  const hasDetailOpen = !isMobile && hasSelection;

  return (
    <ThemeCtx.Provider value={isDark}>
      <div className="h-full min-h-0 relative flex flex-col overflow-hidden bg-background">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,hsl(var(--primary)/0.06),transparent)]" />

        <div className="relative z-10 flex-1 min-h-0 flex flex-col">
          {/* ═══ TOP BAR ═══ */}
          <TooltipProvider delayDuration={150}>
          <div className="flex items-center justify-between px-3 sm:px-4 h-11 sm:h-[52px] flex-shrink-0 border-b border-border/50 glass-panel">
            {/* Left: Title */}
            <div className="flex items-center gap-3">
              <Globe className="w-4.5 h-4.5 text-blue-400 animate-spin-slow" />
              <h1 className="text-sm font-semibold text-gradient-blue">Network</h1>
            </div>

            {/* Center: Stats */}
            {globalStats && (
              <div className="hidden md:flex items-center gap-1.5">
                <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                  <Users className="w-3.5 h-3.5" />
                  <span className="font-mono">{globalStats.totalPartners}</span>
                  <span>Partner</span>
                </span>
              </div>
            )}

            {/* Right: Actions */}
            <div className="flex items-center gap-1.5">
              {(deepSearch.running || deepSearch.results.length > 0) && !deepSearch.canvasOpen && (
                <button onClick={() => deepSearch.setCanvasOpen(true)} className="p-1.5 rounded-md transition-all bg-accent/20 hover:bg-accent/30 text-accent-foreground" title="Mostra Deep Search">
                  <Eye className="w-4 h-4" />
                </button>
              )}
              <button onClick={() => setAiOpen(true)} className="p-1.5 rounded-md transition-all text-muted-foreground hover:text-foreground hover:bg-muted" title="Assistente AI">
                <Bot className="w-4 h-4" />
              </button>
              <button onClick={toggleTheme} className="p-1.5 rounded-md transition-all text-muted-foreground hover:text-foreground hover:bg-muted">
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            </div>
          </div>
          </TooltipProvider>

          {/* ═══ MAIN: 3-column layout ═══ */}
          <div className={cn(
            "flex-1 min-h-0 px-4 pb-3 gap-3 overflow-hidden",
            isMobile ? "flex flex-col" : "flex"
          )}>
            {/* COL 1: Country Grid */}
            <div className={cn(
              "flex-shrink-0 min-h-0 flex flex-col gap-2 transition-all duration-200",
              isMobile
                ? (hasSelection ? "max-h-[35vh]" : "")
                : (hasDetailOpen ? "w-[220px]" : "w-[280px]")
            )}>
              <CountryGrid
                selected={selectedCountries}
                onToggle={handleCountryClick}
                onRemove={handleRemoveCountry}
                filterMode={filterMode}
                directoryOnly={directoryOnly}
                onDirectoryOnlyChange={setDirectoryOnly}
                compact={hasSelection || isMobile}
              />
            </div>

            {/* COL 2: Partner List */}
            <div className="flex-1 min-w-0 min-h-0 flex flex-col gap-2">
            {hasSelection ? (
              <>
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
                    onDirectoryOnlyChange={setDirectoryOnly}
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
              </>
            ) : (
              <div className="flex-1 min-h-0 flex flex-col items-center justify-center rounded-xl border border-border/40 bg-card/30 backdrop-blur-sm">
                <Globe className="w-10 h-10 text-muted-foreground/20 mb-3" />
                <p className="text-sm text-muted-foreground/60 font-medium">Seleziona un paese per vedere i partner</p>
                <p className="text-xs text-muted-foreground/40 mt-1">Clicca su uno o più paesi dall'elenco a sinistra</p>
              </div>
            )}
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
        </div>
      </div>
      <AiAssistantDialog open={aiOpen} onClose={() => setAiOpen(false)} context={{ selectedCountries, filterMode }} />
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
