import { useState, useCallback, useMemo } from "react";
import { Sun, Moon, Globe, Users, Mail, Phone, Download, FolderDown, FileText, Bot, ArrowLeft } from "lucide-react";
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

  const [selectedCountries, setSelectedCountries] = useState<{ code: string; name: string }[]>([]);
  const [carouselStep, setCarouselStep] = useState(0); // 0 = grid view, 1 = partner view
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);
  const [directoryOnly, setDirectoryOnly] = useState(false);
  const [filterMode, setFilterMode] = useState<FilterKey>("all");
  const [aiOpen, setAiOpen] = useState(false);
  const [deepSearchRunning, setDeepSearchRunning] = useState(false);
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
  const { data: jobs } = useDownloadJobs();
  const { emergencyStop, startJob } = useDownloadProcessor();
  const toggleFavorite = useToggleFavorite();

  const activeJobs = useMemo(() => (jobs || []).filter(j => j.status === "running" || j.status === "pending"), [jobs]);

  // Partner detail (lifted from PartnerListPanel)
  const { data: selectedPartner } = usePartner(selectedPartnerId || "");

  const toggleCountry = useCallback((code: string, name: string) => {
    setSelectedCountries(prev =>
      prev.some(c => c.code === code) ? prev.filter(c => c.code !== code) : [...prev, { code, name }]
    );
  }, []);

  const removeCountry = useCallback((code: string) => {
    setSelectedCountries(prev => prev.filter(c => c.code !== code));
  }, []);

  // Confirm selection → slide to step 1
  const confirmSelection = useCallback(() => {
    if (selectedCountries.length > 0) {
      setCarouselStep(1);
      setSelectedPartnerId(null);
    }
  }, [selectedCountries.length]);

  // Go back to grid
  const goBack = useCallback(() => {
    setCarouselStep(0);
    setSelectedPartnerId(null);
  }, []);

  const handleDeepSearch = useCallback(async (partnerIds: string[]) => {
    if (deepSearchRunning || partnerIds.length === 0) return;
    setDeepSearchRunning(true);
    let done = 0;
    try {
      for (const id of partnerIds) {
        done++;
        toast.loading(`Deep Search ${done}/${partnerIds.length}...`, { id: "deep-search-ops" });
        const { error } = await supabase.functions.invoke("deep-search-partner", { body: { partnerId: id } });
        if (error) console.error("Deep search error for", id, error);
      }
      toast.success(`Deep Search completata: ${done} partner`, { id: "deep-search-ops" });
      queryClient.invalidateQueries({ queryKey: ["partners"] });
    } catch (e: any) {
      toast.error(e?.message || "Errore Deep Search", { id: "deep-search-ops" });
    } finally {
      setDeepSearchRunning(false);
    }
  }, [deepSearchRunning, queryClient]);

  const handleGenerateAliases = useCallback(async (codes: string[], type: "company" | "contact") => {
    if (aliasGenerating) return;
    setAliasGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-aliases", { body: { countryCodes: codes } });
      if (error) throw error;
      if (data?.success) {
        toast.success(`Alias generati: ${data.processed} aziende, ${data.contacts} contatti`);
        queryClient.invalidateQueries({ queryKey: ["partners"] });
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
      <div className={`h-[calc(100vh-4rem)] relative overflow-hidden -m-6 ${th.pageBg}`} style={{ overscrollBehavior: 'contain' }}>
        <div className={`absolute inset-0 bg-gradient-to-br ${th.pageGrad1}`} />
        <div className={`absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] ${th.pageGrad2} via-transparent to-transparent`} />
        <div className={`absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] ${isDark ? "from-violet-500/[0.03]" : "from-sky-200/20"} via-transparent to-transparent animate-pulse`} style={{ animationDuration: '10s' }} />

        <div className="relative z-10 h-full flex flex-col">
          {/* ═══ TOP BAR ═══ */}
          <div className="flex items-center justify-between px-4 py-1.5 flex-shrink-0">
            <div className="flex items-center gap-3">
              {carouselStep === 1 && (
                <button
                  onClick={goBack}
                  className={cn(
                    "p-1.5 rounded-lg transition-all",
                    isDark ? "bg-white/[0.06] hover:bg-white/[0.12] text-slate-300" : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                  )}
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
              <h1 className={`text-sm font-semibold ${th.h1}`}>Operations</h1>

              {/* Country badges in header (step 1) */}
              {carouselStep === 1 && selectedCountries.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto max-w-[300px]">
                  {selectedCountries.map(c => (
                    <span key={c.code} className={cn(
                      "flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full shrink-0 font-medium",
                      isDark ? "bg-sky-500/15 text-sky-300 border border-sky-500/25" : "bg-sky-50 text-sky-700 border border-sky-200"
                    )}>
                      {getCountryFlag(c.code)} {c.name}
                    </span>
                  ))}
                </div>
              )}

              {/* Stats inline badges (step 1) */}
              {carouselStep === 1 && globalStats && (
                <div className="flex items-center gap-2 ml-2">
                  <span className={`text-[10px] font-mono font-bold ${isDark ? "text-emerald-400" : "text-emerald-600"}`}>
                    <Users className="w-3 h-3 inline mr-0.5" />{globalStats.totalPartners}
                  </span>
                  <span className={`text-[10px] font-mono font-bold ${isDark ? "text-violet-400" : "text-violet-600"}`}>
                    <FileText className="w-3 h-3 inline mr-0.5" />{globalStats.withProfile}
                  </span>
                  <span className={`text-[10px] font-mono font-bold ${isDark ? "text-sky-400" : "text-sky-600"}`}>
                    <Mail className="w-3 h-3 inline mr-0.5" />{globalStats.withEmail}
                  </span>
                </div>
              )}

              {activeJobs.length > 0 && (
                <span className={`flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full ${isDark ? "bg-amber-500/15 text-amber-400 border border-amber-500/25" : "bg-sky-50 text-sky-600 border border-sky-200"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isDark ? "bg-amber-400" : "bg-sky-500"}`} />
                  {activeJobs.length} attivi
                </span>
              )}
              <SpeedGauge
                lastUpdatedAt={activeJobs.find(j => j.status === "running")?.updated_at ?? activeJobs[0]?.updated_at ?? null}
                onStop={() => emergencyStop()}
                idle={activeJobs.length === 0}
              />
            </div>
            <div className="flex items-center gap-2">
              <WcaSessionIndicator />
              <button onClick={() => setAiOpen(true)} className={`p-1.5 rounded-lg transition-all ${isDark ? "bg-violet-500/20 hover:bg-violet-500/30 text-violet-400" : "bg-violet-50 hover:bg-violet-100 text-violet-600 shadow-sm"}`} title="Assistente AI">
                <Bot className="w-4 h-4" />
              </button>
              <button onClick={toggleTheme} className={`p-1.5 rounded-lg transition-all ${isDark ? "bg-slate-800/60 hover:bg-slate-700/60 text-amber-400" : "bg-white/80 hover:bg-white shadow-sm text-sky-600"}`}>
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* ═══ CONTENT ═══ */}
          <div className="flex-1 min-h-0 px-4 pb-3 overflow-hidden relative">
            {/* ═══ STEP 0: Stats + CountryGrid ═══ */}
            {carouselStep === 0 && (
              <div className="flex gap-3 h-full animate-in fade-in slide-in-from-left-4 duration-200">
                {/* COL 1: Stats sidebar */}
                <div className={`w-[140px] flex-shrink-0 flex flex-col gap-2 overflow-auto rounded-xl border p-2 ${isDark ? "bg-white/[0.03] backdrop-blur-xl border-white/[0.08]" : "bg-white/50 backdrop-blur-xl border-white/80 shadow-sm"}`}>
                  {globalStats ? (
                    <>
                      <StatItem icon={Globe} label="Paesi" value={globalStats.scannedCountries} isDark={isDark} color={isDark ? "text-sky-400" : "text-sky-500"} onClick={() => setFilterMode("all")} active={filterMode === "all"} />
                      <StatItem icon={Users} label="Partner" value={globalStats.totalPartners.toLocaleString()} isDark={isDark} color={isDark ? "text-emerald-400" : "text-emerald-500"} onClick={() => setFilterMode("todo")} active={filterMode === "todo"} />
                      <StatItem icon={FileText} label="Profili" value={globalStats.withProfile.toLocaleString()} isDark={isDark} color={isDark ? "text-violet-400" : "text-violet-500"}
                        progress={globalStats.totalPartners > 0 ? Math.round((globalStats.withProfile / globalStats.totalPartners) * 100) : 0}
                        progressColor="from-violet-400 to-purple-500"
                        onClick={() => setFilterMode("no_profile")} active={filterMode === "no_profile"} />
                      <StatItem icon={Mail} label="Email" value={globalStats.withEmail.toLocaleString()} isDark={isDark} color={isDark ? "text-sky-400" : "text-sky-500"}
                        progress={globalStats.totalPartners > 0 ? Math.round((globalStats.withEmail / globalStats.totalPartners) * 100) : 0}
                        progressColor="from-sky-400 to-blue-500" />
                      <StatItem icon={Phone} label="Telefoni" value={globalStats.withPhone.toLocaleString()} isDark={isDark} color={isDark ? "text-teal-400" : "text-teal-500"}
                        progress={globalStats.totalPartners > 0 ? Math.round((globalStats.withPhone / globalStats.totalPartners) * 100) : 0}
                        progressColor="from-teal-400 to-emerald-500" />
                      <StatItem icon={FolderDown} label="Directory" value={(globalStats.totalDirectory ?? 0).toLocaleString()} isDark={isDark} color={isDark ? "text-amber-400" : "text-amber-500"} onClick={() => setFilterMode("missing")} active={filterMode === "missing"} />
                    </>
                  ) : (
                    Array.from({ length: 6 }).map((_, i) => (
                      <Skeleton key={i} className={`h-14 rounded-lg ${isDark ? "bg-white/[0.06]" : ""}`} />
                    ))
                  )}
                  {/* Confirm button */}
                  {selectedCountries.length > 0 && (
                    <div className="mt-auto pt-2 border-t border-white/[0.08]">
                      <div className="flex flex-wrap gap-1 mb-1.5 justify-center">
                        {selectedCountries.map(c => (
                          <span key={c.code} className="text-sm">{getCountryFlag(c.code)}</span>
                        ))}
                      </div>
                      <button
                        onClick={confirmSelection}
                        className={cn(
                          "w-full py-2 rounded-lg font-bold text-xs transition-all duration-200 hover:scale-[1.02] active:scale-[0.97]",
                          isDark
                            ? "bg-sky-500 hover:bg-sky-400 text-white shadow-lg shadow-sky-500/25"
                            : "bg-sky-500 hover:bg-sky-600 text-white shadow-lg shadow-sky-500/30"
                        )}
                      >
                        Conferma →
                      </button>
                    </div>
                  )}
                </div>

                {/* COL 2: Country Grid + Job monitors */}
                <div className="flex-1 min-h-0 flex flex-col gap-2">
                  <CountryGrid
                    selected={selectedCountries}
                    onToggle={toggleCountry}
                    onRemove={removeCountry}
                    filterMode={filterMode}
                    directoryOnly={directoryOnly}
                    onDirectoryOnlyChange={setDirectoryOnly}
                  />
                  {activeJobs.length > 0 && (
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      <ActiveJobBar />
                      <DownloadTerminal />
                      <JobMonitor />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ═══ STEP 1: Adaptive Partner View ═══ */}
            {carouselStep === 1 && (
              <div className="flex gap-3 h-full animate-in fade-in slide-in-from-right-4 duration-200 overflow-hidden">
                {/* LEFT: Partner Detail — only when a partner is selected */}
                {selectedPartnerId && selectedPartner && (
                  <div className={cn(
                    "w-[38%] flex-shrink-0 min-h-0 rounded-2xl border overflow-hidden animate-in fade-in slide-in-from-left-4 duration-200",
                    isDark ? "bg-white/[0.02] backdrop-blur-xl border-white/[0.08]" : "bg-white/40 backdrop-blur-xl border-white/80 shadow-sm"
                  )}>
                    <div className="h-full overflow-auto">
                      <PartnerDetailCompact
                        partner={selectedPartner}
                        onBack={() => setSelectedPartnerId(null)}
                        onToggleFavorite={() => toggleFavorite.mutate({ id: selectedPartner.id, isFavorite: !selectedPartner.is_favorite })}
                        isDark={isDark}
                      />
                    </div>
                  </div>
                )}

                {/* RIGHT: Partner List — full width when no detail, 62% when detail open */}
                <div className="flex-1 min-w-0 min-h-0 flex flex-col">
                  <ActiveJobBar />
                  <div className={cn(
                    "flex-1 min-h-0 rounded-2xl border overflow-hidden",
                    isDark ? "bg-white/[0.02] backdrop-blur-xl border-white/[0.08]" : "bg-white/40 backdrop-blur-xl border-white/80 shadow-sm"
                  )}>
                    <PartnerListPanel
                      countryCodes={selectedCountries.map(c => c.code)}
                      countryNames={selectedCountries.map(c => c.name)}
                      selectedCountries={selectedCountries}
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
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <AiAssistantDialog
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        context={{ selectedCountries, filterMode }}
      />
    </ThemeCtx.Provider>
  );
}

/* ── Vertical Stat Item ── */
function StatItem({ icon: Icon, label, value, color, isDark, progress, progressColor, onClick, active }: {
  icon: any; label: string; value: string | number; color: string; isDark: boolean;
  progress?: number; progressColor?: string;
  onClick?: () => void; active?: boolean;
}) {
  const isClickable = !!onClick;
  const activeBorder = active
    ? isDark ? "border-sky-400/40 ring-1 ring-sky-400/20" : "border-sky-400 ring-1 ring-sky-300/40"
    : isDark ? "border-white/[0.06]" : "border-slate-200/60";
  const activeBg = active
    ? isDark ? "bg-sky-950/40" : "bg-sky-50/80"
    : isDark ? "bg-white/[0.03]" : "bg-white/40";

  return (
    <div
      onClick={onClick}
      className={`rounded-lg border p-2 transition-all duration-150 ${activeBg} ${activeBorder} ${isClickable ? "cursor-pointer hover:scale-[1.02]" : ""} ${isClickable && !active ? (isDark ? "hover:bg-white/[0.06]" : "hover:bg-white/60") : ""}`}
    >
      <div className="flex items-center gap-1.5 mb-0.5">
        <Icon className={`w-3.5 h-3.5 ${color}`} />
        <span className={`text-[9px] uppercase tracking-wider font-semibold ${isDark ? "text-slate-500" : "text-slate-400"}`}>{label}</span>
      </div>
      <span className={`text-lg font-mono font-extrabold leading-tight ${isDark ? "text-white" : "text-slate-800"}`}>{value}</span>
      {progress !== undefined && (
        <div className="mt-1 flex items-center gap-1">
          <div className={`flex-1 h-1 rounded-full overflow-hidden ${isDark ? "bg-white/[0.06]" : "bg-slate-200/60"}`}>
            <div className={`h-full rounded-full bg-gradient-to-r ${progressColor || "from-sky-400 to-blue-500"}`} style={{ width: `${progress}%` }} />
          </div>
          <span className={`text-[9px] font-mono font-bold ${color}`}>{progress}%</span>
        </div>
      )}
    </div>
  );
}
