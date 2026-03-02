import { useState, useCallback, useMemo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Sun, Moon, Bot, X, Eye, Globe, Users, FileX, MailX, PhoneOff, FolderOpen, Terminal, Download,
} from "lucide-react";
import { DeepSearchCanvas } from "@/components/operations/DeepSearchCanvas";
import { useDeepSearch } from "@/hooks/useDeepSearchRunner";
import { DownloadCanvas, type DownloadResult, type DownloadCurrent } from "@/components/operations/DownloadCanvas";
import { AiAssistantDialog } from "@/components/operations/AiAssistantDialog";
import { SpeedGauge } from "@/components/download/SpeedGauge";
import { ThemeCtx, t } from "@/components/download/theme";
import { WcaSessionIndicator } from "@/components/download/WcaSessionIndicator";
import { CountryGrid, type FilterKey } from "@/components/download/CountryGrid";
import { ActiveJobBar } from "@/components/download/ActiveJobBar";
import { DownloadTerminal } from "@/components/download/DownloadTerminal";
import { JobMonitor } from "@/components/download/JobMonitor";
import { PartnerListPanel } from "@/components/operations/PartnerListPanel";
import { PartnerDetailCompact } from "@/components/partners/PartnerDetailCompact";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useDownloadJobs } from "@/hooks/useDownloadJobs";
import { useDownloadProcessor } from "@/hooks/useDownloadProcessor";
import { useCountryStats } from "@/hooks/useCountryStats";
import { usePartner, useToggleFavorite } from "@/hooks/usePartners";
import { getCountryFlag } from "@/lib/countries";
import { Skeleton } from "@/components/ui/skeleton";
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
  const [filterMode, setFilterMode] = useState<FilterKey>("all");
  const [aiOpen, setAiOpen] = useState(false);
  const deepSearch = useDeepSearch();
  const [aliasGenerating, setAliasGenerating] = useState(false);
  const [dlCanvasOpen, setDlCanvasOpen] = useState(false);
  const [dlResults, setDlResults] = useState<DownloadResult[]>([]);
  const [dlCurrent, setDlCurrent] = useState<DownloadCurrent | null>(null);
  const [showTerminal, setShowTerminal] = useState(false);
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
  const { data: jobs } = useDownloadJobs();
  const { emergencyStop, startJob: rawStartJob, onProgressRef, onResultRef } = useDownloadProcessor();
  const toggleFavorite = useToggleFavorite();

  // Wire download canvas callbacks
  onProgressRef.current = useCallback((p: DownloadCurrent) => {
    setDlCurrent(p);
    if (!dlCanvasOpen) setDlCanvasOpen(true);
  }, [dlCanvasOpen]);
  onResultRef.current = useCallback((r: DownloadResult) => {
    setDlResults(prev => [...prev, r]);
  }, []);

  const startJob = useCallback((jobId: string) => {
    setDlResults([]);
    setDlCanvasOpen(true);
    rawStartJob(jobId);
  }, [rawStartJob]);

  const activeJobs = useMemo(() => (jobs || []).filter(j => j.status === "running" || j.status === "pending"), [jobs]);

  const activeCountryCodes = useMemo(() => selectedCountries.map(c => c.code), [selectedCountries]);
  const activeCountryNames = useMemo(() => selectedCountries.map(c => c.name), [selectedCountries]);
  const hasSelection = selectedCountries.length > 0;

  const { data: selectedPartner } = usePartner(selectedPartnerId || "");

  const handleCountryClick = useCallback((code: string, name: string) => {
    setSelectedCountries(prev => {
      const exists = prev.some(c => c.code === code);
      return exists ? prev.filter(c => c.code !== code) : [...prev, { code, name }];
    });
    setSelectedPartnerId(null);
  }, []);

  const handleRemoveCountry = useCallback((code: string) => {
    setSelectedCountries(prev => prev.filter(c => c.code !== code));
    setSelectedPartnerId(null);
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

  const th = t(isDark);

  return (
    <ThemeCtx.Provider value={isDark}>
      <div className="h-full min-h-0 relative flex flex-col overflow-hidden bg-background">
        {/* Subtle ambient — single layer only */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,hsl(var(--primary)/0.06),transparent)]" />

        <div className="relative z-10 flex-1 min-h-0 flex flex-col">
          {/* ═══ TOP BAR ═══ */}
          <TooltipProvider delayDuration={150}>
          <div className="flex items-center justify-between px-4 h-[52px] flex-shrink-0 border-b border-border/50 glass-panel">
            {/* Left: Title + active badge */}
            <div className="flex items-center gap-3">
              <Globe className="w-4.5 h-4.5 text-blue-400 animate-spin-slow" />
              <h1 className="text-sm font-semibold text-gradient-blue">Operations</h1>
              {activeJobs.length > 0 && (
                <span className="flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full micro-badge-amber">
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                  {activeJobs.length} attivi
                </span>
              )}
            </div>

            {/* Center: Stats pills — contextual to selected countries */}
            {globalStats && (() => {
              const contextStats = (() => {
                if (selectedCountries.length > 0 && countryStatsData?.byCountry) {
                  const agg = { totalPartners: 0, withProfile: 0, withEmail: 0, withPhone: 0 };
                  selectedCountries.forEach(c => {
                    const s = countryStatsData.byCountry[c.code];
                    if (s) {
                      agg.totalPartners += s.total_partners;
                      agg.withProfile += s.with_profile;
                      agg.withEmail += s.with_email;
                      agg.withPhone += s.with_phone;
                    }
                  });
                  const dirCount = dirData ? selectedCountries.reduce((sum, c) => sum + (dirData[c.code]?.count || 0), 0) : 0;
                  return { ...agg, scannedCountries: selectedCountries.length, totalDirectory: dirCount };
                }
                return globalStats;
              })();
              const missingProfile = contextStats.totalPartners - contextStats.withProfile;
              const missingEmail = contextStats.totalPartners - contextStats.withEmail;
              const missingPhone = contextStats.totalPartners - contextStats.withPhone;
              return (
                <div className="hidden md:flex items-center gap-1.5 flex-wrap">
                  <StatPill icon={Globe} value={contextStats.scannedCountries} label={selectedCountries.length > 0 ? "Selez." : "Paesi"} isDark={isDark} onClick={() => setFilterMode("all")} active={filterMode === "all"} variant="info" />
                  <StatPill icon={Users} value={contextStats.totalPartners} label="Partner" isDark={isDark} onClick={() => setFilterMode("todo")} active={filterMode === "todo"} variant="info" />
                  <StatPill icon={FileX} value={missingProfile} label="No Profilo" isDark={isDark} onClick={() => setFilterMode("no_profile")} active={filterMode === "no_profile"} variant={missingProfile > 0 ? "warn" : "ok"} />
                  <StatPill icon={MailX} value={missingEmail} label="No Email" isDark={isDark} onClick={() => setFilterMode("no_email")} active={filterMode === "no_email"} variant={missingEmail > 0 ? "warn" : "ok"} />
                  <StatPill icon={PhoneOff} value={missingPhone} label="No Tel" isDark={isDark} onClick={() => setFilterMode("no_phone")} active={filterMode === "no_phone"} variant={missingPhone > 0 ? "warn" : "ok"} />
                  <StatPill icon={FolderOpen} value={contextStats.totalDirectory} label="Directory" isDark={isDark} onClick={() => setFilterMode("missing")} active={filterMode === "missing"} variant="info" />
                </div>
              );
            })()}

            {/* Right: Actions */}
            <div className="flex items-center gap-1.5">
              {activeJobs.length > 0 && (
                <SpeedGauge
                  lastUpdatedAt={activeJobs.find(j => j.status === "running")?.updated_at ?? activeJobs[0]?.updated_at ?? null}
                  onStop={() => emergencyStop()}
                  idle={activeJobs.length === 0}
                />
              )}
              <WcaSessionIndicator />
              {(activeJobs.length > 0 || dlResults.length > 0) && !dlCanvasOpen && (
                <button onClick={() => setDlCanvasOpen(true)} className="p-1.5 rounded-md transition-all bg-primary/10 hover:bg-primary/20 text-primary" title="Mostra Download Canvas">
                  <Download className="w-4 h-4" />
                </button>
              )}
              {(activeJobs.length > 0 || (jobs || []).length > 0) && (
                <button onClick={() => setShowTerminal(v => !v)} className={cn(
                  "p-1.5 rounded-md transition-all",
                  showTerminal
                    ? "bg-success/15 text-success border border-success/30"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )} title="Terminal">
                  <Terminal className="w-4 h-4" />
                </button>
              )}
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

          {/* ═══ MAIN: Country Grid + Partner List + Detail ═══ */}
          <div className={cn(
            "flex-1 min-h-0 px-4 pb-3 gap-3",
            isMobile ? "flex flex-col overflow-y-auto" : "flex"
          )}>
            {/* LEFT: Country Grid */}
            <div className={cn(
              "flex-shrink-0 min-h-0 flex flex-col gap-2 transition-all duration-200",
              isMobile
                ? (hasSelection ? "max-h-[35vh]" : "")
                : hasSelection ? "w-[260px]" : "max-w-[520px] mx-auto w-full"
            )}>
              <CountryGrid
                selected={selectedCountries}
                onToggle={handleCountryClick}
                onRemove={handleRemoveCountry}
                filterMode={filterMode}
                onFilterModeChange={setFilterMode}
                directoryOnly={directoryOnly}
                onDirectoryOnlyChange={setDirectoryOnly}
                compact={hasSelection || isMobile}
              />
              {(activeJobs.length > 0 || showTerminal) && !hasSelection && !isMobile && (
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <ActiveJobBar />
                  {showTerminal && <DownloadTerminal />}
                  <JobMonitor />
                </div>
              )}
            </div>

            {/* CENTER: Partner List + Detail overlay */}
            {hasSelection && (
              <div className="flex-1 min-w-0 min-h-0 flex flex-col gap-2 animate-in fade-in slide-in-from-right-4 duration-200">
                <ActiveJobBar />
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
                    onJobCreated={startJob}
                    directoryOnly={directoryOnly}
                    onDirectoryOnlyChange={setDirectoryOnly}
                    onSelectPartner={setSelectedPartnerId}
                    selectedPartnerId={selectedPartnerId}
                  />

                  {/* Detail overlay slide-in */}
                  {selectedPartnerId && selectedPartner && (
                    <div className="absolute inset-0 z-20 flex flex-col animate-in slide-in-from-right-8 duration-200 bg-background/95 backdrop-blur-md">
                      <div className="flex items-center px-3 py-1.5 flex-shrink-0 border-b border-border">
                        <button onClick={() => setSelectedPartnerId(null)}
                          className="flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md transition-colors text-muted-foreground hover:text-foreground hover:bg-muted">
                          <X className="w-4 h-4" /> Chiudi
                        </button>
                      </div>
                      <div className="flex-1 min-h-0 overflow-auto">
                        <PartnerDetailCompact
                          partner={selectedPartner}
                          onBack={() => setSelectedPartnerId(null)}
                          onToggleFavorite={() => toggleFavorite.mutate({ id: selectedPartner.id, isFavorite: !selectedPartner.is_favorite })}
                          isDark={isDark}
                        />
                      </div>
                    </div>
                  )}

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

                  {/* Download Canvas overlay */}
                  <DownloadCanvas
                    open={dlCanvasOpen}
                    onClose={() => setDlCanvasOpen(false)}
                    onStop={() => emergencyStop()}
                    current={dlCurrent}
                    results={dlResults}
                    running={activeJobs.length > 0}
                    isDark={isDark}
                  />
                </div>

                {/* Terminal below partner panel */}
                {showTerminal && (
                  <div className="flex-shrink-0">
                    <DownloadTerminal />
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

  // Tri-state: 0 → green, ≤10 → amber, >10 → red
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
            "flex flex-col items-center px-3 py-1 rounded-lg border transition-all whitespace-nowrap cursor-pointer hover:scale-105",
            pillClass,
            active && "ring-1 ring-current shadow-[0_0_8px_currentColor]"
          )}
        >
          <div className="flex items-center gap-1.5">
            <Icon className="w-3.5 h-3.5" />
            <span className="text-xl font-bold tabular-nums leading-none">{value.toLocaleString()}</span>
          </div>
          <span className="text-[10px] uppercase tracking-wider font-medium opacity-70 leading-none mt-0.5">{label}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs font-medium">
        {label}: {value.toLocaleString()}
      </TooltipContent>
    </Tooltip>
  );
}
