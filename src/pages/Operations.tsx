import { useState, useCallback, useMemo, useRef } from "react";
import {
  Sun, Moon, Bot, X, Eye, Globe, Users, FileX, MailX, PhoneOff, FolderOpen,
} from "lucide-react";
import { DeepSearchCanvas, type DeepSearchResult, type DeepSearchCurrent } from "@/components/operations/DeepSearchCanvas";
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

/** Read directory totals */
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

  const [activeCountry, setActiveCountry] = useState<{ code: string; name: string } | null>(null);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);
  const [directoryOnly, setDirectoryOnly] = useState(false);
  const [filterMode, setFilterMode] = useState<FilterKey>("all");
  const [aiOpen, setAiOpen] = useState(false);
  const [deepSearchRunning, setDeepSearchRunning] = useState(false);
  const [aliasGenerating, setAliasGenerating] = useState(false);
  const [dsCanvasOpen, setDsCanvasOpen] = useState(false);
  const [dsResults, setDsResults] = useState<DeepSearchResult[]>([]);
  const [dsCurrent, setDsCurrent] = useState<DeepSearchCurrent | null>(null);
  const dsAbortRef = useRef(false);
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
  const { emergencyStop, startJob } = useDownloadProcessor();
  const toggleFavorite = useToggleFavorite();

  const activeJobs = useMemo(() => (jobs || []).filter(j => j.status === "running" || j.status === "pending"), [jobs]);

  const activeCountryCode = activeCountry?.code || "";

  const { data: selectedPartner } = usePartner(selectedPartnerId || "");

  const handleCountryClick = useCallback((code: string, name: string) => {
    setActiveCountry(prev => prev?.code === code ? null : { code, name });
    setSelectedPartnerId(null);
  }, []);

  const handleDeepSearch = useCallback(async (partnerIds: string[]) => {
    if (deepSearchRunning || partnerIds.length === 0) return;
    setDeepSearchRunning(true);
    setDsResults([]);
    setDsCanvasOpen(true);
    dsAbortRef.current = false;
    let done = 0;
    try {
      for (const id of partnerIds) {
        if (dsAbortRef.current) break;
        done++;
        // Pre-call: fetch partner info from cache for display
        const cached = queryClient.getQueryData<any[]>(["partners"])
          ?.flat()?.find((p: any) => p.id === id);
        setDsCurrent({
          partnerId: id,
          companyName: cached?.company_name || `Partner ${done}`,
          countryCode: cached?.country_code,
          logoUrl: cached?.logo_url,
          index: done,
          total: partnerIds.length,
        });
        toast.loading(`Deep Search ${done}/${partnerIds.length}...`, { id: "deep-search-ops" });
        const { data, error } = await supabase.functions.invoke("deep-search-partner", { body: { partnerId: id } });
        const result: DeepSearchResult = {
          partnerId: id,
          companyName: data?.companyName || cached?.company_name || `Partner ${done}`,
          countryCode: cached?.country_code,
          logoUrl: cached?.logo_url,
          socialLinksFound: data?.socialLinksFound || 0,
          logoFound: data?.logoFound || false,
          contactProfilesFound: data?.contactProfilesFound || 0,
          companyProfileFound: data?.companyProfileFound || false,
          rating: data?.rating || 0,
          rateLimited: data?.rateLimited,
          error: error ? String(error) : undefined,
        };
        setDsResults(prev => [...prev, result]);
        if (error) console.error("Deep search error for", id, error);
      }
      const msg = dsAbortRef.current
        ? `Deep Search interrotta: ${done} partner processati`
        : `Deep Search completata: ${done} partner`;
      dsAbortRef.current ? toast.info(msg, { id: "deep-search-ops" }) : toast.success(msg, { id: "deep-search-ops" });
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      queryClient.invalidateQueries({ queryKey: ["country-stats"] });
    } catch (e: any) {
      toast.error(e?.message || "Errore Deep Search", { id: "deep-search-ops" });
    } finally {
      setDeepSearchRunning(false);
      setDsCurrent(null);
    }
  }, [deepSearchRunning, queryClient]);

  const handleStopDeepSearch = useCallback(() => {
    dsAbortRef.current = true;
  }, []);

  const handleGenerateAliases = useCallback(async (codes: string[], type: "company" | "contact") => {
    if (aliasGenerating) return;
    setAliasGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-aliases", { body: { countryCodes: codes } });
      if (error) throw error;
      if (data?.success) {
        toast.success(`Alias generati: ${data.processed} aziende, ${data.contacts} contatti`);
        queryClient.invalidateQueries({ queryKey: ["partners"] });
        queryClient.invalidateQueries({ queryKey: ["country-stats"] });
      } else {
        toast.error(data?.error || "Errore generazione alias");
      }
    } catch (e: any) {
      toast.error(e?.message || "Errore");
    } finally {
      setAliasGenerating(false);
    }
  }, [aliasGenerating, queryClient]);

  const th = t(isDark);

  return (
    <ThemeCtx.Provider value={isDark}>
      <div className={`h-full min-h-0 relative flex flex-col overflow-hidden ${th.pageBg}`}>
        <div className={`absolute inset-0 bg-gradient-to-br ${th.pageGrad1}`} />
        <div className={`absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] ${th.pageGrad2} via-transparent to-transparent`} />
        <div className={`absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] ${isDark ? "from-violet-500/[0.03]" : "from-sky-200/20"} via-transparent to-transparent animate-pulse`} style={{ animationDuration: '10s' }} />

        <div className="relative z-10 flex-1 min-h-0 flex flex-col">
          {/* ═══ TOP BAR ═══ */}
          <TooltipProvider delayDuration={150}>
          <div className="flex items-center justify-between px-4 py-2 flex-shrink-0">
            {/* Left: Title + active badge */}
            <div className="flex items-center gap-3">
              <h1 className={cn("text-base font-bold tracking-tight", isDark ? "text-slate-100" : "text-slate-800")}>Operations</h1>
              {activeJobs.length > 0 && (
                <span className={cn(
                  "flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full",
                  isDark ? "bg-amber-500/15 text-amber-400 border border-amber-500/25" : "bg-amber-50 text-amber-600 border border-amber-200"
                )}>
                  <span className={cn("w-1.5 h-1.5 rounded-full animate-pulse", isDark ? "bg-amber-400" : "bg-amber-500")} />
                  {activeJobs.length} attivi
                </span>
              )}
            </div>

            {/* Center: Stats pills */}
            {globalStats && (() => {
              const missingProfile = globalStats.totalPartners - globalStats.withProfile;
              const missingEmail = globalStats.totalPartners - globalStats.withEmail;
              const missingPhone = globalStats.totalPartners - globalStats.withPhone;
              return (
                <div className="flex items-center gap-1.5">
                  <StatPill icon={Globe} value={globalStats.scannedCountries} label="Paesi" isDark={isDark} onClick={() => setFilterMode("all")} active={filterMode === "all"} variant="info" />
                  <StatPill icon={Users} value={globalStats.totalPartners} label="Partner" isDark={isDark} onClick={() => setFilterMode("todo")} active={filterMode === "todo"} variant="info" />
                  <StatPill icon={FileX} value={missingProfile} label="No Profilo" isDark={isDark} onClick={() => setFilterMode("no_profile")} active={filterMode === "no_profile"} variant={missingProfile > 0 ? "warn" : "ok"} />
                  <StatPill icon={MailX} value={missingEmail} label="No Email" isDark={isDark} variant={missingEmail > 0 ? "warn" : "ok"} />
                  <StatPill icon={PhoneOff} value={missingPhone} label="No Tel" isDark={isDark} variant={missingPhone > 0 ? "warn" : "ok"} />
                  <StatPill icon={FolderOpen} value={globalStats.totalDirectory} label="Directory" isDark={isDark} onClick={() => setFilterMode("missing")} active={filterMode === "missing"} variant="info" />
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
              {(deepSearchRunning || dsResults.length > 0) && !dsCanvasOpen && (
                <button onClick={() => setDsCanvasOpen(true)} className={cn(
                  "p-1.5 rounded-lg transition-all",
                  isDark ? "bg-violet-500/20 hover:bg-violet-500/30 text-violet-400" : "bg-violet-50 hover:bg-violet-100 text-violet-600 shadow-sm"
                )} title="Mostra Deep Search">
                  <Eye className="w-4 h-4" />
                </button>
              )}
              <button onClick={() => setAiOpen(true)} className={cn(
                "p-1.5 rounded-lg transition-all",
                isDark ? "bg-violet-500/20 hover:bg-violet-500/30 text-violet-400" : "bg-violet-50 hover:bg-violet-100 text-violet-600 shadow-sm"
              )} title="Assistente AI">
                <Bot className="w-4 h-4" />
              </button>
              <button onClick={toggleTheme} className={cn(
                "p-1.5 rounded-lg transition-all",
                isDark ? "bg-slate-800/60 hover:bg-slate-700/60 text-amber-400" : "bg-white/80 hover:bg-white shadow-sm text-sky-600"
              )}>
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            </div>
          </div>
          </TooltipProvider>

          {/* ═══ MAIN: Country Grid + Partner List + Detail ═══ */}
          <div className="flex-1 min-h-0 px-4 pb-3 flex gap-3">
            {/* LEFT: Country Grid (fixed width) */}
            <div className={cn(
              "flex-shrink-0 min-h-0 flex flex-col gap-2 transition-all duration-200",
              activeCountry ? "w-[260px]" : "w-full"
            )}>
              <CountryGrid
                selected={activeCountry ? [activeCountry] : []}
                onToggle={handleCountryClick}
                onRemove={() => { setActiveCountry(null); setSelectedPartnerId(null); }}
                filterMode={filterMode}
                directoryOnly={directoryOnly}
                onDirectoryOnlyChange={setDirectoryOnly}
              />
              {activeJobs.length > 0 && !activeCountry && (
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <ActiveJobBar />
                  <DownloadTerminal />
                  <JobMonitor />
                </div>
              )}
            </div>

            {/* CENTER: Partner List + Detail overlay */}
            {activeCountry && (
              <div className="flex-1 min-w-0 min-h-0 flex flex-col gap-2 animate-in fade-in slide-in-from-right-4 duration-200">
                <ActiveJobBar />
                <div className={cn(
                  "flex-1 min-h-0 rounded-2xl border overflow-hidden relative",
                  isDark ? "bg-white/[0.02] backdrop-blur-xl border-white/[0.08]" : "bg-white/40 backdrop-blur-xl border-white/80 shadow-sm"
                )}>
                  <PartnerListPanel
                    countryCode={activeCountryCode}
                    countryName={activeCountry.name}
                    isDark={isDark}
                    onDeepSearch={handleDeepSearch}
                    onGenerateAliases={handleGenerateAliases}
                    deepSearchRunning={deepSearchRunning}
                    aliasGenerating={aliasGenerating}
                    onJobCreated={startJob}
                    directoryOnly={directoryOnly}
                    onDirectoryOnlyChange={setDirectoryOnly}
                    onSelectPartner={setSelectedPartnerId}
                    selectedPartnerId={selectedPartnerId}
                  />

                  {/* Detail overlay slide-in */}
                  {selectedPartnerId && selectedPartner && (
                    <div className={cn(
                      "absolute inset-0 z-20 flex flex-col animate-in slide-in-from-right-8 duration-200",
                      isDark ? "bg-slate-950/95 backdrop-blur-xl" : "bg-white/95 backdrop-blur-xl"
                    )}>
                      <div className={cn("flex items-center px-3 py-1.5 flex-shrink-0 border-b", isDark ? "border-white/[0.08]" : "border-slate-200/60")}>
                        <button onClick={() => setSelectedPartnerId(null)}
                          className={cn("flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-lg transition-colors",
                            isDark ? "text-slate-400 hover:text-slate-200 hover:bg-white/[0.06]" : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                          )}>
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
                    open={dsCanvasOpen}
                    onClose={() => setDsCanvasOpen(false)}
                    onStop={handleStopDeepSearch}
                    current={dsCurrent}
                    results={dsResults}
                    running={deepSearchRunning}
                    isDark={isDark}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <AiAssistantDialog open={aiOpen} onClose={() => setAiOpen(false)} context={{ selectedCountries: activeCountry ? [activeCountry] : [], filterMode }} />
    </ThemeCtx.Provider>
  );
}

/* ── Stat Pill (mini-card with icon, number, label) ── */
function StatPill({ icon: Icon, value, label, isDark, onClick, active, variant = "info" }: {
  icon: any; value: number; label: string; isDark: boolean;
  onClick?: () => void; active?: boolean;
  variant?: "info" | "warn" | "ok";
}) {
  const isComplete = variant === "ok" || (variant === "warn" && value === 0);
  const colorClass = isComplete
    ? isDark ? "text-emerald-400 border-emerald-500/20 bg-emerald-500/10" : "text-emerald-600 border-emerald-200 bg-emerald-50"
    : variant === "warn"
      ? isDark ? "text-rose-400 border-rose-500/20 bg-rose-500/10" : "text-rose-600 border-rose-200 bg-rose-50"
      : active
        ? isDark ? "text-sky-400 border-sky-500/30 bg-sky-500/15" : "text-sky-600 border-sky-300 bg-sky-50"
        : isDark ? "text-slate-300 border-white/[0.08] bg-white/[0.03]" : "text-slate-600 border-slate-200 bg-white/60";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={cn(
            "flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] transition-all whitespace-nowrap",
            onClick ? "cursor-pointer hover:scale-105" : "cursor-default",
            colorClass
          )}
        >
          <Icon className="w-3.5 h-3.5" />
          <span className="font-bold tabular-nums">{value.toLocaleString()}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs font-medium">
        {label}: {value.toLocaleString()}
      </TooltipContent>
    </Tooltip>
  );
}
