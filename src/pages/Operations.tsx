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
  const [carouselStep, setCarouselStep] = useState(0);
  const [activeTab, setActiveTab] = useState(0);
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

  // Active country for tab
  const activeCountry = selectedCountries[activeTab] || selectedCountries[0];
  const activeCountryCode = activeCountry?.code || "";

  const { data: selectedPartner } = usePartner(selectedPartnerId || "");

  const toggleCountry = useCallback((code: string, name: string) => {
    setSelectedCountries(prev =>
      prev.some(c => c.code === code) ? prev.filter(c => c.code !== code) : [...prev, { code, name }]
    );
  }, []);

  const removeCountry = useCallback((code: string) => {
    setSelectedCountries(prev => prev.filter(c => c.code !== code));
  }, []);

  const confirmSelection = useCallback(() => {
    if (selectedCountries.length > 0) {
      setCarouselStep(1);
      setActiveTab(0);
      setSelectedPartnerId(null);
    }
  }, [selectedCountries.length]);

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
                <button onClick={goBack} className={cn("p-1.5 rounded-lg transition-all", isDark ? "bg-white/[0.06] hover:bg-white/[0.12] text-slate-300" : "bg-slate-100 hover:bg-slate-200 text-slate-600")}>
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
              <h1 className={`text-sm font-semibold ${th.h1}`}>Operations</h1>

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
              <div className="flex flex-col gap-2 h-full animate-in fade-in slide-in-from-left-4 duration-200">
                {/* ── Compact Status Bar ── */}
                <div className={cn(
                  "flex items-center gap-1 px-2 py-1.5 rounded-xl border flex-shrink-0 overflow-x-auto",
                  isDark ? "bg-white/[0.03] backdrop-blur-xl border-white/[0.08]" : "bg-white/50 backdrop-blur-xl border-white/80 shadow-sm"
                )}>
                  {globalStats ? (
                    <>
                      <ChipStat icon={Globe} label="Paesi" value={globalStats.scannedCountries} isDark={isDark} color={isDark ? "text-sky-400" : "text-sky-500"} onClick={() => setFilterMode("all")} active={filterMode === "all"} />
                      <ChipStat icon={Users} label="Partner" value={globalStats.totalPartners.toLocaleString()} isDark={isDark} color={isDark ? "text-emerald-400" : "text-emerald-500"} onClick={() => setFilterMode("todo")} active={filterMode === "todo"} />
                      <ChipStat icon={FileText} label="Profili" value={globalStats.withProfile.toLocaleString()} isDark={isDark} color={isDark ? "text-violet-400" : "text-violet-500"} onClick={() => setFilterMode("no_profile")} active={filterMode === "no_profile"}
                        pct={globalStats.totalPartners > 0 ? Math.round((globalStats.withProfile / globalStats.totalPartners) * 100) : 0} />
                      <ChipStat icon={Mail} label="Email" value={globalStats.withEmail.toLocaleString()} isDark={isDark} color={isDark ? "text-sky-400" : "text-sky-500"}
                        pct={globalStats.totalPartners > 0 ? Math.round((globalStats.withEmail / globalStats.totalPartners) * 100) : 0} />
                      <ChipStat icon={Phone} label="Tel" value={globalStats.withPhone.toLocaleString()} isDark={isDark} color={isDark ? "text-teal-400" : "text-teal-500"}
                        pct={globalStats.totalPartners > 0 ? Math.round((globalStats.withPhone / globalStats.totalPartners) * 100) : 0} />
                      <ChipStat icon={FolderDown} label="Directory" value={(globalStats.totalDirectory ?? 0).toLocaleString()} isDark={isDark} color={isDark ? "text-amber-400" : "text-amber-500"} onClick={() => setFilterMode("missing")} active={filterMode === "missing"} />
                    </>
                  ) : (
                    Array.from({ length: 6 }).map((_, i) => (
                      <Skeleton key={i} className={`h-8 w-24 rounded-lg ${isDark ? "bg-white/[0.06]" : ""}`} />
                    ))
                  )}

                  {/* Spacer + selection confirm */}
                  <div className="ml-auto flex items-center gap-2 flex-shrink-0 pl-2">
                    {selectedCountries.length > 0 && (
                      <>
                        <div className="flex items-center gap-0.5">
                          {selectedCountries.slice(0, 6).map(c => (
                            <span key={c.code} className="text-sm leading-none">{getCountryFlag(c.code)}</span>
                          ))}
                          {selectedCountries.length > 6 && (
                            <span className={`text-[10px] font-bold ml-0.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>+{selectedCountries.length - 6}</span>
                          )}
                        </div>
                        <button onClick={confirmSelection} className={cn("px-3 py-1.5 rounded-lg font-bold text-xs transition-all duration-200 hover:scale-[1.02] active:scale-[0.97] whitespace-nowrap", isDark ? "bg-sky-500 hover:bg-sky-400 text-white shadow-lg shadow-sky-500/25" : "bg-sky-500 hover:bg-sky-600 text-white shadow-lg shadow-sky-500/30")}>
                          Conferma →
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* ── Country Grid + Job monitors ── */}
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

            {/* ═══ STEP 1: Tab per Paese + 2 Colonne Fisse ═══ */}
            {carouselStep === 1 && (
              <div className="flex flex-col gap-2 h-full animate-in fade-in slide-in-from-right-4 duration-200 overflow-hidden">
                {/* Country Tab Bar */}
                {selectedCountries.length > 1 && (
                  <div className="flex items-center gap-1 flex-shrink-0 overflow-x-auto pb-1">
                    {selectedCountries.map((c, idx) => (
                      <button
                        key={c.code}
                        onClick={() => { setActiveTab(idx); setSelectedPartnerId(null); }}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 border",
                          idx === activeTab
                            ? isDark ? "bg-sky-500/20 border-sky-400/40 text-sky-300" : "bg-sky-100 border-sky-300 text-sky-700"
                            : isDark ? "bg-white/[0.03] border-white/[0.06] text-slate-400 hover:bg-white/[0.06]" : "bg-white/60 border-slate-200 text-slate-500 hover:bg-white"
                        )}
                      >
                        {getCountryFlag(c.code)} {c.name}
                      </button>
                    ))}
                  </div>
                )}

                {/* 2-column layout */}
                <div className="flex gap-3 flex-1 min-h-0 overflow-hidden">
                  {/* LEFT: Partner List (~58%) */}
                  <div className="w-[58%] flex-shrink-0 min-h-0 flex flex-col gap-2">
                    <ActiveJobBar />
                    <div className={cn(
                      "flex-1 min-h-0 rounded-2xl border overflow-hidden",
                      isDark ? "bg-white/[0.02] backdrop-blur-xl border-white/[0.08]" : "bg-white/40 backdrop-blur-xl border-white/80 shadow-sm"
                    )}>
                      <PartnerListPanel
                        countryCode={activeCountryCode}
                        countryName={activeCountry?.name || ""}
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

                  {/* RIGHT: Detail Panel (~42%) */}
                  <div className={cn(
                    "flex-1 min-w-0 min-h-0 rounded-2xl border overflow-hidden",
                    isDark ? "bg-white/[0.02] backdrop-blur-xl border-white/[0.08]" : "bg-white/40 backdrop-blur-xl border-white/80 shadow-sm"
                  )}>
                    {selectedPartnerId && selectedPartner ? (
                      <div className="h-full overflow-auto animate-in fade-in duration-200">
                        <PartnerDetailCompact
                          partner={selectedPartner}
                          onBack={() => setSelectedPartnerId(null)}
                          onToggleFavorite={() => toggleFavorite.mutate({ id: selectedPartner.id, isFavorite: !selectedPartner.is_favorite })}
                          isDark={isDark}
                        />
                      </div>
                    ) : (
                      <div className="h-full flex items-center justify-center">
                        <div className="text-center space-y-3 px-6">
                          <div className={cn("w-14 h-14 rounded-2xl mx-auto flex items-center justify-center", isDark ? "bg-white/[0.06]" : "bg-slate-100")}>
                            <Users className={`w-7 h-7 ${isDark ? "text-white/20" : "text-slate-300"}`} />
                          </div>
                          <div>
                            <p className={`text-sm font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>Seleziona un partner</p>
                            <p className={`text-xs mt-1 ${isDark ? "text-slate-600" : "text-slate-400"}`}>Clicca su un partner dalla lista per vederne i dettagli</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <AiAssistantDialog open={aiOpen} onClose={() => setAiOpen(false)} context={{ selectedCountries, filterMode }} />
    </ThemeCtx.Provider>
  );
}

/* ── Horizontal Chip Stat ── */
function ChipStat({ icon: Icon, label, value, color, isDark, pct, onClick, active }: {
  icon: any; label: string; value: string | number; color: string; isDark: boolean;
  pct?: number; onClick?: () => void; active?: boolean;
}) {
  const isClickable = !!onClick;
  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all duration-150 whitespace-nowrap flex-shrink-0",
        active
          ? isDark ? "bg-sky-950/40 border-sky-400/40 ring-1 ring-sky-400/20" : "bg-sky-50/80 border-sky-400 ring-1 ring-sky-300/40"
          : isDark ? "bg-white/[0.03] border-white/[0.06]" : "bg-white/40 border-slate-200/60",
        isClickable ? "cursor-pointer hover:scale-[1.02]" : "",
        isClickable && !active ? (isDark ? "hover:bg-white/[0.06]" : "hover:bg-white/60") : ""
      )}
    >
      <Icon className={`w-3.5 h-3.5 ${color} flex-shrink-0`} />
      <span className={isDark ? "text-slate-400" : "text-slate-500"}>{label}</span>
      <span className={`font-mono font-extrabold ${isDark ? "text-white" : "text-slate-800"}`}>{value}</span>
      {pct !== undefined && (
        <span className={`text-[10px] font-mono font-bold ${color}`}>{pct}%</span>
      )}
    </div>
  );
}
